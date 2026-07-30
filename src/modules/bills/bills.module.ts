import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceBill } from '../../database/entities/workspace-bill.entity';
import { Workspace } from '../../database/entities/workspace.entity';
import { BillsService } from './bills.service';
import { BillsController } from './bills.controller';
import { BillsAlertDigestService } from './bills-alert-digest.service';
import { BillsAlertScheduler } from './bills-alert.scheduler';
import { TransactionsModule } from '../transactions/transactions.module';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceBill, Workspace]),
    TransactionsModule,
    CategoriesModule,
  ],
  controllers: [BillsController],
  providers: [BillsService, BillsAlertDigestService, BillsAlertScheduler],
  exports: [BillsService, BillsAlertDigestService],
})
export class BillsModule {}
