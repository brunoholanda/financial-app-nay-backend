import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ManagerGuard } from '../../common/guards/manager.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { ManagerService } from './manager.service';
import { ListUsersQueryDto, UpdateManagedUserDto } from './dto/manager.dto';
import { TicketsService } from '../tickets/tickets.service';
import {
  CreateTicketMessageDto,
  ListTicketsQueryDto,
  UpdateTicketDto,
} from '../tickets/dto/ticket.dto';

/** Todas as rotas exigem a flag de gestão no banco (não só o token). */
// Rotas do dono do sistema: ficam fora da especificação pública.
@ApiExcludeController()
@Controller('manager')
@UseGuards(JwtAuthGuard, ManagerGuard)
export class ManagerController {
  constructor(
    private readonly manager: ManagerService,
    private readonly tickets: TicketsService,
  ) {}

  @Get('overview')
  overview() {
    return this.manager.overview();
  }

  @Get('users')
  users(@Query() query: ListUsersQueryDto) {
    return this.manager.listUsers(query);
  }

  @Get('users/:id')
  user(@Param('id', ParseUUIDPipe) id: string) {
    return this.manager.getUser(id);
  }

  @Patch('users/:id')
  updateUser(
    @CurrentUser() manager: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateManagedUserDto,
  ) {
    return this.manager.updateUser(manager.sub, id, dto);
  }

  @Post('users/:id/sync')
  syncUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.manager.syncUser(id);
  }

  @Get('payments')
  payments(@Query() query: ListUsersQueryDto) {
    return this.manager.payments(query);
  }

  @Get('payments/:id/invoices')
  invoices(@Param('id', ParseUUIDPipe) id: string) {
    return this.manager.invoices(id);
  }

  @Post('payments/reconcile')
  reconcile() {
    return this.manager.reconcileAll();
  }

  @Get('tickets')
  ticketList(@Query() query: ListTicketsQueryDto) {
    return this.tickets.listForManager(query);
  }

  @Get('tickets/:id')
  ticket(@Param('id', ParseUUIDPipe) id: string) {
    return this.tickets.getForManager(id);
  }

  @Post('tickets/:id/messages')
  ticketReply(
    @CurrentUser() manager: JwtPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTicketMessageDto,
  ) {
    return this.tickets.replyAsManager(manager, id, dto);
  }

  @Patch('tickets/:id')
  ticketUpdate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTicketDto,
  ) {
    return this.tickets.updateAsManager(id, dto);
  }
}
