import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateWorkspaceAccountDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  bankName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  branch?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  accountNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  pixKeyPrimary?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  pixKeySecondary?: string;
}
