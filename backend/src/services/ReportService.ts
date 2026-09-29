/**
 * ReportService.ts
 *
 * Reports for the web admin (UC-A06): users, rides, money, performance and
 * safety over a date range, grouped by day, week or month. Each report has
 * summary figures, a time series for the chart, and tables. Any report can
 * be downloaded as CSV. Periods are in Zimbabwe time.
 */

import { PipelineStage } from 'mongoose';
import { User } from '../models/User';
import { Ride } from '../models/Ride';
import { Booking } from '../models/Booking';
import { Payment } from '../models/Payment';
import { Rating } from '../models/Rating';
import { EmergencyRecord } from '../models/EmergencyRecord';
import { Dispute } from '../models/Dispute';
import { BookingStatus, RideStatus, SOSStatus } from '../types';
import { AppError } from '../utils/AppError';
import { localDay } from './ReportExport';
import { REGION } from '../config/region';

export const REPORT_TYPES = ['users', 'rides', 'financial', 'performance', 'safety'] as const;
export type ReportType = (typeof REPORT_TYPES)[number];
export type GroupBy = 'day' | 'week' | 'month';

const TZ = REGION.timeZone;
const MAX_RANGE_DAYS = 730; // reports cover up to two years

export interface ReportParams {
  from: Date;
  to: Date;
  groupBy: GroupBy;
}

export interface Report {
  type: ReportType;
  from: string;
  to: string;
  groupBy: GroupBy;
  /** Headline figures for the whole range */
  summary: Array<{ label: string; value: number; format: 'count' | 'money' | 'percent' | 'decimal' | 'minutes' }>;
  /** One row per period; `period` is the ISO start of the period */
  series: Array<Record<string, number | string>>;
  /** Names of the series columns, in chart order, with labels */
  seriesColumns: Array<{ key: string; label: string; format: 'count' | 'money' | 'percent' | 'decimal' }>;
  /** Extra breakdowns, such as top routes */
  tables: Array<{ title: string; columns: string[]; rows: Array<Array<string | number>> }>;
}

export function parseReportParams(query: Record<string, unknown>): ReportParams {
  const to = query.to ? new Date(String(query.to)) : new Date();
  const from = query.from ? new Date(String(query.from)) : new Date(to.getTime() - 30 * 86_400_000);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    throw new AppError('Choose a valid date range', 422, 'VALIDATION_ERROR');
  }
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) {
    throw new AppError('Reports cover up to two years at a time', 422, 'VALIDATION_ERROR');
  }
  const groupBy = (['day', 'week', 'month'] as const).find((g) => g === query.groupBy) ?? 'day';
  return { from, to, groupBy };
}

/** $dateTrunc on a field, in Zimbabwe time */
const period = (field: string, unit: GroupBy) => ({ $dateTrunc: { date: `$${field}`, unit, timezone: TZ } });

async function bucket(
  model: { aggregate: (p: PipelineStage[]) => Promise<unknown[]> },
  dateField: string,
  match: Record<string, unknown>,
  p: ReportParams,
  fields: Record<string, unknown>,
): Promise<Map<string, Record<string, number>>> {
  const rows = (await model.aggregate([
    { $match: { ...match, [dateField]: { $gte: p.from, $lte: p.to } } },
    { $group: { _id: period(dateField, p.groupBy), ...fields } },
  ])) as Array<Record<string, number> & { _id: Date }>;
  return new Map(rows.map(({ _id, ...rest }) => [new Date(_id).toISOString(), rest]));
}

/** Every period start in the range, so empty periods show as zero */
function periods(p: ReportParams): string[] {
  const out: string[] = [];
  // Work in Zimbabwe time by shifting, then shift back
  const shift = REGION.utcOffsetMs;
  const d = new Date(p.from.getTime() + shift);
  d.setUTCHours(0, 0, 0, 0);
  if (p.groupBy === 'month') d.setUTCDate(1);
  if (p.groupBy === 'week') d.setUTCDate(d.getUTCDate() - d.getUTCDay()); // $dateTrunc weeks start on Sunday
  const end = p.to.getTime() + shift;
  while (d.getTime() <= end && out.length < 800) {
    out.push(new Date(d.getTime() - shift).toISOString());
    if (p.groupBy === 'day') d.setUTCDate(d.getUTCDate() + 1);
    else if (p.groupBy === 'week') d.setUTCDate(d.getUTCDate() + 7);
    else d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

function merge(p: ReportParams, sources: Record<string, Map<string, Record<string, number>>>, columns: string[][]) {
  return periods(p).map((start) => {
    const row: Record<string, number | string> = { period: start };
    for (const [source, key, as] of columns) {
      const value = sources[source].get(start)?.[key];
      row[as ?? key] = typeof value === 'number' ? Math.round(value * 100) / 100 : 0;
    }
    return row;
  });
}

const sum = (rows: Array<Record<string, number | string>>, key: string) =>
  Math.round(rows.reduce((a, r) => a + Number(r[key] ?? 0), 0) * 100) / 100;

export class ReportService {
  async build(type: ReportType, p: ReportParams): Promise<Report> {
    if (!REPORT_TYPES.includes(type)) throw new AppError('Unknown report', 404, 'NOT_FOUND');
    const base = { type, from: p.from.toISOString(), to: p.to.toISOString(), groupBy: p.groupBy };
    switch (type) {
      case 'users': return { ...base, ...(await this.users(p)) };
      case 'rides': return { ...base, ...(await this.rides(p)) };
      case 'financial': return { ...base, ...(await this.financial(p)) };
      case 'performance': return { ...base, ...(await this.performance(p)) };
      case 'safety': return { ...base, ...(await this.safety(p)) };
    }
  }

  private async users(p: ReportParams) {
    const [signups, drivers, totalBefore, active] = await Promise.all([
      bucket(User, 'createdAt', {}, p, { count: { $sum: 1 } }),
      bucket(User, 'kyc.reviewedAt', { 'kyc.status': 'approved' }, p, { count: { $sum: 1 } }),
      User.countDocuments({ createdAt: { $lt: p.from } }),
      Booking.distinct('rider', { createdAt: { $gte: p.from, $lte: p.to } }),
    ]);
    const series = merge(p, { signups, drivers }, [['signups', 'count', 'newUsers'], ['drivers', 'count', 'newDrivers']]);
    const newUsers = sum(series, 'newUsers');
    const [gender] = await Promise.all([
      User.aggregate([{ $match: { createdAt: { $lte: p.to } } }, { $group: { _id: '$gender', n: { $sum: 1 } } }]),
    ]);
    return {
      summary: [
        { label: 'New users', value: newUsers, format: 'count' as const },
        { label: 'New verified drivers', value: sum(series, 'newDrivers'), format: 'count' as const },
        { label: 'Users at the end', value: totalBefore + newUsers, format: 'count' as const },
        { label: 'Riders who booked', value: active.length, format: 'count' as const },
      ],
      series,
      seriesColumns: [
        { key: 'newUsers', label: 'New users', format: 'count' as const },
        { key: 'newDrivers', label: 'New verified drivers', format: 'count' as const },
      ],
      tables: [
        {
          title: 'Users by gender',
          columns: ['Gender', 'Users'],
          rows: gender.map((g: { _id: string | null; n: number }) => [g._id ?? 'Not given', g.n]),
        },
      ],
    };
  }

  private async rides(p: ReportParams) {
    const [created, done, cancelled, routes, hours] = await Promise.all([
      bucket(Ride, 'createdAt', {}, p, { count: { $sum: 1 } }),
      bucket(Ride, 'completedAt', { status: RideStatus.COMPLETED }, p, {
        count: { $sum: 1 },
        km: { $avg: '$estimatedDistanceKm' },
        seats: { $sum: '$totalSeats' },
        left: { $sum: '$availableSeats' },
      }),
      bucket(Ride, 'cancelledAt', { status: RideStatus.CANCELLED }, p, { count: { $sum: 1 } }),
      Ride.aggregate([
        { $match: { createdAt: { $gte: p.from, $lte: p.to } } },
        { $group: { _id: { from: '$pickup.address', to: '$dropoff.address' }, n: { $sum: 1 } } },
        { $sort: { n: -1 } },
        { $limit: 10 },
      ]),
      Ride.aggregate([
        { $match: { departureTime: { $gte: p.from, $lte: p.to } } },
        { $group: { _id: { $hour: { date: '$departureTime', timezone: TZ } }, n: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);
    const series = merge(p, { created, done, cancelled }, [
      ['created', 'count', 'created'],
      ['done', 'count', 'completed'],
      ['cancelled', 'count', 'cancelled'],
      ['done', 'km', 'avgDistanceKm'],
    ]);
    let seats = 0;
    let left = 0;
    for (const v of done.values()) {
      seats += v.seats ?? 0;
      left += v.left ?? 0;
    }
    const completed = sum(series, 'completed');
    const cancelledTotal = sum(series, 'cancelled');
    return {
      summary: [
        { label: 'Rides posted', value: sum(series, 'created'), format: 'count' as const },
        { label: 'Rides completed', value: completed, format: 'count' as const },
        { label: 'Cancellation rate', value: completed + cancelledTotal ? cancelledTotal / (completed + cancelledTotal) : 0, format: 'percent' as const },
        { label: 'Seat occupancy', value: seats ? (seats - left) / seats : 0, format: 'percent' as const },
      ],
      series,
      seriesColumns: [
        { key: 'created', label: 'Posted', format: 'count' as const },
        { key: 'completed', label: 'Completed', format: 'count' as const },
        { key: 'cancelled', label: 'Cancelled', format: 'count' as const },
      ],
      tables: [
        {
          title: 'Popular routes',
          columns: ['From', 'To', 'Rides'],
          rows: routes.map((r: { _id: { from: string; to: string }; n: number }) => [r._id.from, r._id.to, r.n]),
        },
        {
          title: 'Departures by hour',
          columns: ['Hour', 'Rides'],
          rows: hours.map((h: { _id: number; n: number }) => [`${String(h._id).padStart(2, '0')}:00`, h.n]),
        },
      ],
    };
  }

  private async financial(p: ReportParams) {
    const completed = { status: BookingStatus.COMPLETED };
    const [fares, refunds, methods] = await Promise.all([
      bucket(Booking, 'actualDropoffTime', completed, p, {
        gross: { $sum: '$finalFare' },
        fees: { $sum: '$platformFee' },
        payouts: { $sum: '$driverEarnings' },
      }),
      bucket(Booking, 'cancelledAt', { refundAmount: { $gt: 0 } }, p, { refunds: { $sum: '$refundAmount' } }),
      Payment.aggregate([
        { $match: { createdAt: { $gte: p.from, $lte: p.to }, status: { $in: ['captured', 'refunded', 'authorized'] } } },
        { $group: { _id: '$method', n: { $sum: 1 }, amount: { $sum: '$amount' } } },
        { $sort: { amount: -1 } },
      ]),
    ]);
    const series = merge(p, { fares, refunds }, [
      ['fares', 'gross', 'grossFares'],
      ['fares', 'fees', 'platformFees'],
      ['fares', 'payouts', 'driverPayouts'],
      ['refunds', 'refunds', 'refunds'],
    ]);
    return {
      summary: [
        { label: 'Fares paid', value: sum(series, 'grossFares'), format: 'money' as const },
        { label: 'Commission earned', value: sum(series, 'platformFees'), format: 'money' as const },
        { label: 'Driver payouts', value: sum(series, 'driverPayouts'), format: 'money' as const },
        { label: 'Refunds on cancellation', value: sum(series, 'refunds'), format: 'money' as const },
      ],
      series,
      seriesColumns: [
        { key: 'grossFares', label: 'Fares', format: 'money' as const },
        { key: 'platformFees', label: 'Commission', format: 'money' as const },
        { key: 'refunds', label: 'Refunds', format: 'money' as const },
      ],
      tables: [
        {
          title: 'Card and UPI payments by method',
          columns: ['Method', 'Payments', 'Amount (US$)'],
          rows: methods.map((m: { _id: string | null; n: number; amount: number }) => [m._id ?? 'Unknown', m.n, Math.round(m.amount)]),
        },
      ],
    };
  }

  private async performance(p: ReportParams) {
    const [ratings, done, cancelled, topDrivers] = await Promise.all([
      bucket(Rating, 'createdAt', {}, p, { avg: { $avg: '$score' }, count: { $sum: 1 } }),
      bucket(Booking, 'actualDropoffTime', { status: BookingStatus.COMPLETED }, p, { count: { $sum: 1 } }),
      bucket(Booking, 'cancelledAt', { status: BookingStatus.CANCELLED }, p, { count: { $sum: 1 } }),
      Booking.aggregate([
        { $match: { status: BookingStatus.COMPLETED, actualDropoffTime: { $gte: p.from, $lte: p.to } } },
        { $group: { _id: '$driver', trips: { $sum: 1 }, earned: { $sum: '$driverEarnings' } } },
        { $sort: { trips: -1 } },
        { $limit: 10 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
        { $project: { trips: 1, earned: 1, name: { $first: '$u.name' }, rating: { $first: '$u.stats.avgRatingAsDriver' } } },
      ]),
    ]);
    const series = merge(p, { ratings, done, cancelled }, [
      ['ratings', 'avg', 'avgRating'],
      ['done', 'count', 'completedBookings'],
      ['cancelled', 'count', 'cancelledBookings'],
    ]);
    const completedTotal = sum(series, 'completedBookings');
    const cancelledTotal = sum(series, 'cancelledBookings');
    let ratingSum = 0;
    let ratingCount = 0;
    for (const v of ratings.values()) {
      ratingSum += (v.avg ?? 0) * (v.count ?? 0);
      ratingCount += v.count ?? 0;
    }
    return {
      summary: [
        { label: 'Average rating', value: ratingCount ? ratingSum / ratingCount : 0, format: 'decimal' as const },
        { label: 'Ratings given', value: ratingCount, format: 'count' as const },
        { label: 'Completion rate', value: completedTotal + cancelledTotal ? completedTotal / (completedTotal + cancelledTotal) : 0, format: 'percent' as const },
        { label: 'Bookings cancelled', value: cancelledTotal, format: 'count' as const },
      ],
      series,
      seriesColumns: [
        { key: 'completedBookings', label: 'Completed', format: 'count' as const },
        { key: 'cancelledBookings', label: 'Cancelled', format: 'count' as const },
      ],
      tables: [
        {
          title: 'Top drivers',
          columns: ['Driver', 'Trips', 'Earned (US$)', 'Rating'],
          rows: topDrivers.map((d: { name?: string; trips: number; earned: number; rating?: number }) => [
            d.name ?? 'Unknown',
            d.trips,
            Math.round(d.earned ?? 0),
            d.rating ? Math.round(d.rating * 10) / 10 : '—',
          ]),
        },
      ],
    };
  }

  private async safety(p: ReportParams) {
    const [sos, falseAlarms, disputes, resolution, categories] = await Promise.all([
      bucket(EmergencyRecord, 'createdAt', {}, p, { count: { $sum: 1 } }),
      bucket(EmergencyRecord, 'createdAt', { status: SOSStatus.FALSE_ALARM }, p, { count: { $sum: 1 } }),
      bucket(Dispute, 'createdAt', {}, p, { count: { $sum: 1 } }),
      EmergencyRecord.aggregate([
        { $match: { createdAt: { $gte: p.from, $lte: p.to }, resolvedAt: { $exists: true } } },
        { $group: { _id: null, mins: { $avg: { $divide: [{ $subtract: ['$resolvedAt', '$createdAt'] }, 60_000] } } } },
      ]),
      Dispute.aggregate([
        { $match: { createdAt: { $gte: p.from, $lte: p.to } } },
        { $group: { _id: '$category', n: { $sum: 1 }, resolved: { $sum: { $cond: [{ $eq: ['$status', 'resolved'] }, 1, 0] } } } },
        { $sort: { n: -1 } },
      ]),
    ]);
    const series = merge(p, { sos, falseAlarms, disputes }, [
      ['sos', 'count', 'sosAlerts'],
      ['falseAlarms', 'count', 'falseAlarms'],
      ['disputes', 'count', 'disputes'],
    ]);
    return {
      summary: [
        { label: 'SOS alerts', value: sum(series, 'sosAlerts'), format: 'count' as const },
        { label: 'False alarms', value: sum(series, 'falseAlarms'), format: 'count' as const },
        { label: 'Average time to resolve SOS', value: Math.round(resolution[0]?.mins ?? 0), format: 'minutes' as const },
        { label: 'Disputes raised', value: sum(series, 'disputes'), format: 'count' as const },
      ],
      series,
      seriesColumns: [
        { key: 'sosAlerts', label: 'SOS alerts', format: 'count' as const },
        { key: 'disputes', label: 'Disputes', format: 'count' as const },
      ],
      tables: [
        {
          title: 'Disputes by category',
          columns: ['Category', 'Raised', 'Resolved'],
          rows: categories.map((c: { _id: string; n: number; resolved: number }) => [c._id, c.n, c.resolved]),
        },
      ],
    };
  }

  /** The whole report as CSV: summary, series, then each table. */
  toCsv(report: Report): string {
    const cell = (v: unknown) => {
      const s = String(v ?? '');
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const line = (cells: unknown[]) => cells.map(cell).join(',');
    const out: string[] = [
      line([`Poolora ${report.type} report`, `${localDay(report.from)} to ${localDay(report.to)}`, `by ${report.groupBy}`]),
      '',
      line(['Summary', 'Value']),
      ...report.summary.map((s) => line([s.label, s.format === 'percent' ? `${Math.round(s.value * 1000) / 10}%` : s.value])),
      '',
    ];
    const keys = Object.keys(report.series[0] ?? { period: '' });
    out.push(line(keys.map((k) => (k === 'period' ? 'Period start' : k))));
    for (const row of report.series) out.push(line(keys.map((k) => (k === 'period' ? localDay(String(row[k])) : row[k]))));
    for (const table of report.tables) {
      out.push('', line([table.title]), line(table.columns), ...table.rows.map(line));
    }
    return out.join('\n') + '\n';
  }
}
