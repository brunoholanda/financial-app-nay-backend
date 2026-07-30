import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { SortOrder } from '../../../common/enums/sort-order.enum';

export const CATEGORY_SORT_FIELDS = ['name', 'type', 'createdAt'] as const;

export type CategorySortField = (typeof CATEGORY_SORT_FIELDS)[number];

export class ListCategoriesQueryDto {
  @IsOptional()
  @IsIn([...CATEGORY_SORT_FIELDS])
  sortBy?: CategorySortField;

  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}
