import { IsUUID } from 'class-validator';

export class PreviewOfxImportDto {
  @IsUUID()
  workspaceAccountId: string;
}
