import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../database/entities/user.entity';
import { Workspace } from '../database/entities/workspace.entity';
import { WorkspaceDocument } from '../database/entities/workspace-document.entity';
import { WorkspaceAccessService } from './services/workspace-access.service';
import { SubscriptionAccessService } from './services/subscription-access.service';
import { DocumentQuotaService } from './services/document-quota.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([Workspace, User, WorkspaceDocument])],
  providers: [
    WorkspaceAccessService,
    SubscriptionAccessService,
    DocumentQuotaService,
  ],
  exports: [
    WorkspaceAccessService,
    SubscriptionAccessService,
    DocumentQuotaService,
  ],
})
export class CommonModule {}
