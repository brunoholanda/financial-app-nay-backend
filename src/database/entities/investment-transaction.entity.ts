import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { InvestmentTransactionKind } from '../../common/enums/investment-transaction-type.enum';
import { Investment } from './investment.entity';

@Entity('investment_transactions')
export class InvestmentTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'investment_id' })
  investmentId: string;

  @ManyToOne(() => Investment, (i) => i.transactions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'investment_id' })
  investment: Investment;

  @Column({
    type: 'enum',
    enum: InvestmentTransactionKind,
    name: 'kind',
  })
  kind: InvestmentTransactionKind;

  @Column({ type: 'decimal', precision: 16, scale: 2 })
  amount: string;

  @Column({ type: 'date' })
  date: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
