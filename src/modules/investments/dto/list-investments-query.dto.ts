import { IsEnum, IsIn, IsOptional, IsUUID } from 'class-validator';
import { InvestmentInstrumentType } from '../../../common/enums/investment-instrument.enum';
import { InvestmentLiquidityType } from '../../../common/enums/investment-liquidity.enum';
import { SortOrder } from '../../../common/enums/sort-order.enum';

export const INVESTMENT_SORT_FIELDS = [
  'name',
  'instrumentType',
  'investedAmount',
  'currentAmount',
  'liquidityType',
  'startDate',
  'endDate',
  'workspaceAccount.name',
  'createdAt',
] as const;

export type InvestmentSortField = (typeof INVESTMENT_SORT_FIELDS)[number];

export class ListInvestmentsQueryDto {
  @IsOptional()
  @IsUUID()
  workspaceAccountId?: string;

  @IsOptional()
  @IsEnum(InvestmentInstrumentType)
  type?: InvestmentInstrumentType;

  @IsOptional()
  @IsEnum(InvestmentLiquidityType)
  liquidity?: InvestmentLiquidityType;

  @IsOptional()
  @IsIn([...INVESTMENT_SORT_FIELDS])
  sortBy?: InvestmentSortField;

  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}
