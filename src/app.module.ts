import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './database/entities/user.entity';
import { Workspace } from './database/entities/workspace.entity';
import { Category } from './database/entities/category.entity';
import { Transaction } from './database/entities/transaction.entity';
import { RecurringSeries } from './database/entities/recurring-series.entity';
import { WorkspaceAccount } from './database/entities/workspace-account.entity';
import { Investment } from './database/entities/investment.entity';
import { InvestmentTransaction } from './database/entities/investment-transaction.entity';
import { YieldHistory } from './database/entities/yield-history.entity';
import { SavingsEntry } from './database/entities/savings-entry.entity';
import { WorkspaceDocument } from './database/entities/workspace-document.entity';
import { CommonModule } from './common/common.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { RecurringModule } from './modules/recurring/recurring.module';
import { WorkspaceAccountsModule } from './modules/workspace-accounts/workspace-accounts.module';
import { InvestmentsModule } from './modules/investments/investments.module';
import { SavingsModule } from './modules/savings/savings.module';
import { WorkspaceDocumentsModule } from './modules/workspace-documents/workspace-documents.module';
import { SeedService } from './database/seed.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get('DATABASE_HOST', 'localhost'),
        port: config.get('DATABASE_PORT', 5432),
        username: config.get('DATABASE_USER', 'postgres'),
        password: config.get('DATABASE_PASSWORD', 'postgres'),
        database: config.get('DATABASE_NAME', 'finance_app'),
        entities: [
          User,
          Workspace,
          Category,
          Transaction,
          RecurringSeries,
          WorkspaceAccount,
          Investment,
          InvestmentTransaction,
          YieldHistory,
          SavingsEntry,
          WorkspaceDocument,
        ],
        synchronize: config.get('DATABASE_SYNC', 'true') === 'true',
        logging: config.get('DATABASE_LOGGING', 'false') === 'true',
      }),
    }),
    TypeOrmModule.forFeature([User]),
    CommonModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    CategoriesModule,
    TransactionsModule,
    DashboardModule,
    RecurringModule,
    WorkspaceAccountsModule,
    InvestmentsModule,
    SavingsModule,
    WorkspaceDocumentsModule,
  ],
  providers: [SeedService],
})
export class AppModule {}
