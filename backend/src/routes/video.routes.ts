import { Router } from 'express';
import { EgressStatus } from 'livekit-server-sdk';
import { readWebhook } from '../services/LiveVideo';
import { phoneLeftRoom, recordingEnded, videoRoomClosed } from '../services/SosVideoService';
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
  const logFailure = (error: Error) => logger.error('Could not handle a LiveKit webhook', { event: event.event, error: error.message });
  const room = event.room?.name ?? '';
  if (event.event === 'participant_left' && room && event.participant?.identity) {
    const { joinedAtMs, joinedAt } = event.participant;
    const joined = joinedAtMs ? new Date(Number(joinedAtMs)) : joinedAt ? new Date(Number(joinedAt) * 1000) : null;
    // Waits to see whether the phone comes back, so LiveKit is answered first
    void phoneLeftRoom(room, event.participant.identity, joined).catch(logFailure);
  } else if (event.event === 'room_finished' && room) {
    await videoRoomClosed(room, event.room?.sid ?? '').catch(logFailure);
  } else if (event.event === 'egress_ended' && event.egressInfo) {
    const info = event.egressInfo;
    const file = info.request.case === 'participant' ? info.request.value.fileOutputs[0]?.filepath : undefined;
    const wrote = info.fileResults.some((f) => Number(f.size) > 0);
    const failed = (info.status === EgressStatus.EGRESS_FAILED || info.status === EgressStatus.EGRESS_ABORTED) && !wrote;
    await recordingEnded({ room: info.roomName, egressId: info.egressId, failed, file, error: info.error }).catch(logFailure);
  }
  res.status(200).json({ status: 'success' });
});

export default router;
