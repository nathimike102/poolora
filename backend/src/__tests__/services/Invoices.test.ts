/**
 * Company bills (UC-C03), against a real MongoDB. Each bill takes the
 * company's share of trips completed and not billed yet, exactly once; it
 * is emailed once; a bill over 30 days unpaid pauses the company's
 * contribution until an admin records the payment.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mockSend = jest.fn();
jest.mock('../../services/Mailer', () => ({
  ...jest.requireActual('../../services/Mailer'),
  mailEnabled: () => true,
  sendMail: (mail: unknown) => mockSend(mail),
}));
jest.mock('../../services/SafetyAlerts', () => ({ pushAdmins: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendPushNotification: jest.fn().mockResolvedValue(undefined),
    createNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));

import { fromLocalClock } from '../../config/region';
import { Booking } from '../../models/Booking';
import { CompanyInvoice } from '../../models/CompanyInvoice';
import { Organisation } from '../../models/Organisation';
import { User } from '../../models/User';
import { AdminAuditLog } from '../../models/AdminAuditLog';
import { InvoiceService, PAYMENT_TERMS_DAYS } from '../../services/InvoiceService';
import { companyContribution } from '../../services/OrganisationService';
import { InvoiceScheduler } from '../../jobs/InvoiceScheduler';
import { BookingStatus } from '../../types';

jest.setTimeout(60_000);

let mongo: MongoMemoryServer;
const service = new InvoiceService();
const adminId = new Types.ObjectId();
const rudo = new Types.ObjectId();
const tendai = new Types.ObjectId();
const driver = new Types.ObjectId();
let econet: Types.ObjectId;
let delta: Types.ObjectId;

/** 2 October 2026, 09:00 in market time: September is due for billing */
const OCT_2 = fromLocalClock(new Date('2026-10-02T09:00:00.000Z'));
const point = { type: 'Point', coordinates: [31.05, -17.8] };

function trip(rider: Types.ObjectId, organisation: Types.ObjectId, month: string, share: number, extra: Record<string, unknown> = {}) {
  return {
    _id: new Types.ObjectId(), ride: new Types.ObjectId(), rider, driver, seatsBooked: 1,
    status: BookingStatus.COMPLETED, estimatedFare: 10, companyShare: share, organisation, companyMonth: month,
    pickup: { location: point, address: 'A' }, dropoff: { location: point, address: 'B' },
    actualDropoffTime: new Date(`${month}-15T08:00:00.000Z`), co2SavedKg: 1.5,
    createdAt: new Date(), updatedAt: new Date(), ...extra,
  };
}

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await Promise.all([CompanyInvoice.init(), Organisation.init()]);
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  mockSend.mockReset().mockResolvedValue(true);
  await Promise.all([Booking.deleteMany({}), CompanyInvoice.deleteMany({}), Organisation.deleteMany({}), User.deleteMany({}), AdminAuditLog.deleteMany({})]);
  const contact = { name: 'Accounts', email: 'accounts@econet.co.zw' };
  const policy = { sharePercent: 50, monthlyCapUsd: 0, weekdaysOnly: false, sites: [{ name: 'Office', address: 'Borrowdale', radiusKm: 5, location: point }] };
  econet = (await Organisation.create({ name: 'Econet', domains: ['econet.co.zw'], billingContact: contact, policy, createdBy: adminId }))._id;
  delta = (await Organisation.create({ name: 'Delta', domains: ['delta.co.zw'], billingContact: { ...contact, email: 'pay@delta.co.zw' }, policy, createdBy: adminId }))._id;
  await User.collection.insertMany([
    { _id: rudo, name: 'Rudo Moyo', phone: '+263771000001', capabilities: ['rider'], stats: {}, work: { organisation: econet, email: 'rudo@econet.co.zw', verifiedAt: new Date() } },
    { _id: tendai, name: 'Tendai Dube', phone: '+263771000002', capabilities: ['rider'], stats: {} },
  ]);
});

describe('which month is billed', () => {
  it('bills last month from 06:00 on the 1st', () => {
    expect(service.billingMonth(fromLocalClock(new Date('2026-10-01T05:59:00.000Z')))).toBe('2026-08');
    expect(service.billingMonth(fromLocalClock(new Date('2026-10-01T06:00:00.000Z')))).toBe('2026-09');
    expect(service.billingMonth(OCT_2)).toBe('2026-09');
  });
});

describe('issuing bills', () => {
  it('bills each company its share of completed trips, once', async () => {
    await Booking.collection.insertMany([
      trip(rudo, econet, '2026-09', 5),
      trip(tendai, econet, '2026-09', 4),
      trip(rudo, econet, '2026-09', 5),
      trip(tendai, delta, '2026-09', 3),
      // Not billed: cancelled, not completed yet, nothing paid by the company, next month
      trip(rudo, econet, '2026-09', 5, { status: BookingStatus.CANCELLED }),
      trip(rudo, econet, '2026-09', 5, { status: BookingStatus.CONFIRMED }),
      trip(rudo, econet, '2026-09', 0),
      trip(rudo, econet, '2026-10', 5),
    ]);
    const issued = await service.billMonth('2026-09', OCT_2);
    expect(issued).toHaveLength(2);
    const bill = (await CompanyInvoice.findOne({ organisation: econet }))!;
    expect(bill).toMatchObject({ month: '2026-09', trips: 3, members: 2, amount: 14, total: 14, co2SavedKg: 4.5, status: 'issued' });
    expect(bill.dueAt.getTime() - bill.issuedAt.getTime()).toBe(PAYMENT_TERMS_DAYS * 86_400_000);
    expect(bill.lines.map((l) => l.member).sort()).toEqual(['Rudo Moyo', 'Rudo Moyo', 'Tendai Dube']);

    expect(await service.billMonth('2026-09', OCT_2)).toHaveLength(0);
    expect(await CompanyInvoice.countDocuments()).toBe(2);
  });

  it('puts a trip completed after its month was billed on the next bill', async () => {
    await Booking.collection.insertMany([trip(rudo, econet, '2026-09', 5)]);
    await service.billMonth('2026-09', OCT_2);
    await Booking.collection.insertMany([trip(rudo, econet, '2026-09', 6), trip(rudo, econet, '2026-10', 2)]);
    await service.billMonth('2026-10', fromLocalClock(new Date('2026-11-02T09:00:00.000Z')));
    const october = (await CompanyInvoice.findOne({ organisation: econet, month: '2026-10' }))!;
    expect(october.amount).toBe(8);
  });

  it('makes one bill with every trip when two runs race', async () => {
    await Booking.collection.insertMany(Array.from({ length: 20 }, () => trip(rudo, econet, '2026-09', 1)));
    const results = await Promise.all([service.issue(econet, '2026-09', OCT_2), service.issue(econet, '2026-09', OCT_2)]);
    // One bill; whichever run lost the race returns it, or nothing if it is still being written
    expect(await CompanyInvoice.countDocuments()).toBe(1);
    const ids = new Set(results.filter(Boolean).map((r) => String(r!._id)));
    expect(ids.size).toBe(1);
    const bill = (await CompanyInvoice.findOne())!;
    expect(bill.trips + (await Booking.countDocuments({ companyInvoice: { $exists: false } }))).toBe(20);
    expect(await Booking.countDocuments({ companyInvoice: bill._id })).toBe(bill.trips);
    // Trips the losing run had reserved were released, and go on the next bill
    await service.billMonth('2026-10', fromLocalClock(new Date('2026-11-02T09:00:00.000Z')));
    expect(await Booking.countDocuments({ companyInvoice: { $exists: false } })).toBe(0);
  });

  it('bills trips reserved for a bill that was never written', async () => {
    const lost = new Types.ObjectId();
    await Booking.collection.insertMany([trip(rudo, econet, '2026-09', 5, { companyInvoice: lost, updatedAt: new Date(Date.now() - 2 * 3_600_000) })]);
    await service.billMonth('2026-09', OCT_2);
    expect((await CompanyInvoice.findOne({ organisation: econet }))?.amount).toBe(5);
  });
});

describe('emailing bills', () => {
  it('sends each bill once to the billing contact, with the PDF and spreadsheet', async () => {
    await Booking.collection.insertMany([trip(rudo, econet, '2026-09', 5)]);
    await service.billMonth('2026-09', OCT_2);
    expect(await service.emailDue()).toBe(1);
    expect(await service.emailDue()).toBe(0);
    const mail = mockSend.mock.calls[0][0];
    expect(mail.to).toBe('accounts@econet.co.zw');
    expect(mail.subject).toContain('US$5');
    expect(mail.attachments.map((a: { filename: string }) => a.filename)).toEqual([expect.stringMatching(/\.pdf$/), expect.stringMatching(/\.xlsx$/)]);
    expect(mail.attachments[0].content.subarray(0, 4).toString()).toBe('%PDF');
    expect(mail.attachments[1].content.subarray(0, 2).toString()).toBe('PK');
  });

  it('tries again later when the email fails', async () => {
    await Booking.collection.insertMany([trip(rudo, econet, '2026-09', 5)]);
    await service.billMonth('2026-09', OCT_2);
    mockSend.mockResolvedValueOnce(false);
    expect(await service.emailDue()).toBe(0);
    expect((await CompanyInvoice.findOne())?.emailError).toBeTruthy();
    expect(await service.emailDue()).toBe(1);
  });
});

describe('late payment', () => {
  const contribution = () => companyContribution({ riderId: rudo.toString(), fare: 10, departure: new Date(Date.now() + 86_400_000), pickup: { lat: -17.8, lng: 31.05 }, dropoff: { lat: -17.8, lng: 31.05 } });

  it('pauses the company\'s contribution after 30 days unpaid, and payment lifts it', async () => {
    await Booking.collection.insertMany([trip(rudo, econet, '2026-09', 5)]);
    const [bill] = await service.billMonth('2026-09', OCT_2);
    expect(await contribution()).toMatchObject({ share: 5 });

    expect(await service.enforceHolds(new Date(OCT_2.getTime() + 29 * 86_400_000))).toBe(0);
    expect(await service.enforceHolds(new Date(OCT_2.getTime() + 31 * 86_400_000))).toBe(1);
    expect(await contribution()).toBeNull();

    await expect(service.markPaid(bill.id, adminId.toString(), '')).rejects.toMatchObject({ statusCode: 422 });
    await service.markPaid(bill.id, adminId.toString(), 'CBZ-TRF-0001');
    expect(await contribution()).toMatchObject({ share: 5 });
    await expect(service.markPaid(bill.id, adminId.toString(), 'CBZ-TRF-0001')).rejects.toThrow('already paid');
    expect(await AdminAuditLog.countDocuments({ action: 'invoice.paid' })).toBe(1);
  });
});

describe('adjusting a bill', () => {
  it('takes off a credit with a reason, never below zero, and not once paid', async () => {
    await Booking.collection.insertMany([trip(rudo, econet, '2026-09', 5)]);
    const [bill] = await service.billMonth('2026-09', OCT_2);
    await expect(service.adjust(bill.id, adminId.toString(), -2, 'no')).rejects.toMatchObject({ statusCode: 422 });
    const { invoice } = await service.adjust(bill.id, adminId.toString(), -2, 'Refund after a dispute on a trip');
    expect(invoice.total).toBe(3);
    await expect(service.adjust(bill.id, adminId.toString(), -4, 'Too much credit given')).rejects.toThrow('below zero');
    await service.markPaid(bill.id, adminId.toString(), 'CBZ-TRF-0002');
    await expect(service.adjust(bill.id, adminId.toString(), 1, 'Late extra charge')).rejects.toThrow('paid bill');
  });
});

describe('the hourly job', () => {
  it('bills, emails and enforces holds in one pass', async () => {
    await Booking.collection.insertMany([trip(rudo, econet, '2026-09', 5)]);
    expect(await InvoiceScheduler.run(OCT_2)).toEqual({ issued: 1, emailed: 1, held: 0 });
    expect(await InvoiceScheduler.run(OCT_2)).toEqual({ issued: 0, emailed: 0, held: 0 });
  });
});
