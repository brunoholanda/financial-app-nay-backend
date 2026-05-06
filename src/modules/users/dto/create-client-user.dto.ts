import { IsEmail, IsString, MinLength } from 'class-validator';
import { IsUUID } from 'class-validator';

export class CreateClientUserDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6)
  password: string;

  @IsUUID()
  workspaceId: string;
}
