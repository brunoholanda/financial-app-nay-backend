import {
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
import { RecurringSeriesService } from './recurring-series.service';
import {
  CancelRecurringSeriesDto,
  CreateRecurringSeriesDto,
  UpdateRecurringSeriesDto,
} from './dto/recurring.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { WorkspaceAccessService } from '../../common/services/workspace-access.service';

@Controller('recurring')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RecurringSeriesController {
  constructor(
    private readonly recurringSeries: RecurringSeriesService,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  @Post()
  @Roles(UserRole.MASTER)
  async create(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Body() dto: CreateRecurringSeriesDto,
  ) {
    const workspaceId = await this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers as Record<string, string | string[] | undefined>,
    );
    return this.recurringSeries.create(workspaceId, dto);
  }

  @Get()
  async list(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    const workspaceId = await this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers as Record<string, string | string[] | undefined>,
    );
    return this.recurringSeries.listAll(workspaceId);
  }

  @Patch(':id')
  @Roles(UserRole.MASTER)
  async update(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateRecurringSeriesDto,
  ) {
    const workspaceId = await this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers as Record<string, string | string[] | undefined>,
    );
    return this.recurringSeries.update(workspaceId, id, dto);
  }

  @Post(':id/cancel')
  @Roles(UserRole.MASTER)
  async cancel(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CancelRecurringSeriesDto,
  ) {
    const workspaceId = await this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers as Record<string, string | string[] | undefined>,
    );
    return this.recurringSeries.cancel(
      workspaceId,
      id,
      dto.cancellationReason,
    );
  }
}
