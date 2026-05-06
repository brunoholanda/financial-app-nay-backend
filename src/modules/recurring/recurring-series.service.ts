import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecurringSeries } from '../../database/entities/recurring-series.entity';
import { CategoriesService } from '../categories/categories.service';
import { WorkspaceAccountsService } from '../workspace-accounts/workspace-accounts.service';
import {
  CreateRecurringSeriesDto,
  UpdateRecurringSeriesDto,
} from './dto/recurring.dto';
import {
  computeEffectiveSeriesEnd,
  debitDateInCalendarMonth,
  seriesAppliesToMonth,
} from '../../common/utils/recurring-period';
import { LedgerType } from '../../common/enums/ledger-type.enum';
import { PaymentSource } from '../../common/enums/payment-source.enum';

export interface RecurringMonthItemDto {
  seriesId: string;
  title: string;
  amount: string;
  type: LedgerType;
  categoryId: string;
  categoryName?: string;
  startDate: string;
  endDate: string;
  effectiveEndDate: string;
  cancelledAt: string | null;
  paymentSource: PaymentSource;
  workspaceAccountId: string | null;
  accountName?: string | null;
  /** Data desta competência (ano/mês filtrados) conforme debitDayOfMonth. */
  debitDateInMonth: string;
}

@Injectable()
export class RecurringSeriesService {
  constructor(
    @InjectRepository(RecurringSeries)
    private readonly repo: Repository<RecurringSeries>,
    private readonly categoriesService: CategoriesService,
    private readonly workspaceAccounts: WorkspaceAccountsService,
  ) {}

  private assertDateOrder(start: string, end: string) {
    const a = start.slice(0, 10);
    const b = end.slice(0, 10);
    if (a > b) {
      throw new BadRequestException('startDate não pode ser maior que endDate');
    }
  }

  private async assertCategoryMatchesType(
    workspaceId: string,
    categoryId: string,
    type: LedgerType,
  ) {
    await this.categoriesService.assertCategoryInWorkspace(
      workspaceId,
      categoryId,
    );
    const cat = await this.categoriesService.findOneInWorkspace(
      workspaceId,
      categoryId,
    );
    if (cat.type !== type) {
      throw new BadRequestException(
        'Categoria não corresponde ao tipo (receita/despesa)',
      );
    }
  }

  private async enforcePaymentTarget(
    workspaceId: string,
    source: PaymentSource,
    accountId: string | null | undefined,
  ): Promise<{ workspaceAccountId: string | null }> {
    if (source === PaymentSource.CASH) {
      if (accountId) {
        throw new BadRequestException(
          'Para espécie (dinheiro) não informe conta bancária',
        );
      }
      return { workspaceAccountId: null };
    }
    if (!accountId) {
      throw new BadRequestException('Selecione a conta bancária');
    }
    await this.workspaceAccounts.assertAccountInWorkspace(
      workspaceId,
      accountId,
    );
    return { workspaceAccountId: accountId };
  }

  async create(workspaceId: string, dto: CreateRecurringSeriesDto) {
    this.assertDateOrder(dto.startDate, dto.endDate);
    await this.assertCategoryMatchesType(
      workspaceId,
      dto.categoryId,
      dto.type,
    );
    const pay = await this.enforcePaymentTarget(
      workspaceId,
      dto.paymentSource,
      dto.workspaceAccountId,
    );
    const row = this.repo.create({
      workspaceId,
      title: dto.title.trim(),
      amount: dto.amount.toFixed(2),
      type: dto.type,
      categoryId: dto.categoryId,
      paymentSource: dto.paymentSource,
      workspaceAccountId: pay.workspaceAccountId,
      startDate: dto.startDate.slice(0, 10),
      endDate: dto.endDate.slice(0, 10),
      debitDayOfMonth: dto.debitDayOfMonth,
      description: dto.description?.trim() ?? null,
    });
    const saved = await this.repo.save(row);
    return this.findOne(workspaceId, saved.id);
  }

  async findOne(workspaceId: string, id: string) {
    const s = await this.repo.findOne({
      where: { id, workspaceId },
      relations: { category: true, workspaceAccount: true },
    });
    if (!s) throw new NotFoundException('Série recorrente não encontrada');
    return s;
  }

  async listAll(workspaceId: string) {
    return this.repo.find({
      where: { workspaceId },
      relations: { category: true, workspaceAccount: true },
      order: { startDate: 'DESC', createdAt: 'DESC' },
    });
  }

  async loadAllForWorkspace(workspaceId: string) {
    return this.repo.find({
      where: { workspaceId },
      relations: { category: true, workspaceAccount: true },
    });
  }

  async update(
    workspaceId: string,
    id: string,
    dto: UpdateRecurringSeriesDto,
  ) {
    const s = await this.repo.findOne({ where: { id, workspaceId } });
    if (!s) throw new NotFoundException('Série recorrente não encontrada');
    if (s.cancelledAt) {
      throw new ForbiddenException('Série cancelada não pode ser editada');
    }
    const nextStart = dto.startDate?.slice(0, 10) ?? s.startDate;
    const nextEnd = dto.endDate?.slice(0, 10) ?? s.endDate;
    this.assertDateOrder(nextStart, nextEnd);
    const nextType = dto.type ?? s.type;
    const nextCat = dto.categoryId ?? s.categoryId;
    if (dto.categoryId !== undefined || dto.type !== undefined) {
      await this.assertCategoryMatchesType(workspaceId, nextCat, nextType);
    }

    const nextSource = dto.paymentSource ?? s.paymentSource;
    let accForEnforce: string | null | undefined;
    if (dto.paymentSource === PaymentSource.CASH) {
      accForEnforce = null;
    } else if (dto.workspaceAccountId !== undefined) {
      accForEnforce = dto.workspaceAccountId;
    } else {
      accForEnforce = s.workspaceAccountId ?? undefined;
    }
    const pay = await this.enforcePaymentTarget(
      workspaceId,
      nextSource,
      accForEnforce,
    );
    s.paymentSource = nextSource;
    s.workspaceAccountId = pay.workspaceAccountId;

    if (dto.title !== undefined) s.title = dto.title.trim();
    if (dto.amount !== undefined) s.amount = dto.amount.toFixed(2);
    if (dto.type !== undefined) s.type = dto.type;
    if (dto.categoryId !== undefined) s.categoryId = dto.categoryId;
    if (dto.startDate !== undefined) s.startDate = dto.startDate.slice(0, 10);
    if (dto.endDate !== undefined) s.endDate = dto.endDate.slice(0, 10);
    if (dto.debitDayOfMonth !== undefined) s.debitDayOfMonth = dto.debitDayOfMonth;
    if (dto.description !== undefined) {
      s.description = dto.description?.trim() ?? null;
    }
    await this.repo.save(s);
    return this.findOne(workspaceId, id);
  }

  async cancel(workspaceId: string, id: string, reason: string) {
    const s = await this.repo.findOne({ where: { id, workspaceId } });
    if (!s) throw new NotFoundException('Série recorrente não encontrada');
    if (s.cancelledAt) {
      throw new BadRequestException('Série já foi cancelada');
    }
    s.cancelledAt = new Date();
    s.cancellationReason = reason.trim();
    await this.repo.save(s);
    return this.findOne(workspaceId, id);
  }

  mapWorkspaceSeriesForMonth(
    rows: RecurringSeries[],
    year: number,
    month: number,
    filters?: { categoryId?: string; type?: LedgerType },
  ): RecurringMonthItemDto[] {
    const items: RecurringMonthItemDto[] = [];
    for (const row of rows) {
      const effEnd = computeEffectiveSeriesEnd(row.endDate, row.cancelledAt);
      if (
        !seriesAppliesToMonth({
          startDate: row.startDate,
          effectiveEndDate: effEnd,
          year,
          month,
        })
      ) {
        continue;
      }
      if (filters?.categoryId && row.categoryId !== filters.categoryId)
        continue;
      if (filters?.type && row.type !== filters.type) continue;

      items.push({
        seriesId: row.id,
        title: row.title,
        amount: row.amount,
        type: row.type,
        categoryId: row.categoryId,
        categoryName: row.category?.name,
        startDate: row.startDate,
        endDate: row.endDate,
        effectiveEndDate: effEnd,
        cancelledAt: row.cancelledAt
          ? new Date(row.cancelledAt).toISOString()
          : null,
        paymentSource: row.paymentSource,
        workspaceAccountId: row.workspaceAccountId,
        accountName: row.workspaceAccount?.name ?? null,
        debitDateInMonth: debitDateInCalendarMonth(
          year,
          month,
          row.debitDayOfMonth ?? 1,
        ),
      });
    }
    return items;
  }

  sumRecurringInMonth(
    rows: RecurringSeries[],
    year: number,
    month: number,
    ledgerType: LedgerType,
  ): number {
    let sum = 0;
    for (const row of rows) {
      if (row.type !== ledgerType) continue;
      const effEnd = computeEffectiveSeriesEnd(row.endDate, row.cancelledAt);
      if (
        seriesAppliesToMonth({
          startDate: row.startDate,
          effectiveEndDate: effEnd,
          year,
          month,
        })
      ) {
        sum += parseFloat(row.amount);
      }
    }
    return sum;
  }

  mergeCategoryTotalsFromRecurring(
    rows: RecurringSeries[],
    year: number,
    month: number,
  ): Map<string, { name: string; type: LedgerType; total: number }> {
    const map = new Map<
      string,
      { name: string; type: LedgerType; total: number }
    >();
    for (const row of rows) {
      const effEnd = computeEffectiveSeriesEnd(row.endDate, row.cancelledAt);
      if (
        !seriesAppliesToMonth({
          startDate: row.startDate,
          effectiveEndDate: effEnd,
          year,
          month,
        })
      ) {
        continue;
      }
      const key = row.categoryId;
      const prev = map.get(key);
      const add = parseFloat(row.amount);
      const name = row.category?.name ?? '?';
      if (prev) {
        prev.total += add;
      } else {
        map.set(key, { name, type: row.type, total: add });
      }
    }
    return map;
  }
}
