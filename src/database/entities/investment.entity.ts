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
import { InvestmentInstrumentType } from '../../common/enums/investment-instrument.enum';
import { InvestmentLiquidityType } from '../../common/enums/investment-liquidity.enum';
import { InvestmentPortfolioCategory } from '../../common/enums/investment-portfolio-category.enum';
import { InvestmentYieldType } from '../../common/enums/investment-yield-type.enum';
import { WorkspaceAccount } from './workspace-account.entity';
import { Workspace } from './workspace.entity';
import { InvestmentTransaction } from './investment-transaction.entity';
import { YieldHistory } from './yield-history.entity';

@Entity('investments')
export class Investment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId: string;

  @ManyToOne(() => Workspace, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace;

  /** Conta registrada no espaço (ex.: banco, carteira) onde o ativo está vinculado */
  @Column({ type: 'uuid', name: 'workspace_account_id' })
  workspaceAccountId: string;

  @ManyToOne(() => WorkspaceAccount, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'workspace_account_id' })
  workspaceAccount: WorkspaceAccount;

  @Column({ type: 'varchar', length: 256 })
  name: string;

  @Column({
    type: 'enum',
    enum: InvestmentInstrumentType,
    name: 'instrument_type',
  })
  instrumentType: InvestmentInstrumentType;

  @Column({
    type: 'enum',
    enum: InvestmentPortfolioCategory,
  })
  category: InvestmentPortfolioCategory;

  @Column({
    type: 'decimal',
    precision: 16,
    scale: 2,
    name: 'invested_amount',
  })
  investedAmount: string;

  @Column({
    type: 'decimal',
    precision: 16,
    scale: 2,
    name: 'current_amount',
  })
  currentAmount: string;

  @Column({
    type: 'enum',
    enum: InvestmentYieldType,
    name: 'yield_type',
  })
  yieldType: InvestmentYieldType;

  /** Ex.: CDI, IPCA, SELIC */
  @Column({ type: 'varchar', length: 64, nullable: true })
  indexer: string | null;

  /** Ex.: 110 (% CDI) ou 12.5 (% a.a.) */
  @Column({ type: 'decimal', precision: 12, scale: 4, nullable: true })
  rate: string | null;

  @Column({ type: 'date', name: 'start_date' })
  startDate: string;

  @Column({ type: 'date', name: 'end_date', nullable: true })
  endDate: string | null;

  @Column({
    type: 'enum',
    enum: InvestmentLiquidityType,
    name: 'liquidity_type',
  })
  liquidityType: InvestmentLiquidityType;

  @OneToMany(() => InvestmentTransaction, (t) => t.investment)
  transactions: InvestmentTransaction[];

  @OneToMany(() => YieldHistory, (y) => y.investment)
  yieldHistory: YieldHistory[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
