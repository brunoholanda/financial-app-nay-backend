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
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { PlanTier } from '../../common/enums/plan-tier.enum';
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

  /**
   * Dono da plataforma: acessa a área de gestão (todos os usuários, chamados e
   * pagamentos). Ligado direto no banco ou por MANAGER_EMAILS.
   */
  @Column({ name: 'is_manager', default: false })
  isManager: boolean;

  /** E-mail diário de contas vencidas / que vencem hoje. */
  @Column({ name: 'email_notify_bills', default: true })
  emailNotifyBills: boolean;

  /** E-mail diário de seguros vencidos / a vencer. */
  @Column({ name: 'email_notify_insurances', default: true })
  emailNotifyInsurances: boolean;

  /**
   * Licença de uso: vale para a conta MASTER. Clientes (USER) herdam o acesso
   * do MASTER dono do espaço.
   */
  @Column({
    name: 'subscription_status',
    type: 'varchar',
    length: 16,
    default: SubscriptionStatus.TRIALING,
  })
  subscriptionStatus: SubscriptionStatus;

  /** Plano contratado: Premium soma o adicional e libera documentos sem limite. */
  @Column({
    name: 'plan_tier',
    type: 'varchar',
    length: 16,
    default: PlanTier.STANDARD,
  })
  planTier: PlanTier;

  /** Fim do teste grátis; enquanto futuro, o acesso está liberado. */
  @Column({ name: 'trial_ends_at', type: 'timestamptz', nullable: true })
  trialEndsAt: Date | null;

  /** Fim do período pago (renovação ou data limite após cancelamento). */
  @Column({ name: 'subscription_ends_at', type: 'timestamptz', nullable: true })
  subscriptionEndsAt: Date | null;

  /** Contas isentas de licença: dono da plataforma e contas anteriores ao plano. */
  @Column({ name: 'license_exempt', default: false })
  licenseExempt: boolean;

  @Column({
    name: 'stripe_customer_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  stripeCustomerId: string | null;

  @Column({
    name: 'stripe_subscription_id',
    type: 'varchar',
    length: 64,
    nullable: true,
  })
  stripeSubscriptionId: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
