import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { SortOrder } from '../../../common/enums/sort-order.enum';

export const BILL_SORT_FIELDS = [
  'title',
  'amount',
  'dueDate',
  'paidAt',
  'isPaid',
  'createdAt',
] as const;

export type BillSortField = (typeof BILL_SORT_FIELDS)[number];

export class ListBillsQueryDto {
  @IsOptional()
  @IsIn([...BILL_SORT_FIELDS])
  sortBy?: BillSortField;

  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}
