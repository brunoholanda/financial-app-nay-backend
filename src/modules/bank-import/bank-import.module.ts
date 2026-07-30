import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../../database/entities/transaction.entity';
import { CategoriesModule } from '../categories/categories.module';
import { WorkspaceAccountsModule } from '../workspace-accounts/workspace-accounts.module';
import { BankImportService } from './bank-import.service';
import { BankImportController } from './bank-import.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    CategoriesModule,
    WorkspaceAccountsModule,
  ],
  controllers: [BankImportController],
  providers: [BankImportService],
})
export class BankImportModule {}
