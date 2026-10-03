jest.mock('../../api/axios', () => ({
  apiClient: { post: jest.fn() },
}));

const mockParticipant = {
  setCameraEnabled: jest.fn().mockResolvedValue(undefined),
  setMicrophoneEnabled: jest.fn().mockResolvedValue(undefined),
  getTrackPublication: jest.fn(),
};
const mockRoom = {
  on: jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  localParticipant: mockParticipant,
};
const mockRoomOptions: unknown[] = [];
jest.mock('livekit-client', () => ({
  Room: jest.fn().mockImplementation((options: unknown) => {
    mockRoomOptions.push(options);
    return mockRoom;
  }),
  RoomEvent: { Disconnected: 'disconnected' },
  Track: { Source: { Camera: 'camera' } },
  VideoPresets43: { h240: { resolution: { width: 320, height: 240 }, encoding: { maxBitrate: 160_000 } } },
}));
jest.mock('@livekit/react-native', () => ({
  registerGlobals: jest.fn(),
  AudioSession: { startAudioSession: jest.fn().mockResolvedValue(undefined), stopAudioSession: jest.fn().mockResolvedValue(undefined) },
}));

import { apiClient } from '../../api/axios';
import { startSosVideo } from '../sosVideo';

const post = apiClient.post as jest.Mock;

describe('SOS video', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRoomOptions.length = 0;
    post.mockImplementation(async (url: string) => ({
      data: { data: url.endsWith('/video') ? { url: 'wss://lk', token: 'pass', recording: false } : url.endsWith('/sending') ? { recording: true } : {} },
    }));
  });

  test('sends the back camera at low resolution, and says whether the server records it', async () => {
    const session = await startSosVideo('e1', true, false, jest.fn());
    expect(post).toHaveBeenNthCalledWith(1, '/safety/sos/e1/video', { toldRecorded: false });
    expect(mockRoom.connect).toHaveBeenCalledWith('wss://lk', 'pass');
    expect(mockRoomOptions[0]).toMatchObject({ videoCaptureDefaults: { facingMode: 'environment', resolution: { height: 240 } }, publishDefaults: { simulcast: false } });
    expect(mockParticipant.setCameraEnabled).toHaveBeenCalledWith(true);
    expect(mockParticipant.setMicrophoneEnabled).toHaveBeenCalledWith(true);
    expect(post).toHaveBeenNthCalledWith(2, '/safety/sos/e1/video/sending');
    expect(session.recording).toBe(true);

    await session.stop();
    expect(mockRoom.disconnect).toHaveBeenCalled();
    expect(post).toHaveBeenLastCalledWith('/safety/sos/e1/video/stop');
  });

  test('leaves the microphone, and the audio session, to the SOS audio recording when that is on', async () => {
    const session = await startSosVideo('e1', false, false, jest.fn());
    await session.stop();
    expect(mockParticipant.setMicrophoneEnabled).not.toHaveBeenCalled();
    const { AudioSession } = jest.requireMock('@livekit/react-native');
    expect(AudioSession.startAudioSession).not.toHaveBeenCalled();
    expect(AudioSession.stopAudioSession).not.toHaveBeenCalled();
  });

  test('leaves the room, and tells the server, when the camera cannot start', async () => {
    mockParticipant.setCameraEnabled.mockRejectedValueOnce(new Error('Camera permission denied'));
    await expect(startSosVideo('e1', true, false, jest.fn())).rejects.toThrow('Camera permission denied');
    expect(mockRoom.disconnect).toHaveBeenCalled();
    expect(post.mock.calls.map(([url]) => url)).toEqual(['/safety/sos/e1/video', '/safety/sos/e1/video/stop']);
  });

  test('tells the server when it cannot reach the video at all', async () => {
    mockRoom.connect.mockRejectedValueOnce(new Error('could not establish signal connection'));
    await expect(startSosVideo('e1', true, false, jest.fn())).rejects.toThrow('signal connection');
    expect(post).toHaveBeenLastCalledWith('/safety/sos/e1/video/stop');
  });
});
