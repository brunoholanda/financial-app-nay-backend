import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Category } from './category.entity';
import { Transaction } from './transaction.entity';
import { WorkspaceAccount } from './workspace-account.entity';

@Entity('workspaces')
export class Workspace {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'business_type' })
  businessType: string;

  @Column({ type: 'uuid', name: 'created_by_id' })
  createdById: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'created_by_id' })
  createdBy: User;

  @Column({
    name: 'pix_key_primary',
    type: 'varchar',
    length: 256,
    nullable: true,
  })
  pixKeyPrimary: string | null;

  @Column({
    name: 'pix_key_secondary',
    type: 'varchar',
    length: 256,
    nullable: true,
  })
  pixKeySecondary: string | null;

  @Column({
    name: 'banking_holder_name',
    type: 'varchar',
    length: 256,
    nullable: true,
  })
  bankingHolderName: string | null;

  @Column({
    name: 'banking_document',
    type: 'varchar',
    length: 32,
    nullable: true,
  })
  bankingDocument: string | null;

  @Column({ name: 'banking_notes', type: 'text', nullable: true })
  bankingNotes: string | null;

  @OneToMany(() => Category, (c) => c.workspace)
  categories: Category[];

  @OneToMany(() => Transaction, (t) => t.workspace)
  transactions: Transaction[];

  @OneToMany(() => WorkspaceAccount, (a) => a.workspace)
  accounts: WorkspaceAccount[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
