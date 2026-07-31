import {
  Body,
  Controller,
  Get,
  Ip,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { VerifyLoginDto } from './dto/verify-login.dto';
import { ResendLoginCodeDto } from './dto/resend-login-code.dto';
import { UpdateNotificationPrefsDto } from './dto/update-notification-prefs.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';

@ApiTags('Autenticação')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * Cadastro público com teste grátis: entra logado direto. Limite baixo porque
   * cada chamada cria conta e dispara e-mail de boas-vindas.
   */
  @Post('signup')
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  signup(@Body() dto: SignupDto) {
    return this.authService.signup(dto);
  }

  /** Etapa 1: valida a senha e envia o código de verificação por e-mail. */
  @Post('login')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  login(@Body() dto: LoginDto, @Ip() ip: string) {
    return this.authService.login(dto.email, dto.password, ip);
  }

  /** Etapa 2: confirma o código e devolve o token de acesso. */
  @Post('login/verify')
  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  verifyLogin(@Body() dto: VerifyLoginDto) {
    return this.authService.verifyLogin(dto.challengeId, dto.code);
  }

  @Post('login/resend')
  @Throttle({ default: { limit: 4, ttl: 60_000 } })
  resendLoginCode(@Body() dto: ResendLoginCodeDto, @Ip() ip: string) {
    return this.authService.resendLoginCode(dto.challengeId, ip);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  me(@CurrentUser() user: JwtPayload) {
    return this.authService.getMe(user.sub);
  }

  @Patch('me/notification-prefs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  updateNotificationPrefs(
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateNotificationPrefsDto,
  ) {
    return this.authService.updateNotificationPrefs(user.sub, dto);
  }
}
