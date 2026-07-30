import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceInsurance } from '../../database/entities/workspace-insurance.entity';
import { Workspace } from '../../database/entities/workspace.entity';
import { InsurancesService } from './insurances.service';
import { InsurancesController } from './insurances.controller';
import { InsurancesAlertDigestService } from './insurances-alert-digest.service';
import { InsurancesAlertScheduler } from './insurances-alert.scheduler';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceInsurance, Workspace])],
  controllers: [InsurancesController],
  providers: [
    InsurancesService,
    InsurancesAlertDigestService,
    InsurancesAlertScheduler,
  ],
  exports: [InsurancesService, InsurancesAlertDigestService],
})
export class InsurancesModule {}
