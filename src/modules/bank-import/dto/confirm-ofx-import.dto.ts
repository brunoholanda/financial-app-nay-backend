import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { LedgerType } from '../../../common/enums/ledger-type.enum';

export class ConfirmOfxImportItemDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  fitId: string;

  @IsDateString()
  date: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsEnum(LedgerType)
  type: LedgerType;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  title: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsUUID()
  categoryId: string;
}

export class ConfirmOfxImportDto {
  @IsUUID()
  workspaceAccountId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => ConfirmOfxImportItemDto)
  items: ConfirmOfxImportItemDto[];
}
