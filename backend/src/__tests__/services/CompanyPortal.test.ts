/**
 * A company's own dashboard (UC-C01 step 3), against a real MongoDB. Only
 * people on the company's domains (or its billing contact) can be named its
 * admins; they see their own company's staff, figures and bills, and never
 * where anyone went.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mockSend = jest.fn().mockResolvedValue(true);
jest.mock('../../services/Mailer', () => ({
  ...jest.requireActual('../../services/Mailer'),
  mailEnabled: () => true,
  sendMail: (mail: unknown) => mockSend(mail),
}));
jest.mock('../../config/firebase', () => ({ getFirebaseAuth: () => { throw new Error('Firebase not initialized'); } }));

import { toLocalClock } from '../../config/region';
import { Booking } from '../../models/Booking';
import { CompanyInvoice } from '../../models/CompanyInvoice';
import { Organisation } from '../../models/Organisation';
import { User } from '../../models/User';
import { CompanyPortalService } from '../../services/CompanyPortalService';
import { BookingStatus } from '../../types';

jest.setTimeout(60_000);

let mongo: MongoMemoryServer;
const portal = new CompanyPortalService();
const pooloraAdmin = new Types.ObjectId();
const rudo = new Types.ObjectId();
const outsider = new Types.ObjectId();
let econet: Types.ObjectId;
let delta: Types.ObjectId;
const month = toLocalClock(new Date()).toISOString().slice(0, 7);
const point = { type: 'Point', coordinates: [31.05, -17.8] };

const trip = (rider: Types.ObjectId, organisation: Types.ObjectId, share: number, status = BookingStatus.COMPLETED) => ({
  ride: new Types.ObjectId(), rider, driver: new Types.ObjectId(), seatsBooked: 1, status,
  estimatedFare: 10, companyShare: share, organisation, companyMonth: month, co2SavedKg: 2,
  pickup: { location: point, address: 'Home, Avondale' }, dropoff: { location: point, address: 'Office, Borrowdale' },
});

async function adminOf(org: Types.ObjectId, email: string) {
  const { added } = await portal.addAdmin(org.toString(), { name: 'HR Person', email }, pooloraAdmin.toString());
  return added.user;
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([Organisation.init(), User.init()]);
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  mockSend.mockClear();
  await Promise.all([Booking.deleteMany({}), CompanyInvoice.deleteMany({}), Organisation.deleteMany({}), User.deleteMany({})]);
  econet = (await Organisation.create({ name: 'Econet', domains: ['econet.co.zw'], billingContact: { name: 'Accounts', email: 'accounts@econet-billing.co.zw' }, notes: 'Contract: 12 months', createdBy: pooloraAdmin }))._id;
  delta = (await Organisation.create({ name: 'Delta', domains: ['delta.co.zw'], billingContact: { name: 'Accounts', email: 'pay@delta.co.zw' }, createdBy: pooloraAdmin }))._id;
  await User.collection.insertMany([
    { _id: pooloraAdmin, name: 'Poolora Admin', phone: '+263771000009', email: 'ops@poolora.co.zw', capabilities: ['rider', 'admin'], stats: {} },
    { _id: rudo, name: 'Rudo Moyo', phone: '+263771000001', capabilities: ['rider'], stats: {}, work: { organisation: econet, email: 'rudo@econet.co.zw', verifiedAt: new Date() } },
    { _id: outsider, name: 'Farai Dube', phone: '+263771000002', capabilities: ['rider'], stats: {}, work: { organisation: delta, email: 'farai@delta.co.zw', verifiedAt: new Date() } },
  ]);
});

describe('naming company admins', () => {
  it('accepts an address on the company\'s domains or its billing contact, and emails them', async () => {
    const hr = await adminOf(econet, 'HR@econet.co.zw');
    expect((await User.findById(hr).lean())?.email).toBe('hr@econet.co.zw');
    await adminOf(econet, 'accounts@econet-billing.co.zw');
    expect(mockSend).toHaveBeenCalledTimes(2);
    expect(mockSend.mock.calls[0][0].text).toContain('You will not see where anyone goes');
  });

  it('refuses other addresses, twice, Poolora admins and another company\'s admins', async () => {
    await expect(adminOf(econet, 'someone@gmail.com')).rejects.toMatchObject({ errorId: 'NOT_COMPANY_EMAIL' });
    await adminOf(econet, 'hr@econet.co.zw');
    await expect(adminOf(econet, 'hr@econet.co.zw')).rejects.toThrow('already a company admin');
    await Organisation.updateOne({ _id: delta }, { $push: { domains: 'poolora.co.zw' } });
    await expect(adminOf(delta, 'ops@poolora.co.zw')).rejects.toThrow('Poolora admins already see every company');
  });
});

describe('the company dashboard', () => {
  it('refuses anyone who is not a company admin', async () => {
    await expect(portal.me(rudo.toString())).rejects.toMatchObject({ statusCode: 403 });
  });

  it('shows the company, without its internal notes', async () => {
    const hr = await adminOf(econet, 'hr@econet.co.zw');
    const { company } = await portal.me(hr);
    expect(company).toMatchObject({ name: 'Econet', contributionPaused: false });
    expect(JSON.stringify(company)).not.toContain('Contract');
  });

  it('counts the company\'s own trips and spend this month, and nobody else\'s', async () => {
    await Booking.collection.insertMany([
      trip(rudo, econet, 5), trip(rudo, econet, 4), trip(rudo, econet, 5, BookingStatus.CANCELLED), trip(outsider, delta, 7),
    ]);
    const hr = await adminOf(econet, 'hr@econet.co.zw');
    expect(await portal.overview(hr)).toMatchObject({ month, members: 1, ridersThisMonth: 1, trips: 2, companyPaid: 9, staffPaid: 11, co2SavedKg: 4 });

    const { members } = await portal.members(hr);
    expect(members).toEqual([expect.objectContaining({ name: 'Rudo Moyo', email: 'rudo@econet.co.zw', tripsThisMonth: 2, companyPaidThisMonth: 9 })]);
    // Never where anyone went
    const everything = JSON.stringify([await portal.overview(hr), members]);
    for (const word of ['Avondale', 'Borrowdale', 'coordinates', 'location', 'pickup', 'dropoff']) expect(everything).not.toContain(word);
  });

  it('lets a company admin remove only their own staff', async () => {
    const hr = await adminOf(econet, 'hr@econet.co.zw');
    await expect(portal.removeMember(hr, outsider.toString())).rejects.toMatchObject({ statusCode: 404 });
    await portal.removeMember(hr, rudo.toString());
    expect((await User.findById(rudo).lean())?.work).toBeUndefined();
  });

  it('shows only the company\'s own bills', async () => {
    const bill = (organisation: Types.ObjectId, number: string) => ({
      organisation, month, number, lines: [], trips: 1, members: 1, amount: 5, adjustments: [], total: 5, co2SavedKg: 1,
      status: 'issued', issuedAt: new Date(), dueAt: new Date(Date.now() + 30 * 86_400_000),
    });
    const [, theirs] = await CompanyInvoice.create([bill(econet, 'PL-1'), bill(delta, 'PL-2')]);
    const hr = await adminOf(econet, 'hr@econet.co.zw');
    expect((await portal.bills(hr)).invoices.map((i) => i.number)).toEqual(['PL-1']);
    await expect(portal.billFile(hr, theirs.id, 'pdf')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('stops working once the admin is removed', async () => {
    const hr = await adminOf(econet, 'hr@econet.co.zw');
    await portal.removeAdmin(econet.toString(), hr, pooloraAdmin.toString());
    await expect(portal.me(hr)).rejects.toMatchObject({ statusCode: 403 });
  });
});
