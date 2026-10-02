/**
 * ChargeService.ts
 *
 * Online payments through Paynow: seat bookings, parcels and wallet top-ups,
 * by EcoCash, OneMoney, InnBucks or card, in US dollars or ZiG.
 *
 * 1. The app starts a charge for something the user owes (start). Paynow
 *    pushes a prompt to their phone, returns an InnBucks code, or gives a
 *    card page to open.
 * 2. Paynow posts the outcome to the result URL (handleResult). The message
 *    is verified by its hash. The app also asks for the status while it
 *    waits (status), and the sweeper checks charges still pending
 *    (reconcilePending), so a lost message does not strand a payment.
 * 3. A paid charge is applied once (apply): the booking or parcel is marked
 *    paid, or the top-up credited. A payment that is no longer needed (the
 *    request was cancelled, or already paid another way) is credited to the
 *    payer's wallet, so money is never lost.
 *
 * Amounts owed are in US dollars. A ZiG charge converts at the rate an admin
 * sets (config.zwgPerUsd) at the moment it starts, and records that rate.
 */

import { randomBytes } from 'crypto';
import { Types } from 'mongoose';
import { config } from '../config';
import { CurrencyCode, money, REGION, roundMoney, toE164 } from '../config/region';
import { GatewayCharge, IGatewayCharge, ChargePurpose } from '../models/GatewayCharge';
import { Booking } from '../models/Booking';
import { ParcelPooling } from '../models/ParcelPooling';
import { Payment } from '../models/Payment';
import { User } from '../models/User';
import { BookingStatus, PaymentMethod, PaymentStatus } from '../types';
import { AppError, NotFoundError } from '../utils/AppError';
import { logger } from '../utils/logger';
import { EventBridge } from '../events';
import { PaynowGateway, PayChannel, PAY_CHANNELS, GatewayStatus, currencyEnabled } from './PaynowGateway';
import { WalletService } from './WalletService';
import { NotificationService } from './NotificationService';
import { channelFits } from './WithdrawalService';
import { phrase } from '../i18n';

const PREFIX: Record<ChargePurpose, string> = { booking: 'BK', parcel: 'PC', topup: 'WT' };
const LABEL: Record<PayChannel, string> = { ecocash: 'EcoCash', onemoney: 'OneMoney', innbucks: 'InnBucks', card: 'card' };
/** Ask Paynow again at most this often while the app waits */
const POLL_EVERY_MS = 5_000;
/** Charges nobody paid are given up on after this */
const PENDING_LIMIT_MS = 24 * 3_600_000;

export interface StartChargeInput {
  purpose: ChargePurpose;
  /** The booking or parcel; not used for top-ups */
  targetId?: string;
  /** Top-ups only, in US dollars */
  amount?: number;
  channel: PayChannel;
  /** Mobile money number, for EcoCash, OneMoney and InnBucks */
  phone?: string;
  currency?: CurrencyCode;
}

/** What the app is shown about a charge */
export function chargeView(charge: IGatewayCharge, instructions?: string) {
  return {
    reference: charge.reference,
    purpose: charge.purpose,
    targetId: charge.target?.toString(),
    status: charge.status,
    channel: charge.channel,
    currency: charge.currency,
    amountUsd: charge.amountUsd,
    chargedAmount: charge.chargedAmount,
    exchangeRate: charge.exchangeRate,
    redirectUrl: charge.status === 'pending' ? charge.redirectUrl : undefined,
    authorizationCode: charge.status === 'pending' ? charge.authorizationCode : undefined,
    authorizationExpires: charge.status === 'pending' ? charge.authorizationExpires : undefined,
    instructions: instructions ?? instructionsFor(charge),
    // Ours (not Paynow's) can be shown in the payer's language by the app (UC-X03)
    ...(instructions ? {} : instructionsKey(charge)),
    failureReason: charge.failureReason,
    creditedToWallet: Boolean(charge.creditedToWalletAt),
  };
}

function instructionsFor(charge: IGatewayCharge): string {
  const amount = money(charge.chargedAmount, charge.currency);
  switch (charge.channel) {
    case 'ecocash':
    case 'onemoney':
      return `Check your phone: ${LABEL[charge.channel]} will ask you to approve ${amount} to Poolora with your PIN.`;
    case 'innbucks':
      return `Open InnBucks and enter or scan the code to pay ${amount}.`;
    default:
      return `Pay ${amount} by card on the Paynow page, then come back to Poolora.`;
  }
}

/** The app catalogue's key for our own instructions, and its values */
function instructionsKey(charge: IGatewayCharge): { instructionsKey: string; instructionsVars: Record<string, string> } {
  const amount = money(charge.chargedAmount, charge.currency);
  if (charge.channel === 'ecocash' || charge.channel === 'onemoney') {
    return { instructionsKey: 'payment.instructions.mobile', instructionsVars: { wallet: LABEL[charge.channel], amount } };
  }
  return { instructionsKey: `payment.instructions.${charge.channel === 'innbucks' ? 'innbucks' : 'card'}`, instructionsVars: { amount } };
}

const resultUrl = () => `${config.app.baseUrl.replace(/\/$/, '')}/payments/paynow/result`;
const returnUrl = (reference: string) => `${config.app.baseUrl.replace(/\/$/, '')}/payments/paynow/return?reference=${encodeURIComponent(reference)}`;

export class ChargeService {
  private gateway = new PaynowGateway();
  private wallet = new WalletService();
  private notifications = new NotificationService();

  /** Which currencies and methods can be used right now */
  options() {
    return {
      currencies: [
        { code: 'USD' as const, enabled: currencyEnabled('USD') },
        { code: 'ZWG' as const, enabled: currencyEnabled('ZWG'), zwgPerUsd: config.zwgPerUsd || undefined },
      ],
      channels: PAY_CHANNELS,
    };
  }

  async start(userId: string, input: StartChargeInput) {
    const channel = input.channel;
    if (!PAY_CHANNELS.includes(channel)) throw new AppError('Choose EcoCash, OneMoney, InnBucks or card', 422, 'VALIDATION_ERROR');
    const currency: CurrencyCode = input.currency === 'ZWG' ? 'ZWG' : 'USD';
    if (!currencyEnabled(currency)) {
      throw new AppError(currency === 'ZWG' ? 'Paying in ZiG is not available right now. Pay in US dollars instead.' : 'Online payments are unavailable right now. Please pay from your wallet.', 503, 'PAYMENT_CURRENCY_UNAVAILABLE');
    }

    let phone: string | undefined;
    if (channel !== 'card') {
      phone = toE164(input.phone ?? '') ?? undefined;
      if (!phone) throw new AppError('Enter the mobile number to pay from, like 0771 234 567', 422, 'VALIDATION_ERROR');
      if (!channelFits(channel, phone)) {
        throw new AppError(`That number is not on ${LABEL[channel]}. EcoCash numbers start 077 or 078, OneMoney 071.`, 422, 'VALIDATION_ERROR');
      }
    }

    const { amountUsd, target, description } = await this.owed(userId, input);
    const exchangeRate = currency === 'ZWG' ? config.zwgPerUsd : undefined;
    const chargedAmount = roundMoney(amountUsd * (exchangeRate ?? 1));
    // A random suffix, not an attempt count: two quick taps on Pay must not
    // send Paynow the same reference, or the second payment has no record
    const reference = `${PREFIX[input.purpose]}-${(target ?? new Types.ObjectId()).toString()}${target ? `-${randomBytes(3).toString('hex')}` : ''}`;

    const user = await User.findById(userId).select('email').lean();
    const email = user?.email || config.paynow.authEmail;
    if (!email) {
      logger.error('Paynow needs an email: set PAYNOW_AUTH_EMAIL');
      throw new AppError('Online payments are unavailable right now. Please pay from your wallet.', 503, 'SERVICE_UNAVAILABLE');
    }

    const started = await this.gateway.start({
      reference,
      amount: chargedAmount,
      currency,
      channel,
      description,
      email,
      // Paynow wants the local format: 0771234567
      phone: phone ? `0${phone.slice(REGION.dialCode.length)}` : undefined,
      resultUrl: resultUrl(),
      returnUrl: returnUrl(reference),
    });

    const charge = await GatewayCharge.create({
      reference,
      purpose: input.purpose,
      target,
      user: userId,
      amountUsd,
      currency,
      chargedAmount,
      exchangeRate,
      channel,
      phone,
      pollUrl: started.pollUrl,
      paynowReference: started.paynowReference,
      redirectUrl: started.redirectUrl,
      authorizationCode: started.authorizationCode,
      authorizationExpires: started.authorizationExpires,
    });
    logger.info('Payment started', { reference, purpose: input.purpose, channel, currency, chargedAmount });
    return chargeView(charge, started.instructions);
  }

  /** The charge as it stands, asking Paynow when it is still pending */
  async status(userId: string, reference: string) {
    const charge = await GatewayCharge.findOne({ reference, user: userId });
    if (!charge) throw new NotFoundError('Payment');
    if (charge.status === 'pending' && Date.now() - charge.updatedAt.getTime() >= POLL_EVERY_MS) {
      await GatewayCharge.updateOne({ _id: charge._id }, { $set: { updatedAt: new Date() } });
      const status = await this.gateway.poll(charge.pollUrl, charge.currency);
      if (status) return chargeView(await this.apply(charge, status));
    }
    return chargeView(charge);
  }

  /**
   * A status update Paynow posted to the result URL. Returns false when the
   * message fails verification (it is then ignored).
   */
  async handleResult(body: string): Promise<boolean> {
    const result = this.gateway.readResult(body);
    if (!result) {
      logger.warn('Paynow result failed verification');
      return false;
    }
    const charge = result.status.reference ? await GatewayCharge.findOne({ reference: result.status.reference }) : null;
    if (!charge) {
      logger.warn('Paynow result for an unknown reference', { reference: result.status.reference });
      return true;
    }
    if (charge.currency !== result.currency) {
      logger.error('Paynow result signed for the wrong currency', { reference: charge.reference });
      return false;
    }
    await this.apply(charge, result.status);
    return true;
  }

  /** Checks pending charges with Paynow, for results that never arrived */
  async reconcilePending(now = new Date()): Promise<number> {
    const pending = await GatewayCharge.find({ status: 'pending', createdAt: { $lt: new Date(now.getTime() - 60_000) } }).limit(100);
    let settled = 0;
    for (const charge of pending) {
      if (now.getTime() - charge.createdAt.getTime() > PENDING_LIMIT_MS) {
        await GatewayCharge.updateOne({ _id: charge._id, status: 'pending' }, { $set: { status: 'failed', failureReason: 'Not paid in time' } });
        settled++;
        continue;
      }
      const status = await this.gateway.poll(charge.pollUrl, charge.currency);
      if (status && status.state !== 'pending') {
        await this.apply(charge, status);
        settled++;
      }
    }
    return settled;
  }

  /** Records what Paynow says, and applies the money once it is paid */
  async apply(charge: IGatewayCharge, status: GatewayStatus): Promise<IGatewayCharge> {
    if (status.state === 'pending') return charge;

    if (status.state === 'paid') {
      if (status.amount !== undefined && status.amount + 0.005 < charge.chargedAmount) {
        logger.error('Paynow reports less paid than charged; needs review', { reference: charge.reference, paid: status.amount, charged: charge.chargedAmount });
        return (await GatewayCharge.findByIdAndUpdate(charge._id, { $set: { status: 'disputed', paynowStatus: status.raw, failureReason: 'Paid amount does not match' } }, { new: true }))!;
      }
      const paid = await GatewayCharge.findOneAndUpdate(
        { _id: charge._id, status: { $in: ['pending', 'failed'] } },
        { $set: { status: 'paid', paidAt: new Date(), paynowStatus: status.raw, paynowReference: status.paynowReference ?? charge.paynowReference } },
        { new: true },
      );
      const current = paid ?? (await GatewayCharge.findById(charge._id))!;
      if (current.status === 'paid') await this.fulfil(current);
      return (await GatewayCharge.findById(charge._id))!;
    }

    // failed, refunded or disputed: a charge already paid and applied is only
    // changed by refunds and disputes, which an admin looks at
    const from = status.state === 'failed' ? ['pending'] : ['pending', 'paid', 'failed'];
    const updated = await GatewayCharge.findOneAndUpdate(
      { _id: charge._id, status: { $in: from } },
      { $set: { status: status.state, paynowStatus: status.raw, ...(status.state === 'failed' ? { failureReason: `${LABEL[charge.channel]} payment ${status.raw.toLowerCase() || 'failed'}` } : {}) } },
      { new: true },
    );
    if (updated && status.state !== 'failed') {
      logger.error('Paynow reports a paid charge refunded or disputed; needs review', { reference: charge.reference, status: status.raw });
    }
    return updated ?? (await GatewayCharge.findById(charge._id))!;
  }

  /** Applies a paid charge to what it paid for. Runs once per charge. */
  private async fulfil(charge: IGatewayCharge): Promise<void> {
    const claimed = await GatewayCharge.findOneAndUpdate({ _id: charge._id, appliedAt: { $exists: false } }, { $set: { appliedAt: new Date() } }, { new: true });
    if (!claimed) return;

    const applied = charge.purpose === 'booking' ? await this.payBooking(claimed)
      : charge.purpose === 'parcel' ? await this.payParcel(claimed)
      : await this.wallet.completeTopUp(claimed.user.toString(), claimed.amountUsd, claimed.reference).then(() => true);
    if (!applied) await this.creditUnneeded(claimed);
  }

  /** Marks a booking paid. False when it no longer needs paying. */
  private async payBooking(charge: IGatewayCharge): Promise<boolean> {
    const booking = await Booking.findById(charge.target);
    if (!booking || booking.status !== BookingStatus.PENDING || booking.paymentMethod !== 'online') return false;
    if (await Payment.exists({ booking: booking._id, status: { $in: [PaymentStatus.CAPTURED, PaymentStatus.REFUNDED] } })) return false;

    const rate = config.ride.platformFeeRate;
    const platformCommission = roundMoney(charge.amountUsd * rate);
    try {
      await Payment.create({
        booking: booking._id,
        rider: booking.rider,
        driver: booking.driver,
        amount: charge.amountUsd,
        currency: 'USD',
        chargedCurrency: charge.currency,
        chargedAmount: charge.chargedAmount,
        exchangeRate: charge.exchangeRate,
        status: PaymentStatus.CAPTURED,
        method: charge.channel as PaymentMethod,
        reference: charge.reference,
        paynowReference: charge.paynowReference,
        driverPayout: roundMoney(charge.amountUsd - platformCommission),
        platformCommission,
        platformCommissionRate: rate,
        idempotencyKey: `pay_${booking._id}`,
      });
    } catch (error) {
      // Another charge for the same booking got there first
      if ((error as { code?: number }).code === 11000) return false;
      throw error;
    }
    // The sweeper may have closed the request between the check above and
    // the payment being recorded; it then refunded nothing, so refund now.
    // The wallet refund is keyed by booking, so it is never paid twice.
    const closed = await Booking.findOne({ _id: booking._id, status: { $ne: BookingStatus.PENDING } });
    if (closed) {
      const { BookingService } = await import('./BookingService');
      await new BookingService().refundBooking(closed, 'The request closed as the payment arrived', 'system');
      logger.warn('Payment arrived as its request closed; refunded to wallet', { reference: charge.reference, bookingId: booking._id });
      return true;
    }
    EventBridge.publish('payment-events', {
      eventType: 'payment.captured',
      data: { orderId: charge.reference, paymentId: charge.paynowReference, bookingId: booking._id, userId: booking.rider, amount: charge.amountUsd },
    });
    await this.notifications
      .createNotification(booking.driver.toString(), phrase('payment.seatRequestTitle'), phrase('payment.seatRequestBody'), 'ride', { bookingId: booking._id.toString() })
      .catch(() => undefined);
    return true;
  }

  /** Marks a parcel paid. False when it no longer needs paying. */
  private async payParcel(charge: IGatewayCharge): Promise<boolean> {
    const parcel = await ParcelPooling.findOneAndUpdate(
      { _id: charge.target, status: BookingStatus.PENDING, paymentMethod: 'online', paymentStatus: 'unpaid' },
      { $set: { paymentStatus: 'paid', paymentRef: charge.reference, paidAt: new Date() } },
      { new: true },
    );
    if (!parcel) return false;
    await this.notifications
      .createNotification(parcel.driver.toString(), phrase('payment.parcelRequestTitle'), phrase('payment.parcelRequestBody', { tracking: parcel.trackingNumber }), 'ride', { parcelId: parcel._id.toString() })
      .catch(() => undefined);
    return true;
  }

  /** A payment that was not needed goes to the payer's wallet */
  private async creditUnneeded(charge: IGatewayCharge): Promise<void> {
    await this.wallet.credit(
      charge.user.toString(),
      charge.amountUsd,
      `${LABEL[charge.channel]} payment ${charge.reference} was not needed, so it is in your wallet`,
      `charge_${charge.reference}`,
      charge.reference,
    );
    await GatewayCharge.updateOne({ _id: charge._id }, { $set: { creditedToWalletAt: new Date() } });
    await this.notifications
      .createNotification(charge.user.toString(), phrase('payment.toWalletTitle'), phrase('payment.toWalletBody', { amount: money(charge.amountUsd) }), 'system', { reference: charge.reference })
      .catch(() => undefined);
    logger.info('Unneeded payment credited to wallet', { reference: charge.reference, amount: charge.amountUsd });
  }

  /** What the user owes for this purpose, checked against who they are */
  private async owed(userId: string, input: StartChargeInput): Promise<{ amountUsd: number; target?: Types.ObjectId; description: string }> {
    if (input.purpose === 'topup') {
      const amount = roundMoney(Number(input.amount));
      await this.wallet.checkTopUp(userId, amount);
      return { amountUsd: amount, description: `Poolora wallet top-up, ${money(amount)}` };
    }
    if (!input.targetId || !Types.ObjectId.isValid(input.targetId)) throw new NotFoundError(input.purpose === 'booking' ? 'Booking' : 'Parcel');

    if (input.purpose === 'booking') {
      const booking = await Booking.findById(input.targetId);
      if (!booking || booking.rider.toString() !== userId) throw new NotFoundError('Booking');
      if (booking.status !== BookingStatus.PENDING || booking.paymentMethod !== 'online') throw new AppError('This request does not need paying', 409, 'NOTHING_TO_PAY');
      if (await Payment.exists({ booking: booking._id, status: PaymentStatus.CAPTURED })) throw new AppError('This request is already paid', 409, 'ALREADY_PAID');
      return { amountUsd: booking.estimatedFare, target: booking._id, description: `Poolora seat: ${booking.pickup.address.split(',')[0]} to ${booking.dropoff.address.split(',')[0]}` };
    }

    const parcel = await ParcelPooling.findById(input.targetId);
    if (!parcel || parcel.sender.toString() !== userId) throw new NotFoundError('Parcel');
    if (parcel.status !== BookingStatus.PENDING || parcel.paymentMethod !== 'online' || parcel.paymentStatus !== 'unpaid') {
      throw new AppError('This parcel does not need paying', 409, 'NOTHING_TO_PAY');
    }
    return { amountUsd: parcel.estimatedCost, target: parcel._id, description: `Poolora parcel ${parcel.trackingNumber}` };
  }
}
