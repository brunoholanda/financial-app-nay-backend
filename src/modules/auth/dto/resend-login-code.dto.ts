import { IsUUID } from 'class-validator';

export class ResendLoginCodeDto {
  @IsUUID()
  challengeId: string;
}
