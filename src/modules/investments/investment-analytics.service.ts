import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Investment } from '../../database/entities/investment.entity';
import { YieldHistory } from '../../database/entities/yield-history.entity';
import { InvestmentInstrumentType } from '../../common/enums/investment-instrument.enum';
import { InvestmentPortfolioCategory } from '../../common/enums/investment-portfolio-category.enum';

export interface InvestmentAnalyticsSummary {
  totalInvested: string;
  totalCurrent: string;
  profitLoss: string;
  profitLossPercent: number | null;
  byAccount: {
    accountId: string;
    accountName: string;
    invested: string;
    current: string;
  }[];
  byCategory: {
    category: InvestmentPortfolioCategory;
    invested: string;
    current: string;
  }[];
  byType: {
    type: InvestmentInstrumentType;
    invested: string;
    current: string;
  }[];
}

@Injectable()
export class InvestmentAnalyticsService {
  constructor(
    @InjectRepository(Investment)
    private readonly invRepo: Repository<Investment>,
    @InjectRepository(YieldHistory)
    private readonly yieldRepo: Repository<YieldHistory>,
  ) {}

  async getSummary(workspaceId: string): Promise<InvestmentAnalyticsSummary> {
    const list = await this.invRepo.find({
      where: { workspaceId },
      relations: { workspaceAccount: true },
    });

    let sumInv = 0;
    let sumCur = 0;
    const byAccountMap = new Map<
      string,
      {
        accountId: string;
        accountName: string;
        invested: number;
        current: number;
      }
    >();
    const byCategoryMap = new Map<
      InvestmentPortfolioCategory,
      { invested: number; current: number }
    >();
    const byTypeMap = new Map<
      InvestmentInstrumentType,
      { invested: number; current: number }
    >();

    for (const i of list) {
      const inv = Number.parseFloat(i.investedAmount);
      const cur = Number.parseFloat(i.currentAmount);
      sumInv += inv;
      sumCur += cur;

      const accId = i.workspaceAccountId;
      const accName = i.workspaceAccount?.name ?? 'Conta';
      const prevA = byAccountMap.get(accId) ?? {
        accountId: accId,
        accountName: accName,
        invested: 0,
        current: 0,
      };
      prevA.invested += inv;
      prevA.current += cur;
      byAccountMap.set(accId, prevA);

      const prevC = byCategoryMap.get(i.category) ?? {
        invested: 0,
        current: 0,
      };
      prevC.invested += inv;
      prevC.current += cur;
      byCategoryMap.set(i.category, prevC);

      const prevT = byTypeMap.get(i.instrumentType) ?? {
        invested: 0,
        current: 0,
      };
      prevT.invested += inv;
      prevT.current += cur;
      byTypeMap.set(i.instrumentType, prevT);
    }

    const profit = sumCur - sumInv;
    const profitPct =
      sumInv > 0 ? Math.round((profit / sumInv) * 10000) / 100 : null;

    const toStr = (n: number) => n.toFixed(2);

    return {
      totalInvested: toStr(sumInv),
      totalCurrent: toStr(sumCur),
      profitLoss: toStr(profit),
      profitLossPercent: profitPct,
      byAccount: [...byAccountMap.values()].map((x) => ({
        accountId: x.accountId,
        accountName: x.accountName,
        invested: toStr(x.invested),
        current: toStr(x.current),
      })),
      byCategory: [...byCategoryMap.entries()].map(([category, v]) => ({
        category,
        invested: toStr(v.invested),
        current: toStr(v.current),
      })),
      byType: [...byTypeMap.entries()].map(([type, v]) => ({
        type,
        invested: toStr(v.invested),
        current: toStr(v.current),
      })),
    };
  }

  /** Série diária registrada em `yield_history` (útil para evolução da posição). */
  async calculateDailyYield(
    workspaceId: string,
    investmentId: string,
    from?: string,
    to?: string,
  ) {
    await this.assertInvestment(workspaceId, investmentId);
    const rows = await this.yieldRepo.find({
      where: { investmentId },
      order: { date: 'ASC', createdAt: 'ASC' },
    });
    let out = rows;
    if (from) out = out.filter((r) => r.date >= from);
    if (to) out = out.filter((r) => r.date <= to);
    return out.map((r) => ({
      date: r.date,
      value: r.value,
      dailyYield: r.dailyYield,
    }));
  }

  /** Agrega `daily_yield` numérico por mês (YYYY-MM) quando informado. */
  async calculateMonthlyYield(
    workspaceId: string,
    investmentId: string,
    from?: string,
    to?: string,
  ) {
    const daily = await this.calculateDailyYield(
      workspaceId,
      investmentId,
      from,
      to,
    );
    const byMonth = new Map<
      string,
      { totalDailyYield: number; count: number; endValue: string }
    >();
    for (const d of daily) {
      const ym = d.date.slice(0, 7);
      const prev = byMonth.get(ym) ?? {
        totalDailyYield: 0,
        count: 0,
        endValue: d.value,
      };
      if (d.dailyYield != null) {
        prev.totalDailyYield += Number.parseFloat(d.dailyYield);
        prev.count += 1;
      }
      prev.endValue = d.value;
      byMonth.set(ym, prev);
    }
    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, agg]) => ({
        month,
        totalDailyYield: agg.count > 0 ? agg.totalDailyYield.toFixed(6) : null,
        endingValue: agg.endValue,
      }));
  }

  async getTotalByAccount(workspaceId: string) {
    const s = await this.getSummary(workspaceId);
    return s.byAccount;
  }

  async getTotalByCategory(workspaceId: string) {
    const s = await this.getSummary(workspaceId);
    return s.byCategory;
  }

  async getTotalInvestedByUser(workspaceId: string) {
    const s = await this.getSummary(workspaceId);
    return { totalInvested: s.totalInvested, totalCurrent: s.totalCurrent };
  }

  private async assertInvestment(
    workspaceId: string,
    id: string,
  ): Promise<void> {
    const ok = await this.invRepo.exist({
      where: { id, workspaceId },
    });
    if (!ok) {
      throw new NotFoundException('Investimento não encontrado');
    }
  }
}
