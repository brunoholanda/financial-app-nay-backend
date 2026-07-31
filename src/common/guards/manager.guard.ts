import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { User } from '../../database/entities/user.entity';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Área de gestão da plataforma. A permissão vem da flag `is_manager` no banco
 * (não do token), então ligar ou desligar o acesso vale na hora.
 */
@Injectable()
export class ManagerGuard implements CanActivate {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: JwtPayload }>();
    const userId = req.user?.sub;
    if (!userId) {
      throw new ForbiddenException('Área restrita à gestão da plataforma.');
    }
    const user = await this.userRepo.findOne({
      where: { id: userId },
      select: ['id', 'isManager', 'isActive'],
    });
    if (!user?.isManager || !user.isActive) {
      throw new ForbiddenException('Área restrita à gestão da plataforma.');
    }
    return true;
  }
}
