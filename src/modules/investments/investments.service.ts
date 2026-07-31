import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Investment } from '../../database/entities/investment.entity';
import { InvestmentTransaction } from '../../database/entities/investment-transaction.entity';
import { YieldHistory } from '../../database/entities/yield-history.entity';
import { CreateInvestmentDto } from './dto/create-investment.dto';
import { UpdateInvestmentDto } from './dto/update-investment.dto';
import {
  ListInvestmentsQueryDto,
  INVESTMENT_SORT_FIELDS,
} from './dto/list-investments-query.dto';
import {
  INVESTMENT_CASHFLOW_SORT_FIELDS,
  ListInvestmentCashflowsQueryDto,
  ListYieldHistoryQueryDto,
  YIELD_HISTORY_SORT_FIELDS,
} from './dto/list-investment-sub-query.dto';
import { WorkspaceAccountsService } from '../workspace-accounts/workspace-accounts.service';
import { InvestmentTransactionKind } from '../../common/enums/investment-transaction-type.enum';
import { CreateInvestmentCashflowDto } from './dto/investment-cashflow.dto';
import { CreateYieldHistoryDto } from './dto/yield-history.dto';
import {
  applyQueryBuilderOrder,
  resolveFindOrder,
} from '../../common/utils/list-sort';

@Injectable()
export class InvestmentsService {
  constructor(
    @InjectRepository(Investment)
    private readonly invRepo: Repository<Investment>,
    @InjectRepository(InvestmentTransaction)
    private readonly invTxRepo: Repository<InvestmentTransaction>,
    @InjectRepository(YieldHistory)
    private readonly yieldRepo: Repository<YieldHistory>,
    private readonly workspaceAccounts: WorkspaceAccountsService,
  ) {}

  private dec2(n: number): string {
    return n.toFixed(2);
  }

  async createInvestment(workspaceId: string, dto: CreateInvestmentDto) {
    await this.workspaceAccounts.assertAccountInWorkspace(
      workspaceId,
      dto.workspaceAccountId,
    );
    if (
      dto.investedAmount < 0 ||
      dto.currentAmount < 0 ||
      !Number.isFinite(dto.investedAmount) ||
      !Number.isFinite(dto.currentAmount)
    ) {
      throw new BadRequestException(
        'Valores monetários devem ser finitos e ≥ 0',
      );
    }

    const row = this.invRepo.create({
      workspaceId,
      workspaceAccountId: dto.workspaceAccountId,
      name: dto.name.trim(),
      instrumentType: dto.type,
      category: dto.category,
      investedAmount: this.dec2(dto.investedAmount),
      currentAmount: this.dec2(dto.currentAmount),
      yieldType: dto.yieldType,
      indexer: dto.indexer?.trim() ?? null,
      rate:
        dto.rate != null && Number.isFinite(dto.rate)
          ? dto.rate.toFixed(4)
          : null,
      startDate: dto.startDate.slice(0, 10),
      endDate: dto.endDate?.slice(0, 10) ?? null,
      liquidityType: dto.liquidity,
    });
    const saved = await this.invRepo.save(row);
    return this.getInvestmentById(workspaceId, saved.id);
  }

  async updateInvestment(
    workspaceId: string,
    id: string,
    dto: UpdateInvestmentDto,
  ) {
    const inv = await this.invRepo.findOne({ where: { id, workspaceId } });
    if (!inv) {
      throw new NotFoundException('Investimento não encontrado');
    }

    if (dto.workspaceAccountId !== undefined) {
      await this.workspaceAccounts.assertAccountInWorkspace(
        workspaceId,
        dto.workspaceAccountId,
      );
      inv.workspaceAccountId = dto.workspaceAccountId;
    }

    if (dto.name !== undefined) inv.name = dto.name.trim();
    if (dto.type !== undefined) inv.instrumentType = dto.type;
    if (dto.category !== undefined) inv.category = dto.category;
    if (dto.yieldType !== undefined) inv.yieldType = dto.yieldType;
    if (dto.indexer !== undefined) inv.indexer = dto.indexer?.trim() ?? null;
    if (dto.rate !== undefined) {
      inv.rate =
        dto.rate != null && Number.isFinite(dto.rate)
          ? dto.rate.toFixed(4)
          : null;
    }
    if (dto.startDate !== undefined) inv.startDate = dto.startDate.slice(0, 10);
    if (dto.endDate !== undefined)
      inv.endDate = dto.endDate?.slice(0, 10) ?? null;
    if (dto.liquidity !== undefined) inv.liquidityType = dto.liquidity;

    if (dto.investedAmount !== undefined) {
      if (dto.investedAmount < 0 || !Number.isFinite(dto.investedAmount)) {
        throw new BadRequestException('Valor investido inválido');
      }
      inv.investedAmount = this.dec2(dto.investedAmount);
    }
    if (dto.currentAmount !== undefined) {
      if (dto.currentAmount < 0 || !Number.isFinite(dto.currentAmount)) {
        throw new BadRequestException('Valor atual inválido');
      }
      inv.currentAmount = this.dec2(dto.currentAmount);
    }

    await this.invRepo.save(inv);
    return this.getInvestmentById(workspaceId, id);
  }

  async deleteInvestment(workspaceId: string, id: string) {
    const inv = await this.invRepo.findOne({ where: { id, workspaceId } });
    if (!inv) {
      throw new NotFoundException('Investimento não encontrado');
    }
    await this.invRepo.remove(inv);
    return { id };
  }

  async getUserInvestments(
    workspaceId: string,
    query: ListInvestmentsQueryDto,
  ) {
    const qb = this.invRepo
      .createQueryBuilder('i')
      .leftJoinAndSelect('i.workspaceAccount', 'acc')
      .where('i.workspaceId = :workspaceId', { workspaceId });

    if (query.workspaceAccountId) {
      qb.andWhere('i.workspaceAccountId = :aid', {
        aid: query.workspaceAccountId,
      });
    }
    if (query.type) {
      qb.andWhere('i.instrumentType = :tp', { tp: query.type });
    }
    if (query.liquidity) {
      qb.andWhere('i.liquidityType = :lq', { lq: query.liquidity });
    }

    applyQueryBuilderOrder(
      qb,
      'i',
      query,
      INVESTMENT_SORT_FIELDS,
      'startDate',
      'DESC',
      {
        'workspaceAccount.name': 'acc.name',
        instrumentType: 'i.instrumentType',
        liquidityType: 'i.liquidityType',
        investedAmount: 'i.investedAmount',
        currentAmount: 'i.currentAmount',
        startDate: 'i.startDate',
        endDate: 'i.endDate',
        name: 'i.name',
        createdAt: 'i.createdAt',
      },
    );
    if (!query.sortBy) {
      qb.addOrderBy('i.name', 'ASC');
    }

    return qb.getMany();
  }

  async getInvestmentById(workspaceId: string, id: string) {
    const row = await this.invRepo.findOne({
      where: { id, workspaceId },
      relations: {
        workspaceAccount: true,
        transactions: true,
        yieldHistory: true,
      },
    });
    if (!row) {
      throw new NotFoundException('Investimento não encontrado');
    }
    if (row.transactions?.length) {
      row.transactions.sort((a, b) => {
        const d = b.date.localeCompare(a.date);
        return d !== 0
          ? d
          : (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
      });
    }
    if (row.yieldHistory?.length) {
      row.yieldHistory.sort((a, b) => {
        const d = a.date.localeCompare(b.date);
        return d !== 0
          ? d
          : (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0);
      });
    }
    return row;
  }

  async addCashflow(
    workspaceId: string,
    investmentId: string,
    dto: CreateInvestmentCashflowDto,
  ) {
    const inv = await this.invRepo.findOne({
      where: { id: investmentId, workspaceId },
    });
    if (!inv) {
      throw new NotFoundException('Investimento não encontrado');
    }
    const amt = dto.amount;
    if (!Number.isFinite(amt) || amt <= 0) {
      throw new BadRequestException('Informe um valor positivo');
    }

    const cur = Number.parseFloat(inv.currentAmount);
    const invBase = Number.parseFloat(inv.investedAmount);

    if (dto.kind === InvestmentTransactionKind.APORTE) {
      inv.investedAmount = this.dec2(invBase + amt);
      inv.currentAmount = this.dec2(cur + amt);
    } else {
      if (amt > cur + 0.0001) {
        throw new BadRequestException(
          'Resgate superior ao valor atual da posição',
        );
      }
      const nextInv = Math.max(0, invBase - amt);
      inv.investedAmount = this.dec2(nextInv);
      inv.currentAmount = this.dec2(cur - amt);
    }

    await this.invRepo.manager.transaction(async (em) => {
      await em.save(inv);
      const txRow = em.create(InvestmentTransaction, {
        investmentId: inv.id,
        kind: dto.kind,
        amount: this.dec2(amt),
        date: dto.date.slice(0, 10),
      });
      await em.save(txRow);
    });

    return this.getInvestmentById(workspaceId, investmentId);
  }

  async listCashflows(
    workspaceId: string,
    investmentId: string,
    query?: ListInvestmentCashflowsQueryDto,
  ) {
    await this.ensureExists(workspaceId, investmentId);
    return this.invTxRepo.find({
      where: { investmentId },
      order: resolveFindOrder(query, INVESTMENT_CASHFLOW_SORT_FIELDS, {
        date: 'DESC',
        createdAt: 'DESC',
      }),
    });
  }

  async addYieldPoint(
    workspaceId: string,
    investmentId: string,
    dto: CreateYieldHistoryDto,
  ) {
    await this.ensureExists(workspaceId, investmentId);
    const row = this.yieldRepo.create({
      investmentId,
      date: dto.date.slice(0, 10),
      value: this.dec2(dto.value),
      dailyYield:
        dto.dailyYield != null && Number.isFinite(dto.dailyYield)
          ? dto.dailyYield.toFixed(6)
          : null,
    });
    await this.yieldRepo.save(row);
    return row;
  }

  async listYieldHistory(
    workspaceId: string,
    investmentId: string,
    query?: ListYieldHistoryQueryDto,
  ) {
    await this.ensureExists(workspaceId, investmentId);
    return this.yieldRepo.find({
      where: { investmentId },
      order: resolveFindOrder(query, YIELD_HISTORY_SORT_FIELDS, {
        date: 'ASC',
        createdAt: 'ASC',
      }),
    });
  }

  private async ensureExists(workspaceId: string, id: string): Promise<void> {
    const ok = await this.invRepo.exist({
      where: { id, workspaceId },
    });
    if (!ok) {
      throw new NotFoundException('Investimento não encontrado');
    }
  }
}
