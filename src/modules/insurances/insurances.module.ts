import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceInsurance } from '../../database/entities/workspace-insurance.entity';
import { InsurancesService } from './insurances.service';
import { InsurancesController } from './insurances.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceInsurance])],
  controllers: [InsurancesController],
  providers: [InsurancesService],
})
export class InsurancesModule {}
