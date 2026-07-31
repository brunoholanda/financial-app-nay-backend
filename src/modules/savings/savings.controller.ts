import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { WorkspaceAccessService } from '../../common/services/workspace-access.service';
import { SavingsService } from './savings.service';
import {
  CreateSavingsEntryDto,
  UpdateSavingsEntryDto,
} from './dto/savings.dto';
import { ListSavingsQueryDto } from './dto/list-savings-query.dto';

@ApiTags('Economias')
@ApiBearerAuth()
@Controller('savings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SavingsController {
  constructor(
    private readonly savingsService: SavingsService,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  private async ws(user: JwtPayload, req: Request) {
    return this.workspaceAccess.resolveWorkspaceId(user, req.headers);
  }

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Query() query: ListSavingsQueryDto,
  ) {
    const workspaceId = await this.ws(user, req);
    return this.savingsService.list(workspaceId, query);
  }

  @Post()
  @Roles(UserRole.MASTER)
  async create(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Body() dto: CreateSavingsEntryDto,
  ) {
    const workspaceId = await this.ws(user, req);
    return this.savingsService.create(workspaceId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.MASTER)
  async update(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateSavingsEntryDto,
  ) {
    const workspaceId = await this.ws(user, req);
    return this.savingsService.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MASTER)
  async remove(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const workspaceId = await this.ws(user, req);
    await this.savingsService.remove(workspaceId, id);
  }
}
