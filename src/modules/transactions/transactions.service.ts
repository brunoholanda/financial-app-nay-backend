import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from '../../database/entities/transaction.entity';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
} from './dto/transaction.dto';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto';
import { CategoriesService } from '../categories/categories.service';
import { RecurringSeriesService } from '../recurring/recurring-series.service';
import { getMonthDateBounds } from '../../common/utils/recurring-period';
import { PaymentSource } from '../../common/enums/payment-source.enum';
import { WorkspaceAccountsService } from '../workspace-accounts/workspace-accounts.service';

@Injectable()
export class TransactionsService {
  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    private readonly categoriesService: CategoriesService,
    private readonly recurringSeriesService: RecurringSeriesService,
    private readonly workspaceAccounts: WorkspaceAccountsService,
  ) {}

  private resolveYearMonth(query: ListTransactionsQueryDto): {
    year: number;
    month: number;
  } {
    if (
      query.year !== undefined &&
      query.month !== undefined &&
      Number.isFinite(query.year) &&
      Number.isFinite(query.month)
    ) {
      return { year: query.year, month: query.month };
    }
    const d = new Date();
    return { year: d.getFullYear(), month: d.getMonth() + 1 };
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

  async create(workspaceId: string, dto: CreateTransactionDto) {
    await this.categoriesService.assertCategoryInWorkspace(
      workspaceId,
      dto.categoryId,
    );
    const pay = await this.enforcePaymentTarget(
      workspaceId,
      dto.paymentSource,
      dto.workspaceAccountId,
    );
    const entity = this.txRepo.create({
      title: dto.title,
      amount: dto.amount.toFixed(2),
      type: dto.type,
      categoryId: dto.categoryId,
      workspaceId,
      paymentSource: dto.paymentSource,
      workspaceAccountId: pay.workspaceAccountId,
      date: dto.date.slice(0, 10),
      description: dto.description ?? null,
    });
    const saved = await this.txRepo.save(entity);
    return this.txRepo.findOne({
      where: { id: saved.id },
      relations: { category: true, workspaceAccount: true },
    });
  }

  async update(workspaceId: string, id: string, dto: UpdateTransactionDto) {
    const tx = await this.txRepo.findOne({ where: { id, workspaceId } });
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }
    if (dto.categoryId) {
      await this.categoriesService.assertCategoryInWorkspace(
        workspaceId,
        dto.categoryId,
      );
      tx.categoryId = dto.categoryId;
    }
    const nextSource = dto.paymentSource ?? tx.paymentSource;
    let accForEnforce: string | null | undefined;
    if (dto.paymentSource === PaymentSource.CASH) {
      accForEnforce = null;
    } else if (dto.workspaceAccountId !== undefined) {
      accForEnforce = dto.workspaceAccountId;
    } else {
      accForEnforce = tx.workspaceAccountId ?? undefined;
    }
    const pay = await this.enforcePaymentTarget(
      workspaceId,
      nextSource,
      accForEnforce,
    );
    tx.paymentSource = nextSource;
    tx.workspaceAccountId = pay.workspaceAccountId;

    if (dto.title !== undefined) tx.title = dto.title;
    if (dto.amount !== undefined) tx.amount = dto.amount.toFixed(2);
    if (dto.type !== undefined) tx.type = dto.type;
    if (dto.date !== undefined) tx.date = dto.date.slice(0, 10);
    if (dto.description !== undefined) tx.description = dto.description ?? null;
    await this.txRepo.save(tx);
    return this.txRepo.findOne({
      where: { id },
      relations: { category: true, workspaceAccount: true },
    });
  }

  async remove(workspaceId: string, id: string) {
    const tx = await this.txRepo.findOne({ where: { id, workspaceId } });
    if (!tx) {
      throw new NotFoundException('Transaction not found');
    }
    await this.txRepo.remove(tx);
    return { id };
  }

  async list(workspaceId: string, query: ListTransactionsQueryDto) {
    const { year, month } = this.resolveYearMonth(query);
    const { start, end } = getMonthDateBounds(year, month);

    const qb = this.txRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.category', 'category')
      .leftJoinAndSelect('t.workspaceAccount', 'workspaceAccount')
      .where('t.workspaceId = :workspaceId', { workspaceId })
      .andWhere('t.date >= :ds', { ds: start })
      .andWhere('t.date <= :de', { de: end })
      .orderBy('t.date', 'DESC')
      .addOrderBy('t.createdAt', 'DESC');

    if (query.categoryId) {
      qb.andWhere('t.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.type) {
      qb.andWhere('t.type = :type', { type: query.type });
    }

    const transactions = await qb.getMany();

    const allSeries =
      await this.recurringSeriesService.loadAllForWorkspace(workspaceId);
    const recurringInMonth =
      this.recurringSeriesService.mapWorkspaceSeriesForMonth(
        allSeries,
        year,
        month,
        {
          categoryId: query.categoryId,
          type: query.type,
        },
      );

    return {
      year,
      month,
      transactions,
      recurringInMonth,
    };
  }
}
