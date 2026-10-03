/**
 * Live video during an SOS (UC-X04), against a real MongoDB with LiveKit
 * mocked. Only the person in danger sends, the safety team only watches,
 * nothing is recorded unless the setting is on, and the video ends with the SOS.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mockLive = { available: true, recording: false, egress: 'EG_1' as string | null, roomSid: 'RM_1', present: false };
jest.mock('../../services/LiveVideo', () => ({
  videoAvailable: () => mockLive.available,
  recordingAvailable: () => mockLive.recording,
  roomFor: (id: string) => `sos-${id}`,
  joinPass: jest.fn(async (_room: string, identity: string, _name: string, role: string) => ({ url: 'wss://poolora.livekit.cloud', token: `${role}:${identity}`, roomSid: mockLive.roomSid })),
  inRoom: jest.fn(async () => mockLive.present),
  startRecording: jest.fn(async () => mockLive.egress),
  stopRecording: jest.fn(async () => undefined),
  closeRoom: jest.fn(async () => undefined),
}));
jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
jest.mock('../../services/SafetyAlerts', () => ({
  pageSafetyTeam: jest.fn(async () => undefined),
  tellUser: jest.fn(async () => undefined),
  textPeople: jest.fn(async () => []),
  pushToPhones: jest.fn(async () => undefined),
  smsAvailable: () => false,
}));

import * as LiveVideo from '../../services/LiveVideo';
import * as SafetyAlerts from '../../services/SafetyAlerts';
import { config } from '../../config';
import { AdminAuditLog } from '../../models/AdminAuditLog';
import { EmergencyRecord } from '../../models/EmergencyRecord';
import { User } from '../../models/User';
import { phoneLeftRoom, recordingEnded, SosVideoService, videoRoomClosed } from '../../services/SosVideoService';
import { SafetyService } from '../../services/SafetyService';
import { SOSStatus } from '../../types';

jest.setTimeout(60_000);

let mongo: MongoMemoryServer;
const video = new SosVideoService();
const safety = new SafetyService();
const rudo = new Types.ObjectId();
const driver = new Types.ObjectId();
const admin = new Types.ObjectId();
let sosId: string;

const mocked = (fn: unknown) => fn as jest.Mock;
const events = async () => (await EmergencyRecord.findById(sosId).lean())!.timeline.map((t) => t.event);

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  (config.aws as { s3Bucket: string }).s3Bucket = 'poolora-test';
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  jest.clearAllMocks();
  Object.assign(mockLive, { available: true, recording: false, egress: 'EG_1', roomSid: 'RM_1', present: false });
  await Promise.all([EmergencyRecord.deleteMany({}), User.deleteMany({}), AdminAuditLog.deleteMany({})]);
  await User.collection.insertMany([
    { _id: rudo, name: 'Rudo Moyo', phone: '+263771000001', capabilities: ['rider'], stats: {} },
    { _id: driver, name: 'Nyasha Chuma', phone: '+263771000003', capabilities: ['rider', 'driver'], stats: {} },
    { _id: admin, name: 'Tendai Safety', phone: '+263771000009', capabilities: ['rider', 'admin'], stats: {} },
  ]);
  sosId = (await EmergencyRecord.create({
    booking: new Types.ObjectId(), ride: new Types.ObjectId(), triggeredBy: rudo, status: SOSStatus.ACKNOWLEDGED,
    triggerLocation: { type: 'Point', coordinates: [31.05, -17.83] }, liveTrackingUrl: 'https://poolora.app/t/x',
  })).id;
});

describe('asking for video', () => {
  it('tells the person, logs it, and is refused without LiveKit', async () => {
    expect(await video.ask(sosId, admin.toString())).toEqual({ asked: true, live: false });
    expect(mocked(SafetyAlerts.tellUser)).toHaveBeenCalledWith(rudo.toString(), expect.objectContaining({ change: 'video-requested', title: expect.anything() }));
    expect(await events()).toContain('Safety team asked for video');
    expect(await AdminAuditLog.exists({ action: 'sos.video.ask', targetId: sosId })).toBeTruthy();

    mockLive.available = false;
    await expect(video.ask(sosId, admin.toString())).rejects.toMatchObject({ errorId: 'VIDEO_UNAVAILABLE' });
    await expect(video.start(sosId, rudo.toString())).rejects.toMatchObject({ errorId: 'VIDEO_UNAVAILABLE' });
  });
});

describe('turning the camera on', () => {
  it('only for the person who raised the SOS, sending only, and live only while the setting is off', async () => {
    await expect(video.start(sosId, driver.toString())).rejects.toMatchObject({ statusCode: 403 });
    const pass = await video.start(sosId, rudo.toString());
    expect(pass).toEqual({ url: 'wss://poolora.livekit.cloud', token: `sender:user:${rudo}`, room: `sos-${sosId}`, recording: false });
    expect(mocked(SafetyAlerts.pageSafetyTeam)).toHaveBeenCalledWith(sosId, expect.stringContaining('turned on their camera'));

    expect(await video.sending(sosId, rudo.toString())).toEqual({ recording: false });
    expect(mocked(LiveVideo.startRecording)).not.toHaveBeenCalled();
    const record = await EmergencyRecord.findById(sosId).lean();
    expect(record?.videoRecordingUrls).toEqual([]);
    expect(record?.timeline.at(-1)).toMatchObject({ event: 'Turned on the camera', details: 'Live only, not recorded' });
  });

  it('records once, with the incident, when the setting is on', async () => {
    mockLive.recording = true;
    expect((await video.start(sosId, rudo.toString(), true)).recording).toBe(true);
    const [first, second] = await Promise.all([video.sending(sosId, rudo.toString()), video.sending(sosId, rudo.toString())]);
    expect([first, second]).toEqual([{ recording: true }, { recording: true }]);
    expect(mocked(LiveVideo.startRecording)).toHaveBeenCalledTimes(1);
    expect(mocked(LiveVideo.startRecording).mock.calls[0][2]).toMatch(new RegExp(`^sos/${sosId}/video-.+\\.mp4$`));
    const record = await EmergencyRecord.findById(sosId).lean();
    expect(record?.video).toMatchObject({ egressId: 'EG_1', recording: true });
    expect(record?.videoRecordingUrls).toEqual([expect.stringMatching(new RegExp(`^s3://poolora-test/sos/${sosId}/video-`))]);
  });

  it('stays live when the recording cannot start, and tries again next time', async () => {
    mockLive.recording = true;
    mockLive.egress = null;
    await video.start(sosId, rudo.toString(), true);
    expect(await video.sending(sosId, rudo.toString())).toEqual({ recording: false });
    expect(await events()).toContain('Video could not be recorded');
    mockLive.egress = 'EG_2';
    expect(await video.sending(sosId, rudo.toString())).toEqual({ recording: true });
  });

  it('never records someone whose screen said it would not be', async () => {
    // Recording was switched on after their SOS screen opened
    mockLive.recording = true;
    expect((await video.start(sosId, rudo.toString(), false)).recording).toBe(false);
    expect(await video.sending(sosId, rudo.toString())).toEqual({ recording: false });
    expect(mocked(LiveVideo.startRecording)).not.toHaveBeenCalled();
  });

  it('stops a running recording when the camera comes on again as "not recorded"', async () => {
    // Recorded at first; the app crashed and reopened after recording was switched off
    mockLive.recording = true;
    await video.start(sosId, rudo.toString(), true);
    await video.sending(sosId, rudo.toString());
    expect((await video.start(sosId, rudo.toString(), false)).recording).toBe(false);
    expect(mocked(LiveVideo.stopRecording)).toHaveBeenCalledWith('EG_1');
    expect((await EmergencyRecord.findById(sosId).lean())?.video).toMatchObject({ recording: false });
    expect((await EmergencyRecord.findById(sosId).lean())?.video?.egressId).toBeUndefined();
    expect(await video.sending(sosId, rudo.toString())).toEqual({ recording: false });
    expect(mocked(LiveVideo.startRecording)).toHaveBeenCalledTimes(1);
  });

  it('gives a camera turned on again its own recording, ending the earlier one', async () => {
    mockLive.recording = true;
    await video.start(sosId, rudo.toString(), true);
    await video.sending(sosId, rudo.toString());
    mockLive.egress = 'EG_2';
    expect((await video.start(sosId, rudo.toString(), true)).recording).toBe(true);
    expect(mocked(LiveVideo.stopRecording)).toHaveBeenCalledWith('EG_1');
    expect(await video.sending(sosId, rudo.toString())).toEqual({ recording: true });
    const record = await EmergencyRecord.findById(sosId).lean();
    expect(record?.video?.egressId).toBe('EG_2');
    expect(record?.videoRecordingUrls).toHaveLength(2);
  });

  it('drops a recording that starts after the camera came on again as "not recorded"', async () => {
    mockLive.recording = true;
    await video.start(sosId, rudo.toString(), true);
    // The new camera wins while LiveKit is still starting the old recording
    mocked(LiveVideo.startRecording).mockImplementationOnce(async () => {
      await video.start(sosId, rudo.toString(), false);
      return 'EG_LATE';
    });
    expect(await video.sending(sosId, rudo.toString())).toEqual({ recording: false });
    expect(mocked(LiveVideo.stopRecording)).toHaveBeenCalledWith('EG_LATE');
    const record = await EmergencyRecord.findById(sosId).lean();
    expect(record?.video?.egressId).toBeUndefined();
    expect(record?.videoRecordingUrls).toEqual([]);
  });

  it('refuses "sending" before the camera is on', async () => {
    await expect(video.sending(sosId, rudo.toString())).rejects.toMatchObject({ errorId: 'VIDEO_NOT_STARTED' });
  });
});

describe('watching', () => {
  it('gives the team a watch-only pass, and logs every viewing', async () => {
    await video.start(sosId, rudo.toString());
    expect(await video.watch(sosId, admin.toString())).toMatchObject({ token: `watcher:admin:${admin}`, live: true, recording: false });
    expect(await AdminAuditLog.countDocuments({ action: 'sos.video.watch', actor: admin })).toBe(1);
  });
});

describe('when a recording ends by itself', () => {
  async function recordedVideo() {
    mockLive.recording = true;
    await video.start(sosId, rudo.toString(), true);
    await video.sending(sosId, rudo.toString());
    return (await EmergencyRecord.findById(sosId).lean())!.videoRecordingUrls[0];
  }

  it('takes a failed recording off the evidence and shows the video is not recorded', async () => {
    const url = await recordedVideo();
    const file = url.replace('s3://poolora-test/', '');
    await recordingEnded({ room: `sos-${sosId}`, egressId: 'EG_1', failed: true, file, error: 'S3 access denied' });
    const record = await EmergencyRecord.findById(sosId).lean();
    expect(record?.videoRecordingUrls).toEqual([]);
    expect(record?.video).toMatchObject({ recording: false });
    expect(record?.video?.egressId).toBeUndefined();
    expect(record?.timeline.at(-1)).toMatchObject({ event: 'Video could not be recorded', details: 'S3 access denied' });
  });

  it('keeps a finished recording, and lets a later one start', async () => {
    const url = await recordedVideo();
    await recordingEnded({ room: `sos-${sosId}`, egressId: 'EG_1', failed: false, file: url.replace('s3://poolora-test/', '') });
    const record = await EmergencyRecord.findById(sosId).lean();
    expect(record?.videoRecordingUrls).toEqual([url]);
    expect(record?.video).toMatchObject({ recording: true });
    expect(record?.video?.egressId).toBeUndefined();
  });

  it('leaves the current recording alone when an earlier one ends', async () => {
    await recordedVideo();
    await recordingEnded({ room: `sos-${sosId}`, egressId: 'EG_OLD', failed: false });
    expect((await EmergencyRecord.findById(sosId).lean())?.video?.egressId).toBe('EG_1');
  });
});

describe('ending', () => {
  it('stops the recording and closes the room when the person turns it off', async () => {
    mockLive.recording = true;
    await video.start(sosId, rudo.toString(), true);
    await video.sending(sosId, rudo.toString());
    expect(await video.stop(sosId, rudo.toString())).toEqual({ stopped: true });
    expect(mocked(LiveVideo.stopRecording)).toHaveBeenCalledWith('EG_1');
    expect(mocked(LiveVideo.closeRoom)).toHaveBeenCalledWith(`sos-${sosId}`);
    expect((await EmergencyRecord.findById(sosId).lean())?.video?.endedAt).toBeInstanceOf(Date);
    expect(await video.stop(sosId, rudo.toString())).toEqual({ stopped: false });
  });

  it('ends when LiveKit says the phone left and it does not come back, but not for an earlier video\'s phone', async () => {
    await video.start(sosId, rudo.toString());
    const startedAt = (await EmergencyRecord.findById(sosId).lean())!.video!.startedAt!;
    await phoneLeftRoom(`sos-${sosId}`, `user:${rudo}`, new Date(startedAt.getTime() - 60_000), 0);
    await phoneLeftRoom(`sos-${sosId}`, `user:${driver}`, new Date(), 0);
    await phoneLeftRoom(`sos-${sosId}`, `admin:${admin}`, new Date(), 0);
    expect((await EmergencyRecord.findById(sosId).lean())?.video?.endedAt).toBeUndefined();

    await phoneLeftRoom(`sos-${sosId}`, `user:${rudo}`, new Date(startedAt.getTime() + 500), 0);
    expect((await EmergencyRecord.findById(sosId).lean())?.video?.endedAt).toBeInstanceOf(Date);
    expect(await events()).toContain('Camera stopped: the phone left the video');
  });

  it('stays on when the phone comes back after a short loss of signal', async () => {
    await video.start(sosId, rudo.toString());
    mockLive.present = true;
    await phoneLeftRoom(`sos-${sosId}`, `user:${rudo}`, new Date(), 0);
    expect((await EmergencyRecord.findById(sosId).lean())?.video?.endedAt).toBeUndefined();
    expect(mocked(LiveVideo.closeRoom)).not.toHaveBeenCalled();
  });

  it('stays on when the camera was turned on again during the wait', async () => {
    await video.start(sosId, rudo.toString());
    mocked(LiveVideo.inRoom).mockImplementationOnce(async () => {
      await new Promise((r) => setTimeout(r, 5));
      await video.start(sosId, rudo.toString());
      return false;
    });
    await phoneLeftRoom(`sos-${sosId}`, `user:${rudo}`, new Date(), 0);
    expect((await EmergencyRecord.findById(sosId).lean())?.video?.endedAt).toBeUndefined();
  });

  it('ends when LiveKit closes its room empty, but not for an earlier room', async () => {
    await video.start(sosId, rudo.toString());
    await videoRoomClosed(`sos-${sosId}`, 'RM_OLD');
    expect((await EmergencyRecord.findById(sosId).lean())?.video?.endedAt).toBeUndefined();
    await videoRoomClosed(`sos-${sosId}`, 'RM_1');
    expect((await EmergencyRecord.findById(sosId).lean())?.video?.endedAt).toBeInstanceOf(Date);
    expect(await events()).toContain('Video ended: nobody was left in it');
  });

  it('ends with the SOS, and a closed SOS cannot be watched', async () => {
    await video.start(sosId, rudo.toString());
    await safety.resolveSOS(sosId, admin.toString(), 'Rider safe at home', false);
    await new Promise((r) => setTimeout(r, 200));
    expect(mocked(LiveVideo.closeRoom)).toHaveBeenCalledWith(`sos-${sosId}`);
    expect(await events()).toContain('Video ended with the SOS');
    await expect(video.watch(sosId, admin.toString())).rejects.toMatchObject({ errorId: 'SOS_CLOSED' });
  });
});
