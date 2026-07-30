import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { WorkspaceDocumentKind } from '../../../common/enums/workspace-document-kind.enum';
import { WorkspaceDocumentScope } from '../../../common/enums/workspace-document-scope.enum';
import { SortOrder } from '../../../common/enums/sort-order.enum';

export const DOCUMENT_SORT_FIELDS = [
  'kind',
  'description',
  'originalFileName',
  'sizeBytes',
  'personScope',
  'createdAt',
] as const;

export type DocumentSortField = (typeof DOCUMENT_SORT_FIELDS)[number];

export class ListWorkspaceDocumentsQueryDto {
  @IsOptional()
  @IsEnum(WorkspaceDocumentScope)
  scope?: WorkspaceDocumentScope;

  @IsOptional()
  @IsEnum(WorkspaceDocumentKind)
  kind?: WorkspaceDocumentKind;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  q?: string;

  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @IsOptional()
  @IsIn([...DOCUMENT_SORT_FIELDS])
  sortBy?: DocumentSortField;

  @IsOptional()
  @IsEnum(SortOrder)
  order?: SortOrder;
}
