import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../../database/entities/user.entity';
import { BillingService } from './billing.service';
import { BillingMailService } from './billing-mail.service';
import { BillingSyncScheduler } from './billing-sync.scheduler';
import { BillingController } from './billing.controller';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [BillingController],
  providers: [BillingService, BillingMailService, BillingSyncScheduler],
  exports: [BillingService],
})
export class BillingModule {}
