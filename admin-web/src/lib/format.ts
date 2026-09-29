/** Display formatting for Zimbabwe: US dollars, Harare time (CAT, UTC+2). */

export const TIME_ZONE = 'Africa/Harare';
export const TIME_ZONE_LABEL = 'Zimbabwe time (CAT)';

const count = new Intl.NumberFormat('en-US');
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const cents = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "US$1,234", "US$12.50" */
export const money = (n: number | null | undefined) => {
  if (n === null || n === undefined) return '—';
  const v = Math.round(n * 100) / 100;
  return `${v < 0 ? '-' : ''}US$${Number.isInteger(v) ? count.format(Math.abs(v)) : cents.format(Math.abs(v))}`;
};
export const num = (n: number | null | undefined) => (n === null || n === undefined ? '—' : count.format(n));
export const short = (n: number) => (Math.abs(n) >= 10_000 ? compact.format(n) : count.format(Math.round(n * 100) / 100));
export const pct = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined ? '—' : `${(n * 100).toFixed(digits)}%`;

export function when(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TIME_ZONE });
}

export function day(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TIME_ZONE });
}

/** "5 min ago", "3 h ago", "2 days ago" */
export function ago(date: string | Date | null | undefined): string {
  if (!date) return '—';
  const mins = Math.round((Date.now() - new Date(date).getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
