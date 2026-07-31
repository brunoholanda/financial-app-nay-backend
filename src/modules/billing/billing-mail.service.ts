import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { User } from '../../database/entities/user.entity';
import {
  formatBrDate,
  todayYmdInTimeZone,
} from '../../common/utils/brazil-date';

type PaymentConfirmedInput = {
  amountCents: number;
  currency: string;
  /** Fim do período pago: é quando a próxima cobrança acontece. */
  periodEnd: Date | null;
  invoiceUrl?: string | null;
};

type PaymentFailedInput = {
  /** Próxima tentativa automática do Stripe, quando informada. */
  nextAttempt: Date | null;
  accessUntil: Date | null;
  invoiceUrl?: string | null;
};

const NAVY = '#0f274d';
const GREEN = '#1a936f';
const RED = '#c0392b';
const MUTED = '#667085';
const BORDER = '#e4e7ec';

/**
 * Avisos de cobrança da licença. Falha de e-mail nunca interrompe o
 * processamento do webhook: o pagamento já foi confirmado pelo Stripe.
 */
@Injectable()
export class BillingMailService {
  private readonly logger = new Logger(BillingMailService.name);

  constructor(
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  async sendPaymentConfirmed(
    user: User,
    input: PaymentConfirmedInput,
  ): Promise<void> {
    const amount = this.formatAmount(input.amountCents, input.currency);
    const nextCharge = this.formatDate(input.periodEnd);
    const lines = [
      `Olá, ${user.name}.`,
      '',
      `Recebemos o pagamento de ${amount} da sua licença de uso. O acesso ao painel está liberado.`,
      nextCharge ? `Próxima cobrança automática: ${nextCharge}.` : '',
      '',
      `Painel: ${this.appUrl()}/dashboard`,
      `Faturas e cancelamento: ${this.appUrl()}/assinatura`,
    ].filter(Boolean);

    await this.send({
      to: user.email,
      subject: `Pagamento confirmado — licença ativa (${amount})`,
      text: lines.join('\n'),
      html: this.buildHtml({
        accent: GREEN,
        eyebrow: 'Pagamento confirmado',
        title: 'Sua licença está ativa',
        intro: `Olá, <strong>${this.escape(user.name)}</strong>. Recebemos o pagamento de <strong>${amount}</strong> e o acesso ao painel segue liberado.`,
        rows: [
          ['Valor pago', amount],
          ['Próxima cobrança', nextCharge ?? 'A definir'],
        ],
        ctaLabel: 'Abrir painel',
        ctaUrl: `${this.appUrl()}/dashboard`,
        footNote: input.invoiceUrl
          ? `<a href="${input.invoiceUrl}" style="color:${GREEN};">Ver fatura no Stripe</a>`
          : 'Você pode ver faturas e cancelar quando quiser na área Assinatura.',
      }),
    });
  }

  async sendPaymentFailed(
    user: User,
    input: PaymentFailedInput,
  ): Promise<void> {
    const nextAttempt = this.formatDate(input.nextAttempt);
    const accessUntil = this.formatDate(input.accessUntil);
    const lines = [
      `Olá, ${user.name}.`,
      '',
      'Não conseguimos confirmar a cobrança da sua licença de uso.',
      nextAttempt ? `Vamos tentar novamente em ${nextAttempt}.` : '',
      accessUntil
        ? `Seu acesso ao painel vale até ${accessUntil}.`
        : 'Enquanto o pagamento não for confirmado, o acesso ao painel fica bloqueado.',
      '',
      `Atualize a forma de pagamento em ${this.appUrl()}/assinatura`,
    ].filter(Boolean);

    await this.send({
      to: user.email,
      subject: 'Não conseguimos confirmar o pagamento da sua licença',
      text: lines.join('\n'),
      html: this.buildHtml({
        accent: RED,
        eyebrow: 'Pagamento pendente',
        title: 'Atualize sua forma de pagamento',
        intro: `Olá, <strong>${this.escape(user.name)}</strong>. A cobrança da sua licença de uso não foi confirmada.`,
        rows: [
          ['Nova tentativa', nextAttempt ?? 'Sem data prevista'],
          ['Acesso liberado até', accessUntil ?? 'Bloqueado'],
        ],
        ctaLabel: 'Regularizar pagamento',
        ctaUrl: `${this.appUrl()}/assinatura`,
        footNote:
          'Se o pagamento já foi feito, clique em “Atualizar situação” na área Assinatura.',
      }),
    });
  }

  private async send(input: {
    to: string;
    subject: string;
    text: string;
    html: string;
  }): Promise<void> {
    if (!this.mailService.isConfigured()) {
      return;
    }
    try {
      await this.mailService.send(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Não foi possível avisar ${input.to} sobre a cobrança: ${message}`,
      );
    }
  }

  private formatAmount(cents: number, currency: string): string {
    return (cents / 100).toLocaleString('pt-BR', {
      style: 'currency',
      currency: currency.toUpperCase(),
    });
  }

  private formatDate(date: Date | null): string | null {
    if (!date) return null;
    return formatBrDate(todayYmdInTimeZone('America/Sao_Paulo', date));
  }

  private appUrl(): string {
    return (
      this.config.get<string>('APP_PUBLIC_URL') ??
      'https://financial.brunoholanda.com'
    ).replace(/\/$/, '');
  }

  private buildHtml(input: {
    accent: string;
    eyebrow: string;
    title: string;
    intro: string;
    rows: [string, string][];
    ctaLabel: string;
    ctaUrl: string;
    footNote: string;
  }): string {
    const rows = input.rows
      .map(
        ([label, value]) => `
                <tr>
                  <td style="padding:8px 0;font-size:14px;color:${MUTED};">${label}</td>
                  <td style="padding:8px 0;font-size:14px;font-weight:600;text-align:right;color:${NAVY};">${value}</td>
                </tr>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${input.title}</title>
</head>
<body style="margin:0;padding:0;background:#f2f4f7;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${NAVY};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f7;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${BORDER};">
          <tr>
            <td style="background:${NAVY};padding:26px 28px 22px;">
              <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#9db0c9;font-weight:600;">${input.eyebrow}</div>
              <div style="font-size:23px;line-height:1.25;color:#ffffff;font-weight:700;margin-top:8px;">${input.title}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 28px;">
              <p style="margin:0 0 18px;font-size:15px;line-height:1.55;">${input.intro}</p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${BORDER};border-bottom:1px solid ${BORDER};margin-bottom:22px;">
                ${rows}
              </table>
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="border-radius:8px;background:${input.accent};">
                    <a href="${input.ctaUrl}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;">
                      ${input.ctaLabel}
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:${MUTED};">${input.footNote}</p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 24px;border-top:1px solid ${BORDER};background:#fafbfc;">
              <div style="font-size:12px;line-height:1.5;color:${MUTED};">
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

  private escape(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
