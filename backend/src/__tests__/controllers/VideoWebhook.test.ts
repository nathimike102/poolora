/**
 * LiveKit's webhook for SOS video (UC-X04): only signed events are acted on,
 * and the signature is checked over the body exactly as sent.
 */
import express from 'express';
import request from 'supertest';
import { createHash } from 'crypto';
import { AccessToken } from 'livekit-server-sdk';

const mockLeft = jest.fn().mockResolvedValue(undefined);
const mockClosed = jest.fn().mockResolvedValue(undefined);
const mockRecordingEnded = jest.fn().mockResolvedValue(undefined);
jest.mock('../../services/SosVideoService', () => ({
  phoneLeftRoom: (...a: unknown[]) => mockLeft(...a),
  videoRoomClosed: (...a: unknown[]) => mockClosed(...a),
  recordingEnded: (...a: unknown[]) => mockRecordingEnded(...a),
}));

import { config } from '../../config';
import videoRoutes from '../../routes/video.routes';

const SECRET = 'a-secret-long-enough-for-signing-tokens';
Object.assign(config.video as unknown as Record<string, string>, { url: 'wss://siham.livekit.cloud', apiKey: 'APIkey', apiSecret: SECRET });

const app = express();
app.use('/video/webhook', express.text({ type: () => true }));
app.use('/video', videoRoutes);

async function signed(body: string, secret = SECRET) {
  const token = new AccessToken('APIkey', secret);
  token.sha256 = createHash('sha256').update(body).digest('base64');
  return token.toJwt();
}

const body = JSON.stringify({
  event: 'participant_left',
  room: { name: 'sos-0123456789abcdef01234567' },
  participant: { identity: 'user:abc', joinedAt: '1790000000' },
  id: 'EV_1', createdAt: '1790000100',
});
const post = (auth: string, payload = body) =>
  request(app).post('/video/webhook').set('Content-Type', 'application/webhook+json').set('Authorization', auth).send(payload);

beforeEach(() => [mockLeft, mockClosed, mockRecordingEnded].forEach((m) => m.mockClear()));

it('acts on a signed event', async () => {
  expect((await post(await signed(body))).status).toBe(200);
  expect(mockLeft).toHaveBeenCalledWith('sos-0123456789abcdef01234567', 'user:abc', new Date(1_790_000_000_000));
});

it('refuses an unsigned, wrongly signed or altered event', async () => {
  expect((await post('')).status).toBe(401);
  expect((await post(await signed(body, 'another-secret-that-is-long-enough!!'))).status).toBe(401);
  expect((await post(await signed(body), body.replace('user:abc', 'user:xyz'))).status).toBe(401);
  expect(mockLeft).not.toHaveBeenCalled();
});

it('passes on a closed room and a failed recording', async () => {
  const closed = JSON.stringify({ event: 'room_finished', room: { name: 'sos-0123456789abcdef01234567', sid: 'RM_1' }, id: 'EV_2', createdAt: '1790000200' });
  expect((await post(await signed(closed), closed)).status).toBe(200);
  expect(mockClosed).toHaveBeenCalledWith('sos-0123456789abcdef01234567', 'RM_1');

  const ended = JSON.stringify({
    event: 'egress_ended',
    egressInfo: {
      egressId: 'EG_1', roomName: 'sos-0123456789abcdef01234567', status: 'EGRESS_FAILED', error: 'S3 access denied',
      participant: { roomName: 'sos-0123456789abcdef01234567', identity: 'user:abc', fileOutputs: [{ filepath: 'sos/0123456789abcdef01234567/video-1.mp4' }] },
    },
    id: 'EV_3', createdAt: '1790000300',
  });
  expect((await post(await signed(ended), ended)).status).toBe(200);
  expect(mockRecordingEnded).toHaveBeenCalledWith({
    room: 'sos-0123456789abcdef01234567', egressId: 'EG_1', failed: true,
    file: 'sos/0123456789abcdef01234567/video-1.mp4', error: 'S3 access denied',
  });
});
