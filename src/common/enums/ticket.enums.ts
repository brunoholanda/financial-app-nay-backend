/** Assunto do chamado, escolhido por quem abre. */
export enum TicketCategory {
  SUPPORT = 'SUPPORT',
  SUGGESTION = 'SUGGESTION',
  BUG = 'BUG',
  BILLING = 'BILLING',
  OTHER = 'OTHER',
}

/** Andamento do chamado; só a gestão muda o status. */
export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_USER = 'WAITING_USER',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum TicketPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

/** Status em que o chamado ainda está na fila de atendimento. */
export const OPEN_TICKET_STATUSES = [
  TicketStatus.OPEN,
  TicketStatus.IN_PROGRESS,
  TicketStatus.WAITING_USER,
];
