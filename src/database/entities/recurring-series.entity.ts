import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { LedgerType } from '../../common/enums/ledger-type.enum';
import { PaymentSource } from '../../common/enums/payment-source.enum';
import { Workspace } from './workspace.entity';
import { Category } from './category.entity';
import { WorkspaceAccount } from './workspace-account.entity';

@Entity('recurring_series')
export class RecurringSeries {
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

  @ManyToOne(() => Category, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
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

  @Column({ type: 'date', name: 'start_date' })
  startDate: string;

  @Column({ type: 'date', name: 'end_date' })
  endDate: string;

  /** Dia do mês em que o débito/competência desta série aparece nos lançamentos (1–31). */
  @Column({
    type: 'int',
    name: 'debit_day_of_month',
    default: 1,
  })
  debitDayOfMonth: number;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({
    type: 'timestamptz',
    name: 'cancelled_at',
    nullable: true,
  })
  cancelledAt: Date | null;

  @Column({
    type: 'text',
    name: 'cancellation_reason',
    nullable: true,
  })
  cancellationReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
