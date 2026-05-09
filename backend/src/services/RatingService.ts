import { Rating, IRating } from '../models/Rating';
import { Booking } from '../models/Booking';
import { User } from '../models/User';
import { BookingStatus } from '../types';
import { AppError, NotFoundError, ConflictError, AuthorizationError } from '../utils/AppError';
import { EventBridge } from '../events';
import Filter from 'bad-words';

const profanityFilter = new Filter();

export interface CreateRatingDto {
    bookingId: string;
    score: number;
    tags?: string[];
    comment?: string;
}

export class RatingService {
    /**
     * Submit a rating after a ride completion.
     */
    async createRating(userId: string, data: CreateRatingDto): Promise<IRating> {
        const { bookingId, score, tags, comment } = data;

        const booking = await Booking.findById(bookingId);
        if (!booking) throw new NotFoundError('Booking');

        if (booking.status !== BookingStatus.COMPLETED) {
            throw new AppError('Can only rate completed bookings', 400);
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

        // Profanity check
        let isFlagged = false;
        let flagReason: string | undefined;
        let sanitizedComment = comment;

        if (comment) {
            if (profanityFilter.isProfane(comment)) {
                isFlagged = true;
                flagReason = 'Profanity detected';
                sanitizedComment = profanityFilter.clean(comment);
            }
        }

        const rating = await Rating.create({
            booking: bookingId,
            ride: booking.ride,
            rater: userId,
            ratee: rateeId,
            raterRole,
            score,
            tags: tags || [],
            comment: sanitizedComment,
            isValidated: !isFlagged,
            isFlagged,
            flagReason,
        });

        // Update ratee's aggregate rating
        if (!isFlagged) {
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
        }

        EventBridge.publish('user-events', {
            eventType: 'rating.submitted',
            data: {
                ratingId: rating._id,
                bookingId,
                score,
                isFlagged,
            },
        });

        return rating;
    }

    /**
     * Get validated ratings for a specific user.
     */
    async getUserRatings(userId: string, page: number, limit: number): Promise<{ ratings: IRating[]; total: number }> {
        const ratings = await Rating.find({
            ratee: userId,
            isValidated: true,
        })
            .populate('rater', 'name profilePhotoUrl')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit);

        const total = await Rating.countDocuments({
            ratee: userId,
            isValidated: true,
        });

        return { ratings, total };
    }
}
