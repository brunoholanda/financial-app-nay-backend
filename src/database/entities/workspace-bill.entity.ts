import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PaymentSource } from '../../common/enums/payment-source.enum';
import { Workspace } from './workspace.entity';
import { Transaction } from './transaction.entity';
import { WorkspaceAccount } from './workspace-account.entity';

@Entity('workspace_bills')
export class WorkspaceBill {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ type: 'varchar', length: 256 })
  title: string;

  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
    name: 'amount',
  })
  amount: string;

  @Column({ type: 'date', name: 'due_date' })
  dueDate: string;

  /** Dias antes do vencimento para alertar “em breve” (não inclui o dia do vencimento). */
  @Column({ type: 'smallint', name: 'alert_days_before', default: 7 })
  alertDaysBefore: number;

  /** Conta mensal recorrente até recurrenceEndDate. */
  @Column({ name: 'is_recurring', default: false })
  isRecurring: boolean;

  /** Última data de vencimento permitida na série (inclusive). */
  @Column({ type: 'date', name: 'recurrence_end_date', nullable: true })
  recurrenceEndDate: string | null;

  @Column({ name: 'is_paid', default: false })
  isPaid: boolean;

  @Column({ type: 'date', name: 'paid_at', nullable: true })
  paidAt: string | null;

  @Column({
    type: 'enum',
    enum: PaymentSource,
    name: 'paid_payment_source',
    nullable: true,
  })
  paidPaymentSource: PaymentSource | null;

  @Column({
    type: 'uuid',
    name: 'paid_workspace_account_id',
    nullable: true,
  })
  paidWorkspaceAccountId: string | null;

  @ManyToOne(() => WorkspaceAccount, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'paid_workspace_account_id' })
  paidWorkspaceAccount: WorkspaceAccount | null;

  @Column({
    type: 'uuid',
    name: 'linked_transaction_id',
    nullable: true,
  })
  linkedTransactionId: string | null;

  @ManyToOne(() => Transaction, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'linked_transaction_id' })
  linkedTransaction: Transaction | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  /** Key R2 do comprovante de pagamento (imagem). */
  @Column({
    type: 'varchar',
    length: 280,
    name: 'receipt_object_key',
    nullable: true,
  })
  receiptObjectKey: string | null;

  @Column({
    type: 'varchar',
    length: 200,
    name: 'receipt_mime_type',
    nullable: true,
  })
  receiptMimeType: string | null;

  @Column({
    type: 'varchar',
    length: 512,
    name: 'receipt_original_file_name',
    nullable: true,
  })
  receiptOriginalFileName: string | null;

  @Column({ type: 'int', name: 'receipt_size_bytes', nullable: true })
  receiptSizeBytes: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
