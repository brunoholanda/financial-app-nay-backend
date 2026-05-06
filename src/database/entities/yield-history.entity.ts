import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Investment } from './investment.entity';

@Entity('yield_history')
export class YieldHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'investment_id' })
  investmentId: string;

  @ManyToOne(() => Investment, (i) => i.yieldHistory, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'investment_id' })
  investment: Investment;

  /** Data de referência (posição avaliada) */
  @Column({ type: 'date' })
  date: string;

  /** Posição marcada nesta data */
  @Column({ type: 'decimal', precision: 16, scale: 2 })
  value: string;

  /** Rendimento do dia (% ou valor absoluto, conforme preenchimento) */
  @Column({
    type: 'decimal',
    precision: 14,
    scale: 6,
    nullable: true,
    name: 'daily_yield',
  })
  dailyYield: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
