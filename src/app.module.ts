import { Module } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './database/entities/user.entity';
import { LoginChallenge } from './database/entities/login-challenge.entity';
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
import { WorkspaceInsurance } from './database/entities/workspace-insurance.entity';
import { WorkspaceBill } from './database/entities/workspace-bill.entity';
import { SupportTicket } from './database/entities/support-ticket.entity';
import { SupportTicketMessage } from './database/entities/support-ticket-message.entity';
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
import { InsurancesModule } from './modules/insurances/insurances.module';
import { BillsModule } from './modules/bills/bills.module';
import { BankImportModule } from './modules/bank-import/bank-import.module';
import { MailModule } from './modules/mail/mail.module';
import { BillingModule } from './modules/billing/billing.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { ManagerModule } from './modules/manager/manager.module';
import { HealthModule } from './modules/health/health.module';
import { SubscriptionInterceptor } from './common/interceptors/subscription.interceptor';
import { RateLimitGuard } from './common/guards/rate-limit.guard';
import { rateLimitOptions } from './common/rate-limit.options';
import { SeedService } from './database/seed.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: rateLimitOptions,
    }),
    MailModule,
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
          LoginChallenge,
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
          WorkspaceInsurance,
          WorkspaceBill,
          SupportTicket,
          SupportTicketMessage,
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
    InsurancesModule,
    BillsModule,
    BankImportModule,
    BillingModule,
    TicketsModule,
    ManagerModule,
    HealthModule,
  ],
  providers: [
    SeedService,
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_INTERCEPTOR, useClass: SubscriptionInterceptor },
  ],
})
export class AppModule {}
