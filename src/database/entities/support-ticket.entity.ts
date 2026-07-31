import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../../common/enums/ticket.enums';
import { User } from './user.entity';
import { Workspace } from './workspace.entity';
import { SupportTicketMessage } from './support-ticket-message.entity';

/** Chamado ou sugestão aberto por um usuário e atendido pela gestão. */
@Entity('support_tickets')
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Número curto exibido ao usuário (#128). */
  @Index({ unique: true })
  @Column({ type: 'int', name: 'number' })
  number: number;

  @Column({ type: 'uuid', name: 'requester_id' })
  requesterId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requester_id' })
  requester: User;

  /** Espaço em que o usuário estava ao abrir o chamado (contexto). */
  @Column({ type: 'uuid', name: 'workspace_id', nullable: true })
  workspaceId: string | null;

  @ManyToOne(() => Workspace, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'workspace_id' })
  workspace: Workspace | null;

  @Column({ type: 'varchar', length: 16, default: TicketCategory.SUPPORT })
  category: TicketCategory;

  @Column({ type: 'varchar', length: 16, default: TicketPriority.NORMAL })
  priority: TicketPriority;

  @Column({ type: 'varchar', length: 16, default: TicketStatus.OPEN })
  status: TicketStatus;

  @Column({ type: 'varchar', length: 180 })
  subject: string;

  /** Data da última mensagem: ordena a fila de atendimento. */
  @Column({ type: 'timestamptz', name: 'last_message_at' })
  lastMessageAt: Date;

  /** Há mensagem do usuário ainda não lida pela gestão. */
  @Column({ name: 'manager_unread', default: true })
  managerUnread: boolean;

  /** Há resposta da gestão ainda não lida pelo usuário. */
  @Column({ name: 'requester_unread', default: false })
  requesterUnread: boolean;

  @Column({ type: 'timestamptz', name: 'closed_at', nullable: true })
  closedAt: Date | null;

  @OneToMany(() => SupportTicketMessage, (m) => m.ticket)
  messages: SupportTicketMessage[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
