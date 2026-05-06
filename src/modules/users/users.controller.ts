import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CreateClientUserDto } from './dto/create-client-user.dto';
import { SetClientActiveDto } from './dto/set-client-active.dto';
import { WORKSPACE_HEADER } from '../../common/constants';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('clients')
  @Roles(UserRole.MASTER)
  createClient(
    @CurrentUser() master: JwtPayload,
    @Body() dto: CreateClientUserDto,
  ) {
    return this.usersService.createClient(master.sub, dto);
  }

  @Get()
  @Roles(UserRole.MASTER)
  async listForWorkspace(
    @CurrentUser() master: JwtPayload,
    @Req() req: Request,
  ) {
    const raw = req.headers[WORKSPACE_HEADER];
    const workspaceId =
      typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
    if (!workspaceId) {
      throw new BadRequestException(
        `Header ${WORKSPACE_HEADER} is required`,
      );
    }
    return this.usersService.listByWorkspace(master.sub, workspaceId);
  }

  @Patch('clients/:id/active')
  @Roles(UserRole.MASTER)
  setClientActive(
    @CurrentUser() master: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: SetClientActiveDto,
  ) {
    const raw = req.headers[WORKSPACE_HEADER];
    const workspaceId =
      typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : undefined;
    if (!workspaceId) {
      throw new BadRequestException(
        `Header ${WORKSPACE_HEADER} is required`,
      );
    }
    return this.usersService.setClientActive(
      master.sub,
      workspaceId,
      id,
      dto.isActive,
    );
  }
}
