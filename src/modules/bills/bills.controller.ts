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
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { WorkspaceAccessService } from '../../common/services/workspace-access.service';
import { BillsService } from './bills.service';
import { BillsAlertDigestService } from './bills-alert-digest.service';
import {
  CreateWorkspaceBillDto,
  PayWorkspaceBillDto,
  UpdateWorkspaceBillDto,
} from './dto/workspace-bill.dto';
import { ListBillsQueryDto } from './dto/list-bills-query.dto';

@Controller('bills')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillsController {
  constructor(
    private readonly billsService: BillsService,
    private readonly billsAlertDigest: BillsAlertDigestService,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  private async ws(user: JwtPayload, req: Request) {
    return this.workspaceAccess.resolveWorkspaceId(user, req.headers);
  }

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Query() query: ListBillsQueryDto,
  ) {
    const workspaceId = await this.ws(user, req);
    return this.billsService.list(workspaceId, query);
  }

  @Get('alerts')
  async alerts(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    const workspaceId = await this.ws(user, req);
    return this.billsService.getAlerts(workspaceId);
  }

  /** Dispara agora o digest diário (mesmo e-mail do cron das 8h). */
  @Post('alerts/email-digest')
  @Roles(UserRole.MASTER)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  sendEmailDigest() {
    return this.billsAlertDigest.runDigest({ force: true });
  }

  @Post()
  @Roles(UserRole.MASTER)
  async create(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Body() dto: CreateWorkspaceBillDto,
  ) {
    const workspaceId = await this.ws(user, req);
    return this.billsService.create(workspaceId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.MASTER)
  async update(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceBillDto,
  ) {
    const workspaceId = await this.ws(user, req);
    return this.billsService.update(workspaceId, id, dto);
  }

  @Patch(':id/pay')
  async pay(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: PayWorkspaceBillDto,
  ) {
    const workspaceId = await this.ws(user, req);
    return this.billsService.pay(workspaceId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MASTER)
  async remove(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const workspaceId = await this.ws(user, req);
    await this.billsService.remove(workspaceId, id);
  }
}
