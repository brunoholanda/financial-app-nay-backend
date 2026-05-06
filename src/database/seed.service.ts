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
    const count = await this.userRepo.count({ where: { role: UserRole.MASTER } });
    if (count > 0) {
      return;
    }
    const email = (
      this.config.get<string>('MASTER_EMAIL') ?? 'master@finance.app'
    ).toLowerCase();
    const password = this.config.get<string>('MASTER_PASSWORD') ?? 'Master@123456';
    const name = this.config.get<string>('MASTER_NAME') ?? 'Administrador Master';
    const hashed = await bcrypt.hash(password, 10);
    await this.userRepo.save(
      this.userRepo.create({
        name,
        email,
        password: hashed,
        role: UserRole.MASTER,
        workspaceId: null,
        isActive: true,
      }),
    );
    this.logger.log(`Seed: usuário MASTER criado (${email})`);
  }
}
