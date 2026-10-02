/**
 * ReceiptService.ts
 *
 * Receipts for riders (UC-R04 step 11): what was paid, for which trip, how,
 * and what came back. Shown in the app, and emailed when a ride is completed
 * or when the rider asks for a copy.
 */

import { Booking } from '../models/Booking';
import { Payment } from '../models/Payment';
import { User } from '../models/User';
import { BookingStatus, PaymentStatus } from '../types';
import { AppError, AuthorizationError, NotFoundError } from '../utils/AppError';
import { emailLayout, escapeHtml, mailEnabled, sendMail } from './Mailer';
import { localTime, money, number } from '../config/region';
import { riderPays } from '../utils/fares';

export interface Receipt {
  receiptNumber: string;
  issuedAt: string;
  status: 'completed' | 'cancelled' | 'no_show' | 'confirmed';
  rider: { name: string };
  driver: { name: string; vehicle?: string };
  trip: { from: string; to: string; departure: string; seats: number };
  /** US dollars */
  fare: number;
  pricePerSeat: number;
  /** Poolora's service fee, included in the fare */
  serviceFee: number;
  refunded: number;
  paid: number;
  paymentMethod: string;
  /** Estimated kg of CO₂ the shared seat saved; completed trips only (UC-R11) */
  co2SavedKg?: number;
  /** What the rider's company paid of the fare, and its name (UC-C01) */
  companyPaid?: number;
  company?: string;
}

async function companyName(id?: unknown): Promise<string | undefined> {
  if (!id) return undefined;
  const { Organisation } = await import('../models/Organisation');
  return (await Organisation.findById(id).select('name').lean())?.name;
}

const METHOD_LABEL: Record<string, string> = { ecocash: 'EcoCash', onemoney: 'OneMoney', innbucks: 'InnBucks', card: 'Card' };
const when = (d: Date | string) => localTime(d, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

export class ReceiptService {
  async build(bookingId: string, userId: string): Promise<Receipt> {
    const booking = await Booking.findById(bookingId)
      .populate<{ ride: { departureTime: Date; pricePerSeat: number; vehicle?: { plateNumber?: string } } | null }>('ride', 'departureTime pricePerSeat vehicle.plateNumber')
      .populate<{ rider: { _id: unknown; name: string } }>('rider', 'name')
      .populate<{ driver: { _id: unknown; name: string } }>('driver', 'name');
    if (!booking) throw new NotFoundError('Booking');
    const riderId = String(booking.rider?._id ?? '');
    const driverId = String(booking.driver?._id ?? '');
    if (userId !== riderId && userId !== driverId) throw new AuthorizationError('This receipt belongs to someone else');
    if (booking.status === BookingStatus.PENDING || booking.status === BookingStatus.REJECTED || booking.status === BookingStatus.PAYMENT_FAILED) {
      throw new AppError('There is no receipt until a seat is confirmed', 409, 'NO_RECEIPT_YET');
    }

    const payment = booking.paymentMethod === 'online'
      ? await Payment.findOne({ booking: booking._id, status: { $in: [PaymentStatus.CAPTURED, PaymentStatus.REFUNDED] } }).lean()
      : null;
    const fare = booking.finalFare ?? booking.estimatedFare;
    const refunded = booking.refundAmount ?? 0;
    const status: Receipt['status'] = booking.noShow
      ? 'no_show'
      : booking.status === BookingStatus.COMPLETED
        ? 'completed'
        : booking.status === BookingStatus.CANCELLED
          ? 'cancelled'
          : 'confirmed';

    return {
      receiptNumber: `PL-${booking._id.toString().slice(-8).toUpperCase()}`,
      issuedAt: new Date().toISOString(),
      status,
      rider: { name: booking.rider?.name ?? 'Rider' },
      driver: { name: booking.driver?.name ?? 'Driver', vehicle: booking.ride?.vehicle?.plateNumber },
      trip: {
        from: booking.pickup.address,
        to: booking.dropoff.address,
        departure: (booking.ride?.departureTime ?? booking.createdAt).toISOString(),
        seats: booking.seatsBooked,
      },
      fare,
      pricePerSeat: booking.ride?.pricePerSeat ?? fare / booking.seatsBooked,
      serviceFee: booking.platformFee ?? 0,
      refunded,
      // The rider's own part; a company's part is on the company's bill
      paid: Math.round((riderPays(booking) - refunded) * 100) / 100,
      ...(booking.companyShare && status !== 'cancelled' && status !== 'no_show' ? { companyPaid: booking.companyShare, company: await companyName(booking.organisation) } : {}),
      ...(status === 'completed' && booking.co2SavedKg ? { co2SavedKg: booking.co2SavedKg } : {}),
      paymentMethod: payment ? `${METHOD_LABEL[String(payment.method)] ?? 'Online'}${payment.chargedCurrency === 'ZWG' && payment.chargedAmount ? ` (charged ${money(payment.chargedAmount, 'ZWG')})` : ''}` : 'Poolora wallet',
    };
  }

  text(r: Receipt): string {
    const lines = [
      `Poolora receipt ${r.receiptNumber}`,
      `${r.trip.from} to ${r.trip.to}`,
      `${when(r.trip.departure)} · ${r.trip.seats} seat${r.trip.seats === 1 ? '' : 's'} · driver ${r.driver.name}${r.driver.vehicle ? ` (${r.driver.vehicle})` : ''}`,
      `Fare ${money(r.fare)} (${r.trip.seats} × ${money(r.pricePerSeat)})`,
      ...(r.serviceFee ? [`Includes Poolora service fee ${money(r.serviceFee)}`] : []),
      ...(r.companyPaid ? [`Paid by ${r.company ?? 'your company'}: ${money(r.companyPaid)}`] : []),
      ...(r.refunded ? [`Refunded ${money(r.refunded)}`] : []),
      `Paid ${money(r.paid)} by ${r.paymentMethod}`,
      r.co2SavedKg ? `Sharing saved about ${number(r.co2SavedKg, 1)} kg of CO₂` : '',
      r.status === 'no_show' ? 'The rider did not come to the pickup; the fare was not refunded.' : '',
    ];
    return lines.filter(Boolean).join('\n');
  }

  html(r: Receipt): string {
    const row = (label: string, value: string, strong = false) =>
      `<tr><td style="padding:6px 0;color:#52514e">${escapeHtml(label)}</td><td style="padding:6px 0;text-align:right${strong ? ';font-weight:bold' : ''}">${escapeHtml(value)}</td></tr>`;
    const statusLine: Record<Receipt['status'], string> = {
      completed: 'Trip completed',
      confirmed: 'Seat confirmed',
      cancelled: 'Booking cancelled',
      no_show: 'Marked as a no-show',
    };
    return emailLayout(`Receipt ${r.receiptNumber}`, `
<p style="margin:0 0 4px"><strong>${escapeHtml(r.trip.from)}</strong> to <strong>${escapeHtml(r.trip.to)}</strong></p>
<p style="margin:0 0 16px;color:#52514e">${escapeHtml(when(r.trip.departure))} · ${escapeHtml(statusLine[r.status])}</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e2e1dc;font-size:14px">
${row('Rider', r.rider.name)}
${row('Driver', `${r.driver.name}${r.driver.vehicle ? ` · ${r.driver.vehicle}` : ''}`)}
${row('Seats', `${r.trip.seats} × ${money(r.pricePerSeat)}`)}
${row('Fare', money(r.fare))}
${r.serviceFee ? row('Includes Poolora service fee', money(r.serviceFee)) : ''}
${r.companyPaid ? row(`Paid by ${r.company ?? 'your company'}`, `− ${money(r.companyPaid)}`) : ''}
${r.refunded ? row('Refunded', `− ${money(r.refunded)}`) : ''}
${row('Total paid', money(r.paid), true)}
${row('Paid by', r.paymentMethod)}
${r.co2SavedKg ? row('CO₂ saved by sharing (estimate)', `${number(r.co2SavedKg, 1)} kg`) : ''}
</table>
<p style="font-size:12px;color:#75746f;margin:16px 0 0">Issued ${escapeHtml(when(r.issuedAt))} CAT. Refunds go to your Poolora wallet at once, and you can withdraw them to EcoCash, OneMoney or InnBucks.</p>`);
  }

  /** Emails the receipt to the rider, if they have an email address and mail is set up */
  async email(bookingId: string, userId: string): Promise<{ sent: boolean; to?: string }> {
    const receipt = await this.build(bookingId, userId);
    const user = await User.findById(userId).select('email').lean();
    if (!user?.email) throw new AppError('Add an email address in your profile to get receipts by email', 409, 'NO_EMAIL');
    if (!mailEnabled()) throw new AppError('Email receipts are not available right now', 503, 'EMAIL_UNAVAILABLE');
    const sent = await sendMail({ to: user.email, subject: `Your Poolora receipt ${receipt.receiptNumber}`, text: this.text(receipt), html: this.html(receipt) });
    return { sent, to: user.email };
  }

  /** Sent automatically when a rider's trip is completed. Silent when there is no email. */
  async emailOnCompletion(bookingId: string, riderId: string): Promise<void> {
    if (!mailEnabled()) return;
    const user = await User.findById(riderId).select('email').lean();
    if (!user?.email) return;
    const receipt = await this.build(bookingId, riderId);
    await sendMail({ to: user.email, subject: `Your Poolora receipt ${receipt.receiptNumber}`, text: this.text(receipt), html: this.html(receipt) });
  }
}
