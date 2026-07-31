import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, In, Repository } from 'typeorm';
import { SupportTicket } from '../../database/entities/support-ticket.entity';
import { SupportTicketMessage } from '../../database/entities/support-ticket-message.entity';
import { User } from '../../database/entities/user.entity';
import {
  OPEN_TICKET_STATUSES,
  TicketPriority,
  TicketStatus,
} from '../../common/enums/ticket.enums';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { SupportMailService } from './support-mail.service';
import {
  CreateTicketDto,
  CreateTicketMessageDto,
  ListTicketsQueryDto,
  UpdateTicketDto,
} from './dto/ticket.dto';

export type TicketListItem = {
  id: string;
  number: number;
  subject: string;
  category: SupportTicket['category'];
  status: TicketStatus;
  priority: TicketPriority;
  createdAt: string;
  lastMessageAt: string;
  closedAt: string | null;
  messageCount: number;
  unread: boolean;
  requester: { id: string; name: string; email: string; role: string } | null;
};

export type TicketMessageView = {
  id: string;
  authorName: string;
  fromManager: boolean;
  isInternal: boolean;
  body: string;
  createdAt: string;
};

export type TicketDetail = TicketListItem & {
  messages: TicketMessageView[];
};

@Injectable()
export class TicketsService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketRepo: Repository<SupportTicket>,
    @InjectRepository(SupportTicketMessage)
    private readonly messageRepo: Repository<SupportTicketMessage>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly mail: SupportMailService,
  ) {}

  /* ---------------- usuário ---------------- */

  async createForUser(
    payload: JwtPayload,
    dto: CreateTicketDto,
  ): Promise<TicketDetail> {
    const user = await this.requireUser(payload.sub);
    const now = new Date();
    const ticket = await this.ticketRepo.save(
      this.ticketRepo.create({
        number: await this.nextNumber(),
        requesterId: user.id,
        workspaceId: payload.workspaceId ?? null,
        category: dto.category,
        priority: TicketPriority.NORMAL,
        status: TicketStatus.OPEN,
        subject: dto.subject.trim(),
        lastMessageAt: now,
        managerUnread: true,
        requesterUnread: false,
      }),
    );
    await this.messageRepo.save(
      this.messageRepo.create({
        ticketId: ticket.id,
        authorId: user.id,
        authorName: user.name,
        fromManager: false,
        isInternal: false,
        body: dto.message.trim(),
      }),
    );

    await this.mail.notifyManagersNewTicket({
      ticket,
      requester: user,
      body: dto.message.trim(),
      managerEmails: await this.managerEmails(),
    });

    return this.detailFor(ticket.id, false);
  }

  async listForUser(
    userId: string,
    query?: ListTicketsQueryDto,
  ): Promise<TicketListItem[]> {
    const tickets = await this.buildList(query)
      .andWhere('t.requesterId = :userId', { userId })
      .getMany();
    return this.decorate(tickets, false);
  }

  /** Abrir o chamado marca as respostas da gestão como lidas. */
  async getForUser(userId: string, id: string): Promise<TicketDetail> {
    const ticket = await this.requireTicket(id);
    if (ticket.requesterId !== userId) {
      throw new NotFoundException('Chamado não encontrado');
    }
    if (ticket.requesterUnread) {
      ticket.requesterUnread = false;
      await this.ticketRepo.save(ticket);
    }
    return this.detailFor(id, false);
  }

  async replyAsUser(
    payload: JwtPayload,
    id: string,
    dto: CreateTicketMessageDto,
  ): Promise<TicketDetail> {
    const user = await this.requireUser(payload.sub);
    const ticket = await this.requireTicket(id);
    if (ticket.requesterId !== user.id) {
      throw new NotFoundException('Chamado não encontrado');
    }

    await this.messageRepo.save(
      this.messageRepo.create({
        ticketId: ticket.id,
        authorId: user.id,
        authorName: user.name,
        fromManager: false,
        isInternal: false,
        body: dto.body.trim(),
      }),
    );

    ticket.lastMessageAt = new Date();
    ticket.managerUnread = true;
    ticket.requesterUnread = false;
    // Resposta do usuário reabre o que já estava fechado.
    if (
      ticket.status === TicketStatus.RESOLVED ||
      ticket.status === TicketStatus.CLOSED
    ) {
      ticket.status = TicketStatus.OPEN;
      ticket.closedAt = null;
    } else if (ticket.status === TicketStatus.WAITING_USER) {
      ticket.status = TicketStatus.IN_PROGRESS;
    }
    await this.ticketRepo.save(ticket);

    await this.mail.notifyManagersReply({
      ticket,
      requester: user,
      body: dto.body.trim(),
      managerEmails: await this.managerEmails(),
    });

    return this.detailFor(id, false);
  }

  async closeAsUser(userId: string, id: string): Promise<TicketDetail> {
    const ticket = await this.requireTicket(id);
    if (ticket.requesterId !== userId) {
      throw new NotFoundException('Chamado não encontrado');
    }
    ticket.status = TicketStatus.CLOSED;
    ticket.closedAt = new Date();
    ticket.managerUnread = false;
    await this.ticketRepo.save(ticket);
    return this.detailFor(id, false);
  }

  /** Quantidade de respostas da gestão que o usuário ainda não abriu. */
  countUnreadForUser(userId: string): Promise<number> {
    return this.ticketRepo.count({
      where: { requesterId: userId, requesterUnread: true },
    });
  }

  /* ---------------- gestão ---------------- */

  async listForManager(query?: ListTicketsQueryDto): Promise<TicketListItem[]> {
    const tickets = await this.buildList(query).getMany();
    return this.decorate(tickets, true);
  }

  async getForManager(id: string): Promise<TicketDetail> {
    const ticket = await this.requireTicket(id);
    if (ticket.managerUnread) {
      ticket.managerUnread = false;
      await this.ticketRepo.save(ticket);
    }
    return this.detailFor(id, true);
  }

  async replyAsManager(
    payload: JwtPayload,
    id: string,
    dto: CreateTicketMessageDto,
  ): Promise<TicketDetail> {
    const manager = await this.requireUser(payload.sub);
    const ticket = await this.requireTicket(id);
    const internal = dto.internal === true;

    await this.messageRepo.save(
      this.messageRepo.create({
        ticketId: ticket.id,
        authorId: manager.id,
        authorName: manager.name,
        fromManager: true,
        isInternal: internal,
        body: dto.body.trim(),
      }),
    );

    ticket.managerUnread = false;
    if (!internal) {
      ticket.lastMessageAt = new Date();
      ticket.requesterUnread = true;
      if (
        ticket.status === TicketStatus.OPEN ||
        ticket.status === TicketStatus.IN_PROGRESS
      ) {
        ticket.status = TicketStatus.WAITING_USER;
      }
    }
    await this.ticketRepo.save(ticket);

    if (!internal) {
      const requester = await this.userRepo.findOne({
        where: { id: ticket.requesterId },
      });
      if (requester) {
        await this.mail.notifyRequesterReply({
          ticket,
          requester,
          body: dto.body.trim(),
        });
      }
    }

    return this.detailFor(id, true);
  }

  async updateAsManager(
    id: string,
    dto: UpdateTicketDto,
  ): Promise<TicketDetail> {
    const ticket = await this.requireTicket(id);
    if (dto.priority) {
      ticket.priority = dto.priority;
    }
    if (dto.status) {
      ticket.status = dto.status;
      ticket.closedAt =
        dto.status === TicketStatus.CLOSED ||
        dto.status === TicketStatus.RESOLVED
          ? (ticket.closedAt ?? new Date())
          : null;
    }
    await this.ticketRepo.save(ticket);
    return this.detailFor(id, true);
  }

  async managerStats(): Promise<{
    open: number;
    waitingManager: number;
    total: number;
  }> {
    const [open, waitingManager, total] = await Promise.all([
      this.ticketRepo.count({ where: { status: In(OPEN_TICKET_STATUSES) } }),
      this.ticketRepo.count({ where: { managerUnread: true } }),
      this.ticketRepo.count(),
    ]);
    return { open, waitingManager, total };
  }

  /* ---------------- apoio ---------------- */

  private buildList(query?: ListTicketsQueryDto) {
    const qb = this.ticketRepo
      .createQueryBuilder('t')
      .leftJoinAndSelect('t.requester', 'requester')
      .orderBy('t.lastMessageAt', 'DESC');

    if (query?.status) {
      qb.andWhere('t.status = :status', { status: query.status });
    } else if (query?.scope === 'open') {
      qb.andWhere('t.status IN (:...statuses)', {
        statuses: OPEN_TICKET_STATUSES,
      });
    }
    if (query?.category) {
      qb.andWhere('t.category = :category', { category: query.category });
    }
    if (query?.q?.trim()) {
      const term = `%${query.q.trim()}%`;
      qb.andWhere(
        new Brackets((w) => {
          w.where('t.subject ILIKE :term', { term })
            .orWhere('requester.name ILIKE :term', { term })
            .orWhere('requester.email ILIKE :term', { term });
        }),
      );
    }
    return qb;
  }

  private async decorate(
    tickets: SupportTicket[],
    forManager: boolean,
  ): Promise<TicketListItem[]> {
    if (!tickets.length) return [];
    const counts = await this.messageRepo
      .createQueryBuilder('m')
      .select('m.ticketId', 'ticketId')
      .addSelect('COUNT(*)', 'total')
      .where('m.ticketId IN (:...ids)', { ids: tickets.map((t) => t.id) })
      .andWhere(forManager ? '1 = 1' : 'm.isInternal = false')
      .groupBy('m.ticketId')
      .getRawMany<{ ticketId: string; total: string }>();
    const byTicket = new Map(
      counts.map((row) => [row.ticketId, Number(row.total)]),
    );
    return tickets.map((ticket) =>
      this.toListItem(ticket, byTicket.get(ticket.id) ?? 0, forManager),
    );
  }

  private async detailFor(
    id: string,
    forManager: boolean,
  ): Promise<TicketDetail> {
    const ticket = await this.ticketRepo.findOne({
      where: { id },
      relations: { requester: true },
    });
    if (!ticket) {
      throw new NotFoundException('Chamado não encontrado');
    }
    const messages = await this.messageRepo.find({
      where: forManager
        ? { ticketId: id }
        : { ticketId: id, isInternal: false },
      order: { createdAt: 'ASC' },
    });
    return {
      ...this.toListItem(ticket, messages.length, forManager),
      messages: messages.map((m) => ({
        id: m.id,
        authorName: m.authorName,
        fromManager: m.fromManager,
        isInternal: m.isInternal,
        body: m.body,
        createdAt: m.createdAt.toISOString(),
      })),
    };
  }

  private toListItem(
    ticket: SupportTicket,
    messageCount: number,
    forManager: boolean,
  ): TicketListItem {
    return {
      id: ticket.id,
      number: ticket.number,
      subject: ticket.subject,
      category: ticket.category,
      status: ticket.status,
      priority: ticket.priority,
      createdAt: ticket.createdAt.toISOString(),
      lastMessageAt: ticket.lastMessageAt.toISOString(),
      closedAt: ticket.closedAt?.toISOString() ?? null,
      messageCount,
      unread: forManager ? ticket.managerUnread : ticket.requesterUnread,
      requester: ticket.requester
        ? {
            id: ticket.requester.id,
            name: ticket.requester.name,
            email: ticket.requester.email,
            role: ticket.requester.role,
          }
        : null,
    };
  }

  private async nextNumber(): Promise<number> {
    const row = await this.ticketRepo
      .createQueryBuilder('t')
      .select('COALESCE(MAX(t.number), 0)', 'max')
      .getRawOne<{ max: string }>();
    return Number(row?.max ?? 0) + 1;
  }

  private async requireTicket(id: string): Promise<SupportTicket> {
    const ticket = await this.ticketRepo.findOne({ where: { id } });
    if (!ticket) {
      throw new NotFoundException('Chamado não encontrado');
    }
    return ticket;
  }

  private async requireUser(id: string): Promise<User> {
    const user = await this.userRepo.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return user;
  }

  /** Destinatários dos avisos de chamado: contas com a flag de gestão. */
  private async managerEmails(): Promise<string[]> {
    const managers = await this.userRepo.find({
      where: { isManager: true, isActive: true },
      select: ['email'],
    });
    return managers.map((m) => m.email);
  }
}
