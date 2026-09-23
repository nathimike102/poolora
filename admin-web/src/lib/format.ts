/** Display formatting, in Indian conventions (₹, lakh grouping, IST). */

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const count = new Intl.NumberFormat('en-IN');
const compact = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 });

export const money = (n: number | null | undefined) => (n === null || n === undefined ? '—' : inr.format(n));
export const num = (n: number | null | undefined) => (n === null || n === undefined ? '—' : count.format(n));
export const short = (n: number) => (Math.abs(n) >= 10_000 ? compact.format(n) : count.format(Math.round(n * 100) / 100));
export const pct = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined ? '—' : `${(n * 100).toFixed(digits)}%`;

export function when(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
}

export function day(date: string | Date | null | undefined): string {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' });
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
