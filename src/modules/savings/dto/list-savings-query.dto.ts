import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { SortOrder } from '../../../common/enums/sort-order.enum';

export const SAVINGS_SORT_FIELDS = [
  'title',
  'referenceAmount',
  'paidAmount',
  'savedAmount',
  'date',
  'description',
  'createdAt',
] as const;

export type SavingsSortField = (typeof SAVINGS_SORT_FIELDS)[number];

export class ListSavingsQueryDto {
  @IsOptional()
  @IsIn([...SAVINGS_SORT_FIELDS])
  sortBy?: SavingsSortField;

  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}
