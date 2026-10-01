/**
 * RatingService.ts
 *
 * Ratings after a trip (UC-R06): an overall score and optional category
 * scores, within 7 days of the drop. The score counts at once; a written
 * review is public only after an admin approves it. Problems reported with a
 * rating (safety, route, payment) are private, and a safety report alerts the
 * admins straight away. Riders who have not rated get one reminder after a day.
 */

import { Rating, IRating } from '../models/Rating';
import type { FilterQuery } from 'mongoose';
import { Types } from 'mongoose';
import { Booking } from '../models/Booking';
import { User } from '../models/User';
import { BookingStatus } from '../types';
import { AppError, NotFoundError, ConflictError, AuthorizationError } from '../utils/AppError';
import { EventBridge } from '../events';
import { logger } from '../utils/logger';
import { audit } from './AuditService';
import Filter from 'bad-words';

const profanityFilter = new Filter();

const DAY_MS = 86_400_000;
/** Ratings are accepted this long after the drop (UC-R06 business rules) */
export const RATING_WINDOW_DAYS = 7;
/** A rider who has not rated is reminded once, this long after the drop */
const REMINDER_AFTER_MS = DAY_MS;

export type RatingCategory = 'behavior' | 'cleanliness' | 'punctuality';
export type RatingIssue = 'safety' | 'route' | 'payment';

export interface CreateRatingDto {
    bookingId: string;
    score: number;
    tags?: string[];
    comment?: string;
    categories?: Partial<Record<RatingCategory, number>>;
    issues?: RatingIssue[];
    issueDetails?: string;
    /** "Did you feel safe?" 1 (no) to 5 (yes); confidential */
    safety?: number;
}

/** A "did you feel safe?" answer this low goes to the safety team like a safety report */
export const UNSAFE_AT_OR_BELOW = 2;

/** Fields never shown to anyone but admins */
const PRIVATE_FIELDS = '-safety -issues -issueDetails -flagReason -moderatedBy -moderationNote';

/** When a completed booking finished, for the rating window */
function completedAt(booking: { actualDropoffTime?: Date; updatedAt: Date }): Date {
    return booking.actualDropoffTime ?? booking.updatedAt;
}

export class RatingService {
    /**
     * Submit a rating after a ride completion.
     */
    async createRating(userId: string, data: CreateRatingDto): Promise<IRating> {
        const { bookingId, score, tags, categories, issues = [], safety } = data;
        const feltUnsafe = safety !== undefined && safety <= UNSAFE_AT_OR_BELOW;
        const comment = data.comment?.trim() || undefined;
        const issueDetails = data.issueDetails?.trim() || undefined;

        const booking = await Booking.findById(bookingId);
        if (!booking) throw new NotFoundError('Booking');

        if (booking.status !== BookingStatus.COMPLETED) {
            throw new AppError('Can only rate completed bookings', 400);
        }
        if (Date.now() - completedAt(booking).getTime() > RATING_WINDOW_DAYS * DAY_MS) {
            throw new AppError(`Ratings can be given up to ${RATING_WINDOW_DAYS} days after the trip. To report a problem, use "Report a problem" on the trip.`, 422, 'RATING_WINDOW_CLOSED');
        }

        // Determine who is rating whom
        const isRider = booking.rider.toString() === userId;
        const isDriver = booking.driver.toString() === userId;

        if (!isRider && !isDriver) {
            throw new AuthorizationError('You are not part of this booking');
        }

        const rateeId = isRider ? booking.driver.toString() : booking.rider.toString();
        const raterRole = isRider ? 'rider' : 'driver';

        // Check for existing rating
        const existing = await Rating.findOne({ booking: bookingId, rater: userId });
        if (existing) {
            throw new ConflictError('You have already rated this booking');
        }

        // A review waits for an admin; profanity is masked and noted for them
        let flagReason: string | undefined;
        let sanitizedComment = comment;
        if (comment && profanityFilter.isProfane(comment)) {
            flagReason = 'Profanity detected';
            sanitizedComment = profanityFilter.clean(comment);
        }
        if (issues.includes('safety')) flagReason = flagReason ? `Safety report; ${flagReason}` : 'Safety report';
        else if (feltUnsafe) flagReason = flagReason ? `Felt unsafe; ${flagReason}` : 'Felt unsafe';

        const rating = await Rating.create({
            booking: bookingId,
            ride: booking.ride,
            rater: userId,
            ratee: rateeId,
            raterRole,
            score,
            tags: tags || [],
            comment: sanitizedComment,
            categories: categories && Object.keys(categories).length ? categories : undefined,
            safety,
            issues: issues.length ? issues : undefined,
            issueDetails,
            commentStatus: sanitizedComment ? 'pending' : undefined,
            // The score always counts; only the written review is moderated
            isValidated: true,
            isFlagged: Boolean(flagReason),
            flagReason,
        });

        // Update ratee's aggregate rating
        const ratingField = isRider ? 'avgRatingAsDriver' : 'avgRatingAsRider';
        const countField = isRider ? 'totalRatingsAsDriver' : 'totalRatingsAsRider';
        const ratee = await User.findById(rateeId);
        if (ratee) {
            const currentAvg = ratee.stats[ratingField] || 0;
            const currentCount = ratee.stats[countField] || 0;
            const newCount = currentCount + 1;
            const newAvg = (currentAvg * currentCount + score) / newCount;

            await User.findByIdAndUpdate(rateeId, {
                $set: {
                    [`stats.${ratingField}`]: Math.round(newAvg * 100) / 100,
                    [`stats.${countField}`]: newCount,
                },
            });
        }

        if (safety !== undefined) {
            // Running average, kept apart from the public rating
            const key = isRider ? 'asDriver' : 'asRider';
            const holder = await User.findById(rateeId).select('+safetyRating').lean();
            const now = holder?.safetyRating?.[key] ?? { avg: 0, count: 0 };
            const count = now.count + 1;
            await User.updateOne({ _id: rateeId }, {
                $set: { [`safetyRating.${key}`]: { avg: Math.round(((now.avg * now.count + safety) / count) * 100) / 100, count } },
            });
        }

        if (issues.includes('safety') || feltUnsafe) {
            // The trip's trail is kept with the report
            const { keepTripTrail } = await import('./TripTrailService');
            await keepTripTrail(booking.ride);
            await this.alertAdmins(rating);
        }

        // Thank-you message (step 8)
        try {
            const { NotificationService } = await import('./NotificationService');
            await new NotificationService().createNotification(
                userId,
                'Thanks for your rating',
                issues.length
                    ? 'Thanks for rating your trip. Our team will look at the problem you reported.'
                    : 'Thanks for rating your trip. It helps keep Poolora safe and friendly.',
                'system',
            );
        } catch {
            // the rating is saved either way
        }

        EventBridge.publish('user-events', {
            eventType: 'rating.submitted',
            data: {
                ratingId: rating._id,
                bookingId,
                score,
                isFlagged: rating.isFlagged,
                safetyReport: issues.includes('safety'),
            },
        });

        return rating;
    }

    /**
     * Ratings a user received. Only approved reviews show their text, and
     * reported problems are never included.
     */
    async getUserRatings(
        userId: string,
        page: number,
        limit: number,
        as?: 'driver' | 'rider',
    ): Promise<{ ratings: IRating[]; total: number }> {
        const filter: FilterQuery<IRating> = { ratee: userId, isValidated: true };
        // A driver is rated by riders, and a rider by drivers
        if (as) filter.raterRole = as === 'driver' ? 'rider' : 'driver';

        const ratings = await Rating.find(filter)
            .select(PRIVATE_FIELDS)
            .populate('rater', 'name profilePhotoUrl')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        // Reviews from before moderation have no status and stay visible
        for (const r of ratings) {
            if (r.commentStatus === 'pending' || r.commentStatus === 'rejected') r.comment = undefined;
        }

        const total = await Rating.countDocuments(filter);

        return { ratings, total };
    }

    /** Average overall and per-category scores a user received in a role */
    async summary(userId: string, as: 'driver' | 'rider' = 'driver') {
        const [row] = await Rating.aggregate<{
            count: number; overall: number; behavior: number | null; cleanliness: number | null; punctuality: number | null;
        }>([
            { $match: { ratee: new Types.ObjectId(userId), isValidated: true, raterRole: as === 'driver' ? 'rider' : 'driver' } },
            {
                $group: {
                    _id: null,
                    count: { $sum: 1 },
                    overall: { $avg: '$score' },
                    behavior: { $avg: '$categories.behavior' },
                    cleanliness: { $avg: '$categories.cleanliness' },
                    punctuality: { $avg: '$categories.punctuality' },
                },
            },
        ]);
        const round = (n: number | null | undefined) => (typeof n === 'number' ? Math.round(n * 10) / 10 : null);
        return {
            count: row?.count ?? 0,
            overall: round(row?.overall),
            categories: { behavior: round(row?.behavior), cleanliness: round(row?.cleanliness), punctuality: round(row?.punctuality) },
        };
    }

    /** Completed trips the user can still rate, newest first */
    async pending(userId: string) {
        const since = new Date(Date.now() - RATING_WINDOW_DAYS * DAY_MS);
        const bookings = await Booking.find({
            $or: [{ rider: userId }, { driver: userId }],
            status: BookingStatus.COMPLETED,
            $and: [{ $or: [{ actualDropoffTime: { $gte: since } }, { actualDropoffTime: { $exists: false }, updatedAt: { $gte: since } }] }],
        })
            .select('rider driver pickup.address dropoff.address actualDropoffTime updatedAt')
            .populate<{ rider: { _id: Types.ObjectId; name?: string }; driver: { _id: Types.ObjectId; name?: string } }>([
                { path: 'rider', select: 'name' },
                { path: 'driver', select: 'name' },
            ])
            .sort({ actualDropoffTime: -1 })
            .limit(50)
            .lean();
        if (!bookings.length) return [];
        const rated = new Set(
            (await Rating.find({ rater: userId, booking: { $in: bookings.map((b) => b._id) } }).select('booking').lean()).map((r) => r.booking.toString()),
        );
        return bookings
            .filter((b) => !rated.has(b._id.toString()))
            .map((b) => {
                const asRider = b.rider?._id?.toString() === userId;
                const done = completedAt(b as never);
                return {
                    bookingId: b._id.toString(),
                    role: asRider ? 'rider' : 'driver',
                    rateeName: (asRider ? b.driver?.name : b.rider?.name) ?? (asRider ? 'your driver' : 'your rider'),
                    from: b.pickup?.address,
                    to: b.dropoff?.address,
                    completedAt: done,
                    closesAt: new Date(done.getTime() + RATING_WINDOW_DAYS * DAY_MS),
                };
            });
    }

    /**
     * One reminder to riders who have not rated a day after the drop (UC-R06
     * 3a). Runs from the booking sweeper.
     */
    async sendReminders(now = new Date()): Promise<number> {
        const due = await Booking.find({
            status: BookingStatus.COMPLETED,
            ratingReminderSentAt: { $exists: false },
            actualDropoffTime: { $lte: new Date(now.getTime() - REMINDER_AFTER_MS), $gte: new Date(now.getTime() - RATING_WINDOW_DAYS * DAY_MS) },
        })
            .select('rider driver')
            .populate<{ driver: { name?: string } | null }>('driver', 'name')
            .limit(200)
            .lean();
        if (!due.length) return 0;

        const rated = new Set(
            (await Rating.find({ booking: { $in: due.map((b) => b._id) }, raterRole: 'rider' }).select('booking').lean()).map((r) => r.booking.toString()),
        );
        const { NotificationService } = await import('./NotificationService');
        const push = new NotificationService();
        let sent = 0;
        for (const b of due) {
            // Claim it first, so two sweeps never remind twice
            const claimed = await Booking.updateOne({ _id: b._id, ratingReminderSentAt: { $exists: false } }, { $set: { ratingReminderSentAt: now } });
            if (!claimed.modifiedCount || rated.has(b._id.toString())) continue;
            const driver = (b.driver?.name ?? 'your driver').split(' ')[0];
            await push
                .sendPushNotification(b.rider.toString(), `How was your ride with ${driver}?`, 'Rate your trip. It takes a few seconds and helps other riders.', { type: 'rate_trip', bookingId: b._id.toString() })
                .catch(() => undefined);
            sent++;
        }
        return sent;
    }

    /**
     * Reviews for admins: safety reports first, then reviews waiting for
     * approval, oldest first.
     */
    async moderationQueue(status: 'pending' | 'reported' | 'done' = 'pending') {
        const filter: FilterQuery<IRating> =
            status === 'reported'
                ? { $or: [{ issues: { $exists: true, $ne: [] } }, { safety: { $lte: UNSAFE_AT_OR_BELOW } }] }
                : status === 'done'
                    ? { commentStatus: { $in: ['approved', 'rejected'] } }
                    : { $or: [{ commentStatus: 'pending' }, { $or: [{ issues: 'safety' }, { safety: { $lte: UNSAFE_AT_OR_BELOW } }], moderatedAt: { $exists: false } }] };
        const ratings = await Rating.find(filter)
            .populate('rater', 'name phone')
            .populate('ratee', 'name phone')
            .populate('moderatedBy', 'name')
            .sort(status === 'done' ? { moderatedAt: -1 } : { createdAt: 1 })
            .limit(200)
            .lean();
        if (status === 'pending') {
            const urgent = (r: { issues?: string[]; safety?: number }) => Number((r.issues ?? []).includes('safety') || (r.safety !== undefined && r.safety <= UNSAFE_AT_OR_BELOW));
            ratings.sort((a, b) => urgent(b) - urgent(a));
        }
        return { ratings };
    }

    /** Approve or reject a review; a safety report is marked as handled */
    async moderate(ratingId: string, adminId: string, decision: 'approve' | 'reject', note?: string) {
        const rating = await Rating.findById(ratingId);
        if (!rating) throw new NotFoundError('Rating');
        if (rating.moderatedAt) throw new ConflictError('This review has already been moderated');
        rating.moderatedBy = new Types.ObjectId(adminId);
        rating.moderatedAt = new Date();
        rating.moderationNote = note?.trim() || undefined;
        if (rating.comment) rating.commentStatus = decision === 'approve' ? 'approved' : 'rejected';
        await rating.save();
        await audit(adminId, decision === 'approve' ? 'review.approve' : 'review.reject', 'user', rating.ratee.toString(), note?.trim() || undefined, {
            ratingId,
        });
        return { rating };
    }

    private async alertAdmins(rating: IRating) {
        try {
            const { SocketGateway } = await import('../sockets/SocketGateway');
            SocketGateway.getInstance()?.getIO()?.to('admin:sos').emit('rating:safety', {
                ratingId: rating._id.toString(),
                bookingId: rating.booking.toString(),
                raterId: rating.rater.toString(),
                rateeId: rating.ratee.toString(),
                at: new Date().toISOString(),
            });
        } catch (error) {
            logger.debug('Could not alert admins about a safety report', { error: (error as Error).message });
        }
        // Admins not at the dashboard hear too (UC-R06 5a: alerted at once)
        const { pushAdmins } = await import('./SafetyAlerts');
        const what = (rating.issues ?? []).includes('safety') ? 'A safety problem was reported on a trip' : 'Someone said they did not feel safe on a trip';
        await pushAdmins('Safety report', `${what}. Open Reviews in the admin.`, { type: 'safety_report', ratingId: rating._id.toString() });
    }
}
