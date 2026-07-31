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
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { WorkspaceAccessService } from '../../common/services/workspace-access.service';
import { InsurancesService } from './insurances.service';
import { InsurancesAlertDigestService } from './insurances-alert-digest.service';
import {
  CreateWorkspaceInsuranceDto,
  UpdateWorkspaceInsuranceDto,
} from './dto/workspace-insurance.dto';
import { ListInsurancesQueryDto } from './dto/list-insurances-query.dto';

@ApiTags('Seguros')
@ApiBearerAuth()
@Controller('insurances')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InsurancesController {
  constructor(
    private readonly insurancesService: InsurancesService,
    private readonly insurancesAlertDigest: InsurancesAlertDigestService,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  private async ws(user: JwtPayload, req: Request) {
    return this.workspaceAccess.resolveWorkspaceId(user, req.headers);
  }

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Query() query: ListInsurancesQueryDto,
  ) {
    const workspaceId = await this.ws(user, req);
    return this.insurancesService.list(workspaceId, query);
  }

  @Get('alerts')
  async alerts(@CurrentUser() user: JwtPayload, @Req() req: Request) {
    const workspaceId = await this.ws(user, req);
    return this.insurancesService.getAlerts(workspaceId);
  }

  /** Dispara agora o digest diário de seguros (mesmo e-mail do cron das 8h). */
  @Post('alerts/email-digest')
  @Roles(UserRole.MASTER)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  sendEmailDigest() {
    return this.insurancesAlertDigest.runDigest({ force: true });
  }

  @Post()
  @Roles(UserRole.MASTER)
  async create(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Body() dto: CreateWorkspaceInsuranceDto,
  ) {
    const workspaceId = await this.ws(user, req);
    return this.insurancesService.create(workspaceId, dto);
  }

  @Patch(':id')
  @Roles(UserRole.MASTER)
  async update(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceInsuranceDto,
  ) {
    const workspaceId = await this.ws(user, req);
    return this.insurancesService.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MASTER)
  async remove(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const workspaceId = await this.ws(user, req);
    await this.insurancesService.remove(workspaceId, id);
  }
}
