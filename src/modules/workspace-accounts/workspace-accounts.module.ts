import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceAccount } from '../../database/entities/workspace-account.entity';
import { Transaction } from '../../database/entities/transaction.entity';
import { RecurringSeries } from '../../database/entities/recurring-series.entity';
import { Investment } from '../../database/entities/investment.entity';
import { WorkspaceAccountsService } from './workspace-accounts.service';
import { WorkspaceAccountsController } from './workspace-accounts.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceAccount,
      Transaction,
      RecurringSeries,
      Investment,
    ]),
  ],
  controllers: [WorkspaceAccountsController],
  providers: [WorkspaceAccountsService],
  exports: [WorkspaceAccountsService],
})
export class WorkspaceAccountsModule {}
