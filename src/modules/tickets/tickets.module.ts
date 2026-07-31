import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupportTicket } from '../../database/entities/support-ticket.entity';
import { SupportTicketMessage } from '../../database/entities/support-ticket-message.entity';
import { User } from '../../database/entities/user.entity';
import { TicketsController } from './tickets.controller';
import { TicketsService } from './tickets.service';
import { SupportMailService } from './support-mail.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([SupportTicket, SupportTicketMessage, User]),
  ],
  controllers: [TicketsController],
  providers: [TicketsService, SupportMailService],
  exports: [TicketsService],
})
export class TicketsModule {}
