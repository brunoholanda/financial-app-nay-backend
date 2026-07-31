import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Investment } from '../../database/entities/investment.entity';
import { InvestmentTransaction } from '../../database/entities/investment-transaction.entity';
import { YieldHistory } from '../../database/entities/yield-history.entity';
import { InvestmentsController } from './investments.controller';
import { InvestmentsService } from './investments.service';
import { InvestmentAnalyticsService } from './investment-analytics.service';
import { WorkspaceAccountsModule } from '../workspace-accounts/workspace-accounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Investment, InvestmentTransaction, YieldHistory]),
    WorkspaceAccountsModule,
  ],
  controllers: [InvestmentsController],
  providers: [InvestmentsService, InvestmentAnalyticsService],
  exports: [InvestmentsService, InvestmentAnalyticsService],
})
export class InvestmentsModule {}
