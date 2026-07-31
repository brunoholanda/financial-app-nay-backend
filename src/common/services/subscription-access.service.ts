import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../database/entities/user.entity';
import { Workspace } from '../../database/entities/workspace.entity';
import { SubscriptionStatus } from '../enums/subscription-status.enum';
import { PlanTier } from '../enums/plan-tier.enum';
import { UserRole } from '../enums/user-role.enum';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

const DEFAULT_TRIAL_DAYS = 15;
const DEFAULT_PRICE_CENTS = 4900;
const DEFAULT_PREMIUM_EXTRA_CENTS = 2900;
const DEFAULT_DOCUMENT_LIMIT = 10;
const CACHE_TTL_MS = 20_000;
const DAY_MS = 86_400_000;

export type SubscriptionAccess = {
  status: SubscriptionStatus;
  /** Se false, as rotas do app respondem 402 até a licença ser regularizada. */
  hasAccess: boolean;
  licenseExempt: boolean;
  inTrial: boolean;
  trialEndsAt: string | null;
  /** Fim do período pago (ou do prazo restante após cancelar). */
  currentPeriodEnd: string | null;
  /** Dias inteiros restantes de acesso; null quando isento. */
  daysLeft: number | null;
  trialDays: number;
  priceCents: number;
  currency: string;
  /** Plano em vigor na conta que paga a licença. */
  planTier: PlanTier;
  /** Adicional mensal do Premium sobre o plano padrão. */
  premiumExtraCents: number;
  /** Valor mensal total do Premium (padrão + adicional). */
  premiumPriceCents: number;
  /** Teto de documentos do plano padrão. */
  standardDocumentLimit: number;
  /** Teto de documentos do plano em vigor; null quando é sem limite. */
  documentLimit: number | null;
  /** true para clientes: quem contrata a licença é o MASTER dono do espaço. */
  managedByOwner: boolean;
  ownerName: string | null;
  ownerEmail: string | null;
};

/**
 * Fonte única da verdade sobre o direito de uso: teste grátis, licença paga
 * e herança do acesso dos clientes a partir do MASTER dono do espaço.
 */
@Injectable()
export class SubscriptionAccessService {
  private readonly cache = new Map<
    string,
    { access: SubscriptionAccess; expiresAtMs: number }
  >();

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>,
    private readonly config: ConfigService,
  ) {}

  get trialDays(): number {
    return this.readInt('BILLING_TRIAL_DAYS', DEFAULT_TRIAL_DAYS);
  }

  get priceCents(): number {
    return this.readInt('BILLING_PRICE_CENTS', DEFAULT_PRICE_CENTS);
  }

  get premiumExtraCents(): number {
    return this.readInt(
      'BILLING_PREMIUM_EXTRA_CENTS',
      DEFAULT_PREMIUM_EXTRA_CENTS,
    );
  }

  get premiumPriceCents(): number {
    return this.priceCents + this.premiumExtraCents;
  }

  /** Documentos inclusos no plano padrão. */
  get standardDocumentLimit(): number {
    return this.readInt('BILLING_DOCUMENT_LIMIT', DEFAULT_DOCUMENT_LIMIT);
  }

  get currency(): string {
    return (this.config.get<string>('BILLING_CURRENCY') ?? 'BRL').toUpperCase();
  }

  priceCentsFor(tier: PlanTier): number {
    return tier === PlanTier.PREMIUM ? this.premiumPriceCents : this.priceCents;
  }

  documentLimitFor(tier: PlanTier): number | null {
    return tier === PlanTier.PREMIUM ? null : this.standardDocumentLimit;
  }

  /** Marca o início do teste grátis (não persiste; quem chama salva). */
  applyTrial(user: User): User {
    user.subscriptionStatus = SubscriptionStatus.TRIALING;
    user.trialEndsAt = new Date(Date.now() + this.trialDays * DAY_MS);
    user.subscriptionEndsAt = null;
    return user;
  }

  async describeForJwt(payload: JwtPayload): Promise<SubscriptionAccess> {
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) {
      return this.describe(null, false);
    }
    return this.describeForUser(user);
  }

  async describeForUser(user: User): Promise<SubscriptionAccess> {
    if (user.role === UserRole.MASTER) {
      return this.describe(user, false);
    }
    const owner = await this.resolveOwner(user);
    return this.describe(owner ?? user, Boolean(owner));
  }

  /** Versão com cache curto, usada no caminho quente das requisições. */
  async hasAccess(payload: JwtPayload): Promise<boolean> {
    const cached = this.cache.get(payload.sub);
    if (cached && cached.expiresAtMs > Date.now()) {
      return cached.access.hasAccess;
    }
    const access = await this.describeForJwt(payload);
    this.cache.set(payload.sub, {
      access,
      expiresAtMs: Date.now() + this.cacheTtlFor(access),
    });
    return access.hasAccess;
  }

  invalidate(userId?: string): void {
    if (userId) {
      this.cache.delete(userId);
      return;
    }
    this.cache.clear();
  }

  /**
   * Conta que responde pela licença (e pelo limite de documentos): o próprio
   * usuário quando MASTER, ou o MASTER dono do espaço quando cliente.
   */
  async resolveLicenseOwner(payload: JwtPayload): Promise<User | null> {
    const user = await this.userRepo.findOne({ where: { id: payload.sub } });
    if (!user) return null;
    if (user.role === UserRole.MASTER) return user;
    return this.resolveOwner(user);
  }

  /** MASTER dono do espaço do cliente — é quem paga a licença. */
  private async resolveOwner(clientUser: User): Promise<User | null> {
    if (!clientUser.workspaceId) return null;
    const workspace = await this.workspaceRepo.findOne({
      where: { id: clientUser.workspaceId },
    });
    if (!workspace) return null;
    return this.userRepo.findOne({ where: { id: workspace.createdById } });
  }

  private describe(
    owner: User | null,
    managedByOwner: boolean,
  ): SubscriptionAccess {
    const planTier =
      owner?.licenseExempt || owner?.planTier === PlanTier.PREMIUM
        ? PlanTier.PREMIUM
        : PlanTier.STANDARD;

    const base = {
      trialDays: this.trialDays,
      priceCents: this.priceCents,
      currency: this.currency,
      planTier,
      premiumExtraCents: this.premiumExtraCents,
      premiumPriceCents: this.premiumPriceCents,
      standardDocumentLimit: this.standardDocumentLimit,
      documentLimit: this.documentLimitFor(planTier),
      managedByOwner,
      ownerName: managedByOwner ? (owner?.name ?? null) : null,
      ownerEmail: managedByOwner ? (owner?.email ?? null) : null,
    };

    if (!owner) {
      return {
        ...base,
        status: SubscriptionStatus.EXPIRED,
        hasAccess: false,
        licenseExempt: false,
        inTrial: false,
        trialEndsAt: null,
        currentPeriodEnd: null,
        daysLeft: 0,
      };
    }

    if (owner.licenseExempt) {
      return {
        ...base,
        status: SubscriptionStatus.ACTIVE,
        hasAccess: true,
        licenseExempt: true,
        inTrial: false,
        trialEndsAt: null,
        currentPeriodEnd: null,
        daysLeft: null,
      };
    }

    const status = owner.subscriptionStatus ?? SubscriptionStatus.TRIALING;
    const inTrial = status === SubscriptionStatus.TRIALING;
    const validUntil = inTrial ? owner.trialEndsAt : owner.subscriptionEndsAt;
    const hasAccess = Boolean(validUntil && validUntil.getTime() > Date.now());

    return {
      ...base,
      status,
      hasAccess,
      licenseExempt: false,
      inTrial,
      trialEndsAt: owner.trialEndsAt?.toISOString() ?? null,
      currentPeriodEnd: owner.subscriptionEndsAt?.toISOString() ?? null,
      daysLeft: this.daysLeft(validUntil),
    };
  }

  private daysLeft(validUntil: Date | null): number {
    if (!validUntil) return 0;
    const diff = validUntil.getTime() - Date.now();
    return diff <= 0 ? 0 : Math.ceil(diff / DAY_MS);
  }

  /** O cache nunca vive além da virada do acesso (fim do teste / do período). */
  private cacheTtlFor(access: SubscriptionAccess): number {
    const boundary = access.inTrial
      ? access.trialEndsAt
      : access.currentPeriodEnd;
    if (!boundary) return CACHE_TTL_MS;
    const remaining = new Date(boundary).getTime() - Date.now();
    if (remaining <= 0) return CACHE_TTL_MS;
    return Math.min(CACHE_TTL_MS, remaining);
  }

  private readInt(key: string, fallback: number): number {
    const parsed = Number.parseInt(this.config.get<string>(key) ?? '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
