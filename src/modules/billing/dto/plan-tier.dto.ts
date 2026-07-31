import { IsEnum, IsOptional } from 'class-validator';
import { PlanTier } from '../../../common/enums/plan-tier.enum';

export class CheckoutDto {
  /** Plano escolhido no checkout; padrão quando ausente. */
  @IsOptional()
  @IsEnum(PlanTier)
  tier?: PlanTier;
}

export class ChangePlanDto {
  @IsEnum(PlanTier)
  tier: PlanTier;
}
