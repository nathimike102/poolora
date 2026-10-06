/**
 * DriverService.ts
 *
 * Driver tools that are not about a single booking: messaging every rider on
 * a ride (UC-D06 step 6), monthly earnings statements (UC-D09) and the
 * Verified Driver badge (UC-D10).
 */

import { plainAverage } from '../utils/ratingScore';
import { Booking } from '../models/Booking';
import { Ride } from '../models/Ride';
import { User, IUser } from '../models/User';
import { BookingStatus, KYCStatus } from '../types';
import { AppError, AuthorizationError, NotFoundError } from '../utils/AppError';
import { ChatService } from './ChatService';
import { NotificationService } from './NotificationService';
import { emailLayout, escapeHtml, mailEnabled, sendMail } from './Mailer';
import { fromLocalClock, money, toLocalClock } from '../config/region';
import { phrase } from '../i18n';

/** What it takes to earn the Verified Driver badge (UC-D10) */
export const VERIFIED_DRIVER_RULES = {
  minTrips: 20,
  minRating: 4.7,
  minRatings: 10,
  maxCancellationRate: 0.05,
  minAccountDays: 90,
};

export interface VerifiedStatus {
  verified: boolean;
  checks: Array<{ label: string; met: boolean; progress: string }>;
}

/** Whether a driver has earned the badge, and how far along each rule they are */
export function verifiedDriverStatus(user: Pick<IUser, 'kyc' | 'stats' | 'createdAt' | 'warnings' | 'isSuspended' | 'isBlocked'>): VerifiedStatus {
  const r = VERIFIED_DRIVER_RULES;
  const s = user.stats ?? ({} as IUser['stats']);
  const days = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86_400_000);
  const checks = [
    { label: 'Licence and vehicle papers checked', met: user.kyc?.status === KYCStatus.APPROVED, progress: user.kyc?.status === KYCStatus.APPROVED ? 'Done' : 'Not yet' },
    { label: `${r.minTrips} or more trips`, met: (s.totalRidesAsDriver ?? 0) >= r.minTrips, progress: `${s.totalRidesAsDriver ?? 0} of ${r.minTrips}` },
    {
      label: `Rating ${r.minRating} or higher from at least ${r.minRatings} riders`,
      // The plain average: the shown score starts at 5 and would flatter a short record
      met: plainAverage(s, 'Driver') >= r.minRating && (s.totalRatingsAsDriver ?? 0) >= r.minRatings,
      progress: `${plainAverage(s, 'Driver').toFixed(1)} from ${s.totalRatingsAsDriver ?? 0} ratings`,
    },
    { label: `Cancels under ${r.maxCancellationRate * 100}% of rides`, met: (s.cancellationRate ?? 0) < r.maxCancellationRate, progress: `${Math.round((s.cancellationRate ?? 0) * 100)}%` },
    { label: `Driving with Poolora for ${r.minAccountDays} days`, met: days >= r.minAccountDays, progress: `${days} days` },
    { label: 'No warnings or suspensions', met: !(user.warnings ?? 0) && !user.isSuspended && !user.isBlocked, progress: user.warnings ? `${user.warnings} warning${user.warnings === 1 ? '' : 's'}` : 'Clear' },
  ];
  return { verified: checks.every((c) => c.met), checks };
}

export interface StatementLine {
  date: string;
  kind: 'Trip' | 'Late cancellation' | 'No-show';
  route: string;
  rider: string;
  fare: number;
  platformFee: number;
  earnings: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export class DriverService {
  /** One message to every confirmed rider on the ride, in each rider's chat (UC-D06 step 6) */
  async messageAllRiders(rideId: string, driverId: string, content: string): Promise<{ sent: number }> {
    const text = content?.trim() ?? '';
    if (!text) throw new AppError('The message is empty', 422, 'VALIDATION_ERROR');
    const ride = await Ride.findById(rideId).select('driver');
    if (!ride) throw new NotFoundError('Ride');
    if (ride.driver.toString() !== driverId) throw new AuthorizationError('Only the ride\'s driver can message its riders');
    const bookings = await Booking.find({ ride: rideId, status: BookingStatus.CONFIRMED }).select('_id rider');
    if (bookings.length === 0) throw new AppError('Nobody is booked on this ride yet', 409, 'NO_RIDERS');

    const chat = new ChatService();
    const push = new NotificationService();
    const { SocketGateway } = await import('../sockets/SocketGateway');
    const io = SocketGateway.getInstance()?.getIO();
    for (const b of bookings) {
      const message = await chat.sendMessage(driverId, { bookingId: b._id.toString(), content: text.slice(0, 2000), contentType: 'text' });
      io?.to(`user:${b.rider.toString()}`).emit('chat:message:receive', {
        messageId: message._id,
        bookingId: b._id.toString(),
        senderId: driverId,
        content: message.content,
        contentType: 'text',
        createdAt: message.createdAt,
      });
      await push.sendPushNotification(b.rider.toString(), phrase('driverMessage.title'), message.content.slice(0, 120), { bookingId: b._id.toString(), type: 'chat' }).catch(() => undefined);
    }
    return { sent: bookings.length };
  }

  /** What a driver earned in a month (Zimbabwe time), line by line (UC-D09) */
  async statement(driverId: string, month: string): Promise<{ month: string; lines: StatementLine[]; totals: { fare: number; platformFee: number; earnings: number; trips: number } }> {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new AppError('Month must look like 2026-09', 422, 'VALIDATION_ERROR');
    const [y, m] = month.split('-').map(Number);
    const from = fromLocalClock(new Date(Date.UTC(y, m - 1, 1)));
    const to = fromLocalClock(new Date(Date.UTC(y, m, 1)));

    const bookings = await Booking.find({
      driver: driverId,
      $or: [
        { status: BookingStatus.COMPLETED, actualDropoffTime: { $gte: from, $lt: to } },
        { status: BookingStatus.CANCELLED, cancellationFee: { $gt: 0 }, cancelledAt: { $gte: from, $lt: to } },
      ],
    })
      .populate<{ rider: { name?: string } | null }>('rider', 'name')
      .sort({ actualDropoffTime: 1, cancelledAt: 1 })
      .lean();

    const lines: StatementLine[] = bookings.map((b) => {
      const completed = b.status === BookingStatus.COMPLETED;
      const when = (completed ? b.actualDropoffTime : b.cancelledAt) ?? b.updatedAt;
      const fare = completed ? b.finalFare ?? b.estimatedFare : b.cancellationFee ?? 0;
      return {
        date: toLocalClock(new Date(when)).toISOString().slice(0, 10),
        kind: completed ? 'Trip' : b.noShow ? 'No-show' : 'Late cancellation',
        route: `${b.pickup.address.split(',')[0]} to ${b.dropoff.address.split(',')[0]}`,
        rider: (b.rider?.name ?? 'Rider').split(' ')[0],
        fare: round2(fare),
        platformFee: round2(b.platformFee ?? 0),
        earnings: round2(b.driverEarnings ?? fare - (b.platformFee ?? 0)),
      };
    });
    const sum = (k: 'fare' | 'platformFee' | 'earnings') => round2(lines.reduce((a, l) => a + l[k], 0));
    return { month, lines, totals: { fare: sum('fare'), platformFee: sum('platformFee'), earnings: sum('earnings'), trips: lines.filter((l) => l.kind === 'Trip').length } };
  }

  statementCsv(s: Awaited<ReturnType<DriverService['statement']>>): string {
    const cell = (v: unknown) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    const rows = [
      ['Date', 'Type', 'Route', 'Rider', 'Fare (USD)', 'Platform fee (USD)', 'Your earnings (USD)'],
      ...s.lines.map((l) => [l.date, l.kind, l.route, l.rider, l.fare, l.platformFee, l.earnings]),
      [],
      ['Total', `${s.totals.trips} trips`, '', '', s.totals.fare, s.totals.platformFee, s.totals.earnings],
    ];
    return rows.map((r) => r.map(cell).join(',')).join('\n') + '\n';
  }

  /** Emails the statement as a CSV attachment */
  async emailStatement(driverId: string, month: string): Promise<{ to: string }> {
    const user = await User.findById(driverId).select('email name').lean();
    if (!user?.email) throw new AppError('Add an email address in your profile to get statements by email', 409, 'NO_EMAIL');
    if (!mailEnabled()) throw new AppError('Email is not available right now', 503, 'EMAIL_UNAVAILABLE');
    const s = await this.statement(driverId, month);
    await sendMail({
      to: user.email,
      subject: `Your Poolora earnings for ${month}`,
      text: `${s.totals.trips} trips in ${month}. Fares ${money(s.totals.fare)}, platform fees ${money(s.totals.platformFee)}, your earnings ${money(s.totals.earnings)}. The full statement is attached.`,
      html: emailLayout(`Earnings for ${month}`, `<p>${s.totals.trips} trips. Fares ${escapeHtml(money(s.totals.fare))}, platform fees ${escapeHtml(money(s.totals.platformFee))}.</p><p style="font-size:18px"><strong>Your earnings: ${escapeHtml(money(s.totals.earnings))}</strong></p><p>The full statement is attached as a spreadsheet.</p>`),
      attachments: [{ filename: `poolora-earnings-${month}.csv`, content: this.statementCsv(s), contentType: 'text/csv' }],
    });
    return { to: user.email };
  }
}
