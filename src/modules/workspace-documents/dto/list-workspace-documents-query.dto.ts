import { IsDateString, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { WorkspaceDocumentKind } from '../../../common/enums/workspace-document-kind.enum';
import { WorkspaceDocumentScope } from '../../../common/enums/workspace-document-scope.enum';

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
}
