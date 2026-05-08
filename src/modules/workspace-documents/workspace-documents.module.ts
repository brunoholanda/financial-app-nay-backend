import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkspaceDocument } from '../../database/entities/workspace-document.entity';
import { WorkspaceDocumentsService } from './workspace-documents.service';
import { WorkspaceDocumentsController } from './workspace-documents.controller';

@Module({
  imports: [TypeOrmModule.forFeature([WorkspaceDocument])],
  controllers: [WorkspaceDocumentsController],
  providers: [WorkspaceDocumentsService],
})
export class WorkspaceDocumentsModule {}
