import { IsString, IsUUID, Length, Matches } from 'class-validator';

export class VerifyLoginDto {
  @IsUUID()
  challengeId: string;

  @IsString()
  @Length(6, 6, { message: 'O código tem 6 dígitos.' })
  @Matches(/^\d{6}$/, { message: 'O código tem 6 dígitos.' })
  code: string;
}
