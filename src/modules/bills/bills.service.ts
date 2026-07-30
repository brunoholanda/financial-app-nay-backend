import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceBill } from '../../database/entities/workspace-bill.entity';
import {
  CreateWorkspaceBillDto,
  PayWorkspaceBillDto,
  UpdateWorkspaceBillDto,
} from './dto/workspace-bill.dto';
import {
  BILL_SORT_FIELDS,
  ListBillsQueryDto,
} from './dto/list-bills-query.dto';
import { PaymentSource } from '../../common/enums/payment-source.enum';
import { LedgerType } from '../../common/enums/ledger-type.enum';
import { TransactionsService } from '../transactions/transactions.service';
import { CategoriesService } from '../categories/categories.service';
import { resolveFindOrder } from '../../common/utils/list-sort';

export type BillAlertStatus = 'OVERDUE' | 'DUE_TODAY' | 'SOON';

export interface BillAlertItem {
  id: string;
  title: string;
  amount: string;
  dueDate: string;
  daysUntilDue: number;
  status: BillAlertStatus;
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

function calendarDaysUntil(fromYmd: string, toYmd: string): number {
  return Math.round(
    (ymdToUtcMs(toYmd) - ymdToUtcMs(fromYmd)) / 86400000,
  );
}

@Injectable()
export class BillsService {
  constructor(
    @InjectRepository(WorkspaceBill)
    private readonly repo: Repository<WorkspaceBill>,
    private readonly transactionsService: TransactionsService,
    private readonly categoriesService: CategoriesService,
  ) {}

  async list(
    workspaceId: string,
    query?: ListBillsQueryDto,
  ): Promise<WorkspaceBill[]> {
    return this.repo.find({
      where: { workspaceId },
      order: resolveFindOrder(query, BILL_SORT_FIELDS, {
        dueDate: 'ASC',
        createdAt: 'DESC',
      }),
    });
  }

  private assertDueDateOrder(dueDate: string) {
    if (!dueDate?.slice(0, 10)) {
      throw new BadRequestException('Data de vencimento inválida');
    }
  }

  async create(
    workspaceId: string,
    dto: CreateWorkspaceBillDto,
  ): Promise<WorkspaceBill> {
    this.assertDueDateOrder(dto.dueDate);
    const row = this.repo.create({
      workspaceId,
      title: dto.title.trim(),
      amount: dto.amount.toFixed(2),
      dueDate: dto.dueDate.slice(0, 10),
      alertDaysBefore: dto.alertDaysBefore ?? 7,
      isPaid: false,
      paidAt: null,
      paidPaymentSource: null,
      paidWorkspaceAccountId: null,
      linkedTransactionId: null,
      notes: dto.notes?.trim() || null,
    });
    return this.repo.save(row);
  }

  async update(
    workspaceId: string,
    id: string,
    dto: UpdateWorkspaceBillDto,
  ): Promise<WorkspaceBill> {
    const row = await this.repo.findOne({ where: { id, workspaceId } });
    if (!row) throw new NotFoundException('Conta não encontrada');
    if (row.isPaid) {
      throw new BadRequestException(
        'Não é possível editar uma conta já marcada como paga.',
      );
    }

    if (dto.title !== undefined) row.title = dto.title.trim();
    if (dto.amount !== undefined) row.amount = dto.amount.toFixed(2);
    if (dto.dueDate !== undefined) {
      this.assertDueDateOrder(dto.dueDate);
      row.dueDate = dto.dueDate.slice(0, 10);
    }
    if (dto.alertDaysBefore !== undefined) {
      row.alertDaysBefore = dto.alertDaysBefore;
    }
    if (dto.notes !== undefined) row.notes = dto.notes?.trim() || null;

    return this.repo.save(row);
  }

  async remove(workspaceId: string, id: string): Promise<void> {
    const row = await this.repo.findOne({ where: { id, workspaceId } });
    if (!row) throw new NotFoundException('Conta não encontrada');
    if (row.isPaid) {
      throw new BadRequestException(
        'Não é possível excluir uma conta já paga (há vínculo de pagamento).',
      );
    }
    const r = await this.repo.delete({ id, workspaceId });
    if (!r.affected) throw new NotFoundException('Conta não encontrada');
  }

  /**
   * Contas em aberto: vencida, vence hoje ou dentro da janela de alerta antes do vencimento.
   */
  async getAlerts(workspaceId: string): Promise<{
    items: BillAlertItem[];
    overdueCount: number;
    dueTodayCount: number;
    soonCount: number;
    total: number;
  }> {
    const rows = await this.repo.find({
      where: { workspaceId, isPaid: false },
      order: { dueDate: 'ASC' },
    });
    const today = todayLocalYmd();
    const items: BillAlertItem[] = [];

    for (const b of rows) {
      const due = b.dueDate.slice(0, 10);
      const daysUntilDue = calendarDaysUntil(today, due);

      if (due < today) {
        items.push({
          id: b.id,
          title: b.title,
          amount: b.amount,
          dueDate: due,
          daysUntilDue,
          status: 'OVERDUE',
          alertDaysBefore: b.alertDaysBefore,
        });
        continue;
      }

      if (due === today) {
        items.push({
          id: b.id,
          title: b.title,
          amount: b.amount,
          dueDate: due,
          daysUntilDue: 0,
          status: 'DUE_TODAY',
          alertDaysBefore: b.alertDaysBefore,
        });
        continue;
      }

      const windowStart = addDaysToYmd(due, -b.alertDaysBefore);
      if (today >= windowStart) {
        items.push({
          id: b.id,
          title: b.title,
          amount: b.amount,
          dueDate: due,
          daysUntilDue,
          status: 'SOON',
          alertDaysBefore: b.alertDaysBefore,
        });
      }
    }

    const overdueCount = items.filter((i) => i.status === 'OVERDUE').length;
    const dueTodayCount = items.filter((i) => i.status === 'DUE_TODAY').length;
    const soonCount = items.filter((i) => i.status === 'SOON').length;
    return {
      items,
      overdueCount,
      dueTodayCount,
      soonCount,
      total: items.length,
    };
  }

  async pay(
    workspaceId: string,
    id: string,
    dto: PayWorkspaceBillDto,
  ): Promise<WorkspaceBill> {
    const row = await this.repo.findOne({ where: { id, workspaceId } });
    if (!row) throw new NotFoundException('Conta não encontrada');
    if (row.isPaid) {
      throw new BadRequestException('Esta conta já está paga.');
    }

    if (
      dto.paymentSource !== PaymentSource.CASH &&
      dto.paymentSource !== PaymentSource.CREDIT_CARD
    ) {
      throw new BadRequestException(
        'Use espécie (dinheiro) ou cartão de crédito.',
      );
    }

    if (dto.paymentSource === PaymentSource.CREDIT_CARD && !dto.workspaceAccountId) {
      throw new BadRequestException(
        'Selecione a conta para pagamento no cartão de crédito.',
      );
    }
    if (dto.paymentSource === PaymentSource.CASH && dto.workspaceAccountId) {
      throw new BadRequestException(
        'Para espécie não informe conta bancária.',
      );
    }

    const paidDay = dto.paidAt.slice(0, 10);

    let linkedTransactionId: string | null = null;
    if (dto.createTransaction) {
      if (!dto.categoryId) {
        throw new BadRequestException(
          'Para lançar no extrato, informe a categoria.',
        );
      }
      const cat = await this.categoriesService.findOneInWorkspace(
        workspaceId,
        dto.categoryId,
      );
      if (cat.type !== LedgerType.EXPENSE) {
        throw new BadRequestException(
          'A categoria do lançamento deve ser do tipo despesa.',
        );
      }

      const amountNum = Number.parseFloat(row.amount);
      const tx = await this.transactionsService.create(workspaceId, {
        title: row.title,
        amount: amountNum,
        type: LedgerType.EXPENSE,
        categoryId: dto.categoryId,
        paymentSource: dto.paymentSource,
        workspaceAccountId:
          dto.paymentSource === PaymentSource.CREDIT_CARD
            ? dto.workspaceAccountId
            : undefined,
        date: paidDay,
        description: row.notes
          ? `Conta a pagar. ${row.notes}`
          : 'Registrado a partir da área Contas a pagar.',
      });
      if (!tx?.id) {
        throw new BadRequestException('Não foi possível criar o lançamento.');
      }
      linkedTransactionId = tx.id;
    }

    row.isPaid = true;
    row.paidAt = paidDay;
    row.paidPaymentSource = dto.paymentSource;
    row.paidWorkspaceAccountId =
      dto.paymentSource === PaymentSource.CREDIT_CARD
        ? dto.workspaceAccountId ?? null
        : null;
    row.linkedTransactionId = linkedTransactionId;

    return this.repo.save(row);
  }
}
