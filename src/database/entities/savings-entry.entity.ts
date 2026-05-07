import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Workspace } from './workspace.entity';

@Entity('savings_entries')
export class SavingsEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @Column({ type: 'varchar', length: 256 })
  title: string;

  /** Preço de referência (ex.: preço “cheio” ou sem desconto) */
  @Column({
    type: 'decimal',
    precision: 14,
    scale: 2,
    name: 'reference_amount',
  })
  referenceAmount: string;

  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'paid_amount' })
  paidAmount: string;

  /** reference_amount − paid_amount (persistido para agregações) */
  @Column({ type: 'decimal', precision: 14, scale: 2, name: 'saved_amount' })
  savedAmount: string;

  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
