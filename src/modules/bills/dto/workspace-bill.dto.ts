import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PaymentSource } from '../../../common/enums/payment-source.enum';

export class CreateWorkspaceBillDto {
  @IsString()
  @MinLength(2)
  title: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsDateString()
  dueDate: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  alertDaysBefore?: number;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ValidateIf((o: CreateWorkspaceBillDto) => o.isRecurring === true)
  @IsDateString()
  recurrenceEndDate?: string;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class UpdateWorkspaceBillDto {
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
  @IsDateString()
  dueDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(365)
  alertDaysBefore?: number;

  @IsOptional()
  @IsBoolean()
  isRecurring?: boolean;

  @ValidateIf(
    (o: UpdateWorkspaceBillDto) =>
      o.isRecurring === true || o.recurrenceEndDate !== undefined,
  )
  @IsOptional()
  @IsDateString()
  recurrenceEndDate?: string | null;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

/** Pagamento com espécie ou cartão de crédito (conta vinculada). */
export class PayWorkspaceBillDto {
  @IsDateString()
  paidAt: string;

  @IsIn([PaymentSource.CASH, PaymentSource.CREDIT_CARD])
  paymentSource: PaymentSource;

  @ValidateIf(
    (o: PayWorkspaceBillDto) => o.paymentSource === PaymentSource.CREDIT_CARD,
  )
  @IsUUID()
  workspaceAccountId?: string;

  @IsOptional()
  @IsBoolean()
  createTransaction?: boolean;

  @ValidateIf((o: PayWorkspaceBillDto) => o.createTransaction === true)
  @IsUUID()
  categoryId?: string;
}
