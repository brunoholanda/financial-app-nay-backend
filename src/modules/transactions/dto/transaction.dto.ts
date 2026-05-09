import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LedgerType } from '../../../common/enums/ledger-type.enum';
import { PaymentSource } from '../../../common/enums/payment-source.enum';

export class CreateTransactionDto {
  @IsString()
  @MinLength(2)
  title: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(LedgerType)
  type: LedgerType;

  @IsUUID()
  categoryId: string;

  @IsEnum(PaymentSource)
  paymentSource: PaymentSource;

  @ValidateIf(
    (o: CreateTransactionDto) =>
      o.paymentSource === PaymentSource.ACCOUNT ||
      o.paymentSource === PaymentSource.CREDIT_CARD,
  )
  @IsUUID()
  workspaceAccountId?: string;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount?: number;

  @IsOptional()
  @IsEnum(LedgerType)
  type?: LedgerType;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(PaymentSource)
  paymentSource?: PaymentSource;

  @IsOptional()
  @IsUUID()
  workspaceAccountId?: string | null;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
