import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class SendTestMailDto {
  @IsEmail()
  to!: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  subject?: string;
}
