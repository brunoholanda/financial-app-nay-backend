import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { WorkspaceAccessService } from '../../common/services/workspace-access.service';
import { MonthlyQueryDto } from '../recurring/dto/recurring.dto';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  @Get('summary')
  async summary(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Query() q: MonthlyQueryDto,
  ) {
    const workspaceId = await this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers as Record<string, string | string[] | undefined>,
    );
    return this.dashboardService.summary(
      workspaceId,
      q.year,
      q.month,
    );
  }
}
