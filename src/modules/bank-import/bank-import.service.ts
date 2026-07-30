import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Transaction } from '../../database/entities/transaction.entity';
import { PaymentSource } from '../../common/enums/payment-source.enum';
import { LedgerType } from '../../common/enums/ledger-type.enum';
import { CategoriesService } from '../categories/categories.service';
import { WorkspaceAccountsService } from '../workspace-accounts/workspace-accounts.service';
import { parseOfxBuffer } from './ofx-parser';
import { parseCsvBuffer } from './csv-parser';
import type { ConfirmOfxImportDto } from './dto/confirm-ofx-import.dto';

export type MemoryUploadedFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const IMPORT_MAX_BYTES = 2 * 1024 * 1024;

@Injectable()
export class BankImportService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    private readonly categoriesService: CategoriesService,
    private readonly workspaceAccounts: WorkspaceAccountsService,
  ) {}

  private assertImportFile(file: MemoryUploadedFile): '.ofx' | '.qfx' | '.csv' {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Envie um arquivo no campo «file».');
    }
    if (file.size > IMPORT_MAX_BYTES) {
      throw new BadRequestException('Arquivo excede 2 MB.');
    }
    const name = (file.originalname || '').toLowerCase();
    const dot = name.lastIndexOf('.');
    const ext = dot >= 0 ? name.slice(dot) : '';
    if (ext === '.ofx' || ext === '.qfx' || ext === '.csv') {
      return ext;
    }
    throw new BadRequestException(
      'Envie um arquivo .ofx, .qfx ou .csv.',
    );
  }

  private parseFile(file: MemoryUploadedFile) {
    const ext = this.assertImportFile(file);
    if (ext === '.csv') {
      return parseCsvBuffer(file.buffer);
    }
    return parseOfxBuffer(file.buffer);
  }

  private async existingFitIds(
    workspaceId: string,
    workspaceAccountId: string,
    fitIds: string[],
  ): Promise<Set<string>> {
    if (fitIds.length === 0) return new Set();
    const unique = [...new Set(fitIds)];
    const chunkSize = 500;
    const found = new Set<string>();
    for (let i = 0; i < unique.length; i += chunkSize) {
      const chunk = unique.slice(i, i + chunkSize);
      const rows = await this.txRepo.find({
        where: {
          workspaceId,
          workspaceAccountId,
          bankFitId: In(chunk),
        },
        select: { bankFitId: true },
      });
      for (const r of rows) {
        if (r.bankFitId) found.add(r.bankFitId);
      }
    }
    return found;
  }

  async preview(
    workspaceId: string,
    workspaceAccountId: string,
    file: MemoryUploadedFile,
  ) {
    await this.workspaceAccounts.assertAccountInWorkspace(
      workspaceId,
      workspaceAccountId,
    );
    const parsed = this.parseFile(file);
    const existing = await this.existingFitIds(
      workspaceId,
      workspaceAccountId,
      parsed.map((p) => p.fitId),
    );
    return {
      workspaceAccountId,
      rows: parsed.map((p) => ({
        fitId: p.fitId,
        date: p.date,
        amount: p.amount,
        type: p.type,
        title: p.title,
        description: p.description,
        isDuplicate: existing.has(p.fitId),
      })),
    };
  }

  async confirm(workspaceId: string, dto: ConfirmOfxImportDto) {
    await this.workspaceAccounts.assertAccountInWorkspace(
      workspaceId,
      dto.workspaceAccountId,
    );

    const fitIds = dto.items.map((i) => i.fitId);
    const existing = await this.existingFitIds(
      workspaceId,
      dto.workspaceAccountId,
      fitIds,
    );

    let imported = 0;
    let skippedDuplicate = 0;
    let failed = 0;
    const errors: { fitId: string; message: string }[] = [];

    // Validate categories once per unique id
    const categoryCache = new Map<
      string,
      { id: string; type: LedgerType }
    >();

    for (const item of dto.items) {
      if (existing.has(item.fitId)) {
        skippedDuplicate += 1;
        continue;
      }

      try {
        let cat = categoryCache.get(item.categoryId);
        if (!cat) {
          const full = await this.categoriesService.findOneInWorkspace(
            workspaceId,
            item.categoryId,
          );
          cat = { id: full.id, type: full.type };
          categoryCache.set(item.categoryId, cat);
        }
        if (cat.type !== item.type) {
          throw new BadRequestException(
            'Categoria não corresponde ao tipo da movimentação',
          );
        }

        const title = item.title.trim();
        if (title.length < 2) {
          throw new BadRequestException('Título inválido');
        }

        const amount = Math.round(item.amount * 100) / 100;
        const entity = this.txRepo.create({
          title,
          amount: amount.toFixed(2),
          type: item.type,
          categoryId: item.categoryId,
          workspaceId,
          paymentSource: PaymentSource.ACCOUNT,
          workspaceAccountId: dto.workspaceAccountId,
          date: item.date.slice(0, 10),
          description: item.description?.trim() || null,
          bankFitId: item.fitId.slice(0, 128),
        });
        await this.txRepo.save(entity);
        existing.add(item.fitId);
        imported += 1;
      } catch (err) {
        failed += 1;
        const message =
          err instanceof Error ? err.message : 'Falha ao importar linha';
        errors.push({ fitId: item.fitId, message });
      }
    }

    return { imported, skippedDuplicate, failed, errors };
  }
}
