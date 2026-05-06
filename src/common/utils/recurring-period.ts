/** Limites inclusivos da competência mensal em data local YYYY-MM-DD */
export function getMonthDateBounds(
  year: number,
  month: number,
): { start: string; end: string } {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  const fmt = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return { start: fmt(first), end: fmt(last) };
}

/** Último dia válido da série antes do cancelamento; min com endDate configurada */
export function computeEffectiveSeriesEnd(
  configuredEndDate: string,
  cancelledAt: Date | null | undefined,
): string {
  const endConfigured = configuredEndDate.slice(0, 10);
  if (!cancelledAt) return endConfigured;
  const d = new Date(cancelledAt);
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() - 1);
  const pad = (n: number) => String(n).padStart(2, '0');
  const cappedByCancel = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return cappedByCancel < endConfigured ? cappedByCancel : endConfigured;
}

export function seriesAppliesToMonth(params: {
  startDate: string;
  effectiveEndDate: string;
  year: number;
  month: number;
}): boolean {
  const { start: monthStart, end: monthEnd } = getMonthDateBounds(
    params.year,
    params.month,
  );
  const sd = params.startDate.slice(0, 10);
  const ed = params.effectiveEndDate.slice(0, 10);
  return sd <= monthEnd && ed >= monthStart;
}

/** Data YYYY-MM-DD do débito no mês calendarístico informado (aclamps ao último dia do mês). */
export function debitDateInCalendarMonth(
  year: number,
  month: number,
  debitDayOfMonth: number,
): string {
  const lastDay = new Date(year, month, 0).getDate();
  const clampedDay = Math.min(Math.max(1, Math.floor(debitDayOfMonth)), lastDay);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${year}-${pad(month)}-${pad(clampedDay)}`;
}
