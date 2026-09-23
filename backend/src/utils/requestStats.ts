/**
 * requestStats.ts
 *
 * Rolling five-minute window of request timings and status codes for the
 * admin dashboard's system health panel. Per backend instance: with several
 * instances each reports its own numbers.
 */

const WINDOW_MS = 5 * 60_000;
const MAX_SAMPLES = 50_000;

const samples: Array<{ at: number; ms: number; status: number }> = [];

export function recordRequest(ms: number, status: number): void {
  samples.push({ at: Date.now(), ms, status });
  if (samples.length > MAX_SAMPLES) samples.splice(0, samples.length - MAX_SAMPLES);
}

export function requestStats() {
  const since = Date.now() - WINDOW_MS;
  while (samples.length && samples[0].at < since) samples.shift();
  const count = samples.length;
  if (count === 0) return { windowMinutes: 5, requests: 0, errorRate: 0, avgMs: 0, p95Ms: 0 };
  const sorted = samples.map((s) => s.ms).sort((a, b) => a - b);
  const errors = samples.filter((s) => s.status >= 500).length;
  return {
    windowMinutes: 5,
    requests: count,
    errorRate: errors / count,
    avgMs: Math.round(sorted.reduce((a, b) => a + b, 0) / count),
    p95Ms: sorted[Math.min(count - 1, Math.floor(count * 0.95))],
  };
}
