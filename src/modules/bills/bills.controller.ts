import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
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
  BillReceiptService,
  type MemoryReceiptFile,
} from './bill-receipt.service';
import { BILL_RECEIPT_MAX_BYTES } from './bill-receipt.constants';
import {
  CreateWorkspaceBillDto,
  PayWorkspaceBillDto,
  UpdateWorkspaceBillDto,
} from './dto/workspace-bill.dto';
import { ListBillsQueryDto } from './dto/list-bills-query.dto';

function attachmentDisposition(fileName: string): string {
  const raw = fileName.replace(/[\r\n"]/g, '_');
  const ascii = raw.replace(/[^\x20-\x7E]/g, '_');
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(raw)}`;
}

@ApiTags('Contas a pagar')
@ApiBearerAuth()
@Controller('bills')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillsController {
  constructor(
    private readonly billsService: BillsService,
    private readonly billsAlertDigest: BillsAlertDigestService,
    private readonly billReceiptService: BillReceiptService,
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

  @Post(':id/receipt-session')
  async createReceiptSession(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const workspaceId = await this.ws(user, req);
    return this.billReceiptService.createSession(workspaceId, id);
  }

  @Post(':id/receipt')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: BILL_RECEIPT_MAX_BYTES },
    }),
  )
  async uploadReceipt(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
    @UploadedFile() file: MemoryReceiptFile | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Envie uma imagem no campo «file».');
    }
    const workspaceId = await this.ws(user, req);
    return this.billReceiptService.uploadAuthenticated(workspaceId, id, file);
  }

  @Get(':id/receipt')
  async downloadReceipt(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<StreamableFile> {
    const workspaceId = await this.ws(user, req);
    const { stream, mimeType, fileName } =
      await this.billReceiptService.openReceiptStream(workspaceId, id);
    return new StreamableFile(stream, {
      type: mimeType,
      disposition: attachmentDisposition(fileName),
    });
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

/** Rotas públicas da sessão QR (câmera no celular). */
@ApiTags('Contas a pagar — comprovante')
@Controller('bills')
export class BillReceiptPublicController {
  constructor(private readonly billReceiptService: BillReceiptService) {}

  @Get('receipt-session/:token')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  getSession(@Param('token') token: string) {
    return this.billReceiptService.getSessionStatus(token);
  }

  @Post('receipt-session/:token/upload')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: BILL_RECEIPT_MAX_BYTES },
    }),
  )
  uploadSession(
    @Param('token') token: string,
    @UploadedFile() file: MemoryReceiptFile | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('Envie uma imagem no campo «file».');
    }
    return this.billReceiptService.uploadViaSession(token, file);
  }
}
