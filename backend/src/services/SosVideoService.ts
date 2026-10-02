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
 * - The video ends when the person stops it or the SOS closes.
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
import { closeRoom, joinPass, recordingAvailable, roomFor, startRecording, stopRecording, videoAvailable } from './LiveVideo';

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
    record.video = { ...(record.video ?? { room: roomFor(emergencyId), recording: false }), requestedAt: now, requestedBy: admin?._id };
    record.timeline.push({ event: 'Safety team asked for video', timestamp: now, details: admin?.name });
    await record.save();

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
   * and whether it will be recorded (decided now, so the phone can say so).
   */
  async start(emergencyId: string, userId: string) {
    if (!videoAvailable()) throw unavailable();
    const record = await this.openRecord(emergencyId);
    this.assertTriggerer(record, userId);

    const user = await User.findById(userId).select('name').lean();
    const room = roomFor(emergencyId);
    const pass = await joinPass(room, `user:${userId}`, user?.name ?? 'Person in danger', 'sender').catch(() => {
      throw unavailable();
    });
    // A camera turned on again while a recording runs keeps that recording
    const recording = live(record) && record.video?.egressId ? record.video.recording : recordingAvailable();
    const now = new Date();
    record.video = {
      room,
      requestedAt: record.video?.requestedAt,
      requestedBy: record.video?.requestedBy,
      startedAt: now,
      recording,
      egressId: live(record) ? record.video?.egressId : undefined,
    };
    record.timeline.push({ event: 'Turned on the camera', timestamp: now, details: recording ? 'Recorded with the incident' : 'Live only, not recorded' });
    await record.save();

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
      await EmergencyRecord.updateOne(
        { _id: emergencyId },
        {
          $set: { 'video.egressId': egressId },
          $push: { videoRecordingUrls: `s3://${config.aws.s3Bucket}/${key}`, timeline: { event: 'Recording video', timestamp: now } },
        },
      );
    } else {
      await EmergencyRecord.updateOne(
        { _id: emergencyId },
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
    const pass = await joinPass(room, `admin:${adminId}`, admin?.name ?? 'Safety team', 'watcher').catch(() => {
      throw unavailable();
    });
    await audit(adminId, 'sos.video.watch', 'sos', emergencyId);
    return { ...pass, room, live: live(record), recording: Boolean(record.video?.recording) };
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

/** Called when an SOS closes, however it closes. */
export async function endSosVideo(emergencyId: string): Promise<void> {
  if (!videoAvailable()) return;
  const record = await EmergencyRecord.findById(emergencyId);
  if (record && live(record)) await end(record, 'Video ended with the SOS');
}
