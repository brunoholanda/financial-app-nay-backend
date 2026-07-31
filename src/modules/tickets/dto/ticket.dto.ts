import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../../../common/enums/ticket.enums';

export class CreateTicketDto {
  @IsEnum(TicketCategory)
  category: TicketCategory;

  @IsString()
  @MinLength(4)
  @MaxLength(180)
  subject: string;

  @IsString()
  @MinLength(10)
  @MaxLength(4000)
  message: string;
}

export class CreateTicketMessageDto {
  @IsString()
  @MinLength(2)
  @MaxLength(4000)
  body: string;

  /** Só a gestão usa: nota interna que o usuário não vê. */
  @IsOptional()
  @IsBoolean()
  internal?: boolean;
}

export class UpdateTicketDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketPriority)
  priority?: TicketPriority;
}

export class ListTicketsQueryDto {
  @IsOptional()
  @IsEnum(TicketStatus)
  status?: TicketStatus;

  @IsOptional()
  @IsEnum(TicketCategory)
  category?: TicketCategory;

  /** «abertos» esconde resolvidos e encerrados. */
  @IsOptional()
  @IsString()
  scope?: 'open' | 'all';

  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
}
