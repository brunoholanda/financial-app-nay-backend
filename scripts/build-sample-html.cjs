#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function formatBrDate(ymd) {
  const [y, m, d] = ymd.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}
function formatBrCurrency(amount) {
  return Number(amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const navy = '#0f274d';
const green = '#1a936f';
const overdue = '#b42318';
const dueToday = '#b54708';
const muted = '#667085';
const border = '#e4e7ec';
const bg = '#f2f4f7';
const appUrl = 'https://financial.brunoholanda.com';
const date = '2026-07-30';

const overdueItems = [
  { title: 'Cartão Nubank', amount: '1840.55', dueDate: '2026-07-25', daysUntilDue: -5 },
  { title: 'Condomínio', amount: '620.00', dueDate: '2026-07-28', daysUntilDue: -2 },
];
const dueTodayItems = [
  { title: 'Internet Fibra', amount: '129.90', dueDate: '2026-07-30', daysUntilDue: 0 },
];

function rows(items, showOverdueDays) {
  return items.map((b) => {
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
  }).join('');
}

function section(title, accent, items, showOverdueDays) {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 16px;border:1px solid ${border};border-radius:10px;overflow:hidden;">
    <tr><td style="padding:10px 14px;background:#fafbfc;border-bottom:1px solid ${border};border-left:4px solid ${accent};">
      <div style="font-size:13px;font-weight:700;color:${accent};letter-spacing:0.02em;text-transform:uppercase;">${title}</div>
    </td></tr>
    <tr><td style="padding:4px 14px 8px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows(items, showOverdueDays)}</table>
    </td></tr>
  </table>`;
}

const html = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /></head>
<body style="margin:0;padding:0;background:${bg};font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${navy};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${bg};padding:24px 12px;"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid ${border};">
<tr><td style="background:${navy};padding:28px 28px 24px;">
  <div style="font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:#9db0c9;font-weight:600;">App Financeiro</div>
  <div style="font-size:24px;line-height:1.25;color:#ffffff;font-weight:700;margin-top:8px;">Contas a pagar</div>
  <div style="font-size:15px;color:#c5d0df;margin-top:8px;">Resumo de ${formatBrDate(date)} · exemplo de layout</div>
</td></tr>
<tr><td style="padding:28px;">
  <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:${navy};">Bom dia. Segue o que precisa de atenção hoje: contas <strong>já vencidas</strong> e as que <strong>vencem hoje</strong>.</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr>
    <td width="50%" style="padding:0 6px 0 0;vertical-align:top;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff4f3;border:1px solid #fecdca;border-radius:10px;">
        <tr><td style="padding:14px 16px;">
          <div style="font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:${overdue};font-weight:700;">Vencidas</div>
          <div style="font-size:28px;line-height:1.2;color:${navy};font-weight:700;margin-top:4px;">2</div>
        </td></tr>
      </table>
    </td>
    <td width="50%" style="padding:0 0 0 6px;vertical-align:top;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fffaeb;border:1px solid #fedf89;border-radius:10px;">
        <tr><td style="padding:14px 16px;">
          <div style="font-size:12px;letter-spacing:0.04em;text-transform:uppercase;color:${dueToday};font-weight:700;">Vencem hoje</div>
          <div style="font-size:28px;line-height:1.2;color:${navy};font-weight:700;margin-top:4px;">1</div>
        </td></tr>
      </table>
    </td>
  </tr></table>
  <div style="font-size:16px;font-weight:700;color:${navy};margin:0 0 10px;">Pessoal</div>
  ${section('Vencidas', overdue, overdueItems, true)}
  ${section('Vencem hoje', dueToday, dueTodayItems, false)}
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 0;"><tr>
    <td style="border-radius:8px;background:${green};">
      <a href="${appUrl}/contas" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;">Abrir Contas no app</a>
    </td>
  </tr></table>
</td></tr>
<tr><td style="padding:18px 28px 24px;border-top:1px solid ${border};background:#fafbfc;">
  <div style="font-size:12px;line-height:1.5;color:${muted};">Este é um e-mail de exemplo do layout do alerta diário (8h Brasília).<br />Holanda Desenvolvimento de Software · financial.brunoholanda.com</div>
</td></tr>
</table></td></tr></table>
</body></html>`;

const out = path.join(__dirname, 'sample-bills-digest.html');
fs.writeFileSync(out, html);
console.log(out);
