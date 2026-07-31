import {
  Injectable,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../database/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { CreateClientUserDto } from './dto/create-client-user.dto';
import {
  ListUsersQueryDto,
  USER_SORT_FIELDS,
} from './dto/list-users-query.dto';
import { Workspace } from '../../database/entities/workspace.entity';
import { resolveFindOrder } from '../../common/utils/list-sort';
import { SubscriptionAccessService } from '../../common/services/subscription-access.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>,
    private readonly subscriptionAccess: SubscriptionAccessService,
  ) {}

  findByEmailWithPassword(email: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { email: email.toLowerCase() } });
  }

  findById(id: string): Promise<User | null> {
    return this.userRepo.findOne({ where: { id } });
  }

  toPublicProfile(user: User) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      workspaceId: user.workspaceId,
      isActive: user.isActive,
      isManager: user.isManager === true,
      emailNotifyBills: user.emailNotifyBills !== false,
      emailNotifyInsurances: user.emailNotifyInsurances !== false,
    };
  }

  async updateNotificationPrefs(
    userId: string,
    prefs: {
      emailNotifyBills?: boolean;
      emailNotifyInsurances?: boolean;
    },
  ) {
    const user = await this.findById(userId);
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    if (prefs.emailNotifyBills !== undefined) {
      user.emailNotifyBills = prefs.emailNotifyBills;
    }
    if (prefs.emailNotifyInsurances !== undefined) {
      user.emailNotifyInsurances = prefs.emailNotifyInsurances;
    }
    const saved = await this.userRepo.save(user);
    return this.toPublicProfile(saved);
  }

  /**
   * Cadastro público: cria o MASTER com o teste grátis já iniciado e o primeiro
   * espaço de trabalho na mesma transação.
   */
  async createMasterAccount(input: {
    name: string;
    email: string;
    password: string;
    workspaceName: string;
    businessType?: string;
  }): Promise<{ user: User; workspace: Workspace }> {
    const email = input.email.toLowerCase().trim();
    const exists = await this.userRepo.exist({ where: { email } });
    if (exists) {
      throw new ConflictException('Este e-mail já está cadastrado.');
    }
    const hashed = await bcrypt.hash(input.password, 10);

    return this.userRepo.manager.transaction(async (manager) => {
      const users = manager.getRepository(User);
      const workspaces = manager.getRepository(Workspace);

      const user = this.subscriptionAccess.applyTrial(
        users.create({
          name: input.name.trim(),
          email,
          password: hashed,
          role: UserRole.MASTER,
          workspaceId: null,
          isActive: true,
          licenseExempt: false,
        }),
      );
      const savedUser = await users.save(user);

      const workspace = await workspaces.save(
        workspaces.create({
          name: input.workspaceName.trim(),
          businessType: input.businessType?.trim() || 'Geral',
          createdById: savedUser.id,
        }),
      );

      return { user: savedUser, workspace };
    });
  }

  async createClient(masterId: string, dto: CreateClientUserDto) {
    const workspace = await this.workspaceRepo.findOne({
      where: { id: dto.workspaceId, createdById: masterId },
    });
    if (!workspace) {
      throw new ForbiddenException('Workspace not found or not owned');
    }
    const email = dto.email.toLowerCase();
    const exists = await this.userRepo.exist({ where: { email } });
    if (exists) {
      throw new ConflictException('Email already registered');
    }
    const hashed = await bcrypt.hash(dto.password, 10);
    const entity = this.userRepo.create({
      name: dto.name,
      email,
      password: hashed,
      role: UserRole.USER,
      workspaceId: dto.workspaceId,
      isActive: true,
    });
    const saved = await this.userRepo.save(entity);
    return {
      id: saved.id,
      name: saved.name,
      email: saved.email,
      role: saved.role,
      workspaceId: saved.workspaceId,
      isActive: saved.isActive,
      createdAt: saved.createdAt,
    };
  }

  async listByWorkspace(
    masterId: string,
    workspaceId: string,
    query?: ListUsersQueryDto,
  ) {
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId, createdById: masterId },
    });
    if (!workspace) {
      throw new ForbiddenException('Workspace not found or not owned');
    }
    return this.userRepo.find({
      where: { workspaceId, role: UserRole.USER },
      select: [
        'id',
        'name',
        'email',
        'role',
        'workspaceId',
        'isActive',
        'createdAt',
      ],
      order: resolveFindOrder(query, USER_SORT_FIELDS, {
        createdAt: 'DESC',
      }),
    });
  }

  async setClientActive(
    masterId: string,
    workspaceId: string,
    clientUserId: string,
    isActive: boolean,
  ) {
    const workspace = await this.workspaceRepo.findOne({
      where: { id: workspaceId, createdById: masterId },
    });
    if (!workspace) {
      throw new ForbiddenException('Workspace not found or not owned');
    }
    const u = await this.userRepo.findOne({
      where: {
        id: clientUserId,
        workspaceId,
        role: UserRole.USER,
      },
    });
    if (!u) {
      throw new NotFoundException(
        'Usuário cliente não encontrado neste espaço',
      );
    }
    u.isActive = isActive;
    await this.userRepo.save(u);
    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      workspaceId: u.workspaceId,
      isActive: u.isActive,
      createdAt: u.createdAt,
    };
  }
}
