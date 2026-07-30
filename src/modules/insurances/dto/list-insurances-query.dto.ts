import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { SortOrder } from '../../../common/enums/sort-order.enum';

export const INSURANCE_SORT_FIELDS = [
  'title',
  'insuranceType',
  'insurerName',
  'premiumTotal',
  'validityStart',
  'validityEnd',
  'createdAt',
] as const;

export type InsuranceSortField = (typeof INSURANCE_SORT_FIELDS)[number];

export class ListInsurancesQueryDto {
  @IsOptional()
  @IsIn([...INSURANCE_SORT_FIELDS])
  sortBy?: InsuranceSortField;

  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}
