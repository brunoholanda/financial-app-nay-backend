import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PlanTier } from '../../../common/enums/plan-tier.enum';
import { SubscriptionStatus } from '../../../common/enums/subscription-status.enum';
import { UserRole } from '../../../common/enums/user-role.enum';

export class ListUsersQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsEnum(PlanTier)
  planTier?: PlanTier;

  /** «active» ou «inactive» filtra pelo acesso da conta. */
  @IsOptional()
  @IsString()
  state?: 'active' | 'inactive';
}

export class UpdateManagedUserDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  /** Conta que usa o sistema sem cobrança e sem limite de documentos. */
  @IsOptional()
  @IsBoolean()
  licenseExempt?: boolean;

  @IsOptional()
  @IsBoolean()
  isManager?: boolean;

  @IsOptional()
  @IsEnum(PlanTier)
  planTier?: PlanTier;

  /** Dias somados ao teste grátis (ou reinício, se já venceu). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  extendTrialDays?: number;

  /** Dias de acesso liberados manualmente, contados de hoje. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  grantAccessDays?: number;
}
