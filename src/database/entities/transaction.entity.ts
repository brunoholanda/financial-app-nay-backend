import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LedgerType } from '../../common/enums/ledger-type.enum';
import { PaymentSource } from '../../common/enums/payment-source.enum';
import { Category } from './category.entity';
import { Workspace } from './workspace.entity';
import { WorkspaceAccount } from './workspace-account.entity';

@Entity('transactions')
@Index(
  'uq_transactions_ws_account_fitid',
  ['workspaceId', 'workspaceAccountId', 'bankFitId'],
  {
    unique: true,
    where: '"bank_fit_id" IS NOT NULL',
  },
)
export class Transaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column({ type: 'decimal', precision: 14, scale: 2 })
  amount: string;

  @Column({ type: 'enum', enum: LedgerType })
  type: LedgerType;

  @Column({ type: 'uuid', name: 'category_id' })
  categoryId: string;

  @ManyToOne(() => Category, (c) => c.transactions, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId: string;

  @ManyToOne(() => Workspace, (w) => w.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({
    type: 'enum',
    enum: PaymentSource,
    name: 'payment_source',
    default: PaymentSource.CASH,
  })
  paymentSource: PaymentSource;

  @Column({ type: 'uuid', name: 'workspace_account_id', nullable: true })
  workspaceAccountId: string | null;

  @ManyToOne(() => WorkspaceAccount, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'workspace_account_id' })
  workspaceAccount: WorkspaceAccount | null;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  /** FITID do extrato OFX — deduplica reimportações na mesma conta. */
  @Column({ type: 'varchar', length: 128, name: 'bank_fit_id', nullable: true })
  bankFitId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
