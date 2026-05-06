import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  businessType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  pixKeyPrimary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  pixKeySecondary?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  bankingHolderName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  bankingDocument?: string | null;

  @IsOptional()
  @IsString()
  bankingNotes?: string | null;
}
