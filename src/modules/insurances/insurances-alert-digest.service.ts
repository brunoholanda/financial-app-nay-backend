import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailService } from '../mail/mail.service';
import {
  InsuranceAlertItem,
  InsurancesDigestWorkspace,
  InsurancesService,
} from './insurances.service';
import { formatBrDate } from '../../common/utils/brazil-date';

type MasterDigest = {
  masterId: string;
  masterEmail: string;
  masterName: string;
  date: string;
  workspaces: InsurancesDigestWorkspace[];
  expiredCount: number;
  soonCount: number;
};

export type InsurancesDigestSendItem = {
  recipient: string;
  masterName: string;
  expiredCount: number;
  soonCount: number;
  messageId?: string;
  error?: string;
};

export type InsurancesDigestResult = {
  sent: boolean;
  skipped: boolean;
  reason?: string;
  recipients: string[];
  expiredCount: number;
  soonCount: number;
  sends: InsurancesDigestSendItem[];
};

const INSURANCE_TYPE_LABELS: Record<string, string> = {
  VIDA: 'Vida individual',
  VIDA_GRUPO: 'Vida em grupo',
  ACIDENTES_PESSOAIS_INDIVIDUAL: 'Acidentes pessoais (individual)',
  ACIDENTES_PESSOAIS_COLETIVO: 'Acidentes pessoais (coletivo)',
  SAUDE_INDIVIDUAL_FAMILIAR: 'Saúde individual / familiar',
  SAUDE_EMPRESARIAL: 'Saúde empresarial',
  ODONTO_INDIVIDUAL: 'Odontológico individual',
  ODONTO_EMPRESARIAL: 'Odontológico empresarial',
  AUTOMOVEL_COMPLETO: 'Automóvel (completo)',
  AUTOMOVEL_TERCEIROS: 'Automóvel (terceiros)',
  FROTA: 'Frota',
  MOTOCICLETA: 'Motocicleta',
  CAMINHAO: 'Caminhão / utilitário pesado',
  RESIDENCIAL: 'Residencial',
  CONDOMINIO: 'Condomínio',
  EMPRESARIAL: 'Empresarial (multirriscos)',
  LOCADOR: 'Locador / imóvel alugado',
  INCENDIO: 'Incêndio (patrimonial)',
  MULTIPLO_RISCOS: 'Múltiplos riscos',
  VIAGEM_INTERNACIONAL: 'Viagem internacional',
  VIAGEM_NACIONAL: 'Viagem nacional',
  RESPONSABILIDADE_CIVIL_GERAL: 'Responsabilidade civil geral',
  RESPONSABILIDADE_CIVIL_PROFISSIONAL: 'Responsabilidade civil profissional',
  D_AND_O: 'D&O (administradores)',
  E_AND_O: 'E&O (erros e omissões)',
  FIANCA_LOCATICIA: 'Fiança locatícia',
  FIANCA_JUDICIAL: 'Fiança judicial',
  AGRICOLA: 'Agrícola',
  RURAL_PECUARIO: 'Rural / pecuário',
  AERONAUTICO: 'Aeronáutico',
  MARITIMO: 'Marítimo',
  TRANSPORTE_NACIONAL_INTERNACIONAL: 'Transporte (nacional / internacional)',
  EQUIPAMENTOS: 'Equipamentos / máquinas',
  EVENTOS: 'Eventos',
  PET: 'Pet',
  CELULAR_GADGET: 'Celular / gadgets',
  CYBER_RISCOS: 'Cyber e riscos digitais',
  GARANTIA: 'Garantia',
  PREVIDENCIA_PRIVADA: 'Previdência privada',
  EDUCACIONAL: 'Educacional',
  ATRASO_EMBARQUE_BAGAGEM: 'Atraso de voo / bagagem',
  OUTRO: 'Outro',
};

@Injectable()
export class InsurancesAlertDigestService {
  private readonly logger = new Logger(InsurancesAlertDigestService.name);

  constructor(
    private readonly insurancesService: InsurancesService,
    private readonly mailService: MailService,
    private readonly config: ConfigService,
  ) {}

  async runDigest(options?: {
    force?: boolean;
  }): Promise<InsurancesDigestResult> {
    const force = options?.force === true;
    const digest = await this.insurancesService.getExpiredAndSoonDigest();
    const byMaster = this.groupByMaster(digest.date, digest.workspaces);

    if (!force && digest.expiredCount === 0 && digest.soonCount === 0) {
      this.logger.log(
        `Digest de seguros ${digest.date}: nada a notificar (sem vencidos / a vencer).`,
      );
      return {
        sent: false,
        skipped: true,
        reason: 'no_insurances',
        recipients: [],
        expiredCount: 0,
        soonCount: 0,
        sends: [],
      };
    }

    if (!byMaster.length) {
      this.logger.warn(
        'Digest de seguros: espaços com alertas sem MASTER ativo vinculado.',
      );
      return {
        sent: false,
        skipped: true,
        reason: 'no_master_recipients',
        recipients: [],
        expiredCount: digest.expiredCount,
        soonCount: digest.soonCount,
        sends: [],
      };
    }

    if (!this.mailService.isConfigured()) {
      this.logger.error('Digest de seguros: SMTP não configurado.');
      return {
        sent: false,
        skipped: true,
        reason: 'smtp_not_configured',
        recipients: byMaster.map((m) => m.masterEmail),
        expiredCount: digest.expiredCount,
        soonCount: digest.soonCount,
        sends: [],
      };
    }

    const appUrl = (
      this.config.get<string>('APP_PUBLIC_URL') ??
      'https://financial.brunoholanda.com'
    ).replace(/\/$/, '');

    const sends: InsurancesDigestSendItem[] = [];

    for (const masterDigest of byMaster) {
      if (
        !force &&
        masterDigest.expiredCount === 0 &&
        masterDigest.soonCount === 0
      ) {
        continue;
      }

      const subject = this.buildSubject(
        masterDigest.date,
        masterDigest.expiredCount,
        masterDigest.soonCount,
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
          expiredCount: masterDigest.expiredCount,
          soonCount: masterDigest.soonCount,
          messageId,
        });
        this.logger.log(
          `Digest seguros → ${masterDigest.masterEmail} (${masterDigest.expiredCount} vencidos, ${masterDigest.soonCount} a vencer)`,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        sends.push({
          recipient: masterDigest.masterEmail,
          masterName: masterDigest.masterName,
          expiredCount: masterDigest.expiredCount,
          soonCount: masterDigest.soonCount,
          error: message,
        });
        this.logger.error(
          `Digest seguros falhou para ${masterDigest.masterEmail}: ${message}`,
        );
      }
    }

    const ok = sends.some((s) => !s.error);
    return {
      sent: ok,
      skipped: !ok,
      reason: ok ? undefined : 'all_sends_failed',
      recipients: sends.map((s) => s.recipient),
      expiredCount: digest.expiredCount,
      soonCount: digest.soonCount,
      sends,
    };
  }

  private groupByMaster(
    date: string,
    workspaces: InsurancesDigestWorkspace[],
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
          expiredCount: 0,
          soonCount: 0,
        };
        map.set(key, entry);
      }
      entry.workspaces.push(ws);
      entry.expiredCount += ws.expired.length;
      entry.soonCount += ws.soon.length;
    }

    return [...map.values()];
  }

  private typeLabel(type: string): string {
    return INSURANCE_TYPE_LABELS[type] ?? type;
  }

  private buildSubject(
    dateYmd: string,
    expiredCount: number,
    soonCount: number,
  ): string {
    const parts: string[] = [];
    if (expiredCount > 0) {
      parts.push(`${expiredCount} vencido${expiredCount > 1 ? 's' : ''}`);
    }
    if (soonCount > 0) {
      parts.push(`${soonCount} a vencer`);
    }
    const summary = parts.length ? parts.join(' · ') : 'sem alertas de vigência';
    return `Seguros — ${formatBrDate(dateYmd)} (${summary})`;
  }

  private buildText(digest: MasterDigest, appUrl: string): string {
    const lines: string[] = [
      `Olá, ${digest.masterName}.`,
      `Resumo de seguros — ${formatBrDate(digest.date)}`,
      `Vencidos: ${digest.expiredCount} | A vencer: ${digest.soonCount}`,
      '',
    ];

    for (const ws of digest.workspaces) {
      lines.push(`Espaço: ${ws.workspaceName}`);
      if (ws.expired.length) {
        lines.push('  Vigência vencida:');
        for (const b of ws.expired) {
          lines.push(
            `  - ${b.title} (${this.typeLabel(b.insuranceType)}) | fim ${formatBrDate(b.validityEnd)} (${Math.abs(b.daysLeft)} dia(s) atrás)`,
          );
        }
      }
      if (ws.soon.length) {
        lines.push('  A vencer:');
        for (const b of ws.soon) {
          const when =
            b.daysLeft === 0
              ? 'vence hoje'
              : `em ${b.daysLeft} dia(s)`;
          lines.push(
            `  - ${b.title} (${this.typeLabel(b.insuranceType)}) | fim ${formatBrDate(b.validityEnd)} (${when})`,
          );
        }
      }
      lines.push('');
    }

    lines.push(`Abrir o app: ${appUrl}/seguros`);
    return lines.join('\n');
  }

  private buildHtml(digest: MasterDigest, appUrl: string): string {
    const navy = '#0f274d';
    const green = '#1a936f';
    const expired = '#b42318';
    const soon = '#b54708';
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
                  <div style="font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:${expired};font-weight:700;">Vencidos</div>
                  <div style="font-size:28px;line-height:1.2;color:${navy};font-weight:700;margin-top:4px;">${digest.expiredCount}</div>
                </td>
              </tr>
            </table>
          </td>
          <td width="50%" style="padding:0 0 0 6px;vertical-align:top;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffaeb;border:1px solid #fedf89;border-radius:10px;">
              <tr>
                <td style="padding:14px 16px;">
                  <div style="font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:${soon};font-weight:700;">A vencer</div>
                  <div style="font-size:28px;line-height:1.2;color:${navy};font-weight:700;margin-top:4px;">${digest.soonCount}</div>
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
          expired,
          soon,
          muted,
          border,
        }),
      )
      .join('');

    const emptyNote =
      digest.expiredCount === 0 && digest.soonCount === 0
        ? `<p style="margin:0 0 20px;color:${muted};font-size:15px;line-height:1.5;">Nenhum seguro vencido ou na janela de alerta nos seus espaços.</p>`
        : '';

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Seguros</title>
</head>
<body style="margin:0;padding:0;background:${bg};font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${navy};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${border};">
          <tr>
            <td style="background:${navy};padding:28px 28px 24px;">
              <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#9db0c9;font-weight:600;">App Financeiro</div>
              <div style="font-size:24px;line-height:1.25;color:#ffffff;font-weight:700;margin-top:8px;">Seguros</div>
              <div style="font-size:15px;color:#c5d0df;margin-top:8px;">Resumo de ${formatBrDate(digest.date)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:${navy};">
                Bom dia, <strong>${this.escapeHtml(digest.masterName)}</strong>. Segue o que precisa de atenção hoje nos seus espaços: seguros com vigência <strong>já vencida</strong> e os que estão <strong>na janela de alerta</strong>.
              </p>
              ${summaryCards}
              ${emptyNote}
              ${workspaceBlocks}
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 0;">
                <tr>
                  <td style="border-radius:8px;background:${green};">
                    <a href="${appUrl}/seguros" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;">
                      Abrir Seguros no app
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
    ws: InsurancesDigestWorkspace,
    colors: {
      navy: string;
      expired: string;
      soon: string;
      muted: string;
      border: string;
    },
  ): string {
    const sections: string[] = [];

    if (ws.expired.length) {
      sections.push(
        this.renderInsuranceSection(
          'Vigência vencida',
          colors.expired,
          ws.expired,
          colors,
          true,
        ),
      );
    }
    if (ws.soon.length) {
      sections.push(
        this.renderInsuranceSection(
          'A vencer',
          colors.soon,
          ws.soon,
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

  private renderInsuranceSection(
    title: string,
    accent: string,
    items: InsuranceAlertItem[],
    colors: {
      navy: string;
      muted: string;
      border: string;
    },
    showExpiredDays: boolean,
  ): string {
    const rows = items
      .map((b) => {
        const meta = showExpiredDays
          ? `${formatBrDate(b.validityEnd)} · ${Math.abs(b.daysLeft)} dia(s) atrás`
          : b.daysLeft === 0
            ? `${formatBrDate(b.validityEnd)} · vence hoje`
            : `${formatBrDate(b.validityEnd)} · em ${b.daysLeft} dia(s)`;
        return `
          <tr>
            <td style="padding:12px 0;border-bottom:1px solid ${colors.border};vertical-align:top;">
              <div style="font-size:15px;font-weight:600;color:${colors.navy};">${this.escapeHtml(b.title)}</div>
              <div style="font-size:13px;color:${colors.muted};margin-top:4px;">${this.escapeHtml(this.typeLabel(b.insuranceType))} · ${meta}</div>
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
