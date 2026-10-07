/**
 * Car GPS trackers through the Traccar gateway (TrackerService). The gateway
 * authenticates with the shared key in X-Siham-Tracker-Key; the endpoint is
 * off while TRACKER_GATEWAY_KEY is unset.
 */
import { Router, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { config } from '../config';
import { logger } from '../utils/logger';
import { TrackerService, TraccarPayload } from '../services/TrackerService';

const router = Router();
const trackers = new TrackerService();

function keyMatches(given: unknown): boolean {
  const expected = config.trackers.gatewayKey;
  if (!expected || typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

// POST /trackers/traccar: one position (Traccar forward.type=json)
router.post('/traccar', async (req: Request, res: Response) => {
  if (!keyMatches(req.get('X-Siham-Tracker-Key'))) {
    res.status(config.trackers.gatewayKey ? 401 : 404).json({ status: 'error' });
    return;
  }
  try {
    const result = await trackers.receive(req.body as TraccarPayload);
    res.status(200).json({ status: 'ok', result });
  } catch (error) {
    // Traccar retries on errors; a position that cannot be handled is logged, not retried forever
    logger.error('Tracker position failed', { error: (error as Error).message });
    res.status(200).json({ status: 'ok', result: 'error' });
  }
});

export default router;
