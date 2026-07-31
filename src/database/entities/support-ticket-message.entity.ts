import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SupportTicket } from './support-ticket.entity';
import { User } from './user.entity';

/** Mensagem da conversa de um chamado. */
@Entity('support_ticket_messages')
export class SupportTicketMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'ticket_id' })
  ticketId: string;

  @ManyToOne(() => SupportTicket, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ticket_id' })
  ticket: SupportTicket;

  @Column({ type: 'uuid', name: 'author_id', nullable: true })
  authorId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'author_id' })
  author: User | null;

  /** Nome guardado na mensagem: sobrevive à exclusão da conta. */
  @Column({ type: 'varchar', length: 160, name: 'author_name' })
  authorName: string;

  /** true quando quem escreveu foi a gestão da plataforma. */
  @Column({ name: 'from_manager', default: false })
  fromManager: boolean;

  /** Nota interna da gestão: o usuário não vê. */
  @Column({ name: 'is_internal', default: false })
  isInternal: boolean;

  @Column({ type: 'text' })
  body: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
