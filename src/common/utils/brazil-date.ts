/** Data civil em fuso IANA (padrão: America/Sao_Paulo). */
export function todayYmdInTimeZone(
  timeZone = 'America/Sao_Paulo',
  date = new Date(),
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const y = parts.find((p) => p.type === 'year')?.value;
  const m = parts.find((p) => p.type === 'month')?.value;
  const d = parts.find((p) => p.type === 'day')?.value;
  if (!y || !m || !d) {
    throw new Error('Não foi possível obter a data no fuso informado');
  }
  return `${y}-${m}-${d}`;
}

export function formatBrDate(ymd: string): string {
  const [y, m, d] = ymd.slice(0, 10).split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y}`;
}

export function formatBrCurrency(amount: string | number): string {
  const n =
    typeof amount === 'number' ? amount : Number.parseFloat(String(amount));
  if (!Number.isFinite(n)) return String(amount);
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
