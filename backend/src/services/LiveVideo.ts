/**
 * LiveVideo.ts
 *
 * The video provider behind SOS video (UC-X04). LiveKit, open source, so it
 * can move from LiveKit Cloud to our own servers without touching the SOS;
 * the rest of the backend only uses these functions.
 *
 * Rooms are one per incident. The phone may only send its camera and
 * microphone and receives nothing (no data spent on incoming video, and no
 * sound that could give the person away). The safety team may only watch.
 */

import {
  AccessToken,
  WebhookReceiver,
  type WebhookEvent,
  EgressClient,
  EncodedFileOutput,
  EncodedFileType,
  RoomServiceClient,
  S3Upload,
  TrackSource,
} from 'livekit-server-sdk';
import { config } from '../config';
import { logger } from '../utils/logger';

/** Room passes only need to last until the phone or the browser has joined */
const PASS_TTL = '10m';
/** A room nobody is in closes after this */
const EMPTY_ROOM_SECONDS = 300;
/**
 * A room everyone has left closes after this. Longer than the phone's grace
 * period (PHONE_GRACE_MS), so a phone that lost its signal can come back
 * before the room, and with it the video, is ended under it. LiveKit's own
 * default (20 seconds) is shorter.
 */
const DEPARTURE_SECONDS = 60;

export type VideoRole = 'sender' | 'watcher';

function video() {
  return config.video as { url: string; apiKey: string; apiSecret: string; recordingAccessKeyId: string; recordingSecretAccessKey: string };
}

/** Whether SOS video is set up at all. Without it the app never offers it. */
export function videoAvailable(): boolean {
  const v = video();
  return Boolean(v.url && v.apiKey && v.apiSecret);
}

/**
 * Whether a camera turned on now would be recorded: the platform setting is
 * on, and LiveKit has its own write-only keys for the bucket.
 */
export function recordingAvailable(): boolean {
  const v = video();
  return videoAvailable()
    && Boolean((config.safety as { recordVideo?: boolean }).recordVideo)
    && Boolean(v.recordingAccessKeyId && v.recordingSecretAccessKey && config.aws.s3Bucket);
}

/** LiveKit's API is https on the same host as the wss:// URL apps connect to */
function apiHost(): string {
  return video().url.replace(/^ws(s?):\/\//, 'http$1://');
}

export const roomFor = (emergencyId: string) => `sos-${emergencyId}`;

/**
 * Creates the incident's room (or finds it) and returns a pass for one
 * person, and the room's own id (a room closed and made again has a new one).
 */
export async function joinPass(room: string, identity: string, name: string, role: VideoRole): Promise<{ url: string; token: string; roomSid: string }> {
  const v = video();
  const created = await new RoomServiceClient(apiHost(), v.apiKey, v.apiSecret)
    .createRoom({ name: room, emptyTimeout: EMPTY_ROOM_SECONDS, departureTimeout: DEPARTURE_SECONDS, maxParticipants: 12 });
  const pass = new AccessToken(v.apiKey, v.apiSecret, { identity, name, ttl: PASS_TTL });
  pass.addGrant(role === 'sender'
    ? { room, roomJoin: true, canPublish: true, canPublishSources: [TrackSource.CAMERA, TrackSource.MICROPHONE], canSubscribe: false, canPublishData: false }
    : { room, roomJoin: true, canPublish: false, canSubscribe: true, canPublishData: false, hidden: true });
  return { url: v.url, token: await pass.toJwt(), roomSid: created.sid };
}

/** Whether someone is in the room now (false if LiveKit cannot say) */
export async function inRoom(room: string, identity: string): Promise<boolean> {
  const v = video();
  try {
    await new RoomServiceClient(apiHost(), v.apiKey, v.apiSecret).getParticipant(room, identity);
    return true;
  } catch {
    return false;
  }
}

/**
 * Records one person's camera and microphone to the bucket at `key`
 * (sos/<id>/...), encrypted by the bucket's default encryption. Returns the
 * recording's id, or null if LiveKit refused (the live video carries on).
 */
export async function startRecording(room: string, identity: string, key: string): Promise<string | null> {
  const v = video();
  try {
    const file = new EncodedFileOutput({
      fileType: EncodedFileType.MP4,
      filepath: key,
      output: {
        case: 's3',
        value: new S3Upload({
          accessKey: v.recordingAccessKeyId,
          secret: v.recordingSecretAccessKey,
          region: config.aws.region,
          bucket: config.aws.s3Bucket,
        }),
      },
    });
    const info = await new EgressClient(apiHost(), v.apiKey, v.apiSecret).startParticipantEgress(room, identity, { file });
    return info.egressId;
  } catch (error) {
    logger.error('Could not start recording SOS video', { room, error: (error as Error).message });
    return null;
  }
}

export async function stopRecording(egressId: string): Promise<void> {
  const v = video();
  await new EgressClient(apiHost(), v.apiKey, v.apiSecret).stopEgress(egressId).catch((error: Error) => {
    // Already stopped, for instance because the phone left the room
    logger.debug('Could not stop SOS video recording', { egressId, error: error.message });
  });
}

/**
 * Checks a webhook from LiveKit (signed with the API secret over the body)
 * and returns the event, or null if it is not genuinely from LiveKit.
 */
export async function readWebhook(body: string, authorization?: string): Promise<WebhookEvent | null> {
  if (!videoAvailable()) return null;
  const v = video();
  try {
    return await new WebhookReceiver(v.apiKey, v.apiSecret).receive(body, authorization);
  } catch {
    return null;
  }
}

/** Ends the room for everyone in it. */
export async function closeRoom(room: string): Promise<void> {
  const v = video();
  await new RoomServiceClient(apiHost(), v.apiKey, v.apiSecret).deleteRoom(room).catch((error: Error) => {
    logger.debug('Could not close SOS video room', { room, error: error.message });
  });
}
