import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SavingsEntry } from '../../database/entities/savings-entry.entity';
import {
  CreateSavingsEntryDto,
  UpdateSavingsEntryDto,
} from './dto/savings.dto';
import {
  ListSavingsQueryDto,
  SAVINGS_SORT_FIELDS,
} from './dto/list-savings-query.dto';
import { getMonthDateBounds } from '../../common/utils/recurring-period';
import { resolveFindOrder } from '../../common/utils/list-sort';

export interface SavingsDashboardSlice {
  savingsInCompetenceMonth: string;
  savingsByMonth: {
    month: string;
    label: string;
    totalSaved: string;
  }[];
}

@Injectable()
export class SavingsService {
  constructor(
    @InjectRepository(SavingsEntry)
    private readonly repo: Repository<SavingsEntry>,
  ) {}

  private amountsToSaved(referenceAmount: number, paidAmount: number): string {
    if (referenceAmount + 1e-9 < paidAmount) {
      throw new BadRequestException(
        'O valor de referência deve ser maior ou igual ao valor pago.',
      );
    }
    return (referenceAmount - paidAmount).toFixed(2);
  }

  /** Janela de `count` meses terminando em (endYear, endMonth), mais antigo primeiro */
  private buildMonthWindow(endYear: number, endMonth: number, count: number) {
    const months: { y: number; m: number; key: string; label: string }[] = [];
    let y = endYear;
    let m = endMonth;
    for (let i = 0; i < count; i++) {
      const key = `${y}-${String(m).padStart(2, '0')}`;
      months.push({
        y,
        m,
        key,
        label: `${String(m).padStart(2, '0')}/${y}`,
      });
      m -= 1;
      if (m < 1) {
        m = 12;
        y -= 1;
      }
    }
    months.reverse();
    return months;
  }

  async list(
    workspaceId: string,
    query?: ListSavingsQueryDto,
  ): Promise<SavingsEntry[]> {
    return this.repo.find({
      where: { workspaceId },
      order: resolveFindOrder(query, SAVINGS_SORT_FIELDS, {
        date: 'DESC',
        createdAt: 'DESC',
      }),
    });
  }

  async create(workspaceId: string, dto: CreateSavingsEntryDto) {
    const savedAmount = this.amountsToSaved(
      dto.referenceAmount,
      dto.paidAmount,
    );
    const row = this.repo.create({
      workspaceId,
      title: dto.title.trim(),
      referenceAmount: dto.referenceAmount.toFixed(2),
      paidAmount: dto.paidAmount.toFixed(2),
      savedAmount,
      date: dto.date.slice(0, 10),
      description: dto.description?.trim() || null,
    });
    return this.repo.save(row);
  }

  async update(workspaceId: string, id: string, dto: UpdateSavingsEntryDto) {
    const row = await this.repo.findOne({ where: { id, workspaceId } });
    if (!row) throw new NotFoundException('Registro não encontrado');
    const ref =
      dto.referenceAmount !== undefined
        ? dto.referenceAmount
        : Number.parseFloat(row.referenceAmount);
    const paid =
      dto.paidAmount !== undefined
        ? dto.paidAmount
        : Number.parseFloat(row.paidAmount);
    if (dto.referenceAmount !== undefined || dto.paidAmount !== undefined) {
      row.savedAmount = this.amountsToSaved(ref, paid);
    }
    if (dto.title !== undefined) row.title = dto.title.trim();
    if (dto.referenceAmount !== undefined) {
      row.referenceAmount = ref.toFixed(2);
    }
    if (dto.paidAmount !== undefined) row.paidAmount = paid.toFixed(2);
    if (dto.date !== undefined) row.date = dto.date.slice(0, 10);
    if (dto.description !== undefined) {
      row.description =
        dto.description === null ? null : dto.description.trim();
    }
    return this.repo.save(row);
  }

  async remove(workspaceId: string, id: string) {
    const r = await this.repo.delete({ id, workspaceId });
    if (!r.affected) throw new NotFoundException('Registro não encontrado');
  }

  async getDashboardSlice(
    workspaceId: string,
    year: number,
    month: number,
  ): Promise<SavingsDashboardSlice> {
    const windowMonths = this.buildMonthWindow(year, month, 12);
    const firstMonth = windowMonths[0];
    const first = getMonthDateBounds(firstMonth.y, firstMonth.m).start;
    const last = getMonthDateBounds(year, month).end;

    const rows = await this.repo
      .createQueryBuilder('s')
      .select("to_char(s.date, 'YYYY-MM')", 'monthKey')
      .addSelect('COALESCE(SUM(s.saved_amount::numeric), 0)', 'total')
      .where('s.workspaceId = :wid', { wid: workspaceId })
      .andWhere('s.date >= :ds', { ds: first })
      .andWhere('s.date <= :de', { de: last })
      .groupBy("to_char(s.date, 'YYYY-MM')")
      .orderBy("to_char(s.date, 'YYYY-MM')", 'ASC')
      .getRawMany<{ monthKey: string; total: string }>();

    const byKey = new Map(rows.map((r) => [r.monthKey, r.total]));
    const series = windowMonths.map((wm) => ({
      month: wm.key,
      label: wm.label,
      totalSaved: parseFloat(byKey.get(wm.key) ?? '0').toFixed(2),
    }));

    const { start, end } = getMonthDateBounds(year, month);
    const comp = await this.repo
      .createQueryBuilder('s')
      .select('COALESCE(SUM(s.saved_amount::numeric), 0)', 'total')
      .where('s.workspaceId = :wid', { wid: workspaceId })
      .andWhere('s.date >= :ds', { ds: start })
      .andWhere('s.date <= :de', { de: end })
      .getRawOne<{ total: string }>();

    return {
      savingsInCompetenceMonth: parseFloat(comp?.total ?? '0').toFixed(2),
      savingsByMonth: series,
    };
  }
}
