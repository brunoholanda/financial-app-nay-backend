import { IsEnum, IsIn, IsOptional } from 'class-validator';
import { SortOrder } from '../../../common/enums/sort-order.enum';

export const WORKSPACE_ACCOUNT_SORT_FIELDS = [
  'name',
  'bankName',
  'branch',
  'accountNumber',
  'pixKeyPrimary',
  'createdAt',
] as const;

export type WorkspaceAccountSortField =
  (typeof WORKSPACE_ACCOUNT_SORT_FIELDS)[number];

export class ListWorkspaceAccountsQueryDto {
  @IsOptional()
  @IsIn([...WORKSPACE_ACCOUNT_SORT_FIELDS])
  sortBy?: WorkspaceAccountSortField;

  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}
