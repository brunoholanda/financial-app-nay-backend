import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { SortOrder } from '../../../common/enums/sort-order.enum';

export const INVESTMENT_CASHFLOW_SORT_FIELDS = [
  'date',
  'kind',
  'amount',
  'createdAt',
] as const;

export type InvestmentCashflowSortField =
  (typeof INVESTMENT_CASHFLOW_SORT_FIELDS)[number];

export class ListInvestmentCashflowsQueryDto {
  @IsOptional()
  @IsIn([...INVESTMENT_CASHFLOW_SORT_FIELDS])
  sortBy?: InvestmentCashflowSortField;

  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}

export const YIELD_HISTORY_SORT_FIELDS = [
  'date',
  'value',
  'dailyYield',
  'createdAt',
] as const;

export type YieldHistorySortField =
  (typeof YIELD_HISTORY_SORT_FIELDS)[number];

export class ListYieldHistoryQueryDto {
  @IsOptional()
  @IsIn([...YIELD_HISTORY_SORT_FIELDS])
  sortBy?: YieldHistorySortField;

  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}
