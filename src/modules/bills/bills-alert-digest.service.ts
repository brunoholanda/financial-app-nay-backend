import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import {
  BillAlertItem,
  BillsDigestWorkspace,
  BillsService,
} from './bills.service';
import { formatBrCurrency, formatBrDate } from '../../common/utils/brazil-date';

type MasterDigest = {
  masterId: string;
  masterEmail: string;
  masterName: string;
  date: string;
  workspaces: BillsDigestWorkspace[];
  overdueCount: number;
  dueTodayCount: number;
};

export type BillsDigestSendItem = {
  recipient: string;
  masterName: string;
  overdueCount: number;
  dueTodayCount: number;
  messageId?: string;
  error?: string;
};

export type BillsDigestResult = {
  sent: boolean;
  skipped: boolean;
  reason?: string;
  recipients: string[];
  overdueCount: number;
  dueTodayCount: number;
  sends: BillsDigestSendItem[];
};

@Injectable()
export class BillsAlertDigestService {
  private readonly logger = new Logger(BillsAlertDigestService.name);

  constructor(
    private readonly billsService: BillsService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  async runDigest(options?: { force?: boolean }): Promise<BillsDigestResult> {
    const force = options?.force === true;
    const digest = await this.billsService.getOverdueAndDueTodayDigest();
    const byMaster = this.groupByMaster(digest.date, digest.workspaces);

    if (!force && digest.overdueCount === 0 && digest.dueTodayCount === 0) {
      this.logger.log(
        `Digest de contas ${digest.date}: nada a notificar (sem vencidas / vencem hoje).`,
      );
      return {
        sent: false,
        skipped: true,
        reason: 'no_bills',
        recipients: [],
        overdueCount: 0,
        dueTodayCount: 0,
        sends: [],
      };
    }

    if (!byMaster.length) {
      this.logger.warn(
        'Digest de contas: espaços com pendências sem MASTER ativo vinculado.',
      );
      return {
        sent: false,
        skipped: true,
        reason: 'no_master_recipients',
        recipients: [],
        overdueCount: digest.overdueCount,
        dueTodayCount: digest.dueTodayCount,
        sends: [],
      };
    }

    if (!this.mailService.isConfigured()) {
      this.logger.error('Digest de contas: SMTP não configurado.');
      return {
        sent: false,
        skipped: true,
        reason: 'smtp_not_configured',
        recipients: byMaster.map((m) => m.masterEmail),
        overdueCount: digest.overdueCount,
        dueTodayCount: digest.dueTodayCount,
        sends: [],
      };
    }

    const appUrl = (
      this.config.get<string>('APP_PUBLIC_URL') ??
      'https://financial.brunoholanda.com'
    ).replace(/\/$/, '');

    const sends: BillsDigestSendItem[] = [];

    for (const masterDigest of byMaster) {
      if (
        !force &&
        masterDigest.overdueCount === 0 &&
        masterDigest.dueTodayCount === 0
      ) {
        continue;
      }

      const subject = this.buildSubject(
        masterDigest.date,
        masterDigest.overdueCount,
        masterDigest.dueTodayCount,
      );
      const text = this.buildText(masterDigest, appUrl);
      const html = this.buildHtml(masterDigest, appUrl);

      try {
        const { messageId } = await this.mailService.send({
          to: masterDigest.masterEmail,
          subject,
          text,
          html,
        });
        sends.push({
          recipient: masterDigest.masterEmail,
          masterName: masterDigest.masterName,
          overdueCount: masterDigest.overdueCount,
          dueTodayCount: masterDigest.dueTodayCount,
          messageId,
        });
        this.logger.log(
          `Digest → ${masterDigest.masterEmail} (${masterDigest.overdueCount} vencidas, ${masterDigest.dueTodayCount} hoje)`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        sends.push({
          recipient: masterDigest.masterEmail,
          masterName: masterDigest.masterName,
          overdueCount: masterDigest.overdueCount,
          dueTodayCount: masterDigest.dueTodayCount,
          error: message,
        });
        this.logger.error(
          `Digest falhou para ${masterDigest.masterEmail}: ${message}`,
        );
      }
    }

    const ok = sends.some((s) => !s.error);
    return {
      sent: ok,
      skipped: !ok,
      reason: ok ? undefined : 'all_sends_failed',
      recipients: sends.map((s) => s.recipient),
      overdueCount: digest.overdueCount,
      dueTodayCount: digest.dueTodayCount,
      sends,
    };
  }

  private groupByMaster(
    date: string,
    workspaces: BillsDigestWorkspace[],
  ): MasterDigest[] {
    const map = new Map<string, MasterDigest>();

    for (const ws of workspaces) {
      const key = ws.masterId;
      let entry = map.get(key);
      if (!entry) {
        entry = {
          masterId: ws.masterId,
          masterEmail: ws.masterEmail,
          masterName: ws.masterName,
          date,
          workspaces: [],
          overdueCount: 0,
          dueTodayCount: 0,
        };
        map.set(key, entry);
      }
      entry.workspaces.push(ws);
      entry.overdueCount += ws.overdue.length;
      entry.dueTodayCount += ws.dueToday.length;
    }

    return [...map.values()];
  }

  private buildSubject(
    dateYmd: string,
    overdueCount: number,
    dueTodayCount: number,
  ): string {
    const parts: string[] = [];
    if (overdueCount > 0) {
      parts.push(`${overdueCount} vencida${overdueCount > 1 ? 's' : ''}`);
    }
    if (dueTodayCount > 0) {
      parts.push(`${dueTodayCount} vencem hoje`);
    }
    const summary = parts.length
      ? parts.join(' · ')
      : 'sem pendências críticas';
    return `Contas a pagar — ${formatBrDate(dateYmd)} (${summary})`;
  }

  private buildText(digest: MasterDigest, appUrl: string): string {
    const lines: string[] = [
      `Olá, ${digest.masterName}.`,
      `Resumo de contas — ${formatBrDate(digest.date)}`,
      `Vencidas: ${digest.overdueCount} | Vencem hoje: ${digest.dueTodayCount}`,
      '',
    ];

    for (const ws of digest.workspaces) {
      lines.push(`Espaço: ${ws.workspaceName}`);
      if (ws.overdue.length) {
        lines.push('  Vencidas:');
        for (const b of ws.overdue) {
          lines.push(
            `  - ${b.title} | ${formatBrDate(b.dueDate)} | ${formatBrCurrency(b.amount)} (${Math.abs(b.daysUntilDue)} dia(s) em atraso)`,
          );
        }
      }
      if (ws.dueToday.length) {
        lines.push('  Vencem hoje:');
        for (const b of ws.dueToday) {
          lines.push(
            `  - ${b.title} | ${formatBrDate(b.dueDate)} | ${formatBrCurrency(b.amount)}`,
          );
        }
      }
      lines.push('');
    }

    lines.push(`Abrir o app: ${appUrl}/contas`);
    return lines.join('\n');
  }

  private buildHtml(digest: MasterDigest, appUrl: string): string {
    const navy = '#0f274d';
    const green = '#1a936f';
    const overdue = '#b42318';
    const dueToday = '#b54708';
    const muted = '#667085';
    const border = '#e4e7ec';
    const bg = '#f2f4f7';

    const summaryCards = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
        <tr>
          <td width="50%" style="padding:0 6px 0 0;vertical-align:top;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff4f3;border:1px solid #fecdca;border-radius:10px;">
              <tr>
                <td style="padding:14px 16px;">
                  <div style="font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:${overdue};font-weight:700;">Vencidas</div>
                  <div style="font-size:28px;line-height:1.2;color:${navy};font-weight:700;margin-top:4px;">${digest.overdueCount}</div>
                </td>
              </tr>
            </table>
          </td>
          <td width="50%" style="padding:0 0 0 6px;vertical-align:top;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffaeb;border:1px solid #fedf89;border-radius:10px;">
              <tr>
                <td style="padding:14px 16px;">
                  <div style="font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:${dueToday};font-weight:700;">Vencem hoje</div>
                  <div style="font-size:28px;line-height:1.2;color:${navy};font-weight:700;margin-top:4px;">${digest.dueTodayCount}</div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>`;

    const workspaceBlocks = digest.workspaces
      .map((ws) =>
        this.renderWorkspaceBlock(ws, {
          navy,
          overdue,
          dueToday,
          muted,
          border,
        }),
      )
      .join('');

    const emptyNote =
      digest.overdueCount === 0 && digest.dueTodayCount === 0
        ? `<p style="margin:0 0 20px;color:${muted};font-size:15px;line-height:1.5;">Nenhuma conta vencida ou com vencimento hoje nos seus espaços.</p>`
        : '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Contas a pagar</title>
</head>
<body style="margin:0;padding:0;background:${bg};font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${navy};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${border};">
          <tr>
            <td style="background:${navy};padding:28px 28px 24px;">
              <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#9db0c9;font-weight:600;">App Financeiro</div>
              <div style="font-size:24px;line-height:1.25;color:#ffffff;font-weight:700;margin-top:8px;">Contas a pagar</div>
              <div style="font-size:15px;color:#c5d0df;margin-top:8px;">Resumo de ${formatBrDate(digest.date)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:${navy};">
                Bom dia, <strong>${this.escapeHtml(digest.masterName)}</strong>. Segue o que precisa de atenção hoje nos seus espaços: contas <strong>já vencidas</strong> e as que <strong>vencem hoje</strong>.
              </p>
              ${summaryCards}
              ${emptyNote}
              ${workspaceBlocks}
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 0;">
                <tr>
                  <td style="border-radius:8px;background:${green};">
                    <a href="${appUrl}/contas" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;">
                      Abrir Contas no app
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 24px;border-top:1px solid ${border};background:#fafbfc;">
              <div style="font-size:12px;line-height:1.5;color:${muted};">
                Enviado automaticamente às 8h (horário de Brasília) para o administrador do espaço.<br />
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

  private renderWorkspaceBlock(
    ws: BillsDigestWorkspace,
    colors: {
      navy: string;
      overdue: string;
      dueToday: string;
      muted: string;
      border: string;
    },
  ): string {
    const sections: string[] = [];

    if (ws.overdue.length) {
      sections.push(
        this.renderBillSection(
          'Vencidas',
          colors.overdue,
          ws.overdue,
          colors,
          true,
        ),
      );
    }
    if (ws.dueToday.length) {
      sections.push(
        this.renderBillSection(
          'Vencem hoje',
          colors.dueToday,
          ws.dueToday,
          colors,
          false,
        ),
      );
    }

    if (!sections.length) return '';

    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;">
        <tr>
          <td style="padding:0 0 10px;">
            <div style="font-size:16px;font-weight:700;color:${colors.navy};">${this.escapeHtml(ws.workspaceName)}</div>
          </td>
        </tr>
        <tr>
          <td>${sections.join('')}</td>
        </tr>
      </table>`;
  }

  private renderBillSection(
    title: string,
    accent: string,
    items: BillAlertItem[],
    colors: {
      navy: string;
      muted: string;
      border: string;
    },
    showOverdueDays: boolean,
  ): string {
    const rows = items
      .map((b) => {
        const meta = showOverdueDays
          ? `${formatBrDate(b.dueDate)} · ${Math.abs(b.daysUntilDue)} dia(s) em atraso`
          : formatBrDate(b.dueDate);
        return `
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid ${colors.border};vertical-align:top;">
              <div style="font-size:15px;font-weight:600;color:${colors.navy};">${this.escapeHtml(b.title)}</div>
              <div style="font-size:13px;color:${colors.muted};margin-top:4px;">${meta}</div>
            </td>
            <td style="padding:12px 0;border-bottom:1px solid ${colors.border};vertical-align:top;text-align:right;white-space:nowrap;">
              <div style="font-size:15px;font-weight:700;color:${colors.navy};">${formatBrCurrency(b.amount)}</div>
            </td>
          </tr>`;
      })
      .join('');

    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid ${colors.border};border-radius:10px;overflow:hidden;">
        <tr>
          <td style="padding:10px 14px;background:#fafbfc;border-bottom:1px solid ${colors.border};border-left:4px solid ${accent};">
            <div style="font-size:13px;font-weight:700;color:${accent};letter-spacing:0.02em;text-transform:uppercase;">${title}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:4px 14px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${rows}
            </table>
          </td>
        </tr>
      </table>`;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
