import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateNotificationPrefsDto {
  @IsOptional()
  @IsBoolean()
  emailNotifyBills?: boolean;

  @IsOptional()
  @IsBoolean()
  emailNotifyInsurances?: boolean;
}
