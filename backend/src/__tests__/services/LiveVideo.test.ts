/**
 * The passes LiveKit is given for SOS video (UC-X04): the phone may only send
 * its camera and microphone and receives nothing; the safety team may only
 * watch, unseen. Recording needs the setting and its own keys.
 */
const mockCreateRoom = jest.fn().mockResolvedValue({});
jest.mock('livekit-server-sdk', () => ({
  ...jest.requireActual('livekit-server-sdk'),
  RoomServiceClient: jest.fn().mockImplementation(() => ({ createRoom: mockCreateRoom })),
}));

import { config } from '../../config';
import { joinPass, recordingAvailable, videoAvailable } from '../../services/LiveVideo';

const video = config.video as unknown as Record<string, string>;
const safety = config.safety as unknown as { recordVideo: boolean };
const claims = (token: string) => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());

beforeEach(() => {
  Object.assign(video, { url: 'wss://siham.livekit.cloud', apiKey: 'APIkey', apiSecret: 'a-secret-long-enough-for-signing-tokens', recordingAccessKeyId: '', recordingSecretAccessKey: '' });
  safety.recordVideo = false;
});

it('is off until LiveKit is set up, and records only with the setting and its own keys', () => {
  expect(videoAvailable()).toBe(true);
  expect(recordingAvailable()).toBe(false);
  safety.recordVideo = true;
  expect(recordingAvailable()).toBe(false); // no write-only keys yet
  Object.assign(video, { recordingAccessKeyId: 'AKIA', recordingSecretAccessKey: 'x' });
  (config.aws as { s3Bucket: string }).s3Bucket = 'siham-test';
  expect(recordingAvailable()).toBe(true);
  video.url = '';
  expect(videoAvailable()).toBe(false);
  expect(recordingAvailable()).toBe(false);
});

it('lets the phone only send, and the safety team only watch', async () => {
  const phone = await joinPass('sos-1', 'user:1', 'Rudo Moyo', 'sender');
  expect(phone.url).toBe('wss://siham.livekit.cloud');
  expect(claims(phone.token).video).toMatchObject({
    room: 'sos-1', roomJoin: true, canPublish: true, canSubscribe: false, canPublishData: false,
    canPublishSources: ['camera', 'microphone'],
  });

  const team = claims((await joinPass('sos-1', 'admin:9', 'Tendai', 'watcher')).token);
  expect(team.sub).toBe('admin:9');
  expect(team.video).toMatchObject({ room: 'sos-1', canPublish: false, canSubscribe: true, hidden: true });
  expect(team.exp - team.nbf).toBeLessThanOrEqual(600);
  expect(mockCreateRoom).toHaveBeenCalledWith(expect.objectContaining({ name: 'sos-1', emptyTimeout: 300 }));
});
