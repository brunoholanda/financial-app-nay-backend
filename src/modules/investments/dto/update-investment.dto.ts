import { Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  Min,
} from 'class-validator';
import { InvestmentInstrumentType } from '../../../common/enums/investment-instrument.enum';
import { InvestmentLiquidityType } from '../../../common/enums/investment-liquidity.enum';
import { InvestmentPortfolioCategory } from '../../../common/enums/investment-portfolio-category.enum';
import { InvestmentYieldType } from '../../../common/enums/investment-yield-type.enum';

export class UpdateInvestmentDto {
  @IsOptional()
  @IsUUID()
  workspaceAccountId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(256)
  name?: string;

  @IsOptional()
  @IsEnum(InvestmentInstrumentType)
  type?: InvestmentInstrumentType;

  @IsOptional()
  @IsEnum(InvestmentPortfolioCategory)
  category?: InvestmentPortfolioCategory;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4, allowNaN: false, allowInfinity: false })
  @Min(0)
  investedAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4, allowNaN: false, allowInfinity: false })
  @Min(0)
  currentAmount?: number;

  @IsOptional()
  @IsEnum(InvestmentYieldType)
  yieldType?: InvestmentYieldType;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  indexer?: string | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 6, allowNaN: false, allowInfinity: false })
  @Min(0)
  rate?: number | null;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string | null;

  @IsOptional()
  @IsEnum(InvestmentLiquidityType)
  liquidity?: InvestmentLiquidityType;
}
