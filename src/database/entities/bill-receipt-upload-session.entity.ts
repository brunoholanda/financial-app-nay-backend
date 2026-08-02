import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { WorkspaceBill } from './workspace-bill.entity';
import { Workspace } from './workspace.entity';

@Entity('bill_receipt_upload_sessions')
export class BillReceiptUploadSession {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'uuid' })
  token: string;

  @Column({ type: 'uuid', name: 'bill_id' })
  billId: string;

  @ManyToOne(() => WorkspaceBill, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'bill_id' })
  bill: WorkspaceBill;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt: Date;

  @Column({ type: 'timestamptz', name: 'consumed_at', nullable: true })
  consumedAt: Date | null;

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
}
