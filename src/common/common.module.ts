import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Workspace } from '../database/entities/workspace.entity';
import { WorkspaceAccessService } from './services/workspace-access.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Workspace])],
  providers: [WorkspaceAccessService],
  exports: [WorkspaceAccessService],
})
export class CommonModule {}
