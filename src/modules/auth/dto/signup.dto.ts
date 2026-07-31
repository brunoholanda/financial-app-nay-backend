import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MinLength,
} from 'class-validator';

export class SignupDto {
  @IsString()
  @Length(3, 120, { message: 'Informe seu nome completo.' })
  name: string;

  @IsEmail({}, { message: 'E-mail inválido.' })
  email: string;

  @IsString()
  @MinLength(8, { message: 'A senha precisa de pelo menos 8 caracteres.' })
  @Matches(/(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'A senha precisa combinar letras e números.',
  })
  password: string;

  /** Nome do primeiro espaço de trabalho (empresa, filial ou cliente). */
  @IsString()
  @Length(2, 120, { message: 'Informe o nome do seu negócio.' })
  workspaceName: string;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  businessType?: string;
}
