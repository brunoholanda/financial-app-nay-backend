import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { WorkspaceDocumentKind } from '../../../common/enums/workspace-document-kind.enum';

export class CreateWorkspaceDocumentDto {
  @IsEnum(WorkspaceDocumentKind)
  kind: WorkspaceDocumentKind;

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
  @IsString()
  @MaxLength(4000)
  description?: string | null;
}
