import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceBill } from '../../database/entities/workspace-bill.entity';
import { BillsService } from './bills.service';
import { BillsController } from './bills.controller';
import { TransactionsModule } from '../transactions/transactions.module';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([WorkspaceBill]),
    TransactionsModule,
    CategoriesModule,
  ],
  controllers: [BillsController],
  providers: [BillsService],
})
export class BillsModule {}
