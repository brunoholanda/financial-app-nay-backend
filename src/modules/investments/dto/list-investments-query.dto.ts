import { IsEnum, IsOptional, IsUUID } from 'class-validator';
import { InvestmentInstrumentType } from '../../../common/enums/investment-instrument.enum';
import { InvestmentLiquidityType } from '../../../common/enums/investment-liquidity.enum';

export class ListInvestmentsQueryDto {
  @IsOptional()
  @IsUUID()
  workspaceAccountId?: string;

  @IsOptional()
  @IsEnum(InvestmentInstrumentType)
  type?: InvestmentInstrumentType;

  @IsOptional()
  @IsEnum(InvestmentLiquidityType)
  liquidity?: InvestmentLiquidityType;
}
