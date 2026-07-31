import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../database/entities/user.entity';
import { UserRole } from '../common/enums/user-role.enum';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.exemptLegacyAccounts();
    await this.syncManagerFlags();

    const count = await this.userRepo.count({
      where: { role: UserRole.MASTER },
    });
    if (count > 0) {
      return;
    }
    const email = (
      this.config.get<string>('MASTER_EMAIL') ?? 'master@finance.app'
    ).toLowerCase();
    const password =
      this.config.get<string>('MASTER_PASSWORD') ?? 'Master@123456';
    const name =
      this.config.get<string>('MASTER_NAME') ?? 'Administrador Master';
    const hashed = await bcrypt.hash(password, 10);
    await this.userRepo.save(
      this.userRepo.create({
        name,
        email,
        password: hashed,
        role: UserRole.MASTER,
        workspaceId: null,
        isActive: true,
        // Conta do dono da plataforma: usa o sistema sem licença paga.
        licenseExempt: true,
        // Primeira conta da instalação: é o dono da plataforma.
        isManager: true,
      }),
    );
    this.logger.log(`Seed: usuário MASTER criado (${email})`);
  }

  /**
   * Liga a flag de gestão para os e-mails de MANAGER_EMAILS (a remoção é
   * manual no banco, para não desligar acesso por descuido no .env).
   */
  private async syncManagerFlags(): Promise<void> {
    const emails = (this.config.get<string>('MANAGER_EMAILS') ?? '')
      .split(/[,;]+/g)
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    if (!emails.length) {
      return;
    }
    const result = await this.userRepo
      .createQueryBuilder()
      .update(User)
      .set({ isManager: true })
      .where('LOWER(email) IN (:...emails)', { emails })
      .andWhere('is_manager = false')
      .execute();
    if (result.affected) {
      this.logger.log(
        `Gestão: ${result.affected} conta(s) marcada(s) como manager via MANAGER_EMAILS.`,
      );
    }
  }

  /**
   * Contas criadas antes da licença ficam isentas: todo cadastro novo grava
   * `trial_ends_at`, então a ausência desse campo identifica o legado.
   */
  private async exemptLegacyAccounts(): Promise<void> {
    const result = await this.userRepo
      .createQueryBuilder()
      .update(User)
      .set({ licenseExempt: true })
      .where('license_exempt = false')
      .andWhere('role = :role', { role: UserRole.MASTER })
      .andWhere('trial_ends_at IS NULL')
      .andWhere('subscription_ends_at IS NULL')
      .andWhere('stripe_customer_id IS NULL')
      .execute();
    if (result.affected) {
      this.logger.log(
        `Licença: ${result.affected} conta(s) anterior(es) ao plano marcada(s) como isenta(s).`,
      );
    }
  }
}
