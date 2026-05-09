/**
 * utils/formatters.ts
 * Common data formatting utilities used across screens.
 */

/** Format Indian currency: 5000 → "₹5,000" */
export const formatINR = (amount: number): string =>
  `₹${amount.toLocaleString('en-IN')}`;

/** Format phone: "9876543210" → "+91 98765 43210" */
export const formatPhone = (phone: string): string => {
  const clean = phone.replace(/\D/g, '');
  if (clean.length !== 10) return phone;
  return `+91 ${clean.slice(0, 5)} ${clean.slice(5)}`;
};

/** Format distance: 1500 → "1.5 km", 800 → "800 m" */
export const formatDistance = (metres: number): string =>
  metres >= 1000
    ? `${(metres / 1000).toFixed(1)} km`
    : `${metres} m`;

/** Format duration in minutes: 90 → "1h 30m", 45 → "45 min" */
export const formatDuration = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

/** Format a Date to "Mon, 12 Aug" */
export const formatDate = (date: Date): string =>
  date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

/** Format a Date to "08:30 AM" */
export const formatTime = (date: Date): string =>
  date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

/** Truncate a string to maxLen chars with ellipsis */
export const truncate = (str: string, maxLen: number): string =>
  str.length > maxLen ? `${str.slice(0, maxLen - 1)}…` : str;

/** Mask phone: "9876543210" → "98765 ****10" */
export const maskPhone = (phone: string): string => {
  const clean = phone.replace(/\D/g, '');
  if (clean.length !== 10) return phone;
  return `${clean.slice(0, 5)} ****${clean.slice(8)}`;
};
