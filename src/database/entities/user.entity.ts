import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserRole } from '../../common/enums/user-role.enum';
import { Workspace } from './workspace.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ type: 'enum', enum: UserRole })
  role: UserRole;

  @Column({ type: 'uuid', nullable: true, name: 'workspace_id' })
  workspaceId: string | null;

  @ManyToOne(() => Workspace, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace | null;

  /** Clientes inativos não autenticam; MASTER deve permanecer ativo. */
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /** E-mail diário de contas vencidas / que vencem hoje. */
  @Column({ name: 'email_notify_bills', default: true })
  emailNotifyBills: boolean;

  /** E-mail diário de seguros vencidos / a vencer. */
  @Column({ name: 'email_notify_insurances', default: true })
  emailNotifyInsurances: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
