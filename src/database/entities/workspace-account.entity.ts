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

@Entity('workspace_accounts')
export class WorkspaceAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'bank_name', type: 'varchar', nullable: true })
  bankName: string | null;

  @Column({ type: 'varchar', nullable: true })
  branch: string | null;

  @Column({ name: 'account_number', type: 'varchar', nullable: true })
  accountNumber: string | null;

  @Column({ name: 'pix_key_primary', type: 'varchar', nullable: true })
  pixKeyPrimary: string | null;

  @Column({ name: 'pix_key_secondary', type: 'varchar', nullable: true })
  pixKeySecondary: string | null;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId: string;

  @ManyToOne(() => Workspace, (w) => w.accounts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
