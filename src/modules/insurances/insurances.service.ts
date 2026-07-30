import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceInsurance } from '../../database/entities/workspace-insurance.entity';
import {
  CreateWorkspaceInsuranceDto,
  UpdateWorkspaceInsuranceDto,
} from './dto/workspace-insurance.dto';
import {
  INSURANCE_SORT_FIELDS,
  ListInsurancesQueryDto,
} from './dto/list-insurances-query.dto';
import { InsurancePaymentMode } from '../../common/enums/insurance-payment-mode.enum';
import { resolveFindOrder } from '../../common/utils/list-sort';

export type InsuranceAlertStatus = 'SOON' | 'EXPIRED';

export interface InsuranceAlertItem {
  id: string;
  title: string;
  insuranceType: string;
  validityEnd: string;
  daysLeft: number;
  status: InsuranceAlertStatus;
  alertDaysBefore: number;
}

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function todayLocalYmd(): string {
  const n = new Date();
  return `${n.getFullYear()}-${pad2(n.getMonth() + 1)}-${pad2(n.getDate())}`;
}

function ymdToUtcMs(ymd: string): number {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}

function addDaysToYmd(ymd: string, deltaDays: number): string {
  const ms = ymdToUtcMs(ymd) + deltaDays * 86400000;
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

/** Dias até end (negativo se já passou), comparando só calendário local em string. */
function calendarDaysUntil(fromYmd: string, endYmd: string): number {
  return Math.round(
    (ymdToUtcMs(endYmd) - ymdToUtcMs(fromYmd)) / 86400000,
  );
}

@Injectable()
export class InsurancesService {
  constructor(
    @InjectRepository(WorkspaceInsurance)
    private readonly repo: Repository<WorkspaceInsurance>,
  ) {}

  async list(
    workspaceId: string,
    query?: ListInsurancesQueryDto,
  ): Promise<WorkspaceInsurance[]> {
    return this.repo.find({
      where: { workspaceId },
      order: resolveFindOrder(query, INSURANCE_SORT_FIELDS, {
        validityEnd: 'ASC',
        createdAt: 'DESC',
      }),
    });
  }

  private normalizeCoverages(
    rows: { label: string; details?: string | null }[] | undefined,
  ): { label: string; details: string | null }[] {
    if (!rows?.length) return [];
    return rows.map((r) => ({
      label: r.label.trim(),
      details: r.details?.trim() ? r.details.trim() : null,
    }));
  }

  private validateInstallments(dto: {
    paymentMode: InsurancePaymentMode;
    installmentCount?: number | null;
    installmentValue?: number | null;
  }) {
    if (dto.paymentMode === InsurancePaymentMode.INSTALLMENTS) {
      const n = dto.installmentCount;
      if (n == null || n < 2) {
        throw new BadRequestException(
          'No modo parcelado, informe a quantidade de parcelas (mínimo 2).',
        );
      }
    } else if (dto.installmentCount != null || dto.installmentValue != null) {
      throw new BadRequestException(
        'Parcelas só se aplicam ao prêmio parcelado.',
      );
    }
  }

  private assertValidityOrder(start: string, end: string) {
    const a = start.slice(0, 10);
    const b = end.slice(0, 10);
    if (a > b) {
      throw new BadRequestException(
        'A data de início da vigência deve ser anterior ou igual ao fim.',
      );
    }
  }

  async create(
    workspaceId: string,
    dto: CreateWorkspaceInsuranceDto,
  ): Promise<WorkspaceInsurance> {
    this.assertValidityOrder(dto.validityStart, dto.validityEnd);
    this.validateInstallments(dto);
    const row = this.repo.create({
      workspaceId,
      title: dto.title.trim(),
      insuranceType: dto.insuranceType,
      insurerName: dto.insurerName?.trim() || null,
      policyNumber: dto.policyNumber?.trim() || null,
      insuredCapital: dto.insuredCapital.toFixed(2),
      premiumTotal: dto.premiumTotal.toFixed(2),
      paymentMode: dto.paymentMode,
      installmentCount:
        dto.paymentMode === InsurancePaymentMode.INSTALLMENTS
          ? dto.installmentCount!
          : null,
      installmentValue:
        dto.installmentValue != null
          ? dto.installmentValue.toFixed(2)
          : null,
      coverages: this.normalizeCoverages(dto.coverages),
      validityStart: dto.validityStart.slice(0, 10),
      validityEnd: dto.validityEnd.slice(0, 10),
      alertDaysBefore: dto.alertDaysBefore ?? 30,
      notes: dto.notes?.trim() || null,
    });
    return this.repo.save(row);
  }

  async update(
    workspaceId: string,
    id: string,
    dto: UpdateWorkspaceInsuranceDto,
  ): Promise<WorkspaceInsurance> {
    const row = await this.repo.findOne({ where: { id, workspaceId } });
    if (!row) throw new NotFoundException('Seguro não encontrado');

    const nextStart = dto.validityStart?.slice(0, 10) ?? row.validityStart;
    const nextEnd = dto.validityEnd?.slice(0, 10) ?? row.validityEnd;
    this.assertValidityOrder(nextStart, nextEnd);

    const nextMode = dto.paymentMode ?? row.paymentMode;
    const nextInstCount =
      dto.installmentCount !== undefined
        ? dto.installmentCount
        : row.installmentCount;
    const nextInstVal =
      dto.installmentValue !== undefined
        ? dto.installmentValue
        : row.installmentValue != null
          ? Number.parseFloat(row.installmentValue)
          : null;
    this.validateInstallments({
      paymentMode: nextMode,
      installmentCount: nextInstCount,
      installmentValue: nextInstVal,
    });

    if (dto.title !== undefined) row.title = dto.title.trim();
    if (dto.insuranceType !== undefined) row.insuranceType = dto.insuranceType;
    if (dto.insurerName !== undefined) {
      row.insurerName = dto.insurerName?.trim() || null;
    }
    if (dto.policyNumber !== undefined) {
      row.policyNumber = dto.policyNumber?.trim() || null;
    }
    if (dto.insuredCapital !== undefined) {
      row.insuredCapital = dto.insuredCapital.toFixed(2);
    }
    if (dto.premiumTotal !== undefined) {
      row.premiumTotal = dto.premiumTotal.toFixed(2);
    }
    row.paymentMode = nextMode;
    if (nextMode === InsurancePaymentMode.INSTALLMENTS) {
      row.installmentCount = nextInstCount ?? row.installmentCount;
      if (dto.installmentValue !== undefined) {
        row.installmentValue =
          dto.installmentValue != null
            ? dto.installmentValue.toFixed(2)
            : null;
      }
    } else {
      row.installmentCount = null;
      row.installmentValue = null;
    }
    if (dto.coverages !== undefined) {
      row.coverages = this.normalizeCoverages(dto.coverages);
    }
    if (dto.validityStart !== undefined) {
      row.validityStart = dto.validityStart.slice(0, 10);
    }
    if (dto.validityEnd !== undefined) {
      row.validityEnd = dto.validityEnd.slice(0, 10);
    }
    if (dto.alertDaysBefore !== undefined) {
      row.alertDaysBefore = dto.alertDaysBefore;
    }
    if (dto.notes !== undefined) row.notes = dto.notes?.trim() || null;

    return this.repo.save(row);
  }

  async remove(workspaceId: string, id: string): Promise<void> {
    const r = await this.repo.delete({ id, workspaceId });
    if (!r.affected) throw new NotFoundException('Seguro não encontrado');
  }

  /** Vigência vencida ou dentro da janela de alerta antes do fim. */
  async getAlerts(workspaceId: string): Promise<{
    items: InsuranceAlertItem[];
    expiredCount: number;
    soonCount: number;
    total: number;
  }> {
    const rows = await this.repo.find({
      where: { workspaceId },
      order: { validityEnd: 'ASC' },
    });
    const today = todayLocalYmd();
    const items: InsuranceAlertItem[] = [];
    for (const r of rows) {
      const end = r.validityEnd.slice(0, 10);
      const daysLeft = calendarDaysUntil(today, end);
      if (end < today) {
        items.push({
          id: r.id,
          title: r.title,
          insuranceType: r.insuranceType,
          validityEnd: end,
          daysLeft,
          status: 'EXPIRED',
          alertDaysBefore: r.alertDaysBefore,
        });
        continue;
      }
      const windowStart = addDaysToYmd(end, -r.alertDaysBefore);
      if (today >= windowStart) {
        items.push({
          id: r.id,
          title: r.title,
          insuranceType: r.insuranceType,
          validityEnd: end,
          daysLeft,
          status: 'SOON',
          alertDaysBefore: r.alertDaysBefore,
        });
      }
    }
    const expiredCount = items.filter((i) => i.status === 'EXPIRED').length;
    const soonCount = items.filter((i) => i.status === 'SOON').length;
    return { items, expiredCount, soonCount, total: items.length };
  }
}
