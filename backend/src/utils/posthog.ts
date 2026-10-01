/**
 * posthog.ts
 *
 * A minimal PostHog client: events are queued and sent to the batch endpoint
 * every few seconds, so a request never waits on analytics. Off unless this is
 * production and POSTHOG_API_KEY is set. Sending never throws.
 */

import { config } from '../config';
import { logger } from './logger';

interface Captured {
  event: string;
  distinct_id: string;
  properties: Record<string, unknown>;
  timestamp: string;
}

const FLUSH_AT = 50;
const FLUSH_EVERY_MS = 10_000;
/** If PostHog is unreachable, drop the oldest events rather than grow without end */
const MAX_QUEUE = 5_000;

let queue: Captured[] = [];
let timer: NodeJS.Timeout | null = null;

export function posthogEnabled(): boolean {
  return config.isProduction && Boolean(config.analytics.posthogKey);
}

export function capture(distinctId: string, event: string, properties: Record<string, unknown> = {}): void {
  if (!posthogEnabled()) return;
  queue.push({ event, distinct_id: distinctId, properties: { ...properties, $lib: 'poolora-backend' }, timestamp: new Date().toISOString() });
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  if (queue.length >= FLUSH_AT) void flush();
  else if (!timer) {
    timer = setTimeout(() => void flush(), FLUSH_EVERY_MS);
    timer.unref();
  }
}

/** Sends what is queued. Called on a timer, when the queue fills, and on shutdown. */
export async function flush(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!queue.length) return;
  const batch = queue;
  queue = [];
  try {
    const res = await fetch(`${config.analytics.posthogHost.replace(/\/$/, '')}/batch/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: config.analytics.posthogKey, batch }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) logger.warn('PostHog rejected a batch', { status: res.status, events: batch.length });
  } catch (error) {
    logger.warn('PostHog unreachable; events dropped', { events: batch.length, error: (error as Error).message });
  }
}
