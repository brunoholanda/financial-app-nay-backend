import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InsuranceType } from '../../common/enums/insurance-type.enum';
import { InsurancePaymentMode } from '../../common/enums/insurance-payment-mode.enum';
import { Workspace } from './workspace.entity';

export type InsuranceCoverageRow = {
  label: string;
  details?: string | null;
};

@Entity('workspace_insurances')
export class WorkspaceInsurance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  /** Nome amigável / identificação do contrato */
  @Column({ type: 'varchar', length: 256 })
  title: string;

  @Column({
    type: 'enum',
    enum: InsuranceType,
    name: 'insurance_type',
  })
  insuranceType: InsuranceType;

  @Column({ type: 'varchar', length: 256, name: 'insurer_name', nullable: true })
  insurerName: string | null;

  @Column({ type: 'varchar', length: 120, name: 'policy_number', nullable: true })
  policyNumber: string | null;

  /** Importância segurada / cobertura principal (referência financeira) */
  @Column({
    type: 'decimal',
    precision: 16,
    scale: 2,
    name: 'insured_capital',
  })
  insuredCapital: string;

  /** Prêmio total contratado */
  @Column({
    type: 'decimal',
    precision: 16,
    scale: 2,
    name: 'premium_total',
  })
  premiumTotal: string;

  @Column({
    type: 'enum',
    enum: InsurancePaymentMode,
    name: 'payment_mode',
  })
  paymentMode: InsurancePaymentMode;

  @Column({ type: 'smallint', name: 'installment_count', nullable: true })
  installmentCount: number | null;

  @Column({
    type: 'decimal',
    precision: 16,
    scale: 2,
    name: 'installment_value',
    nullable: true,
  })
  installmentValue: string | null;

  @Column({ type: 'jsonb', nullable: false })
  coverages: InsuranceCoverageRow[];

  @Column({ type: 'date', name: 'validity_start' })
  validityStart: string;

  @Column({ type: 'date', name: 'validity_end' })
  validityEnd: string;

  /** Dias antes do fim da vigência para considerar “próximo ao vencimento” */
  @Column({ type: 'smallint', name: 'alert_days_before', default: 30 })
  alertDaysBefore: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
