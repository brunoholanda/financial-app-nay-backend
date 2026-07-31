import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { SubscriptionAccessService } from '../../common/services/subscription-access.service';
import { User } from '../../database/entities/user.entity';
import { Workspace } from '../../database/entities/workspace.entity';
import {
  formatBrDate,
  todayYmdInTimeZone,
} from '../../common/utils/brazil-date';
import { SignupDto } from './dto/signup.dto';

@Injectable()
export class SignupService {
  private readonly logger = new Logger(SignupService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly subscriptionAccess: SubscriptionAccessService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  async register(dto: SignupDto): Promise<User> {
    const { user, workspace } =
      await this.usersService.createMasterAccount(dto);
    this.logger.log(
      `Nova conta em teste: ${user.email} (espaço "${workspace.name}")`,
    );
    await this.sendWelcome(user, workspace);
    return user;
  }

  /** E-mail de boas-vindas é cortesia: falha nele não invalida o cadastro. */
  private async sendWelcome(user: User, workspace: Workspace): Promise<void> {
    if (!this.mailService.isConfigured()) {
      return;
    }
    const appUrl = (
      this.config.get<string>('APP_PUBLIC_URL') ??
      'https://financial.brunoholanda.com'
    ).replace(/\/$/, '');
    const trialEnd = user.trialEndsAt
      ? formatBrDate(
          todayYmdInTimeZone('America/Sao_Paulo', new Date(user.trialEndsAt)),
        )
      : null;
    const price = this.formatPrice();

    try {
      await this.mailService.send({
        to: user.email,
        subject: `Bem-vindo ao App Financeiro — ${this.subscriptionAccess.trialDays} dias de teste grátis`,
        text: this.buildText(user, workspace, appUrl, trialEnd, price),
        html: this.buildHtml(user, workspace, appUrl, trialEnd, price),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Não foi possível enviar o e-mail de boas-vindas para ${user.email}: ${message}`,
      );
    }
  }

  private formatPrice(): string {
    return (this.subscriptionAccess.priceCents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: this.subscriptionAccess.currency,
    });
  }

  private buildText(
    user: User,
    workspace: Workspace,
    appUrl: string,
    trialEnd: string | null,
    price: string,
  ): string {
    return [
      `Olá, ${user.name}.`,
      '',
      `Sua conta foi criada e o espaço "${workspace.name}" já está pronto para uso.`,
      trialEnd
        ? `Você tem ${this.subscriptionAccess.trialDays} dias de teste grátis, até ${trialEnd}.`
        : `Você tem ${this.subscriptionAccess.trialDays} dias de teste grátis.`,
      `Depois desse período, a licença de uso custa ${price} por mês.`,
      '',
      `Acesse o painel: ${appUrl}/login`,
    ].join('\n');
  }

  private buildHtml(
    user: User,
    workspace: Workspace,
    appUrl: string,
    trialEnd: string | null,
    price: string,
  ): string {
    const navy = '#0f274d';
    const green = '#1a936f';
    const muted = '#667085';
    const border = '#e4e7ec';
    const bg = '#f2f4f7';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bem-vindo ao App Financeiro</title>
</head>
<body style="margin:0;padding:0;background:${bg};font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${navy};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${border};">
          <tr>
            <td style="background:${navy};padding:28px 28px 24px;">
              <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#9db0c9;font-weight:600;">App Financeiro</div>
              <div style="font-size:24px;line-height:1.25;color:#ffffff;font-weight:700;margin-top:8px;">Sua conta está pronta</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">
                Olá, <strong>${this.escapeHtml(user.name)}</strong>. Criamos sua conta e o espaço
                <strong>${this.escapeHtml(workspace.name)}</strong> já está disponível no painel.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#f8fafc;border:1px solid ${border};border-radius:12px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <div style="font-size:13px;text-transform:uppercase;letter-spacing:0.04em;color:${green};font-weight:700;">Teste grátis</div>
                    <div style="font-size:20px;font-weight:700;margin-top:6px;">${this.subscriptionAccess.trialDays} dias sem custo</div>
                    ${trialEnd ? `<div style="font-size:14px;color:${muted};margin-top:6px;">Válido até ${trialEnd}.</div>` : ''}
                    <div style="font-size:14px;color:${muted};margin-top:10px;">Depois desse período, a licença de uso custa <strong>${price}/mês</strong> e pode ser cancelada quando quiser.</div>
                  </td>
                </tr>
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:${green};">
                    <a href="${appUrl}/login" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;">
                      Entrar no painel
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 24px;border-top:1px solid ${border};background:#fafbfc;">
              <div style="font-size:12px;line-height:1.5;color:${muted};">
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
}
