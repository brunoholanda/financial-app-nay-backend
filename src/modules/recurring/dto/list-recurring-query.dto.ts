import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { SortOrder } from '../../../common/enums/sort-order.enum';

export const RECURRING_SORT_FIELDS = [
  'title',
  'amount',
  'type',
  'debitDayOfMonth',
  'startDate',
  'endDate',
  'cancelledAt',
  'createdAt',
] as const;

export type RecurringSortField = (typeof RECURRING_SORT_FIELDS)[number];

export class ListRecurringQueryDto {
  @IsOptional()
  @IsIn([...RECURRING_SORT_FIELDS])
  sortBy?: RecurringSortField;

  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}
