import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSavingsEntryDto {
  @IsString()
  @MinLength(2)
  title: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  referenceAmount: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paidAmount: number;

  @IsDateString()
  date: string;

  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateSavingsEntryDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  referenceAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  paidAmount?: number;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  description?: string | null;
}
