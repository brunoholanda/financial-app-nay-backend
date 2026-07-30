import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkspaceAccount } from '../../database/entities/workspace-account.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { RecurringSeries } from '../../database/entities/recurring-series.entity';
import { Investment } from '../../database/entities/investment.entity';
import { CreateWorkspaceAccountDto } from './dto/workspace-account.dto';
import { UpdateWorkspaceAccountDto } from './dto/update-workspace-account.dto';
import {
  ListWorkspaceAccountsQueryDto,
  WORKSPACE_ACCOUNT_SORT_FIELDS,
} from './dto/list-workspace-accounts-query.dto';
import { resolveFindOrder } from '../../common/utils/list-sort';

@Injectable()
export class WorkspaceAccountsService {
  constructor(
    @InjectRepository(WorkspaceAccount)
    private readonly accountRepo: Repository<WorkspaceAccount>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(RecurringSeries)
    private readonly recRepo: Repository<RecurringSeries>,
    @InjectRepository(Investment)
    private readonly invRepo: Repository<Investment>,
  ) {}

  list(workspaceId: string, query?: ListWorkspaceAccountsQueryDto) {
    return this.accountRepo.find({
      where: { workspaceId },
      order: resolveFindOrder(query, WORKSPACE_ACCOUNT_SORT_FIELDS, {
        name: 'ASC',
        createdAt: 'ASC',
      }),
    });
  }

  async assertAccountInWorkspace(workspaceId: string, accountId: string) {
    const ok = await this.accountRepo.exist({
      where: { id: accountId, workspaceId },
    });
    if (!ok) {
      throw new NotFoundException('Conta não encontrada neste espaço');
    }
  }

  create(workspaceId: string, dto: CreateWorkspaceAccountDto) {
    const row = this.accountRepo.create({
      workspaceId,
      name: dto.name.trim(),
      bankName: dto.bankName?.trim() ?? null,
      branch: dto.branch?.trim() ?? null,
      accountNumber: dto.accountNumber?.trim() ?? null,
      pixKeyPrimary: dto.pixKeyPrimary?.trim() ?? null,
      pixKeySecondary: dto.pixKeySecondary?.trim() ?? null,
    });
    return this.accountRepo.save(row);
  }

  async update(
    workspaceId: string,
    id: string,
    dto: UpdateWorkspaceAccountDto,
  ) {
    const row = await this.accountRepo.findOne({ where: { id, workspaceId } });
    if (!row) throw new NotFoundException('Conta não encontrada');
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.bankName !== undefined)
      row.bankName = dto.bankName?.trim() ?? null;
    if (dto.branch !== undefined) row.branch = dto.branch?.trim() ?? null;
    if (dto.accountNumber !== undefined)
      row.accountNumber = dto.accountNumber?.trim() ?? null;
    if (dto.pixKeyPrimary !== undefined)
      row.pixKeyPrimary = dto.pixKeyPrimary?.trim() ?? null;
    if (dto.pixKeySecondary !== undefined)
      row.pixKeySecondary = dto.pixKeySecondary?.trim() ?? null;
    return this.accountRepo.save(row);
  }

  async remove(workspaceId: string, id: string) {
    const row = await this.accountRepo.findOne({ where: { id, workspaceId } });
    if (!row) throw new NotFoundException('Conta não encontrada');
    const txs = await this.txRepo.count({
      where: { workspaceAccountId: id },
    });
    const recs = await this.recRepo.count({
      where: { workspaceAccountId: id },
    });
    const invs = await this.invRepo.count({
      where: { workspaceAccountId: id },
    });
    if (txs + recs + invs > 0) {
      throw new ConflictException(
        'Conta vinculada a lançamentos ou investimentos; altere ou remova os vínculos antes.',
      );
    }
    await this.accountRepo.remove(row);
    return { id };
  }
}
