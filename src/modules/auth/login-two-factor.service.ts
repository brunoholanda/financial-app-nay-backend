import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThan, Repository } from 'typeorm';
import { randomInt } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { LoginChallenge } from '../../database/entities/login-challenge.entity';
import { User } from '../../database/entities/user.entity';
import { MailService } from '../mail/mail.service';

const CODE_LENGTH = 6;
const MAX_ATTEMPTS = 5;
const MAX_RESENDS = 3;
const RESEND_INTERVAL_SEC = 60;
const DEFAULT_TTL_SEC = 600;

/** Só `CODE_INVALID` e `RESEND_TOO_SOON` permitem seguir na tela do código. */
export type TwoFactorErrorCode =
  | 'CODE_INVALID'
  | 'RESEND_TOO_SOON'
  | 'CHALLENGE_NOT_FOUND'
  | 'CHALLENGE_EXPIRED'
  | 'TOO_MANY_ATTEMPTS'
  | 'RESEND_LIMIT'
  | 'ACCOUNT_UNAVAILABLE';

export type TwoFactorChallenge = {
  twoFactorRequired: true;
  challengeId: string;
  /** E-mail parcialmente oculto, só para o usuário confirmar o destino. */
  maskedEmail: string;
  codeLength: number;
  expiresAt: string;
  resendAvailableInSec: number;
};

/**
 * Segundo fator do login: gera um código numérico, envia por e-mail e só
 * libera a sessão quando o código correto é informado.
 */
@Injectable()
export class LoginTwoFactorService {
  private readonly logger = new Logger(LoginTwoFactorService.name);

  constructor(
    @InjectRepository(LoginChallenge)
    private readonly challengeRepo: Repository<LoginChallenge>,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  /** Desligue apenas em ambiente local: `AUTH_2FA_ENABLED=false`. */
  isEnabled(): boolean {
    return this.config.get<string>('AUTH_2FA_ENABLED')?.trim() !== 'false';
  }

  private get ttlSec(): number {
    const raw = Number.parseInt(
      this.config.get<string>('AUTH_2FA_TTL_SEC') ?? '',
      10,
    );
    return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_TTL_SEC;
  }

  async start(user: User, requestIp?: string): Promise<TwoFactorChallenge> {
    this.requireMailer();
    await this.purgeStale();
    // Um desafio pendente por vez: pedir um novo código invalida o anterior.
    await this.challengeRepo.delete({ userId: user.id, consumedAt: IsNull() });

    const code = this.generateCode();
    const now = new Date();
    const challenge = await this.challengeRepo.save(
      this.challengeRepo.create({
        userId: user.id,
        codeHash: await bcrypt.hash(code, 10),
        expiresAt: new Date(now.getTime() + this.ttlSec * 1000),
        lastSentAt: now,
        attempts: 0,
        resendCount: 0,
        consumedAt: null,
        requestIp: requestIp ?? null,
      }),
    );

    await this.deliver(challenge, user, code);
    return this.toChallengeInfo(challenge, user.email);
  }

  async resend(
    challengeId: string,
    requestIp?: string,
  ): Promise<TwoFactorChallenge> {
    this.requireMailer();
    const challenge = await this.findPending(challengeId);
    const user = await this.loadUser(challenge);

    const sinceLastSend = Math.floor(
      (Date.now() - challenge.lastSentAt.getTime()) / 1000,
    );
    if (sinceLastSend < RESEND_INTERVAL_SEC) {
      this.reject(
        'RESEND_TOO_SOON',
        `Aguarde ${RESEND_INTERVAL_SEC - sinceLastSend}s para pedir um novo código.`,
      );
    }
    if (challenge.resendCount >= MAX_RESENDS) {
      await this.challengeRepo.delete({ id: challenge.id });
      this.reject(
        'RESEND_LIMIT',
        'Limite de reenvios atingido. Faça o login novamente.',
      );
    }

    const code = this.generateCode();
    const now = new Date();
    challenge.codeHash = await bcrypt.hash(code, 10);
    challenge.expiresAt = new Date(now.getTime() + this.ttlSec * 1000);
    challenge.lastSentAt = now;
    challenge.attempts = 0;
    challenge.resendCount += 1;
    challenge.requestIp = requestIp ?? challenge.requestIp;
    const saved = await this.challengeRepo.save(challenge);

    await this.deliver(saved, user, code);
    return this.toChallengeInfo(saved, user.email);
  }

  /** Valida o código e devolve o id do usuário; o desafio não pode ser reusado. */
  async consume(challengeId: string, code: string): Promise<string> {
    const challenge = await this.findPending(challengeId);

    if (challenge.attempts >= MAX_ATTEMPTS) {
      await this.challengeRepo.delete({ id: challenge.id });
      this.reject(
        'TOO_MANY_ATTEMPTS',
        'Muitas tentativas incorretas. Faça o login novamente.',
      );
    }

    const ok = await bcrypt.compare(code.trim(), challenge.codeHash);
    if (!ok) {
      challenge.attempts += 1;
      await this.challengeRepo.save(challenge);
      const left = MAX_ATTEMPTS - challenge.attempts;
      if (left <= 0) {
        await this.challengeRepo.delete({ id: challenge.id });
        this.reject(
          'TOO_MANY_ATTEMPTS',
          'Muitas tentativas incorretas. Faça o login novamente.',
        );
      }
      this.reject(
        'CODE_INVALID',
        `Código inválido. ${left} tentativa(s) restante(s).`,
      );
    }

    challenge.consumedAt = new Date();
    await this.challengeRepo.save(challenge);
    return challenge.userId;
  }

  private async findPending(challengeId: string): Promise<LoginChallenge> {
    const challenge = challengeId
      ? await this.challengeRepo.findOne({
          where: { id: challengeId },
          relations: { user: true },
        })
      : null;
    if (!challenge || challenge.consumedAt) {
      this.reject(
        'CHALLENGE_NOT_FOUND',
        'Verificação não encontrada. Faça o login novamente.',
      );
    }
    if (challenge.expiresAt.getTime() <= Date.now()) {
      await this.challengeRepo.delete({ id: challenge.id });
      this.reject(
        'CHALLENGE_EXPIRED',
        'Código expirado. Faça o login novamente para receber outro.',
      );
    }
    return challenge;
  }

  private async loadUser(challenge: LoginChallenge): Promise<User> {
    const user = challenge.user;
    if (!user || !user.isActive) {
      await this.challengeRepo.delete({ id: challenge.id });
      this.reject('ACCOUNT_UNAVAILABLE', 'Conta inativa ou inexistente');
    }
    return user;
  }

  /** Erro 401 com `code`, para o frontend decidir se mantém a tela do código. */
  private reject(code: TwoFactorErrorCode, message: string): never {
    throw new UnauthorizedException({
      statusCode: 401,
      error: 'Unauthorized',
      message,
      code,
    });
  }

  private requireMailer(): void {
    if (this.mailService.isConfigured()) return;
    this.logger.error(
      'Verificação em duas etapas ativa, mas o SMTP não está configurado.',
    );
    throw new ServiceUnavailableException(
      'Não foi possível enviar o código de verificação: e-mail não configurado no servidor.',
    );
  }

  private async deliver(
    challenge: LoginChallenge,
    user: User,
    code: string,
  ): Promise<void> {
    try {
      await this.mailService.send({
        to: user.email,
        subject: `${code} é o seu código de acesso — App Financeiro`,
        text: this.buildText(user, code),
        html: this.buildHtml(user, code),
      });
      this.logger.log(`Código de acesso enviado para ${user.email}`);
    } catch (err) {
      // Sem e-mail entregue o desafio é inútil; remove para não travar o usuário.
      await this.challengeRepo.delete({ id: challenge.id });
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Falha ao enviar código de acesso para ${user.email}: ${message}`,
      );
      throw new ServiceUnavailableException(
        'Não foi possível enviar o código de verificação. Tente novamente em instantes.',
      );
    }
  }

  private toChallengeInfo(
    challenge: LoginChallenge,
    email: string,
  ): TwoFactorChallenge {
    return {
      twoFactorRequired: true,
      challengeId: challenge.id,
      maskedEmail: this.maskEmail(email),
      codeLength: CODE_LENGTH,
      expiresAt: challenge.expiresAt.toISOString(),
      resendAvailableInSec: RESEND_INTERVAL_SEC,
    };
  }

  private maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!domain) return email;
    const visible = local.slice(0, local.length > 3 ? 2 : 1);
    return `${visible}${'*'.repeat(Math.max(local.length - visible.length, 2))}@${domain}`;
  }

  private generateCode(): string {
    return String(randomInt(0, 10 ** CODE_LENGTH)).padStart(CODE_LENGTH, '0');
  }

  private buildText(user: User, code: string): string {
    const minutes = Math.round(this.ttlSec / 60);
    return [
      `Olá, ${user.name}.`,
      '',
      `Seu código de acesso ao App Financeiro é: ${code}`,
      `O código expira em ${minutes} minuto(s) e só pode ser usado uma vez.`,
      '',
      'Se não foi você que tentou entrar, ignore este e-mail e troque sua senha.',
    ].join('\n');
  }

  private buildHtml(user: User, code: string): string {
    const navy = '#0f274d';
    const muted = '#667085';
    const border = '#e4e7ec';
    const bg = '#f2f4f7';
    const minutes = Math.round(this.ttlSec / 60);

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Código de acesso</title>
</head>
<body style="margin:0;padding:0;background:${bg};font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${navy};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${border};">
          <tr>
            <td style="background:${navy};padding:28px 28px 24px;">
              <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#9db0c9;font-weight:600;">App Financeiro</div>
              <div style="font-size:24px;line-height:1.25;color:#ffffff;font-weight:700;margin-top:8px;">Código de acesso</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:${navy};">
                Olá, <strong>${this.escapeHtml(user.name)}</strong>. Use o código abaixo para concluir a entrada no painel.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
                <tr>
                  <td align="center" style="background:#f8fafc;border:1px solid ${border};border-radius:12px;padding:22px 16px;">
                    <div style="font-size:34px;line-height:1.1;font-weight:700;letter-spacing:0.22em;color:${navy};">${code}</div>
                    <div style="font-size:13px;color:${muted};margin-top:10px;">Expira em ${minutes} minuto(s) · uso único</div>
                  </td>
                </tr>
              </table>
              <p style="margin:0;font-size:14px;line-height:1.55;color:${muted};">
                Se não foi você que tentou entrar, ignore este e-mail e troque a sua senha por segurança.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 24px;border-top:1px solid ${border};background:#fafbfc;">
              <div style="font-size:12px;line-height:1.5;color:${muted};">
                Nunca compartilhe este código. Nossa equipe não solicita códigos de acesso.<br />
                Holanda Desenvolvimento de Software · financial.brunoholanda.com
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /** Remove desafios expirados/consumidos para a tabela não crescer sem limite. */
  private async purgeStale(): Promise<void> {
    try {
      await this.challengeRepo.delete({ expiresAt: LessThan(new Date()) });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Falha ao limpar desafios expirados: ${message}`);
    }
  }
}
