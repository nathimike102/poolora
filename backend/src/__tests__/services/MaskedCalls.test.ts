/**
 * Masked calls (UC-D06) against a real MongoDB with Twilio mocked: only the
 * rider and driver of a live booking can call, neither number is shown to
 * the other, the recording notice plays, and Twilio callbacks need a valid
 * signature.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const create = jest.fn().mockResolvedValue({ sid: 'CA123' });
const validateRequest = jest.fn().mockReturnValue(true);
jest.mock('twilio', () => Object.assign(jest.fn(() => ({ calls: { create } })), { validateRequest: (...a: unknown[]) => validateRequest(...a) }));

import { User } from '../../models/User';
import { Booking } from '../../models/Booking';
import { CallLog } from '../../models/CallLog';
import { CallService } from '../../services/CallService';
import { config } from '../../config';

jest.setTimeout(60_000);
let mongo: MongoMemoryServer;
const service = new CallService();
const rider = new Types.ObjectId();
const driver = new Types.ObjectId();
const stranger = new Types.ObjectId();
const twilioConfig = config.twilio as unknown as Record<string, unknown>;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  Object.assign(twilioConfig, { enabled: true, accountSid: 'AC1', authToken: 'tok', voiceNumber: '+918000000000', recordCalls: true });
});
afterAll(async () => {
  Object.assign(twilioConfig, { enabled: false });
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase();
  create.mockClear();
  await User.collection.insertMany([
    { _id: rider, name: 'Asha', phone: '+919000000001', capabilities: ['rider'], kyc: { status: 'none' }, stats: {} },
    { _id: driver, name: 'Ravi', phone: '+919000000002', capabilities: ['rider', 'driver'], kyc: { status: 'approved' }, stats: {} },
  ]);
});

const booking = async (fields: Record<string, unknown> = {}) =>
  (await Booking.collection.insertOne({ rider, driver, ride: new Types.ObjectId(), status: 'confirmed', seatsBooked: 1, estimatedFare: 100, createdAt: new Date(), updatedAt: new Date(), ...fields })).insertedId.toString();

it('rings the caller from the platform number and dials the other side, with the recording notice', async () => {
  const id = await booking();
  await expect(service.start(id, stranger.toString())).rejects.toThrow('not on this booking');
  const { callId } = await service.start(id, rider.toString());

  const args = create.mock.calls[0][0];
  expect(args).toMatchObject({ to: '+919000000001', from: '+918000000000' });
  expect(args.twiml).toContain('callerId="+918000000000"');
  expect(args.twiml).toContain('<Number>+919000000002</Number>');
  expect(args.twiml).toContain('recorded for safety');
  expect(args.statusCallback).toContain(`/calls/twilio/status?callId=${callId}`);
  expect(await CallLog.findById(callId).lean()).toMatchObject({ twilioCallSid: 'CA123', recorded: true });

  await service.onRecording(callId, { RecordingStatus: 'completed', RecordingSid: 'RE1', RecordingUrl: 'https://api.twilio.com/rec/RE1', RecordingDuration: '42' });
  const { calls } = await service.forUser(driver.toString());
  expect(calls[0]).toMatchObject({ hasRecording: true, recordingDurationSec: 42 });
  expect(calls[0].recordingUrl).toBeUndefined();
});

it('closes calls 2 hours after the trip, and when Twilio voice is off', async () => {
  const done = await booking({ status: 'completed', actualDropoffTime: new Date(Date.now() - 3 * 3_600_000) });
  await expect(service.start(done, driver.toString())).rejects.toMatchObject({ errorId: 'CALL_WINDOW_CLOSED' });
  const live = await booking();
  twilioConfig.voiceNumber = '';
  await expect(service.start(live, driver.toString())).rejects.toMatchObject({ errorId: 'CALLS_UNAVAILABLE' });
  twilioConfig.voiceNumber = '+918000000000';
});

it('checks the Twilio signature', () => {
  validateRequest.mockReturnValueOnce(false);
  expect(service.verifyWebhook('sig', 'https://api/calls/twilio/status?callId=1', {})).toBe(false);
  expect(service.verifyWebhook(undefined, 'https://api/calls/twilio/status', {})).toBe(false);
  expect(service.verifyWebhook('sig', 'https://api/calls/twilio/status', {})).toBe(true);
});
