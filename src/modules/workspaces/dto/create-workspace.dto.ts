import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateWorkspaceDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(2)
  businessType: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  pixKeyPrimary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  pixKeySecondary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  bankingHolderName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  bankingDocument?: string;

  @IsOptional()
  @IsString()
  bankingNotes?: string;
}
