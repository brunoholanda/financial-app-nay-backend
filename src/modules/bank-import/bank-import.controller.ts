import {
  BadRequestException,
  Body,
  Controller,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { WorkspaceAccessService } from '../../common/services/workspace-access.service';
import {
  BankImportService,
  type MemoryUploadedFile,
} from './bank-import.service';
import { PreviewOfxImportDto } from './dto/preview-ofx-import.dto';
import { ConfirmOfxImportDto } from './dto/confirm-ofx-import.dto';

const OFX_MAX_BYTES = 2 * 1024 * 1024;

@Controller('bank-import')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.MASTER)
export class BankImportController {
  constructor(
    private readonly bankImport: BankImportService,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  private async ws(user: JwtPayload, req: Request) {
    return this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers as Record<string, string | string[] | undefined>,
    );
  }

  @Post('preview')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: OFX_MAX_BYTES },
    }),
  )
  async preview(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @UploadedFile() file: MemoryUploadedFile | undefined,
    @Body() dto: PreviewOfxImportDto,
  ) {
    if (!file) {
      throw new BadRequestException('Envie um arquivo no campo «file».');
    }
    const workspaceId = await this.ws(user, req);
    return this.bankImport.preview(workspaceId, dto.workspaceAccountId, file);
  }

  @Post('confirm')
  async confirm(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Body() dto: ConfirmOfxImportDto,
  ) {
    const workspaceId = await this.ws(user, req);
    return this.bankImport.confirm(workspaceId, dto);
  }
}
