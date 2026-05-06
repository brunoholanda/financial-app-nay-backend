import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecurringSeries } from '../../database/entities/recurring-series.entity';
import { RecurringSeriesService } from './recurring-series.service';
import { RecurringSeriesController } from './recurring-series.controller';
import { CategoriesModule } from '../categories/categories.module';
import { WorkspaceAccountsModule } from '../workspace-accounts/workspace-accounts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RecurringSeries]),
    CategoriesModule,
    WorkspaceAccountsModule,
  ],
  controllers: [RecurringSeriesController],
  providers: [RecurringSeriesService],
  exports: [RecurringSeriesService],
})
export class RecurringModule {}
