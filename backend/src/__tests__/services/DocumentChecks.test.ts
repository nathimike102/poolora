/**
 * Automatic checks on driver applications (UC-A01): Indian licence and plate
 * formats, age at issue, the same licence on two accounts, old vehicles, and
 * the background-check vendor's answer.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const post = jest.fn();
jest.mock('axios', () => ({ __esModule: true, default: { post: (...a: unknown[]) => post(...a), create: jest.fn(() => ({ post: jest.fn(), get: jest.fn() })) } }));

import { User } from '../../models/User';
import { DocumentCheckService, parseLicence, parsePlate } from '../../services/DocumentCheckService';
import { config } from '../../config';

jest.setTimeout(60_000);
let mongo: MongoMemoryServer;
const service = new DocumentCheckService();
const a = new Types.ObjectId();
const b = new Types.ObjectId();
const vehicle = (plateNumber: string, year: number) => ({ make: 'Maruti', model: 'Dzire', year, color: 'White', plateNumber, vehicleType: 'sedan', hasAC: true, registrationDocUrl: 's3://b/kyc/x/r.jpg', insuranceDocUrl: 's3://b/kyc/x/i.jpg', photos: [] });

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  (config.aws as { accessKeyId: string }).accessKeyId = ''; // no S3 file checks here
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase();
  post.mockReset();
});

it('reads licence and Zimbabwe plate numbers', () => {
  expect(parseLicence('123456 AB')).toEqual({ number: '123456AB' });
  expect(parseLicence('ABCDEF')).toBeNull();
  expect(parseLicence('12')).toBeNull();
  expect(parsePlate('AEA 1234')).toEqual({ standard: true });
  expect(parsePlate('TENDAI1')).toEqual({ standard: false });
  expect(parsePlate('NOT A PLATE AT ALL')).toBeNull();
});

it('flags an under-age driver, a reused licence and an old car', async () => {
  await User.collection.insertMany([
    { _id: a, name: 'Tendai', phone: '+263771000001', dateOfBirth: new Date(new Date().getFullYear() - 17, 0, 1), capabilities: ['rider'], stats: {}, kyc: { status: 'pending', licenseNumber: '123456AB' }, vehicles: [vehicle('AEA1234', new Date().getFullYear() - 16)] },
    { _id: b, name: 'Other Tendai', phone: '+263771000002', capabilities: ['rider'], stats: {}, kyc: { status: 'approved', licenseNumber: '123456AB' }, vehicles: [] },
  ]);
  const results = await service.run(a.toString());
  const by = Object.fromEntries(results.map((r) => [r.check, r.result]));
  expect(by).toMatchObject({
    'Licence number format': 'pass',
    'Driver age': 'fail', // 17
    'Registration number format': 'pass',
    'Licence used elsewhere': 'fail',
    'Vehicle age': 'warn', // 16 years: flagged for a roadworthiness look
  });
  expect((await User.findById(a).lean())?.kyc.autoChecks?.length).toBe(results.length);
});

it('stores the vendor answer, and marks an unreachable vendor for a manual check', async () => {
  await User.collection.insertOne({ _id: a, name: 'Tendai', phone: '+263771000001', capabilities: ['rider'], stats: {}, kyc: { status: 'pending', licenseNumber: '123456AB' }, vehicles: [vehicle('AEA1234', 2020)] });
  (config.kycVerify as { url: string }).url = 'https://verify.example/checks';
  post.mockResolvedValueOnce({ data: { status: 'consider', reference: 'V-1', summary: 'Licence suspended in 2023' } });
  await service.onSubmitted(a.toString());
  expect(post.mock.calls[0][1]).toMatchObject({ reference: a.toString(), licenceNumber: '123456AB', registrationNumber: 'AEA1234' });
  expect((await User.findById(a).lean())?.kyc.backgroundCheck).toMatchObject({ status: 'consider', reference: 'V-1' });

  post.mockRejectedValueOnce(new Error('timeout'));
  await service.sendToVendor(a.toString());
  expect((await User.findById(a).lean())?.kyc.backgroundCheck?.status).toBe('error');
  (config.kycVerify as { url: string }).url = '';
});
