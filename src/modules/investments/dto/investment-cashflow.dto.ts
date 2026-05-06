import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, Min } from 'class-validator';
import { InvestmentTransactionKind } from '../../../common/enums/investment-transaction-type.enum';

export class CreateInvestmentCashflowDto {
  @IsEnum(InvestmentTransactionKind)
  kind!: InvestmentTransactionKind;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4, allowNaN: false, allowInfinity: false })
  @Min(0.01)
  amount!: number;

  @IsDateString()
  date!: string;
}
