/**
 * CallService.ts
 *
 * Masked calls between a rider and their driver (UC-D06), through Twilio.
 * Twilio rings the caller from the platform number; when they answer, it
 * dials the other person, again showing the platform number. Neither side
 * learns the other's phone. Calls are allowed while the booking is
 * confirmed or on the road, and for 2 hours after the trip (lost items).
 *
 * With recording on (CALL_RECORDING, default on), both sides hear that the
 * call is recorded, and admins can play recordings in safety reviews
 * (UC-A03). Without Twilio voice set up, the endpoint says so and the app
 * falls back to a normal phone call.
 */

import twilio from 'twilio';
import { Types } from 'mongoose';
import { CallLog, ICallLog } from '../models/CallLog';
import { Booking } from '../models/Booking';
import { User } from '../models/User';
import { BookingStatus } from '../types';
import { config } from '../config';
import { AppError, AuthorizationError, NotFoundError } from '../utils/AppError';
import { logger } from '../utils/logger';

const AFTER_TRIP_MS = 2 * 3_600_000;
const MAX_CALLS_PER_HOUR = 10;
const MAX_CALL_SECONDS = 1800;

let client: ReturnType<typeof twilio> | null = null;
const twilioClient = () => (client ??= twilio(config.twilio.accountSid, config.twilio.authToken));

export function maskedCallsEnabled(): boolean {
  return Boolean(config.twilio.enabled && config.twilio.accountSid && config.twilio.authToken && config.twilio.voiceNumber);
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dialable = (phone?: string) => Boolean(phone && /^\+\d{8,15}$/.test(phone));

export class CallService {
  /** Rings the caller, then connects them to the other person on the booking */
  async start(bookingId: string, callerId: string): Promise<{ callId: string; masked: true }> {
    if (!maskedCallsEnabled()) throw new AppError('Calls through Poolora are not set up; call directly instead', 503, 'CALLS_UNAVAILABLE');
    if (!Types.ObjectId.isValid(bookingId)) throw new NotFoundError('Booking');
    const booking = await Booking.findById(bookingId).select('rider driver status actualDropoffTime updatedAt');
    if (!booking) throw new NotFoundError('Booking');
    const isRider = booking.rider.toString() === callerId;
    if (!isRider && booking.driver.toString() !== callerId) throw new AuthorizationError('You are not on this booking');

    const recentlyDone = booking.status === BookingStatus.COMPLETED
      && Date.now() - new Date(booking.actualDropoffTime ?? booking.updatedAt).getTime() < AFTER_TRIP_MS;
    if (booking.status !== BookingStatus.CONFIRMED && !recentlyDone) {
      throw new AppError('Calls are open while the booking is confirmed and for 2 hours after the trip', 409, 'CALL_WINDOW_CLOSED');
    }
    const calleeId = isRider ? booking.driver : booking.rider;
    const recent = await CallLog.countDocuments({ booking: booking._id, caller: callerId, createdAt: { $gte: new Date(Date.now() - 3_600_000) } });
    if (recent >= MAX_CALLS_PER_HOUR) throw new AppError('Too many calls on this booking; try a message instead', 429, 'TOO_MANY_CALLS');

    const [caller, callee] = await Promise.all([
      User.findById(callerId).select('phone').lean(),
      User.findById(calleeId).select('phone').lean(),
    ]);
    if (!dialable(caller?.phone)) throw new AppError('Add a phone number to your profile to call', 422, 'NO_PHONE');
    if (!dialable(callee?.phone)) throw new AppError('The other person has no phone number to call; send a message instead', 422, 'NO_PHONE');

    const record = config.twilio.recordCalls;
    const log = await CallLog.create({ booking: booking._id, caller: callerId, callee: calleeId, recorded: record });
    const base = config.app.baseUrl.replace(/\/$/, '');
    const hook = (kind: string) => `${base}/calls/twilio/${kind}?callId=${log._id}`;
    const from = config.twilio.voiceNumber;
    const twiml = `<Response><Say voice="alice" language="en-GB">Connecting your Poolora call.${record ? ' This call is recorded for safety.' : ''}</Say>`
      + `<Dial callerId="${xml(from)}" timeLimit="${MAX_CALL_SECONDS}"${record ? ` record="record-from-answer-dual" recordingStatusCallback="${xml(hook('recording'))}" recordingStatusCallbackMethod="POST"` : ''}>`
      + `<Number>${xml(callee!.phone)}</Number></Dial></Response>`;

    try {
      const call = await twilioClient().calls.create({
        to: caller!.phone,
        from,
        twiml,
        statusCallback: hook('status'),
        statusCallbackMethod: 'POST',
        statusCallbackEvent: ['ringing', 'answered', 'completed'],
      });
      await CallLog.updateOne({ _id: log._id }, { $set: { twilioCallSid: call.sid } });
    } catch (error) {
      await CallLog.updateOne({ _id: log._id }, { $set: { status: 'failed' } });
      logger.error('Masked call failed to start', { bookingId, error: (error as Error).message });
      throw new AppError('The call could not be placed; call directly instead', 502, 'CALL_FAILED');
    }
    return { callId: log._id.toString(), masked: true };
  }

  /** Twilio's signature check: the request really came from our Twilio account */
  verifyWebhook(signature: string | undefined, url: string, params: Record<string, unknown>): boolean {
    return Boolean(signature) && twilio.validateRequest(config.twilio.authToken, signature!, url, params);
  }

  async onStatus(callId: string, params: Record<string, string>) {
    if (!Types.ObjectId.isValid(callId)) return;
    const set: Partial<ICallLog> = { status: (params.CallStatus as ICallLog['status']) ?? 'initiated' };
    if (params.CallDuration) set.durationSec = Number(params.CallDuration);
    await CallLog.updateOne({ _id: callId }, { $set: set });
  }

  async onRecording(callId: string, params: Record<string, string>) {
    if (!Types.ObjectId.isValid(callId) || params.RecordingStatus !== 'completed') return;
    await CallLog.updateOne(
      { _id: callId },
      { $set: { recordingSid: params.RecordingSid, recordingUrl: params.RecordingUrl, recordingDurationSec: Number(params.RecordingDuration ?? 0) } },
    );
  }

  /** Calls on a user's bookings, for admins */
  async forUser(userId: string): Promise<{ calls: Array<Record<string, unknown>> }> {
    if (!Types.ObjectId.isValid(userId)) throw new NotFoundError('User');
    const calls = await CallLog.find({ $or: [{ caller: userId }, { callee: userId }] })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('caller', 'name')
      .populate('callee', 'name')
      .lean();
    return { calls: calls.map(({ recordingUrl, ...c }): Record<string, unknown> => ({ ...c, hasRecording: Boolean(recordingUrl) })) };
  }

  /** The recording as MP3, fetched from Twilio with the account's credentials (admins only) */
  async recording(callId: string): Promise<Buffer> {
    if (!Types.ObjectId.isValid(callId)) throw new NotFoundError('Recording');
    const log = await CallLog.findById(callId).select('recordingUrl').lean();
    if (!log?.recordingUrl) throw new NotFoundError('Recording');
    const res = await fetch(`${log.recordingUrl}.mp3`, {
      headers: { Authorization: `Basic ${Buffer.from(`${config.twilio.accountSid}:${config.twilio.authToken}`).toString('base64')}` },
    });
    if (!res.ok) throw new AppError('The recording is not available from Twilio', 502, 'RECORDING_UNAVAILABLE');
    return Buffer.from(await res.arrayBuffer());
  }
}
