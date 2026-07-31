import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import { SupportTicket } from '../../database/entities/support-ticket.entity';
import { User } from '../../database/entities/user.entity';
import { TicketCategory } from '../../common/enums/ticket.enums';

const CATEGORY_LABEL: Record<TicketCategory, string> = {
  SUPPORT: 'Suporte',
  SUGGESTION: 'Sugestão',
  BUG: 'Erro no sistema',
  BILLING: 'Cobrança',
  OTHER: 'Outro assunto',
};

const NAVY = '#0f274d';
const GREEN = '#1a936f';
const MUTED = '#667085';
const BORDER = '#e4e7ec';

type TicketMailInput = {
  ticket: SupportTicket;
  requester: User;
  body: string;
};

/**
 * Avisos de chamado. Falha de e-mail nunca derruba a abertura ou a resposta —
 * a conversa já está gravada no banco.
 */
@Injectable()
export class SupportMailService {
  private readonly logger = new Logger(SupportMailService.name);

  constructor(
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  async notifyManagersNewTicket(
    input: TicketMailInput & { managerEmails: string[] },
  ): Promise<void> {
    const to = this.recipients(input.managerEmails);
    if (!to.length) return;
    const { ticket, requester } = input;
    await this.send({
      to,
      subject: `[Chamado #${ticket.number}] ${ticket.subject}`,
      text: [
        `Novo chamado de ${requester.name} (${requester.email}).`,
        `Assunto: ${CATEGORY_LABEL[ticket.category]} — ${ticket.subject}`,
        '',
        input.body,
        '',
        `Atender: ${this.appUrl()}/gestao`,
      ].join('\n'),
      html: this.buildHtml({
        eyebrow: `Chamado #${ticket.number}`,
        title: ticket.subject,
        intro: `<strong>${this.escape(requester.name)}</strong> (${this.escape(requester.email)}) abriu um chamado de <strong>${CATEGORY_LABEL[ticket.category]}</strong>.`,
        body: input.body,
        ctaLabel: 'Abrir a gestão',
        ctaUrl: `${this.appUrl()}/gestao`,
      }),
    });
  }

  async notifyManagersReply(
    input: TicketMailInput & { managerEmails: string[] },
  ): Promise<void> {
    const to = this.recipients(input.managerEmails);
    if (!to.length) return;
    const { ticket, requester } = input;
    await this.send({
      to,
      subject: `[Chamado #${ticket.number}] nova mensagem de ${requester.name}`,
      text: [
        `${requester.name} respondeu o chamado #${ticket.number} (${ticket.subject}).`,
        '',
        input.body,
        '',
        `Atender: ${this.appUrl()}/gestao`,
      ].join('\n'),
      html: this.buildHtml({
        eyebrow: `Chamado #${ticket.number}`,
        title: 'Nova mensagem do cliente',
        intro: `<strong>${this.escape(requester.name)}</strong> respondeu em “${this.escape(ticket.subject)}”.`,
        body: input.body,
        ctaLabel: 'Responder',
        ctaUrl: `${this.appUrl()}/gestao`,
      }),
    });
  }

  async notifyRequesterReply(input: TicketMailInput): Promise<void> {
    const { ticket, requester } = input;
    await this.send({
      to: requester.email,
      subject: `[Chamado #${ticket.number}] resposta da nossa equipe`,
      text: [
        `Olá, ${requester.name}.`,
        '',
        `Respondemos seu chamado #${ticket.number} — ${ticket.subject}:`,
        '',
        input.body,
        '',
        `Ver e responder: ${this.appUrl()}/suporte`,
      ].join('\n'),
      html: this.buildHtml({
        eyebrow: `Chamado #${ticket.number}`,
        title: 'Respondemos seu chamado',
        intro: `Olá, <strong>${this.escape(requester.name)}</strong>. Veja nossa resposta em “${this.escape(ticket.subject)}”.`,
        body: input.body,
        ctaLabel: 'Ver chamado',
        ctaUrl: `${this.appUrl()}/suporte`,
      }),
    });
  }

  /**
   * Destinatários dos avisos: as contas de gestão mais os endereços fixos de
   * SUPPORT_ALERT_EMAILS — assim o dono do sistema é avisado de todo chamado,
   * mesmo que nenhuma conta esteja com a flag de gestão ligada.
   */
  private recipients(managerEmails: string[]): string[] {
    const fixed = (this.config.get<string>('SUPPORT_ALERT_EMAILS') ?? '')
      .split(/[,;]+/g)
      .map((email) => email.trim())
      .filter(Boolean);
    const unique = new Map<string, string>();
    for (const email of [...fixed, ...managerEmails]) {
      unique.set(email.toLowerCase(), email);
    }
    return [...unique.values()];
  }

  private async send(input: {
    to: string | string[];
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
        `Não foi possível enviar o aviso de chamado: ${message}`,
      );
    }
  }

  private appUrl(): string {
    return (
      this.config.get<string>('APP_PUBLIC_URL') ??
      'https://financial.brunoholanda.com'
    ).replace(/\/$/, '');
  }

  private buildHtml(input: {
    eyebrow: string;
    title: string;
    intro: string;
    body: string;
    ctaLabel: string;
    ctaUrl: string;
  }): string {
    const body = this.escape(input.body).replace(/\n/g, '<br />');
    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${this.escape(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f2f4f7;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${NAVY};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f4f7;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${BORDER};">
          <tr>
            <td style="background:${NAVY};padding:26px 28px 22px;">
              <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#9db0c9;font-weight:600;">${this.escape(input.eyebrow)}</div>
              <div style="font-size:23px;line-height:1.25;color:#ffffff;font-weight:700;margin-top:8px;">${this.escape(input.title)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:26px 28px;">
              <p style="margin:0 0 16px;font-size:15px;line-height:1.55;">${input.intro}</p>
              <div style="padding:14px 16px;border-radius:10px;background:#f8fafc;border:1px solid ${BORDER};font-size:14px;line-height:1.6;color:${NAVY};">
                ${body}
              </div>
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:22px;">
                <tr>
                  <td style="border-radius:8px;background:${GREEN};">
                    <a href="${input.ctaUrl}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;">
                      ${this.escape(input.ctaLabel)}
                    </a>
                  </td>
                </tr>
              </table>
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
