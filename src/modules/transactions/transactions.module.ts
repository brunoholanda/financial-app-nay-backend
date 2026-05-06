import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../../database/entities/transaction.entity';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { CategoriesModule } from '../categories/categories.module';
import { RecurringModule } from '../recurring/recurring.module';
import { WorkspaceAccountsModule } from '../workspace-accounts/workspace-accounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    CategoriesModule,
    RecurringModule,
    WorkspaceAccountsModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
})
export class TransactionsModule {}
