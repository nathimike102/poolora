/**
 * Online payments through Paynow: signed messages, starting EcoCash and ZiG
 * payments, applying a paid result exactly once, crediting payments that
 * are no longer needed to the wallet, top-ups, and withdrawals to mobile
 * money. Only Paynow's HTTP endpoint is faked; the rest runs on a database.
 */
import mongoose, { Types } from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';

jest.mock('../../events', () => ({ EventBridge: { publish: jest.fn() } }));
jest.mock('../../services/NotificationService', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    createNotification: jest.fn().mockResolvedValue(undefined),
    sendPushNotification: jest.fn().mockResolvedValue(undefined),
  })),
}));
const mockPost = jest.fn();
jest.mock('axios', () => ({ __esModule: true, default: { post: (...a: unknown[]) => mockPost(...a) } }));

import { User } from '../../models/User';
import { Ride } from '../../models/Ride';
import { Booking } from '../../models/Booking';
import { Payment } from '../../models/Payment';
import { Wallet } from '../../models/Wallet';
import { GatewayCharge } from '../../models/GatewayCharge';
import { WithdrawalRequest } from '../../models/WithdrawalRequest';
import { ChargeService } from '../../services/ChargeService';
import { WithdrawalService } from '../../services/WithdrawalService';
import { BookingService } from '../../services/BookingService';
import { paynowHash, parseMessage, verifyMessage } from '../../services/PaynowGateway';

jest.setTimeout(60_000);

const USD_KEY = 'usd-integration-key';
const ZWG_KEY = 'zwg-integration-key';
let mongo: MongoMemoryServer;
const charges = new ChargeService();
const withdrawals = new WithdrawalService();
const riderId = new Types.ObjectId();
const driverId = new Types.ObjectId();
const rideId = new Types.ObjectId();
const HOUR = 3_600_000;

/** A Paynow message with a valid hash */
function signed(fields: Array<[string, string]>, key = USD_KEY): string {
  return new URLSearchParams([...fields, ['hash', paynowHash(fields, key)]]).toString();
}
const POLL_URL = 'https://www.paynow.co.zw/Interface/CheckPayment/?guid=abc';
const okReply = (key = USD_KEY) => signed([['status', 'Ok'], ['instructions', 'Dial *151*2*4# and enter your PIN'], ['paynowreference', '777'], ['pollurl', POLL_URL]], key);
const result = (reference: string, status: string, amount: string, key = USD_KEY) =>
  signed([['reference', reference], ['paynowreference', '777'], ['amount', amount], ['status', status], ['pollurl', POLL_URL]], key);
/** The form fields of the n-th request sent to Paynow */
const sent = (n = 0) => parseMessage(mockPost.mock.calls[n][1] as string);

async function onlineBooking(fare = 3) {
  return Booking.create({
    ride: rideId, rider: riderId, driver: driverId, status: 'pending', seatsBooked: 1, estimatedFare: fare, paymentMethod: 'online',
    pickup: { location: { type: 'Point', coordinates: [31.04, -17.8] }, address: 'Avondale, Harare' },
    dropoff: { location: { type: 'Point', coordinates: [31.1, -17.75] }, address: 'Borrowdale, Harare' },
  });
}
const walletBalance = async (userId = riderId) => (await Wallet.findOne({ userId }).lean())?.balance ?? 0;

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});
beforeEach(async () => {
  await mongoose.connection.db!.dropDatabase();
  mockPost.mockReset().mockResolvedValue({ data: okReply() });
  await User.collection.insertMany([
    { _id: riderId, name: 'Rudo Moyo', phone: '+263771000001', email: 'rudo@example.com', capabilities: ['rider'], stats: {} },
    { _id: driverId, name: 'Tendai Ncube', phone: '+263771000002', capabilities: ['rider', 'driver'], kyc: { status: 'approved' }, stats: {} },
  ]);
  await Ride.collection.insertOne({
    _id: rideId, driver: driverId, status: 'scheduled', departureTime: new Date(Date.now() + 5 * HOUR), availableSeats: 3, totalSeats: 3, pricePerSeat: 3,
    pickup: { location: { type: 'Point', coordinates: [31.04, -17.8] }, address: 'Avondale' },
    dropoff: { location: { type: 'Point', coordinates: [31.1, -17.75] }, address: 'Borrowdale' },
  });
});

describe('Paynow message hashes', () => {
  it('signs values in order with the integration key, and rejects any change', () => {
    const fields: Array<[string, string]> = [['reference', 'BK-1'], ['amount', '3.00'], ['status', 'Paid']];
    const message = parseMessage(signed(fields));
    expect(verifyMessage(message, USD_KEY)).toBe(true);
    expect(verifyMessage(message, ZWG_KEY)).toBe(false);
    expect(verifyMessage(parseMessage(signed(fields).replace('3.00', '0.01')), USD_KEY)).toBe(false);
    expect(verifyMessage([...fields], USD_KEY)).toBe(false); // no hash at all
  });
});

describe('starting a payment', () => {
  it('pushes an EcoCash prompt for the fare, signed for the US dollar integration', async () => {
    const booking = await onlineBooking(3);
    const charge = await charges.start(riderId.toString(), { purpose: 'booking', targetId: booking._id.toString(), channel: 'ecocash', phone: '+263 77 111 1111' });

    expect(mockPost.mock.calls[0][0]).toBe('https://www.paynow.co.zw/interface/remotetransaction');
    const fields = Object.fromEntries(sent());
    expect(fields).toMatchObject({ id: '1201', reference: expect.stringMatching(new RegExp(`^BK-${booking._id}-[0-9a-f]{6}$`)), amount: '3.00', phone: '0771111111', method: 'ecocash', authemail: 'rudo@example.com', status: 'Message' });
    expect(verifyMessage(sent(), USD_KEY)).toBe(true);
    expect(charge).toMatchObject({ status: 'pending', currency: 'USD', chargedAmount: 3, instructions: 'Dial *151*2*4# and enter your PIN' });
  });

  it('charges ZiG at the admin rate through the ZiG integration', async () => {
    mockPost.mockResolvedValue({ data: okReply(ZWG_KEY) });
    const booking = await onlineBooking(3);
    const charge = await charges.start(riderId.toString(), { purpose: 'booking', targetId: booking._id.toString(), channel: 'onemoney', phone: '0712345678', currency: 'ZWG' });
    expect(Object.fromEntries(sent())).toMatchObject({ id: '1202', amount: '79.50', method: 'onemoney' });
    expect(charge).toMatchObject({ currency: 'ZWG', chargedAmount: 79.5, exchangeRate: 26.5, amountUsd: 3 });
  });

  it('opens the card page for card payments', async () => {
    mockPost.mockResolvedValue({ data: signed([['status', 'Ok'], ['browserurl', 'https://www.paynow.co.zw/Payment/ConfirmPayment/1'], ['pollurl', POLL_URL]]) });
    const booking = await onlineBooking();
    const charge = await charges.start(riderId.toString(), { purpose: 'booking', targetId: booking._id.toString(), channel: 'card' });
    expect(mockPost.mock.calls[0][0]).toBe('https://www.paynow.co.zw/interface/initiatetransaction');
    expect(charge.redirectUrl).toBe('https://www.paynow.co.zw/Payment/ConfirmPayment/1');
  });

  it('refuses a number on the wrong network, someone else\'s booking, and passes on Paynow\'s refusal', async () => {
    const booking = await onlineBooking();
    const id = booking._id.toString();
    await expect(charges.start(riderId.toString(), { purpose: 'booking', targetId: id, channel: 'onemoney', phone: '0771111111' })).rejects.toThrow('not on OneMoney');
    await expect(charges.start(driverId.toString(), { purpose: 'booking', targetId: id, channel: 'ecocash', phone: '0771111111' })).rejects.toMatchObject({ statusCode: 404 });
    mockPost.mockResolvedValue({ data: 'status=Error&error=Insufficient%20balance' });
    await expect(charges.start(riderId.toString(), { purpose: 'booking', targetId: id, channel: 'ecocash', phone: '0774444444' })).rejects.toThrow('Insufficient balance');
    expect(await GatewayCharge.countDocuments()).toBe(0);
  });
});

describe('Paynow results', () => {
  async function paidBooking() {
    const booking = await onlineBooking(3);
    const charge = await charges.start(riderId.toString(), { purpose: 'booking', targetId: booking._id.toString(), channel: 'ecocash', phone: '0771111111' });
    return { booking, charge };
  }

  it('records the payment once, after which the driver can accept', async () => {
    const { booking, charge } = await paidBooking();
    await expect(new BookingService().confirmBooking(booking._id.toString(), driverId.toString())).rejects.toMatchObject({ errorId: 'PAYMENT_PENDING' });

    expect(await charges.handleResult(result(charge.reference, 'Paid', '3.00'))).toBe(true);
    expect(await charges.handleResult(result(charge.reference, 'Paid', '3.00'))).toBe(true);
    const payments = await Payment.find({ booking: booking._id }).lean();
    expect(payments).toHaveLength(1);
    expect(payments[0]).toMatchObject({ amount: 3, status: 'captured', method: 'ecocash', reference: charge.reference, platformCommission: 0.45 });

    const confirmed = await new BookingService().confirmBooking(booking._id.toString(), driverId.toString());
    expect(confirmed.status).toBe('confirmed');
  });

  it('ignores a message whose hash does not match, or signed with the other currency\'s key', async () => {
    const { charge } = await paidBooking();
    expect(await charges.handleResult(result(charge.reference, 'Paid', '3.00').replace('Paid', 'Paid%20'))).toBe(false);
    expect(await charges.handleResult(result(charge.reference, 'Paid', '3.00', ZWG_KEY))).toBe(false);
    expect(await Payment.countDocuments()).toBe(0);
  });

  it('marks a cancelled prompt failed, and a short payment disputed', async () => {
    const { charge } = await paidBooking();
    await charges.handleResult(result(charge.reference, 'Cancelled', '3.00'));
    expect(await GatewayCharge.findOne({ reference: charge.reference }).lean()).toMatchObject({ status: 'failed', failureReason: 'EcoCash payment cancelled' });

    const second = await charges.start(riderId.toString(), { purpose: 'booking', targetId: charge.targetId!, channel: 'ecocash', phone: '0771111111' });
    expect(second.reference).toMatch(new RegExp(`^BK-${charge.targetId}-[0-9a-f]{6}$`));
    expect(second.reference).not.toBe(charge.reference);
    await charges.handleResult(result(second.reference, 'Paid', '1.00'));
    expect((await GatewayCharge.findOne({ reference: second.reference }).lean())?.status).toBe('disputed');
    expect(await Payment.countDocuments()).toBe(0);
  });

  it('puts a payment for a cancelled request, or a second payment, in the wallet', async () => {
    const { booking, charge } = await paidBooking();
    const again = await charges.start(riderId.toString(), { purpose: 'booking', targetId: booking._id.toString(), channel: 'ecocash', phone: '0771111111' });
    await charges.handleResult(result(charge.reference, 'Paid', '3.00'));
    await charges.handleResult(result(again.reference, 'Paid', '3.00'));
    expect(await Payment.countDocuments()).toBe(1);
    expect(await walletBalance()).toBe(3);

    const late = await onlineBooking(2);
    const lateCharge = await charges.start(riderId.toString(), { purpose: 'booking', targetId: late._id.toString(), channel: 'ecocash', phone: '0771111111' });
    await Booking.updateOne({ _id: late._id }, { $set: { status: 'cancelled' } });
    await charges.handleResult(result(lateCharge.reference, 'Paid', '2.00'));
    expect(await walletBalance()).toBe(5);
    expect(await charges.status(riderId.toString(), lateCharge.reference)).toMatchObject({ status: 'paid', creditedToWallet: true });
  });

  it('gives two quick taps on Pay different references, so neither payment is lost', async () => {
    const booking = await onlineBooking(3);
    const start = () => charges.start(riderId.toString(), { purpose: 'booking', targetId: booking._id.toString(), channel: 'ecocash', phone: '0771111111' });
    const [a, b] = await Promise.all([start(), start()]);
    expect(a.reference).not.toBe(b.reference);
    expect(await GatewayCharge.countDocuments({ target: booking._id })).toBe(2);
  });

  it('refunds a payment that lands just as the sweeper closes the unpaid request', async () => {
    const { booking, charge } = await paidBooking();
    // payBooking reads the request while it is still pending; the sweeper
    // then cancels it, finding no payment and so refunding nothing
    const stale = await Booking.findById(booking._id);
    await Booking.updateOne({ _id: booking._id }, { $set: { status: 'cancelled', cancellationReason: 'Payment was not completed within 15 minutes' } });
    const spy = jest.spyOn(Booking, 'findById').mockResolvedValueOnce(stale as never);
    await charges.handleResult(result(charge.reference, 'Paid', '3.00'));
    spy.mockRestore();

    expect(await walletBalance()).toBe(3);
    expect(await Payment.findOne({ booking: booking._id }).lean()).toMatchObject({ status: 'refunded', refundAmount: 3 });
    // The sweeper finishing its own refund afterwards does not pay twice
    await new BookingService().refundBooking((await Booking.findById(booking._id))!, 'again', 'system');
    expect(await walletBalance()).toBe(3);
  });

  it('asks Paynow while the app waits, when the result has not arrived', async () => {
    const { charge } = await paidBooking();
    await GatewayCharge.collection.updateOne({ reference: charge.reference }, { $set: { updatedAt: new Date(Date.now() - 60_000) } });
    mockPost.mockResolvedValueOnce({ data: result(charge.reference, 'Paid', '3.00') });
    expect(await charges.status(riderId.toString(), charge.reference)).toMatchObject({ status: 'paid' });
    expect(mockPost).toHaveBeenLastCalledWith(POLL_URL, '', expect.anything());
    expect(await Payment.countDocuments()).toBe(1);
  });

  it('refunds a cancelled online booking to the wallet', async () => {
    const { booking, charge } = await paidBooking();
    await charges.handleResult(result(charge.reference, 'Paid', '3.00'));
    const outcome = await new BookingService().refundBooking((await Booking.findById(booking._id))!, 'Driver cancelled', driverId.toString());
    expect(outcome).toBe('wallet');
    expect(await walletBalance()).toBe(3);
    expect(await Payment.findOne({ booking: booking._id }).lean()).toMatchObject({ status: 'refunded', refundAmount: 3 });
  });
});

describe('wallet top-ups', () => {
  it('credits a paid top-up once', async () => {
    const charge = await charges.start(riderId.toString(), { purpose: 'topup', amount: 20, channel: 'innbucks', phone: '0731234567' });
    expect(Object.fromEntries(sent())).toMatchObject({ amount: '20.00', method: 'innbucks' });
    await charges.handleResult(result(charge.reference, 'Paid', '20.00'));
    await charges.handleResult(result(charge.reference, 'Paid', '20.00'));
    expect(await walletBalance()).toBe(20);
  });

  it('refuses a top-up over the limit before anything is charged', async () => {
    await expect(charges.start(riderId.toString(), { purpose: 'topup', amount: 5000, channel: 'ecocash', phone: '0771111111' })).rejects.toMatchObject({ errorId: 'INVALID_AMOUNT' });
    expect(mockPost).not.toHaveBeenCalled();
  });
});

describe('withdrawals to mobile money', () => {
  beforeEach(async () => {
    await Wallet.create({ userId: driverId, balance: 50 });
  });

  it('holds the amount, and gives it back when cancelled or rejected', async () => {
    const request = await withdrawals.request(driverId.toString(), { amount: 20, channel: 'ecocash', payNumber: '0771000002' });
    expect(request).toMatchObject({ status: 'pending', payNumber: '+263771000002' });
    expect(await walletBalance(driverId)).toBe(30);
    await expect(withdrawals.request(driverId.toString(), { amount: 5, channel: 'ecocash', payNumber: '0771000002' })).rejects.toMatchObject({ errorId: 'WITHDRAWAL_PENDING' });

    await withdrawals.cancel(driverId.toString(), request._id.toString());
    expect(await walletBalance(driverId)).toBe(50);
    await expect(withdrawals.cancel(driverId.toString(), request._id.toString())).rejects.toMatchObject({ errorId: 'WITHDRAWAL_SETTLED' });

    const second = await withdrawals.request(driverId.toString(), { amount: 10, channel: 'onemoney', payNumber: '0712000002' });
    await withdrawals.reject(second._id.toString(), riderId.toString(), 'The number is not registered');
    expect(await walletBalance(driverId)).toBe(50);
  });

  it('records the payout when an admin sends it', async () => {
    const request = await withdrawals.request(driverId.toString(), { amount: 25, channel: 'ecocash', payNumber: '0771000002' });
    await expect(withdrawals.markPaid(request._id.toString(), riderId.toString(), '')).rejects.toMatchObject({ statusCode: 422 });
    await withdrawals.markPaid(request._id.toString(), riderId.toString(), 'MP260929.1234.A00001');
    expect(await WithdrawalRequest.findById(request._id).lean()).toMatchObject({ status: 'paid', payoutReference: 'MP260929.1234.A00001' });
    expect(await walletBalance(driverId)).toBe(25);
  });

  it('lets a small refund leave in full, but not part of it', async () => {
    // A US$1 seat refunded to the wallet is under the US$2 minimum
    await Wallet.updateOne({ userId: driverId }, { $set: { balance: 1 } });
    await expect(withdrawals.request(driverId.toString(), { amount: 0.5, channel: 'ecocash', payNumber: '0771000002' })).rejects.toMatchObject({ statusCode: 422 });
    const all = await withdrawals.request(driverId.toString(), { amount: 1, channel: 'ecocash', payNumber: '0771000002' });
    expect(all).toMatchObject({ status: 'pending', amount: 1 });
    expect(await walletBalance(driverId)).toBe(0);
  });

  it('refuses more than the balance, and a number on another network', async () => {
    await expect(withdrawals.request(driverId.toString(), { amount: 80, channel: 'ecocash', payNumber: '0771000002' })).rejects.toMatchObject({ errorId: 'INSUFFICIENT_BALANCE' });
    await expect(withdrawals.request(driverId.toString(), { amount: 10, channel: 'ecocash', payNumber: '0712000002' })).rejects.toThrow('not on EcoCash');
    expect(await WithdrawalRequest.countDocuments()).toBe(0);
    expect(await walletBalance(driverId)).toBe(50);
  });
});
