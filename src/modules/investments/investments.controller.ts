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
import type { Request } from 'express';
import { InvestmentsService } from './investments.service';
import { InvestmentAnalyticsService } from './investment-analytics.service';
import { CreateInvestmentDto } from './dto/create-investment.dto';
import { UpdateInvestmentDto } from './dto/update-investment.dto';
import { ListInvestmentsQueryDto } from './dto/list-investments-query.dto';
import { CreateInvestmentCashflowDto } from './dto/investment-cashflow.dto';
import { CreateYieldHistoryDto } from './dto/yield-history.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { WorkspaceAccessService } from '../../common/services/workspace-access.service';

@Controller('investments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InvestmentsController {
  constructor(
    private readonly investmentsService: InvestmentsService,
    private readonly analyticsService: InvestmentAnalyticsService,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  @Get('analytics/summary')
  async analyticsSummary(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
  ) {
    const workspaceId = await this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers as Record<string, string | string[] | undefined>,
    );
    return this.analyticsService.getSummary(workspaceId);
  }

  @Post()
  @Roles(UserRole.MASTER)
  async create(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Body() dto: CreateInvestmentDto,
  ) {
    const workspaceId = await this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers as Record<string, string | string[] | undefined>,
    );
    return this.investmentsService.createInvestment(workspaceId, dto);
  }

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Query() query: ListInvestmentsQueryDto,
  ) {
    const workspaceId = await this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers as Record<string, string | string[] | undefined>,
    );
    return this.investmentsService.getUserInvestments(workspaceId, query);
  }

  @Get(':id')
  async findOne(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const workspaceId = await this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers as Record<string, string | string[] | undefined>,
    );
    return this.investmentsService.getInvestmentById(workspaceId, id);
  }

  @Patch(':id')
  @Roles(UserRole.MASTER)
  async patch(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateInvestmentDto,
  ) {
    const workspaceId = await this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers as Record<string, string | string[] | undefined>,
    );
    return this.investmentsService.updateInvestment(workspaceId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MASTER)
  async remove(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const workspaceId = await this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers as Record<string, string | string[] | undefined>,
    );
    return this.investmentsService.deleteInvestment(workspaceId, id);
  }

  @Post(':id/cashflows')
  @Roles(UserRole.MASTER)
  async addCashflow(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CreateInvestmentCashflowDto,
  ) {
    const workspaceId = await this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers as Record<string, string | string[] | undefined>,
    );
    return this.investmentsService.addCashflow(workspaceId, id, dto);
  }

  @Get(':id/cashflows')
  async listCashflows(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const workspaceId = await this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers as Record<string, string | string[] | undefined>,
    );
    return this.investmentsService.listCashflows(workspaceId, id);
  }

  @Post(':id/yield-points')
  @Roles(UserRole.MASTER)
  async addYieldPoint(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: CreateYieldHistoryDto,
  ) {
    const workspaceId = await this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers as Record<string, string | string[] | undefined>,
    );
    return this.investmentsService.addYieldPoint(workspaceId, id, dto);
  }

  @Get(':id/yield-points')
  async listYieldPoints(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const workspaceId = await this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers as Record<string, string | string[] | undefined>,
    );
    return this.investmentsService.listYieldHistory(workspaceId, id);
  }

  @Get(':id/analytics/yield-daily')
  async yieldDaily(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const workspaceId = await this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers as Record<string, string | string[] | undefined>,
    );
    return this.analyticsService.calculateDailyYield(
      workspaceId,
      id,
      from,
      to,
    );
  }

  @Get(':id/analytics/yield-monthly')
  async yieldMonthly(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const workspaceId = await this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers as Record<string, string | string[] | undefined>,
    );
    return this.analyticsService.calculateMonthlyYield(
      workspaceId,
      id,
      from,
      to,
    );
  }
}
