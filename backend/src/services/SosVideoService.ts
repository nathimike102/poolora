/**
 * SosVideoService.ts
 *
 * Live video during an SOS (UC-X04). When the person cannot speak freely,
 * the safety team can ask them to turn on their camera, or they can turn it
 * on themselves, and the team watches from the web admin.
 *
 * - Only the phone sends. It receives nothing, so the team can never make a
 *   sound on it that gives the person away, and no data is spent on it.
 * - Low resolution, with sound only a tap away, to keep data use down.
 * - Recorded with the incident's evidence (sos/<id>/) only when the platform
 *   setting is on, and the phone says so before the camera comes on. The
 *   setting stays off until legal advice allows recording in the car.
 * - The video ends when the person stops it, their phone drops out of it
 *   for good (LiveKit's webhook), or the SOS closes.
 */

import { EmergencyRecord, IEmergencyRecord } from '../models/EmergencyRecord';
import { User } from '../models/User';
import { SOSStatus } from '../types';
import { AppError, AuthorizationError, NotFoundError } from '../utils/AppError';
import { EventBridge } from '../events';
import { config } from '../config';
import { phrase } from '../i18n';
import { audit } from './AuditService';
import { pageSafetyTeam, tellUser } from './SafetyAlerts';
import { closeRoom, inRoom, joinPass, recordingAvailable, roomFor, startRecording, stopRecording, videoAvailable } from './LiveVideo';

const OPEN = [SOSStatus.TRIGGERED, SOSStatus.ACKNOWLEDGED];

const live = (record: Pick<IEmergencyRecord, 'video'>) => Boolean(record.video?.startedAt && !record.video.endedAt);

function unavailable(): AppError {
  return new AppError('Video is not available. Call the person instead.', 503, 'VIDEO_UNAVAILABLE');
}

function published(emergencyId: string): void {
  EventBridge.publish('safety-events', { eventType: 'sos.updated', data: { emergencyId, change: 'video' } });
}

export class SosVideoService {
  private async openRecord(emergencyId: string): Promise<IEmergencyRecord> {
    const record = await EmergencyRecord.findById(emergencyId);
    if (!record) throw new NotFoundError('Emergency record');
    if (!OPEN.includes(record.status)) throw new AppError('This SOS is already closed', 409, 'SOS_CLOSED');
    return record;
  }

  private assertTriggerer(record: IEmergencyRecord, userId: string): void {
    if (String(record.triggeredBy) !== userId) throw new AuthorizationError('You do not have access to this SOS');
  }

  /** The safety team asks the person to turn on their camera, by push and on the SOS screen. */
  async ask(emergencyId: string, adminId: string) {
    if (!videoAvailable()) throw unavailable();
    const record = await this.openRecord(emergencyId);
    if (live(record)) return { asked: false, live: true };

    const admin = await User.findById(adminId).select('name').lean();
    const now = new Date();
    // Only the ask is written, and only while the camera is off: a camera
    // turned on meanwhile is never overwritten by this stale copy
    const asked = await EmergencyRecord.updateOne(
      {
        _id: emergencyId,
        status: { $in: OPEN },
        $or: [{ 'video.startedAt': { $exists: false } }, { 'video.endedAt': { $exists: true } }],
      },
      {
        $set: { 'video.room': roomFor(emergencyId), 'video.requestedAt': now, 'video.requestedBy': admin?._id },
        $push: { timeline: { event: 'Safety team asked for video', timestamp: now, details: admin?.name } },
      },
    );
    if (!asked.modifiedCount) {
      await this.openRecord(emergencyId);
      return { asked: false, live: true };
    }

    await audit(adminId, 'sos.video.ask', 'sos', emergencyId);
    published(emergencyId);
    void tellUser(String(record.triggeredBy), {
      emergencyId,
      change: 'video-requested',
      title: phrase('sos.user.videoAskTitle'),
      body: phrase('sos.user.videoAskBody'),
    });
    return { asked: true, live: false };
  }

  /**
   * The person turns on their camera, asked or not. Returns where to send it,
   * and whether it is recorded. It is recorded only if recording is on and
   * the phone told them so before they turned it on (`toldRecorded`): a
   * setting changed while the screen was open never records someone who
   * was told it would not be.
   */
  async start(emergencyId: string, userId: string, toldRecorded = false) {
    if (!videoAvailable()) throw unavailable();
    const record = await this.openRecord(emergencyId);
    this.assertTriggerer(record, userId);

    const user = await User.findById(userId).select('name').lean();
    const room = roomFor(emergencyId);
    const { roomSid, ...pass } = await joinPass(room, `user:${userId}`, user?.name ?? 'Person in danger', 'sender').catch(() => {
      throw unavailable();
    });
    // Turned on again (the app was closed or crashed): a recording of the
    // earlier camera ends with it, and this one gets its own if it is recorded
    const running = live(record) ? record.video?.egressId : undefined;
    if (running && running !== 'starting') await stopRecording(running);
    const recording = toldRecorded && recordingAvailable();
    const now = new Date();
    // Written only while the SOS is open: one closed meanwhile has already
    // ended its video, and must not show a camera on again
    const saved = await EmergencyRecord.updateOne(
      { _id: emergencyId, status: { $in: OPEN } },
      {
        $set: { 'video.room': room, 'video.roomSid': roomSid, 'video.startedAt': now, 'video.recording': recording },
        $unset: { 'video.endedAt': 1, 'video.egressId': 1 },
        $push: { timeline: { event: 'Turned on the camera', timestamp: now, details: recording ? 'Recorded with the incident' : 'Live only, not recorded' } },
      },
    );
    if (!saved.modifiedCount) {
      await closeRoom(room);
      throw new AppError('This SOS is already closed', 409, 'SOS_CLOSED');
    }

    published(emergencyId);
    void pageSafetyTeam(emergencyId, `${user?.name ?? 'The person'} turned on their camera. Watch it on the SOS page.`);
    return { ...pass, room, recording };
  }

  /** The phone's camera is sending: start the recording, if this one is recorded. */
  async sending(emergencyId: string, userId: string) {
    const record = await this.openRecord(emergencyId);
    this.assertTriggerer(record, userId);
    if (!live(record)) throw new AppError('Turn on the camera first', 409, 'VIDEO_NOT_STARTED');
    if (!record.video?.recording) return { recording: false };

    // Claim the recording first, so two calls never start two
    const claimed = await EmergencyRecord.findOneAndUpdate(
      { _id: emergencyId, 'video.recording': true, 'video.endedAt': { $exists: false }, 'video.egressId': { $exists: false } },
      { $set: { 'video.egressId': 'starting' } },
    );
    if (!claimed) return { recording: true };

    const key = `sos/${emergencyId}/video-${new Date().toISOString().replace(/[:.]/g, '-')}.mp4`;
    const egressId = await startRecording(record.video.room, `user:${userId}`, key);
    const now = new Date();
    if (egressId) {
      // Keep it only if this video still has its claim: a camera turned on
      // again as "not recorded", or ended, meanwhile wins
      const kept = await EmergencyRecord.updateOne(
        { _id: emergencyId, 'video.egressId': 'starting', 'video.recording': true, 'video.endedAt': { $exists: false } },
        {
          $set: { 'video.egressId': egressId },
          $push: { videoRecordingUrls: `s3://${config.aws.s3Bucket}/${key}`, timeline: { event: 'Recording video', timestamp: now } },
        },
      );
      if (!kept.modifiedCount) {
        await stopRecording(egressId);
        return { recording: false };
      }
    } else {
      await EmergencyRecord.updateOne(
        { _id: emergencyId, 'video.egressId': 'starting' },
        { $unset: { 'video.egressId': 1 }, $push: { timeline: { event: 'Video could not be recorded', timestamp: now, details: 'It is still live to the safety team' } } },
      );
    }
    published(emergencyId);
    return { recording: Boolean(egressId) };
  }

  /** The person turns their camera off. Also allowed just after the SOS closes. */
  async stop(emergencyId: string, userId: string) {
    const record = await EmergencyRecord.findById(emergencyId);
    if (!record) throw new NotFoundError('Emergency record');
    this.assertTriggerer(record, userId);
    if (!live(record)) return { stopped: false };
    await end(record, 'Turned off the camera');
    return { stopped: true };
  }

  /** An admin watches. Every viewing is in the audit log. */
  async watch(emergencyId: string, adminId: string) {
    if (!videoAvailable()) throw unavailable();
    const record = await this.openRecord(emergencyId);
    const admin = await User.findById(adminId).select('name').lean();
    const room = roomFor(emergencyId);
    const { url, token } = await joinPass(room, `admin:${adminId}`, admin?.name ?? 'Safety team', 'watcher').catch(() => {
      throw unavailable();
    });
    await audit(adminId, 'sos.video.watch', 'sos', emergencyId);
    return { url, token, room, live: live(record), recording: Boolean(record.video?.recording) };
  }
}

/** Ends the video: stops any recording and closes the room for everyone. */
async function end(record: IEmergencyRecord, event: string): Promise<void> {
  const video = record.video;
  if (!video) return;
  const now = new Date();
  if (video.egressId && video.egressId !== 'starting') await stopRecording(video.egressId);
  await closeRoom(video.room);
  await EmergencyRecord.updateOne(
    { _id: record._id },
    { $set: { 'video.endedAt': now }, $push: { timeline: { event, timestamp: now } } },
  );
  published(String(record._id));
}

/** How long a phone that dropped out has to come back before its video ends */
export const PHONE_GRACE_MS = 30_000;

const sosIdOf = (room: string) => /^sos-([a-f0-9]{24})$/.exec(room)?.[1];
const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms).unref?.());

/**
 * LiveKit says someone left an SOS room. When it is the phone of the person
 * who raised it (the app closed, crashed or lost its signal), the video has
 * ended unless the phone comes back within the grace period, as it does
 * after a short loss of signal. Then the team no longer sees "Camera on". A
 * phone leaving an earlier video, before the camera was turned on again,
 * changes nothing.
 */
export async function phoneLeftRoom(room: string, identity: string, joinedAt: Date | null, graceMs = PHONE_GRACE_MS): Promise<void> {
  const id = sosIdOf(room);
  if (!id || !identity.startsWith('user:')) return;
  const record = await EmergencyRecord.findById(id);
  if (!record || !live(record) || `user:${String(record.triggeredBy)}` !== identity) return;
  // The camera's start is set just before the phone joins (a second's slack for clocks in whole seconds)
  const startedAt = record.video!.startedAt!;
  if (joinedAt && joinedAt.getTime() < startedAt.getTime() - 1000) return;

  await wait(graceMs);
  if (await inRoom(room, identity)) return;
  const now = await EmergencyRecord.findById(id);
  // Turned off, ended or turned on again meanwhile
  if (!now || !live(now) || now.video!.startedAt!.getTime() !== startedAt.getTime()) return;
  await end(now, 'Camera stopped: the phone left the video');
}

/**
 * LiveKit closed an SOS room because nobody was left in it, for instance
 * when the phone never managed to join. A video still shown as on has ended.
 * Only this video's own room counts, not one closed before it was turned on again.
 */
export async function videoRoomClosed(room: string, roomSid: string): Promise<void> {
  const id = sosIdOf(room);
  if (!id) return;
  const record = await EmergencyRecord.findById(id);
  if (!record || !live(record) || !roomSid || record.video?.roomSid !== roomSid) return;
  await end(record, 'Video ended: nobody was left in it');
}

/**
 * LiveKit finished a recording. If it failed and wrote nothing, its file is
 * taken off the incident's evidence, and the team sees that this video is
 * not being recorded. Either way a later recording can start.
 */
export async function recordingEnded(info: { room: string; egressId: string; failed: boolean; file?: string; error?: string }): Promise<void> {
  const id = sosIdOf(info.room);
  if (!id) return;
  const now = new Date();
  if (info.failed && info.file) {
    await EmergencyRecord.updateOne({ _id: id }, { $pull: { videoRecordingUrls: `s3://${config.aws.s3Bucket}/${info.file}` } });
  }
  const current = await EmergencyRecord.updateOne(
    { _id: id, 'video.egressId': info.egressId },
    {
      $unset: { 'video.egressId': 1 },
      ...(info.failed
        ? { $set: { 'video.recording': false }, $push: { timeline: { event: 'Video could not be recorded', timestamp: now, details: info.error || 'It is still live to the safety team' } } }
        : {}),
    },
  );
  if (current.modifiedCount || info.failed) published(id);
}

/** Called when an SOS closes, however it closes. */
export async function endSosVideo(emergencyId: string): Promise<void> {
  if (!videoAvailable()) return;
  const record = await EmergencyRecord.findById(emergencyId);
  if (record && live(record)) await end(record, 'Video ended with the SOS');
}
