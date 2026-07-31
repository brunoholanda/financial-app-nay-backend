import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { LedgerType } from '../../../common/enums/ledger-type.enum';

export class CreateCategoryDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsEnum(LedgerType)
  type: LedgerType;
}

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsEnum(LedgerType)
  type?: LedgerType;
}
