/**
 * AdminOverviewService.ts
 *
 * The live numbers on the web admin's dashboard (UC-A02): users, rides,
 * money, safety and system health, plus anomalies worth a look. The
 * dashboard polls this every 30 seconds.
 */

import mongoose from 'mongoose';
import { User } from '../models/User';
import { Ride } from '../models/Ride';
import { Booking } from '../models/Booking';
import { EmergencyRecord } from '../models/EmergencyRecord';
import { Dispute } from '../models/Dispute';
import { Rating } from '../models/Rating';
import { getRedisClient } from '../config/redis';
import { BookingStatus, FraudLevel, KYCStatus, RideStatus, SOSStatus } from '../types';
import { requestStats } from '../utils/requestStats';

const DAY = 86_400_000;

function startOfToday(now: Date): Date {
  // India time (UTC+5:30), where the service runs
  const ist = new Date(now.getTime() + 5.5 * 3_600_000);
  ist.setUTCHours(0, 0, 0, 0);
  return new Date(ist.getTime() - 5.5 * 3_600_000);
}

async function sumBookings(match: Record<string, unknown>, field: string): Promise<{ total: number; count: number }> {
  const [row] = await Booking.aggregate([
    { $match: match },
    { $group: { _id: null, total: { $sum: `$${field}` }, count: { $sum: 1 } } },
  ]);
  return { total: Math.round((row?.total ?? 0) * 100) / 100, count: row?.count ?? 0 };
}

async function activeUsersLastHour(): Promise<number | null> {
  const redis = getRedisClient();
  if (!redis) return null;
  const now = new Date();
  const hours = [now, new Date(now.getTime() - 3_600_000)].map((d) => `active:users:${d.toISOString().slice(0, 13)}`);
  try {
    return await redis.pfcount(...hours);
  } catch {
    return null;
  }
}

export interface Anomaly {
  severity: 'critical' | 'warning';
  title: string;
  detail: string;
  link?: string;
}

export class AdminOverviewService {
  async overview(now = new Date()) {
    const today = startOfToday(now);
    const weekAgo = new Date(today.getTime() - 7 * DAY);
    const monthAgo = new Date(today.getTime() - 30 * DAY);
    const completed = { status: BookingStatus.COMPLETED };

    const [
      totalUsers, newToday, newWeek, drivers, verifiedDrivers, pendingApplications, activeHour,
      liveRides, upcomingRides, ridesCreatedToday, ridesCompletedToday, ridesCancelledToday,
      weekCompletedRides, weekCancelledRides, occupancy,
      revenueToday, revenueWeek, revenueMonth, pendingSettlement, refundsWeek,
      activeSos, openDisputes, blocked, suspended, pendingBlocks, fraudFlagged, reviewsWaiting, safetyReports,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: today } }),
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
      User.countDocuments({ capabilities: 'driver' }),
      User.countDocuments({ 'kyc.status': KYCStatus.APPROVED }),
      User.countDocuments({ 'kyc.status': KYCStatus.PENDING }),
      activeUsersLastHour(),
      Ride.countDocuments({ status: RideStatus.IN_PROGRESS }),
      Ride.countDocuments({ status: { $in: [RideStatus.SCHEDULED, RideStatus.ACTIVE] }, departureTime: { $gte: now } }),
      Ride.countDocuments({ createdAt: { $gte: today } }),
      Ride.countDocuments({ status: RideStatus.COMPLETED, completedAt: { $gte: today } }),
      Ride.countDocuments({ status: RideStatus.CANCELLED, cancelledAt: { $gte: today } }),
      Ride.countDocuments({ status: RideStatus.COMPLETED, completedAt: { $gte: weekAgo } }),
      Ride.countDocuments({ status: RideStatus.CANCELLED, cancelledAt: { $gte: weekAgo } }),
      Ride.aggregate([
        { $match: { status: RideStatus.COMPLETED, completedAt: { $gte: weekAgo } } },
        { $group: { _id: null, seats: { $sum: '$totalSeats' }, left: { $sum: '$availableSeats' } } },
      ]),
      sumBookings({ ...completed, actualDropoffTime: { $gte: today } }, 'platformFee'),
      sumBookings({ ...completed, actualDropoffTime: { $gte: weekAgo } }, 'platformFee'),
      sumBookings({ ...completed, actualDropoffTime: { $gte: monthAgo } }, 'platformFee'),
      sumBookings({ ...completed, settlementStatus: { $ne: 'settled' } }, 'driverEarnings'),
      sumBookings({ refundAmount: { $gt: 0 }, cancelledAt: { $gte: weekAgo } }, 'refundAmount'),
      EmergencyRecord.countDocuments({ status: { $in: [SOSStatus.TRIGGERED, SOSStatus.ACKNOWLEDGED] } }),
      Dispute.countDocuments({ status: { $ne: 'resolved' } }),
      User.countDocuments({ isBlocked: true }),
      User.countDocuments({ isSuspended: true, isBlocked: { $ne: true } }),
      User.countDocuments({ 'pendingBlock.requestedAt': { $exists: true } }),
      User.countDocuments({ fraudLevel: { $in: [FraudLevel.FLAGGED, FraudLevel.BLOCKED] }, fraudReview: { $exists: false } }),
      Rating.countDocuments({ $or: [{ commentStatus: 'pending' }, { issues: 'safety', moderatedAt: { $exists: false } }] }),
      Rating.countDocuments({ issues: 'safety', moderatedAt: { $exists: false } }),
    ]);

    const [volumeToday, volumeWeek, volumeMonth] = await Promise.all([
      sumBookings({ ...completed, actualDropoffTime: { $gte: today } }, 'finalFare'),
      sumBookings({ ...completed, actualDropoffTime: { $gte: weekAgo } }, 'finalFare'),
      sumBookings({ ...completed, actualDropoffTime: { $gte: monthAgo } }, 'finalFare'),
    ]);

    const seats = occupancy[0]?.seats ?? 0;
    const weekEnded = weekCompletedRides + weekCancelledRides;
    const system = await this.systemHealth();

    const summary = {
      generatedAt: now.toISOString(),
      users: {
        total: totalUsers,
        newToday,
        newThisWeek: newWeek,
        drivers,
        riders: totalUsers - drivers,
        verifiedDrivers,
        pendingApplications,
        activeLastHour: activeHour,
      },
      rides: {
        live: liveRides,
        upcoming: upcomingRides,
        createdToday: ridesCreatedToday,
        completedToday: ridesCompletedToday,
        cancelledToday: ridesCancelledToday,
        cancellationRate7d: weekEnded ? weekCancelledRides / weekEnded : 0,
        occupancy7d: seats ? (seats - (occupancy[0]?.left ?? 0)) / seats : null,
      },
      money: {
        revenue: { today: revenueToday.total, week: revenueWeek.total, month: revenueMonth.total },
        volume: { today: volumeToday.total, week: volumeWeek.total, month: volumeMonth.total },
        tripsPaid: { today: volumeToday.count, week: volumeWeek.count, month: volumeMonth.count },
        pendingSettlement: pendingSettlement.total,
        refunds7d: { total: refundsWeek.total, count: refundsWeek.count },
      },
      safety: { activeSos, openDisputes, blockedUsers: blocked, suspendedUsers: suspended, pendingBlocks, fraudFlagged, reviewsWaiting, safetyReports },
      system,
    };
    return { ...summary, anomalies: await this.anomalies(now, summary) };
  }

  private async systemHealth() {
    const started = Date.now();
    let databaseMs: number | null = null;
    try {
      await mongoose.connection.db?.admin().ping();
      databaseMs = Date.now() - started;
    } catch {
      databaseMs = null;
    }
    const redis = getRedisClient();
    let redisOk = false;
    try {
      redisOk = redis ? (await redis.ping()) === 'PONG' : false;
    } catch {
      redisOk = false;
    }
    const memory = process.memoryUsage();
    return {
      uptimeSeconds: Math.round(process.uptime()),
      memoryMb: Math.round(memory.rss / 1_048_576),
      databaseMs,
      redis: redisOk,
      requests: requestStats(),
    };
  }

  /**
   * Compares today with the average of the previous seven days (UC-A02
   * step 4). Rule-based, not a model: a spike needs both a clear ratio and a
   * minimum count, so a quiet day does not raise alarms.
   */
  private async anomalies(
    now: Date,
    summary: { safety: { activeSos: number; pendingBlocks: number; fraudFlagged: number; safetyReports?: number }; users: { pendingApplications: number }; system: { requests: { requests: number; errorRate: number } } },
  ): Promise<Anomaly[]> {
    const today = startOfToday(now);
    const weekAgo = new Date(today.getTime() - 7 * DAY);
    const hoursIntoDay = Math.max(1, (now.getTime() - today.getTime()) / 3_600_000);
    const [bookingsToday, bookingsWeek, cancelsToday, cancelsWeek, fraudToday] = await Promise.all([
      Booking.countDocuments({ createdAt: { $gte: today } }),
      Booking.countDocuments({ createdAt: { $gte: weekAgo, $lt: today } }),
      Booking.countDocuments({ status: BookingStatus.CANCELLED, cancelledAt: { $gte: today } }),
      Booking.countDocuments({ status: BookingStatus.CANCELLED, cancelledAt: { $gte: weekAgo, $lt: today } }),
      User.countDocuments({ fraudLevel: { $in: [FraudLevel.FLAGGED, FraudLevel.BLOCKED] }, fraudFlaggedAt: { $gte: today } }),
    ]);
    // Expected so far today, pro rata from the weekly daily average
    const expectedBookings = (bookingsWeek / 7) * (hoursIntoDay / 24);
    const expectedCancels = (cancelsWeek / 7) * (hoursIntoDay / 24);

    const out: Anomaly[] = [];
    if (summary.safety.activeSos > 0) {
      out.push({ severity: 'critical', title: `${summary.safety.activeSos} active SOS`, detail: 'Respond within 5 minutes.', link: '/sos' });
    }
    const { requests } = summary.system;
    if (requests.requests >= 50 && requests.errorRate > 0.05) {
      out.push({
        severity: 'critical',
        title: 'High error rate',
        detail: `${Math.round(requests.errorRate * 100)}% of the last ${requests.requests} requests failed on this server.`,
      });
    }
    if (cancelsToday >= 5 && cancelsToday > expectedCancels * 2) {
      out.push({
        severity: 'warning',
        title: 'Spike in cancellations',
        detail: `${cancelsToday} cancellations so far today; about ${Math.round(expectedCancels)} would be usual by now.`,
        link: '/reports?type=performance',
      });
    }
    if (expectedBookings >= 10 && bookingsToday < expectedBookings * 0.5) {
      out.push({
        severity: 'warning',
        title: 'Bookings well below normal',
        detail: `${bookingsToday} bookings so far today; about ${Math.round(expectedBookings)} would be usual by now.`,
        link: '/reports?type=rides',
      });
    }
    if (fraudToday >= 3) {
      out.push({ severity: 'warning', title: 'Several fraud flags today', detail: `${fraudToday} accounts flagged or blocked by fraud checks today.`, link: '/fraud' });
    }
    // High-risk flags are due for review within 2 hours (UC-AI02)
    const fraudOverdue = await User.countDocuments({
      fraudLevel: { $in: [FraudLevel.FLAGGED, FraudLevel.BLOCKED] },
      fraudReview: { $exists: false },
      fraudFlaggedAt: { $lt: new Date(now.getTime() - 2 * 3_600_000) },
    });
    if (fraudOverdue > 0) {
      out.push({ severity: 'warning', title: 'Fraud flags overdue', detail: `${fraudOverdue} waiting more than 2 hours for review.`, link: '/fraud' });
    }
    if (summary.safety.safetyReports) {
      out.push({ severity: 'critical', title: 'Safety reports in ratings', detail: `${summary.safety.safetyReports} waiting for the safety team.`, link: '/reviews' });
    }
    if (summary.safety.pendingBlocks > 0) {
      out.push({ severity: 'warning', title: 'Blocks waiting for approval', detail: summary.safety.pendingBlocks === 1 ? '1 account block needs a second admin.' : `${summary.safety.pendingBlocks} account blocks need a second admin.`, link: '/users?status=pending_block' });
    }
    const overdue = await User.countDocuments({ 'kyc.status': KYCStatus.PENDING, 'kyc.submittedAt': { $lt: new Date(now.getTime() - 2 * DAY) } });
    if (overdue > 0) {
      out.push({ severity: 'warning', title: 'Driver applications overdue', detail: `${overdue} waiting more than 48 hours.`, link: '/applications' });
    }
    return out;
  }
}
