import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import * as fs from 'fs/promises';
import { createReadStream, existsSync } from 'fs';
import { join, extname, basename } from 'path';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { WorkspaceDocument } from '../../database/entities/workspace-document.entity';
import {
  CreateWorkspaceDocumentDto,
  UpdateWorkspaceDocumentDto,
} from './dto/workspace-document.dto';

import { WORKSPACE_DOCUMENT_MAX_BYTES } from './workspace-documents.constants';

const MAX_BYTES = WORKSPACE_DOCUMENT_MAX_BYTES;

/** Alinhado ao arquivo recebido pelo multer em memória */
export type MemoryUploadedFile = {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const ALLOWED_EXT = new Set([
  '.pdf',
  '.zip',
  '.rar',
  '.7z',
  '.doc',
  '.docx',
  '.xls',
  '.xlsx',
  '.ppt',
  '.pptx',
  '.odt',
  '.ods',
  '.txt',
  '.csv',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
]);

@Injectable()
export class WorkspaceDocumentsService {
  constructor(
    @InjectRepository(WorkspaceDocument)
    private readonly repo: Repository<WorkspaceDocument>,
    private readonly config: ConfigService,
  ) {}

  private uploadRoot(): string {
    return (
      this.config.get<string>('DOCUMENTS_UPLOAD_DIR') ??
      join(process.cwd(), 'uploads')
    );
  }

  private resolveDir(workspaceId: string): string {
    return join(this.uploadRoot(), 'workspace-documents', workspaceId);
  }

  private fullPath(workspaceId: string, storedFileName: string): string {
    return join(this.resolveDir(workspaceId), storedFileName);
  }

  async list(workspaceId: string): Promise<WorkspaceDocument[]> {
    return this.repo.find({
      where: { workspaceId },
      order: { createdAt: 'DESC' },
    });
  }

  validateUploadFile(file: MemoryUploadedFile): void {
    if (!file?.buffer?.length || !file.size) {
      throw new BadRequestException('Arquivo em falta ou vazio.');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException(
        'O arquivo excede o limite de 5 MB.',
      );
    }
    const ext = extname(file.originalname || '').toLowerCase();
    if (!ext || !ALLOWED_EXT.has(ext)) {
      throw new BadRequestException(
        `Extensão não permitida. Use: ${[...ALLOWED_EXT].sort().join(', ')}`,
      );
    }
  }

  async create(
    workspaceId: string,
    file: MemoryUploadedFile,
    dto: CreateWorkspaceDocumentDto,
  ): Promise<WorkspaceDocument> {
    this.validateUploadFile(file);
    const ext = extname(file.originalname || '').toLowerCase();
    const storedFileName = `${randomUUID()}${ext}`;
    const dir = this.resolveDir(workspaceId);
    await fs.mkdir(dir, { recursive: true });
    const full = this.fullPath(workspaceId, storedFileName);
    await fs.writeFile(full, file.buffer);

    const safeName = basename(file.originalname || 'documento')
      .replace(/[\r\n"]/g, '')
      .slice(0, 512);

    const row = this.repo.create({
      workspaceId,
      kind: dto.kind,
      description: dto.description?.trim() || null,
      originalFileName: safeName || `documento${ext}`,
      storedFileName,
      mimeType: (file.mimetype || 'application/octet-stream').slice(0, 200),
      sizeBytes: file.size,
    });
    return this.repo.save(row);
  }

  async update(
    workspaceId: string,
    id: string,
    dto: UpdateWorkspaceDocumentDto,
  ): Promise<WorkspaceDocument> {
    const row = await this.repo.findOne({ where: { id, workspaceId } });
    if (!row) throw new NotFoundException('Documento não encontrado');
    if (dto.kind !== undefined) row.kind = dto.kind;
    if (dto.description !== undefined) {
      row.description =
        dto.description === null ? null : dto.description.trim() || null;
    }
    return this.repo.save(row);
  }

  async remove(workspaceId: string, id: string): Promise<void> {
    const row = await this.repo.findOne({ where: { id, workspaceId } });
    if (!row) throw new NotFoundException('Documento não encontrado');
    const full = this.fullPath(workspaceId, row.storedFileName);
    await this.repo.remove(row);
    try {
      await fs.unlink(full);
    } catch {
      /* arquivo já ausente */
    }
  }

  async openDownloadStream(workspaceId: string, id: string): Promise<{
    stream: ReturnType<typeof createReadStream>;
    row: WorkspaceDocument;
  }> {
    const row = await this.repo.findOne({ where: { id, workspaceId } });
    if (!row) throw new NotFoundException('Documento não encontrado');
    const full = this.fullPath(workspaceId, row.storedFileName);
    if (!existsSync(full)) {
      throw new NotFoundException('Arquivo não encontrado no armazenamento');
    }
    return { stream: createReadStream(full), row };
  }
}
