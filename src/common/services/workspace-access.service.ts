import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WORKSPACE_HEADER } from '../constants';
import { UserRole } from '../enums/user-role.enum';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { Workspace } from '../../database/entities/workspace.entity';

@Injectable()
export class WorkspaceAccessService {
  constructor(
    @InjectRepository(Workspace)
    private readonly workspaceRepo: Repository<Workspace>,
  ) {}

  async resolveWorkspaceId(
    user: JwtPayload,
    headers: Record<string, string | string[] | undefined>,
  ): Promise<string> {
    if (user.role === UserRole.USER) {
      if (!user.workspaceId) {
        throw new ForbiddenException('User is not assigned to a workspace');
      }
      return user.workspaceId;
    }

    const raw = headers[WORKSPACE_HEADER];
    const header =
      typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
    if (!header) {
      throw new BadRequestException(
        `Header ${WORKSPACE_HEADER} is required for master workspace context`,
      );
    }

    const ws = await this.workspaceRepo.findOne({
      where: { id: header, createdById: user.sub },
    });
    if (!ws) {
      throw new ForbiddenException('Workspace not found or not owned');
    }
    return ws.id;
  }
}
