import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { Workspace } from '../../database/entities/workspace.entity';
import { WorkspaceDocument } from '../../database/entities/workspace-document.entity';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { PlanTier } from '../../common/enums/plan-tier.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { SubscriptionAccessService } from '../../common/services/subscription-access.service';
import { DocumentQuotaService } from '../../common/services/document-quota.service';
import { BillingInvoice, BillingService } from '../billing/billing.service';
import { TicketsService } from '../tickets/tickets.service';
import { ListUsersQueryDto, UpdateManagedUserDto } from './dto/manager.dto';

const DAY_MS = 86_400_000;

export type ManagedUserLicense = {
  status: SubscriptionStatus;
  planTier: PlanTier;
  licenseExempt: boolean;
  hasAccess: boolean;
  inTrial: boolean;
  trialEndsAt: string | null;
  subscriptionEndsAt: string | null;
  daysLeft: number | null;
  monthlyCents: number | null;
};

export type ManagedUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  isManager: boolean;
  createdAt: string;
  workspaceId: string | null;
  workspaceName: string | null;
  /** Titular que responde pela licença (nulo quando é o próprio usuário). */
  ownerName: string | null;
  ownerEmail: string | null;
  hasStripe: boolean;
  license: ManagedUserLicense;
};

export type ManagerOverview = {
  currency: string;
  users: {
    total: number;
    active: number;
    masters: number;
    clients: number;
    managers: number;
    signupsLast30: number;
  };
  licenses: {
    trialing: number;
    active: number;
    pastDue: number;
    canceled: number;
    exempt: number;
    /** Titulares sem acesso: teste vencido ou pagamento em atraso. */
    blocked: number;
  };
  revenue: {
    mrrCents: number;
    payingStandard: number;
    payingPremium: number;
  };
  tickets: { open: number; waitingManager: number; total: number };
  trialsEndingSoon: Array<{
    id: string;
    name: string;
    email: string;
    trialEndsAt: string | null;
    daysLeft: number;
  }>;
  workspaces: number;
  documents: number;
};

export type ManagedUserDetail = ManagedUser & {
  documentsUsed: number;
  documentLimit: number | null;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  workspaces: Array<{ id: string; name: string; businessType: string }>;
  clients: Array<{
    id: string;
    name: string;
    email: string;
    isActive: boolean;
  }>;
  invoices: BillingInvoice[];
};

export type ManagerPayments = {
  currency: string;
  paymentConfigured: boolean;
  mrrCents: number;
  accounts: ManagedUser[];
};

/**
 * Área de gestão da plataforma: visão geral, contas, chamados e pagamentos.
 * Só acessível a usuários com a flag de gestão (ver ManagerGuard).
 */
@Injectable()
export class ManagerService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>,
    @InjectRepository(WorkspaceDocument)
    private readonly documentRepo: Repository<WorkspaceDocument>,
    private readonly access: SubscriptionAccessService,
    private readonly documentQuota: DocumentQuotaService,
    private readonly billing: BillingService,
    private readonly tickets: TicketsService,
  ) {}

  async overview(): Promise<ManagerOverview> {
    const [users, workspaces, documents, ticketStats] = await Promise.all([
      this.userRepo.find(),
      this.workspaceRepo.count(),
      this.documentRepo.count(),
      this.tickets.managerStats(),
    ]);

    const masters = users.filter((u) => u.role === UserRole.MASTER);
    const since = Date.now() - 30 * DAY_MS;
    const licenses = {
      trialing: 0,
      active: 0,
      pastDue: 0,
      canceled: 0,
      exempt: 0,
      blocked: 0,
    };
    let mrrCents = 0;
    let payingStandard = 0;
    let payingPremium = 0;
    const trialsEndingSoon: ManagerOverview['trialsEndingSoon'] = [];

    for (const master of masters) {
      if (master.licenseExempt) {
        licenses.exempt += 1;
        continue;
      }
      const license = this.licenseOf(master);
      switch (master.subscriptionStatus) {
        case SubscriptionStatus.TRIALING:
          licenses.trialing += 1;
          break;
        case SubscriptionStatus.ACTIVE:
          licenses.active += 1;
          break;
        case SubscriptionStatus.PAST_DUE:
          licenses.pastDue += 1;
          break;
        default:
          licenses.canceled += 1;
          break;
      }
      if (!license.hasAccess) {
        licenses.blocked += 1;
      }
      if (
        master.subscriptionStatus === SubscriptionStatus.ACTIVE &&
        license.hasAccess
      ) {
        mrrCents += this.access.priceCentsFor(master.planTier);
        if (master.planTier === PlanTier.PREMIUM) payingPremium += 1;
        else payingStandard += 1;
      }
      if (
        license.inTrial &&
        license.hasAccess &&
        (license.daysLeft ?? 99) <= 5
      ) {
        trialsEndingSoon.push({
          id: master.id,
          name: master.name,
          email: master.email,
          trialEndsAt: license.trialEndsAt,
          daysLeft: license.daysLeft ?? 0,
        });
      }
    }

    trialsEndingSoon.sort((a, b) => a.daysLeft - b.daysLeft);

    return {
      currency: this.access.currency,
      users: {
        total: users.length,
        active: users.filter((u) => u.isActive).length,
        masters: masters.length,
        clients: users.length - masters.length,
        managers: users.filter((u) => u.isManager).length,
        signupsLast30: users.filter((u) => u.createdAt.getTime() >= since)
          .length,
      },
      licenses,
      revenue: { mrrCents, payingStandard, payingPremium },
      tickets: ticketStats,
      trialsEndingSoon: trialsEndingSoon.slice(0, 8),
      workspaces,
      documents,
    };
  }

  async listUsers(query?: ListUsersQueryDto): Promise<ManagedUser[]> {
    const qb = this.userRepo
      .createQueryBuilder('u')
      .leftJoinAndSelect('u.workspace', 'workspace')
      .orderBy('u.createdAt', 'DESC');

    if (query?.q?.trim()) {
      const term = `%${query.q.trim()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('u.name ILIKE :term', { term }).orWhere(
            'u.email ILIKE :term',
            { term },
          );
        }),
      );
    }
    if (query?.status) {
      qb.andWhere('u.subscriptionStatus = :status', { status: query.status });
    }
    if (query?.role) {
      qb.andWhere('u.role = :role', { role: query.role });
    }
    if (query?.planTier) {
      qb.andWhere('u.planTier = :planTier', { planTier: query.planTier });
    }
    if (query?.state) {
      qb.andWhere('u.isActive = :isActive', {
        isActive: query.state === 'active',
      });
    }

    const users = await qb.getMany();
    return this.decorateUsers(users);
  }

  async getUser(id: string): Promise<ManagedUserDetail> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: { workspace: true },
    });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    const [base] = await this.decorateUsers([user]);
    const owner = await this.licenseOwnerOf(user);
    const workspaces = await this.workspaceRepo.find({
      where: { createdById: user.id },
      order: { createdAt: 'ASC' },
    });
    const clients = workspaces.length
      ? await this.userRepo.find({
          where: {
            role: UserRole.USER,
            workspaceId: In(workspaces.map((w) => w.id)),
          },
          order: { name: 'ASC' },
        })
      : [];
    const quota = owner
      ? await this.documentQuota.describeForOwner(owner)
      : null;

    return {
      ...base,
      documentsUsed: quota?.used ?? 0,
      documentLimit: quota?.limit ?? null,
      stripeCustomerId: user.stripeCustomerId,
      stripeSubscriptionId: user.stripeSubscriptionId,
      workspaces: workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        businessType: w.businessType,
      })),
      clients: clients.map((c) => ({
        id: c.id,
        name: c.name,
        email: c.email,
        isActive: c.isActive,
      })),
      invoices: owner ? await this.billing.listInvoicesForUser(owner.id) : [],
    };
  }

  /** Ajustes manuais de conta: acesso, isenção, plano, teste e cortesia. */
  async updateUser(
    managerId: string,
    id: string,
    dto: UpdateManagedUserDto,
  ): Promise<ManagedUserDetail> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    if (id === managerId && dto.isManager === false) {
      throw new BadRequestException(
        'Você não pode remover seu próprio acesso de gestão.',
      );
    }
    if (id === managerId && dto.isActive === false) {
      throw new BadRequestException(
        'Você não pode desativar sua própria conta.',
      );
    }

    if (dto.isActive !== undefined) user.isActive = dto.isActive;
    if (dto.isManager !== undefined) user.isManager = dto.isManager;
    if (dto.licenseExempt !== undefined) user.licenseExempt = dto.licenseExempt;
    if (dto.planTier) user.planTier = dto.planTier;

    if (dto.extendTrialDays) {
      const from =
        user.trialEndsAt && user.trialEndsAt.getTime() > Date.now()
          ? user.trialEndsAt.getTime()
          : Date.now();
      user.trialEndsAt = new Date(from + dto.extendTrialDays * DAY_MS);
      user.subscriptionStatus = SubscriptionStatus.TRIALING;
    }
    if (dto.grantAccessDays) {
      const from =
        user.subscriptionEndsAt &&
        user.subscriptionEndsAt.getTime() > Date.now()
          ? user.subscriptionEndsAt.getTime()
          : Date.now();
      user.subscriptionEndsAt = new Date(from + dto.grantAccessDays * DAY_MS);
      user.subscriptionStatus = SubscriptionStatus.ACTIVE;
    }

    await this.userRepo.save(user);
    this.access.invalidate(user.id);
    return this.getUser(user.id);
  }

  async payments(query?: ListUsersQueryDto): Promise<ManagerPayments> {
    const accounts = await this.listUsers({
      ...query,
      role: UserRole.MASTER,
    });
    const mrrCents = accounts.reduce(
      (sum, account) =>
        account.license.status === SubscriptionStatus.ACTIVE &&
        account.license.hasAccess &&
        !account.license.licenseExempt
          ? sum + (account.license.monthlyCents ?? 0)
          : sum,
      0,
    );
    return {
      currency: this.access.currency,
      paymentConfigured: this.billing.isConfigured(),
      mrrCents,
      accounts,
    };
  }

  async invoices(userId: string): Promise<BillingInvoice[]> {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    const owner = await this.licenseOwnerOf(user);
    return owner ? this.billing.listInvoicesForUser(owner.id) : [];
  }

  /** Reconsulta o Stripe para a conta e regrava a licença. */
  async syncUser(userId: string): Promise<ManagedUserDetail> {
    await this.billing.syncUserById(userId);
    this.access.invalidate(userId);
    return this.getUser(userId);
  }

  async reconcileAll(): Promise<{
    checked: number;
    updated: number;
    failed: number;
  }> {
    const result = await this.billing.reconcileSubscriptions();
    this.access.invalidate();
    return result;
  }

  /* ---------------- apoio ---------------- */

  private async decorateUsers(users: User[]): Promise<ManagedUser[]> {
    const clientWorkspaceIds = users
      .filter((u) => u.role !== UserRole.MASTER && u.workspaceId)
      .map((u) => u.workspaceId as string);

    const owners = new Map<string, User>();
    if (clientWorkspaceIds.length) {
      const workspaces = await this.workspaceRepo.find({
        where: { id: In([...new Set(clientWorkspaceIds)]) },
      });
      const ownerIds = [...new Set(workspaces.map((w) => w.createdById))];
      const ownerUsers = ownerIds.length
        ? await this.userRepo.find({ where: { id: In(ownerIds) } })
        : [];
      const byId = new Map(ownerUsers.map((o) => [o.id, o]));
      for (const workspace of workspaces) {
        const owner = byId.get(workspace.createdById);
        if (owner) owners.set(workspace.id, owner);
      }
    }

    return users.map((user) => {
      const owner =
        user.role === UserRole.MASTER
          ? user
          : ((user.workspaceId ? owners.get(user.workspaceId) : null) ?? null);
      const managedByOwner = Boolean(owner && owner.id !== user.id);
      return {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        isManager: user.isManager,
        createdAt: user.createdAt.toISOString(),
        workspaceId: user.workspaceId,
        workspaceName: user.workspace?.name ?? null,
        ownerName: managedByOwner ? (owner?.name ?? null) : null,
        ownerEmail: managedByOwner ? (owner?.email ?? null) : null,
        hasStripe: Boolean(owner?.stripeCustomerId),
        license: this.licenseOf(owner),
      };
    });
  }

  private async licenseOwnerOf(user: User): Promise<User | null> {
    if (user.role === UserRole.MASTER) return user;
    if (!user.workspaceId) return null;
    const workspace = await this.workspaceRepo.findOne({
      where: { id: user.workspaceId },
    });
    if (!workspace) return null;
    return this.userRepo.findOne({ where: { id: workspace.createdById } });
  }

  private licenseOf(owner: User | null): ManagedUserLicense {
    if (!owner) {
      return {
        status: SubscriptionStatus.EXPIRED,
        planTier: PlanTier.STANDARD,
        licenseExempt: false,
        hasAccess: false,
        inTrial: false,
        trialEndsAt: null,
        subscriptionEndsAt: null,
        daysLeft: 0,
        monthlyCents: null,
      };
    }
    if (owner.licenseExempt) {
      return {
        status: SubscriptionStatus.ACTIVE,
        planTier: PlanTier.PREMIUM,
        licenseExempt: true,
        hasAccess: true,
        inTrial: false,
        trialEndsAt: null,
        subscriptionEndsAt: null,
        daysLeft: null,
        monthlyCents: null,
      };
    }
    const status = owner.subscriptionStatus ?? SubscriptionStatus.TRIALING;
    const inTrial = status === SubscriptionStatus.TRIALING;
    const validUntil = inTrial ? owner.trialEndsAt : owner.subscriptionEndsAt;
    const remaining = validUntil ? validUntil.getTime() - Date.now() : 0;
    return {
      status,
      planTier: owner.planTier ?? PlanTier.STANDARD,
      licenseExempt: false,
      hasAccess: remaining > 0,
      inTrial,
      trialEndsAt: owner.trialEndsAt?.toISOString() ?? null,
      subscriptionEndsAt: owner.subscriptionEndsAt?.toISOString() ?? null,
      daysLeft: remaining > 0 ? Math.ceil(remaining / DAY_MS) : 0,
      monthlyCents: this.access.priceCentsFor(
        owner.planTier ?? PlanTier.STANDARD,
      ),
    };
  }
}
