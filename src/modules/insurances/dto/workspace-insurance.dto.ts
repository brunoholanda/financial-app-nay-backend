import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { InsuranceType } from '../../../common/enums/insurance-type.enum';
import { InsurancePaymentMode } from '../../../common/enums/insurance-payment-mode.enum';

export class InsuranceCoverageItemDto {
  @IsString()
  @MinLength(1)
  label: string;

  @IsOptional()
  @IsString()
  details?: string | null;
}

export class CreateWorkspaceInsuranceDto {
  @IsString()
  @MinLength(2)
  title: string;

  @IsEnum(InsuranceType)
  insuranceType: InsuranceType;

  @IsOptional()
  @IsString()
  insurerName?: string | null;

  @IsOptional()
  @IsString()
  policyNumber?: string | null;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  insuredCapital: number;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  premiumTotal: number;

  @IsEnum(InsurancePaymentMode)
  paymentMode: InsurancePaymentMode;

  @ValidateIf(
    (o: CreateWorkspaceInsuranceDto) =>
      o.paymentMode === InsurancePaymentMode.INSTALLMENTS,
  )
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(120)
  installmentCount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  installmentValue?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => InsuranceCoverageItemDto)
  coverages?: InsuranceCoverageItemDto[];

  @IsDateString()
  validityStart: string;

  @IsDateString()
  validityEnd: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  alertDaysBefore?: number;

  @IsOptional()
  @IsString()
  notes?: string | null;
}

export class UpdateWorkspaceInsuranceDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  title?: string;

  @IsOptional()
  @IsEnum(InsuranceType)
  insuranceType?: InsuranceType;

  @IsOptional()
  @IsString()
  insurerName?: string | null;

  @IsOptional()
  @IsString()
  policyNumber?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  insuredCapital?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  premiumTotal?: number;

  @IsOptional()
  @IsEnum(InsurancePaymentMode)
  paymentMode?: InsurancePaymentMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2)
  @Max(120)
  installmentCount?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  installmentValue?: number | null;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(80)
  @ValidateNested({ each: true })
  @Type(() => InsuranceCoverageItemDto)
  coverages?: InsuranceCoverageItemDto[];

  @IsOptional()
  @IsDateString()
  validityStart?: string;

  @IsOptional()
  @IsDateString()
  validityEnd?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  alertDaysBefore?: number;

  @IsOptional()
  @IsString()
  notes?: string | null;
}
