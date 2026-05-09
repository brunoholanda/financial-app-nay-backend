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
  WorkspaceDocumentsService,
  type MemoryUploadedFile,
} from './workspace-documents.service';
import {
  CreateWorkspaceDocumentDto,
  UpdateWorkspaceDocumentDto,
} from './dto/workspace-document.dto';
import { ListWorkspaceDocumentsQueryDto } from './dto/list-workspace-documents-query.dto';
import { WORKSPACE_DOCUMENT_MAX_BYTES } from './workspace-documents.constants';

function attachmentDisposition(fileName: string): string {
  const raw = fileName.replace(/[\r\n"]/g, '_');
  const ascii = raw.replace(/[^\x20-\x7E]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(raw)}`;
}

@Controller('documents')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WorkspaceDocumentsController {
  constructor(
    private readonly documentsService: WorkspaceDocumentsService,
    private readonly workspaceAccess: WorkspaceAccessService,
  ) {}

  private async ws(user: JwtPayload, req: Request) {
    return this.workspaceAccess.resolveWorkspaceId(
      user,
      req.headers as Record<string, string | string[] | undefined>,
    );
  }

  @Get()
  async list(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Query() query: ListWorkspaceDocumentsQueryDto,
  ) {
    const workspaceId = await this.ws(user, req);
    return this.documentsService.list(workspaceId, query);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: WORKSPACE_DOCUMENT_MAX_BYTES },
    }),
  )
  @Roles(UserRole.MASTER)
  async create(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @UploadedFile() file: MemoryUploadedFile | undefined,
    @Body() dto: CreateWorkspaceDocumentDto,
  ) {
    if (!file) {
      throw new BadRequestException('Envie um arquivo no campo «file».');
    }
    const workspaceId = await this.ws(user, req);
    return this.documentsService.create(workspaceId, file, dto);
  }

  @Get(':id/file')
  async download(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
  ): Promise<StreamableFile> {
    const workspaceId = await this.ws(user, req);
    const { stream, row } =
      await this.documentsService.openDownloadStream(workspaceId, id);
    return new StreamableFile(stream, {
      type: row.mimeType,
      disposition: attachmentDisposition(row.originalFileName),
    });
  }

  @Patch(':id')
  @Roles(UserRole.MASTER)
  async update(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDocumentDto,
  ) {
    const workspaceId = await this.ws(user, req);
    return this.documentsService.update(workspaceId, id, dto);
  }

  @Delete(':id')
  @Roles(UserRole.MASTER)
  async remove(
    @CurrentUser() user: JwtPayload,
    @Req() req: Request,
    @Param('id') id: string,
  ) {
    const workspaceId = await this.ws(user, req);
    await this.documentsService.remove(workspaceId, id);
  }
}
