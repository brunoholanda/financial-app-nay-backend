import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { basename, extname } from 'path';
import type { Readable } from 'stream';
import { Brackets, Repository } from 'typeorm';
import {
  buildDocumentObjectKey,
  isR2ObjectKey,
  R2_OBJECT_KEY_SQL,
} from '../../common/storage/document-object-key';
import {
  OBJECT_STORAGE,
  type ObjectStorage,
} from '../../common/storage/object-storage.types';
import { WorkspaceDocument } from '../../database/entities/workspace-document.entity';
import { applyQueryBuilderOrder } from '../../common/utils/list-sort';
import type { ListWorkspaceDocumentsQueryDto } from './dto/list-workspace-documents-query.dto';
import { DOCUMENT_SORT_FIELDS } from './dto/list-workspace-documents-query.dto';
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
export class WorkspaceDocumentsService implements OnModuleInit {
  private readonly logger = new Logger(WorkspaceDocumentsService.name);

  constructor(
    @InjectRepository(WorkspaceDocument)
    private readonly repo: Repository<WorkspaceDocument>,
    @Inject(OBJECT_STORAGE)
    private readonly storage: ObjectStorage,
  ) {}

  /** Remove metadados de arquivos antigos no disco local — só R2 permanece. */
  async onModuleInit(): Promise<void> {
    const result = await this.repo
      .createQueryBuilder()
      .delete()
      .from(WorkspaceDocument)
      .where(
        `stored_file_name NOT LIKE 'documentos/%' AND stored_file_name NOT LIKE 'comprovantes/%'`,
      )
      .execute();
    const removed = result.affected ?? 0;
    if (removed > 0) {
      this.logger.warn(
        `Removidos ${removed} documento(s) locais antigos do banco (apenas R2 é válido).`,
      );
    }
  }

  private assertR2Row(row: WorkspaceDocument): void {
    if (!isR2ObjectKey(row.storedFileName)) {
      throw new NotFoundException('Documento não encontrado');
    }
  }

  async list(
    workspaceId: string,
    query?: ListWorkspaceDocumentsQueryDto,
  ): Promise<WorkspaceDocument[]> {
    const qb = this.repo
      .createQueryBuilder('d')
      .where('d.workspaceId = :wid', { wid: workspaceId })
      .andWhere(R2_OBJECT_KEY_SQL);

    if (query?.scope) {
      qb.andWhere('d.personScope = :scope', { scope: query.scope });
    }
    if (query?.kind) {
      qb.andWhere('d.kind = :kind', { kind: query.kind });
    }
    if (query?.q?.trim()) {
      const term = `%${query.q.trim()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('d.description ILIKE :term', { term }).orWhere(
            'd.originalFileName ILIKE :term',
            { term },
          );
        }),
      );
    }
    const from = query?.createdFrom?.slice(0, 10);
    const to = query?.createdTo?.slice(0, 10);
    if (from) {
      qb.andWhere('d.createdAt >= :cf', { cf: `${from}T00:00:00.000Z` });
    }
    if (to) {
      qb.andWhere('d.createdAt <= :ct', { ct: `${to}T23:59:59.999Z` });
    }

    applyQueryBuilderOrder(
      qb,
      'd',
      query,
      DOCUMENT_SORT_FIELDS,
      'createdAt',
      'DESC',
    );
    return qb.getMany();
  }

  validateUploadFile(file: MemoryUploadedFile): void {
    if (!file?.buffer?.length || !file.size) {
      throw new BadRequestException('Arquivo em falta ou vazio.');
    }
    if (file.size > MAX_BYTES) {
      throw new BadRequestException('O arquivo excede o limite de 5 MB.');
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
    const fileName = `${randomUUID()}${ext}`;
    const objectKey = buildDocumentObjectKey(workspaceId, dto.kind, fileName);
    const mimeType = (file.mimetype || 'application/octet-stream').slice(
      0,
      200,
    );

    await this.storage.putObject(objectKey, file.buffer, mimeType);

    const safeName = basename(file.originalname || 'documento')
      .replace(/[\r\n"]/g, '')
      .slice(0, 512);

    const row = this.repo.create({
      workspaceId,
      kind: dto.kind,
      personScope: dto.personScope,
      description: dto.description?.trim() || null,
      originalFileName: safeName || `documento${ext}`,
      storedFileName: objectKey,
      mimeType,
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
    this.assertR2Row(row);
    if (dto.kind !== undefined) row.kind = dto.kind;
    if (dto.personScope !== undefined) row.personScope = dto.personScope;
    if (dto.description !== undefined) {
      row.description =
        dto.description === null ? null : dto.description.trim() || null;
    }
    return this.repo.save(row);
  }

  async remove(workspaceId: string, id: string): Promise<void> {
    const row = await this.repo.findOne({ where: { id, workspaceId } });
    if (!row) throw new NotFoundException('Documento não encontrado');
    this.assertR2Row(row);
    const key = row.storedFileName;
    await this.repo.remove(row);
    await this.storage.deleteObject(key);
  }

  async openDownloadStream(
    workspaceId: string,
    id: string,
  ): Promise<{
    stream: Readable;
    row: WorkspaceDocument;
  }> {
    const row = await this.repo.findOne({ where: { id, workspaceId } });
    if (!row) throw new NotFoundException('Documento não encontrado');
    this.assertR2Row(row);
    try {
      const stream = await this.storage.getObjectStream(row.storedFileName);
      return { stream, row };
    } catch {
      throw new NotFoundException('Arquivo não encontrado no armazenamento');
    }
  }
}
