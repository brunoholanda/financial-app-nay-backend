import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { WorkspaceDocumentKind } from '../../../common/enums/workspace-document-kind.enum';
import { WorkspaceDocumentScope } from '../../../common/enums/workspace-document-scope.enum';

export class CreateWorkspaceDocumentDto {
  @IsEnum(WorkspaceDocumentKind)
  kind: WorkspaceDocumentKind;

  @IsEnum(WorkspaceDocumentScope)
  personScope: WorkspaceDocumentScope;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string;
}

export class UpdateWorkspaceDocumentDto {
  @IsOptional()
  @IsEnum(WorkspaceDocumentKind)
  kind?: WorkspaceDocumentKind;

  @IsOptional()
  @IsEnum(WorkspaceDocumentScope)
  personScope?: WorkspaceDocumentScope;

  @IsOptional()
  @IsString()
  @MaxLength(4000)
  description?: string | null;
}
