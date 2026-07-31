import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { JwtPayload } from '../../common/interfaces/jwt-payload.interface';
import { User } from '../../database/entities/user.entity';
import {
  SubscriptionAccess,
  SubscriptionAccessService,
} from '../../common/services/subscription-access.service';
import {
  LoginTwoFactorService,
  TwoFactorChallenge,
} from './login-two-factor.service';
import { SignupService } from './signup.service';
import { SignupDto } from './dto/signup.dto';

type SessionUser = ReturnType<UsersService['toPublicProfile']> & {
  subscription: SubscriptionAccess;
};

type Session = {
  access_token: string;
  user: SessionUser;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly twoFactor: LoginTwoFactorService,
    private readonly signupService: SignupService,
    private readonly subscriptionAccess: SubscriptionAccessService,
  ) {}

  async validateUser(email: string, password: string) {
    const user = await this.usersService.findByEmailWithPassword(email);
    if (!user) {
      return null;
    }
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return null;
    }
    return user;
  }

  /** Cadastro público: já entra logado, com o teste grátis em andamento. */
  async signup(dto: SignupDto): Promise<Session> {
    const user = await this.signupService.register(dto);
    return this.issueSession(user);
  }

  /**
   * Senha correta não entrega sessão: envia o código por e-mail e devolve o
   * desafio, que precisa ser confirmado em `verifyLogin`.
   */
  async login(
    email: string,
    password: string,
    requestIp?: string,
  ): Promise<Session | TwoFactorChallenge> {
    const user = await this.validateUser(email, password);
    if (!user) {
      throw new UnauthorizedException('Credenciais inválidas');
    }
    this.assertActive(user);

    if (!this.twoFactor.isEnabled()) {
      return this.issueSession(user);
    }
    return this.twoFactor.start(user, requestIp);
  }

  async verifyLogin(challengeId: string, code: string): Promise<Session> {
    const userId = await this.twoFactor.consume(challengeId, code);
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('Conta inexistente');
    }
    this.assertActive(user);
    return this.issueSession(user);
  }

  resendLoginCode(
    challengeId: string,
    requestIp?: string,
  ): Promise<TwoFactorChallenge> {
    return this.twoFactor.resend(challengeId, requestIp);
  }

  async getMe(userId: string): Promise<SessionUser> {
    const user = await this.usersService.findById(userId);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Conta inativa ou inexistente');
    }
    return this.publicProfile(user);
  }

  async updateNotificationPrefs(
    userId: string,
    prefs: {
      emailNotifyBills?: boolean;
      emailNotifyInsurances?: boolean;
    },
  ) {
    return this.usersService.updateNotificationPrefs(userId, prefs);
  }

  private assertActive(user: User): void {
    if (!user.isActive) {
      throw new UnauthorizedException(
        'Conta inativa. Entre em contato com o administrador.',
      );
    }
  }

  private async publicProfile(user: User): Promise<SessionUser> {
    const subscription = await this.subscriptionAccess.describeForUser(user);
    return { ...this.usersService.toPublicProfile(user), subscription };
  }

  private async issueSession(user: User): Promise<Session> {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      workspaceId: user.workspaceId,
    };
    const access_token = await this.jwtService.signAsync(payload);
    return {
      access_token,
      user: await this.publicProfile(user),
    };
  }
}
