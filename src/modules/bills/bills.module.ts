import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceBill } from '../../database/entities/workspace-bill.entity';
import { Workspace } from '../../database/entities/workspace.entity';
import { BillReceiptUploadSession } from '../../database/entities/bill-receipt-upload-session.entity';
import { BillsService } from './bills.service';
import { BillReceiptService } from './bill-receipt.service';
import {
  BillReceiptPublicController,
  BillsController,
} from './bills.controller';
import { BillsAlertDigestService } from './bills-alert-digest.service';
import { BillsAlertScheduler } from './bills-alert.scheduler';
import { TransactionsModule } from '../transactions/transactions.module';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkspaceBill,
      Workspace,
      BillReceiptUploadSession,
    ]),
    TransactionsModule,
    CategoriesModule,
  ],
  controllers: [BillsController, BillReceiptPublicController],
  providers: [
    BillsService,
    BillReceiptService,
    BillsAlertDigestService,
    BillsAlertScheduler,
  ],
  exports: [BillsService, BillsAlertDigestService],
})
export class BillsModule {}
