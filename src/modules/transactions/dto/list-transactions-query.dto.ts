import {
  IsEnum,
  IsOptional,
  IsUUID,
  IsDateString,
  IsInt,
  IsIn,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LedgerType } from '../../../common/enums/ledger-type.enum';
import { PaymentSource } from '../../../common/enums/payment-source.enum';
import { SortOrder } from '../../../common/enums/sort-order.enum';

export const TRANSACTION_SORT_FIELDS = [
  'date',
  'title',
  'amount',
  'type',
  'paymentSource',
  'category.name',
  'workspaceAccount.name',
  'createdAt',
] as const;

export type TransactionSortField = (typeof TRANSACTION_SORT_FIELDS)[number];

export class ListTransactionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsEnum(LedgerType)
  type?: LedgerType;

  @IsOptional()
  @IsEnum(PaymentSource)
  paymentSource?: PaymentSource;

  @IsOptional()
  @IsUUID()
  workspaceAccountId?: string;

  @IsOptional()
  @IsDateString()
  dateFrom?: string;

  @IsOptional()
  @IsDateString()
  dateTo?: string;

  @IsOptional()
  @IsIn([...TRANSACTION_SORT_FIELDS])
  sortBy?: TransactionSortField;

  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}
