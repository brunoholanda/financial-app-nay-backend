const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');

function loadEnv(filePath) {
  const env = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith("'") && value.endsWith("'")) ||
      (value.startsWith('"') && value.endsWith('"'))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function formatBrDate(ymd) {
  const [y, m, d] = ymd.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function formatBrCurrency(amount) {
  return Number(amount).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Mesmo layout do BillsAlertDigestService (amostra realista). */
function buildDigestHtml({ masterName, date, appUrl }) {
  const navy = '#0f274d';
  const green = '#1a936f';
  const overdueC = '#b42318';
  const dueTodayC = '#b54708';
  const muted = '#667085';
  const border = '#e4e7ec';
  const bg = '#f2f4f7';

  const overdueItems = [
    {
      title: 'Cartão Nubank',
      amount: '1840.55',
      dueDate: '2026-07-25',
      daysUntilDue: -5,
    },
    {
      title: 'Condomínio',
      amount: '620.00',
      dueDate: '2026-07-28',
      daysUntilDue: -2,
    },
  ];
  const dueTodayItems = [
    {
      title: 'Internet Fibra',
      amount: '129.90',
      dueDate: date,
      daysUntilDue: 0,
    },
  ];
  const overdueCount = overdueItems.length;
  const dueTodayCount = dueTodayItems.length;

  function rows(items, showOverdueDays) {
    return items
      .map((b) => {
        const meta = showOverdueDays
          ? `${formatBrDate(b.dueDate)} · ${Math.abs(b.daysUntilDue)} dia(s) em atraso`
          : formatBrDate(b.dueDate);
        return `<tr>
            <td style="padding:12px 0;border-bottom:1px solid ${border};vertical-align:top;">
              <div style="font-size:15px;font-weight:600;color:${navy};">${escapeHtml(b.title)}</div>
              <div style="font-size:13px;color:${muted};margin-top:4px;">${meta}</div>
            </td>
            <td style="padding:12px 0;border-bottom:1px solid ${border};vertical-align:top;text-align:right;white-space:nowrap;">
              <div style="font-size:15px;font-weight:700;color:${navy};">${formatBrCurrency(b.amount)}</div>
            </td>
          </tr>`;
      })
      .join('');
  }

  function section(title, accent, items, showOverdueDays) {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid ${border};border-radius:10px;overflow:hidden;">
        <tr>
          <td style="padding:10px 14px;background:#fafbfc;border-bottom:1px solid ${border};border-left:4px solid ${accent};">
            <div style="font-size:13px;font-weight:700;color:${accent};letter-spacing:0.02em;text-transform:uppercase;">${title}</div>
          </td>
        </tr>
        <tr>
          <td style="padding:4px 14px 8px;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              ${rows(items, showOverdueDays)}
            </table>
          </td>
        </tr>
      </table>`;
  }

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
              <div style="font-size:15px;color:#c5d0df;margin-top:8px;">Resumo de ${formatBrDate(date)}</div>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:${navy};">
                Bom dia, <strong>${escapeHtml(masterName)}</strong>. Segue o que precisa de atenção hoje nos seus espaços: contas <strong>já vencidas</strong> e as que <strong>vencem hoje</strong>.
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                <tr>
                  <td width="50%" style="padding:0 6px 0 0;vertical-align:top;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff4f3;border:1px solid #fecdca;border-radius:10px;">
                      <tr>
                        <td style="padding:14px 16px;">
                          <div style="font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:${overdueC};font-weight:700;">Vencidas</div>
                          <div style="font-size:28px;line-height:1.2;color:${navy};font-weight:700;margin-top:4px;">${overdueCount}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td width="50%" style="padding:0 0 0 6px;vertical-align:top;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffaeb;border:1px solid #fedf89;border-radius:10px;">
                      <tr>
                        <td style="padding:14px 16px;">
                          <div style="font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:${dueTodayC};font-weight:700;">Vencem hoje</div>
                          <div style="font-size:28px;line-height:1.2;color:${navy};font-weight:700;margin-top:4px;">${dueTodayCount}</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <div style="font-size:16px;font-weight:700;color:${navy};margin:0 0 10px;">Pessoal</div>
              ${section('Vencidas', overdueC, overdueItems, true)}
              ${section('Vencem hoje', dueTodayC, dueTodayItems, false)}
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

async function main() {
  const to = process.argv[2] || 'brunoholanda1618@gmail.com';
  const env = loadEnv(path.join(__dirname, '..', '.env'));
  const appUrl = (
    env.APP_PUBLIC_URL || 'https://financial.brunoholanda.com'
  ).replace(/\/$/, '');
  const date = new Date().toLocaleDateString('en-CA', {
    timeZone: 'America/Sao_Paulo',
  });

  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT || 465),
    secure: String(env.SMTP_SECURE || 'true').toLowerCase() !== 'false',
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });

  console.log('SMTP', env.SMTP_HOST, env.SMTP_USER, '→', to);
  await transporter.verify();
  console.log('VERIFY_OK');

  const html = buildDigestHtml({
    masterName: 'Bruno Holanda',
    date,
    appUrl,
  });

  const info = await transporter.sendMail({
    from: env.MAIL_FROM,
    to,
    subject: `Contas a pagar — ${formatBrDate(date)} (2 vencidas · 1 vencem hoje)`,
    text: [
      'Olá, Bruno Holanda.',
      `Resumo de contas — ${formatBrDate(date)}`,
      'Vencidas: 2 | Vencem hoje: 1',
      '',
      'Espaço: Pessoal',
      '  - Cartão Nubank | R$ 1.840,55',
      '  - Condomínio | R$ 620,00',
      '  - Internet Fibra | R$ 129,90',
      '',
      `Abrir o app: ${appUrl}/contas`,
    ].join('\n'),
    html,
  });

  console.log('SENT', info.messageId);
}

main().catch((err) => {
  console.error('FAIL', err.message);
  process.exit(1);
});
