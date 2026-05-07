import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from '../../database/entities/transaction.entity';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { RecurringModule } from '../recurring/recurring.module';
import { SavingsModule } from '../savings/savings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Transaction]),
    RecurringModule,
    SavingsModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
