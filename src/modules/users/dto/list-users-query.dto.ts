import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { SortOrder } from '../../../common/enums/sort-order.enum';

export const USER_SORT_FIELDS = [
  'name',
  'email',
  'isActive',
  'createdAt',
] as const;

export type UserSortField = (typeof USER_SORT_FIELDS)[number];

export class ListUsersQueryDto {
  @IsOptional()
  @IsIn([...USER_SORT_FIELDS])
  sortBy?: UserSortField;

  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}
