import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { TicketsService } from './tickets.service';
import {
  CreateTicketDto,
  CreateTicketMessageDto,
  ListTicketsQueryDto,
} from './dto/ticket.dto';

/** Chamados do próprio usuário: abrir, acompanhar, responder e encerrar. */
@ApiTags('Chamados')
@ApiBearerAuth()
@Controller('tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly tickets: TicketsService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload, @Query() query: ListTicketsQueryDto) {
    return this.tickets.listForUser(user.sub, query);
  }

  @Get('unread-count')
  async unreadCount(@CurrentUser() user: JwtPayload) {
    return { unread: await this.tickets.countUnreadForUser(user.sub) };
  }

  @Get(':id')
  get(@CurrentUser() user: JwtPayload, @Param('id', ParseUUIDPipe) id: string) {
    return this.tickets.getForUser(user.sub, id);
  }

  /** Cada chamado novo dispara e-mail para a gestão: limite conservador. */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 600_000 } })
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateTicketDto) {
    return this.tickets.createForUser(user, dto);
  }

  @Post(':id/messages')
  @Throttle({ default: { limit: 30, ttl: 600_000 } })
  reply(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTicketMessageDto,
  ) {
    return this.tickets.replyAsUser(user, id, dto);
  }

  @Post(':id/close')
  close(
    @CurrentUser() user: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tickets.closeAsUser(user.sub, id);
  }
}
