import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../../database/entities/transaction.entity';
import { LedgerType } from '../../common/enums/ledger-type.enum';
import { RecurringSeriesService } from '../recurring/recurring-series.service';
import { getMonthDateBounds } from '../../common/utils/recurring-period';

export interface CategoryBreakdownRow {
  categoryId: string;
  categoryName: string;
  type: LedgerType;
  total: string;
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    private readonly recurringSeriesService: RecurringSeriesService,
  ) {}

  private resolveYearMonth(year?: number, month?: number) {
    if (
      year !== undefined &&
      month !== undefined &&
      Number.isFinite(year) &&
      Number.isFinite(month)
    ) {
      return { year, month };
    }
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
  }

  async summary(
    workspaceId: string,
    year?: number,
    month?: number,
  ) {
    const ym = this.resolveYearMonth(year, month);
    const { start, end } = getMonthDateBounds(ym.year, ym.month);

    const incomeSingles = await this.txRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amount::numeric), 0)', 'total')
      .where('t.workspaceId = :workspaceId', { workspaceId })
      .andWhere('t.type = :type', { type: LedgerType.INCOME })
      .andWhere('t.date >= :ds', { ds: start })
      .andWhere('t.date <= :de', { de: end })
      .getRawOne<{ total: string }>();

    const expenseSingles = await this.txRepo
      .createQueryBuilder('t')
      .select('COALESCE(SUM(t.amount::numeric), 0)', 'total')
      .where('t.workspaceId = :workspaceId', { workspaceId })
      .andWhere('t.type = :type', { type: LedgerType.EXPENSE })
      .andWhere('t.date >= :ds', { ds: start })
      .andWhere('t.date <= :de', { de: end })
      .getRawOne<{ total: string }>();

    const allSeries =
      await this.recurringSeriesService.loadAllForWorkspace(workspaceId);
    const recInc = this.recurringSeriesService.sumRecurringInMonth(
      allSeries,
      ym.year,
      ym.month,
      LedgerType.INCOME,
    );
    const recExp = this.recurringSeriesService.sumRecurringInMonth(
      allSeries,
      ym.year,
      ym.month,
      LedgerType.EXPENSE,
    );

    const totalIncome = (
      parseFloat(incomeSingles?.total ?? '0') + recInc
    ).toFixed(2);
    const totalExpense = (
      parseFloat(expenseSingles?.total ?? '0') + recExp
    ).toFixed(2);
    const balance = (
      parseFloat(totalIncome) - parseFloat(totalExpense)
    ).toFixed(2);

    const singlesRows = await this.txRepo
      .createQueryBuilder('t')
      .select('t.categoryId', 'categoryId')
      .addSelect('c.name', 'categoryName')
      .addSelect('c.type', 'type')
      .addSelect('SUM(t.amount::numeric)', 'total')
      .innerJoin('t.category', 'c')
      .where('t.workspaceId = :workspaceId', { workspaceId })
      .andWhere('t.date >= :ds', { ds: start })
      .andWhere('t.date <= :de', { de: end })
      .groupBy('t.categoryId')
      .addGroupBy('c.name')
      .addGroupBy('c.type')
      .getRawMany();

    const byMap = new Map<
      string,
      { categoryName: string; type: LedgerType; total: number }
    >();
    for (const row of singlesRows) {
      byMap.set(row.categoryId as string, {
        categoryName: row.categoryName as string,
        type: row.type as LedgerType,
        total: parseFloat(String(row.total)),
      });
    }

    const recAgg = this.recurringSeriesService.mergeCategoryTotalsFromRecurring(
      allSeries,
      ym.year,
      ym.month,
    );
    for (const [catId, v] of recAgg) {
      const prev = byMap.get(catId);
      if (prev) {
        prev.total += v.total;
      } else {
        byMap.set(catId, {
          categoryName: v.name,
          type: v.type,
          total: v.total,
        });
      }
    }

    const breakdown: CategoryBreakdownRow[] = [...byMap.entries()]
      .map(([categoryId, v]) => ({
        categoryId,
        categoryName: v.categoryName,
        type: v.type,
        total: v.total.toFixed(2),
      }))
      .sort((a, b) =>
        a.categoryName.localeCompare(b.categoryName, 'pt-BR'),
      );

    return {
      year: ym.year,
      month: ym.month,
      totalIncome,
      totalExpense,
      balance,
      byCategory: breakdown,
      singlesIncomeTotal: incomeSingles?.total ?? '0',
      singlesExpenseTotal: expenseSingles?.total ?? '0',
      recurringIncomeTotal: recInc.toFixed(2),
      recurringExpenseTotal: recExp.toFixed(2),
    };
  }
}
