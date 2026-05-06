import {

  IsDateString,

  IsEnum,

  IsInt,

  IsNumber,

  IsOptional,

  IsString,

  IsUUID,

  Min,

  MinLength,

  Max,

  ValidateIf,

} from 'class-validator';

import { Type } from 'class-transformer';

import { LedgerType } from '../../../common/enums/ledger-type.enum';

import { PaymentSource } from '../../../common/enums/payment-source.enum';



export class CreateRecurringSeriesDto {

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

    (o: CreateRecurringSeriesDto) =>

      o.paymentSource === PaymentSource.ACCOUNT,

  )

  @IsUUID()

  workspaceAccountId?: string;



  @IsDateString()

  startDate: string;



  @IsDateString()

  endDate: string;



  @Type(() => Number)

  @IsInt()

  @Min(1)

  @Max(31)

  debitDayOfMonth: number;



  @IsOptional()

  @IsString()

  description?: string;

}



export class UpdateRecurringSeriesDto {

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

  startDate?: string;



  @IsOptional()

  @IsDateString()

  endDate?: string;



  @IsOptional()

  @Type(() => Number)

  @IsInt()

  @Min(1)

  @Max(31)

  debitDayOfMonth?: number;



  @IsOptional()

  @IsString()

  description?: string;

}



export class CancelRecurringSeriesDto {

  @IsString()

  @MinLength(5, { message: 'Descreva o motivo (mínimo 5 caracteres)' })

  cancellationReason: string;

}



export class MonthlyQueryDto {

  @IsOptional()

  @Type(() => Number)

  @IsNumber()

  @Min(2000)

  @Max(2100)

  year?: number;



  @IsOptional()

  @Type(() => Number)

  @IsNumber()

  @Min(1)

  @Max(12)

  month?: number;

}

