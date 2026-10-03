import { Router } from 'express';
import { readWebhook } from '../services/LiveVideo';
import { phoneLeftRoom } from '../services/SosVideoService';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /video/webhook
 * LiveKit's events, signed with the API secret. Set this URL in the LiveKit
 * project's webhook settings. The body arrives as text (app.ts) so the
 * signature is checked over it exactly as sent.
 */
router.post('/webhook', async (req, res) => {
  const event = await readWebhook(typeof req.body === 'string' ? req.body : '', req.get('authorization'));
  if (!event) {
    res.status(401).json({ status: 'error', message: 'Invalid signature' });
    return;
  }
  try {
    if (event.event === 'participant_left' && event.room?.name && event.participant?.identity) {
      const { joinedAtMs, joinedAt } = event.participant;
      const joined = joinedAtMs ? new Date(Number(joinedAtMs)) : joinedAt ? new Date(Number(joinedAt) * 1000) : null;
      await phoneLeftRoom(event.room.name, event.participant.identity, joined);
    }
  } catch (error) {
    logger.error('Could not handle a LiveKit webhook', { event: event.event, error: (error as Error).message });
  }
  res.status(200).json({ status: 'success' });
});

export default router;
