/**
 * utils/ratingScore.ts
 *
 * The rating people see. Everyone starts at 5 stars and no score can go above
 * 5. Each rating moves the score only part of the way, so one unhappy rider or
 * driver cannot sink someone, while a pattern of low ratings still shows.
 *
 *   score = (PRIOR × 5 + sum of ratings) / (PRIOR + number of ratings)
 *
 * It is the plain average with PRIOR five-star ratings counted in first. With
 * PRIOR = 10, a first 1-star rating takes a new driver from 5.0 to 4.64, the
 * same rating after 50 five-star trips takes them to 4.93, and a driver rated
 * 1 star on every trip still falls below 2 after 40 trips.
 *
 * The stored stats.avgRatingAs* is this score. The plain average is kept as
 * stats.ratingSumAs* and the count, for rules that need the real average.
 */

export const MAX_RATING = 5;
/** Five-star ratings everyone starts with */
export const RATING_PRIOR_COUNT = 10;

export type RatingRole = 'Driver' | 'Rider' | 'Organizer';

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The score shown for a sum of ratings over a number of ratings */
export function ratingScore(sum: number, count: number): number {
  return round2((RATING_PRIOR_COUNT * MAX_RATING + sum) / (RATING_PRIOR_COUNT + count));
}

type Stats = Partial<Record<`avgRatingAs${RatingRole}` | `totalRatingsAs${RatingRole}` | `ratingSumAs${RatingRole}`, number>>;

/**
 * The sum of someone's ratings. Accounts rated before the sum was stored kept
 * the plain average in avgRatingAs*, so for them it is average × count.
 */
export function ratingSum(stats: Stats | undefined, role: RatingRole): number {
  const sum = stats?.[`ratingSumAs${role}`];
  if (typeof sum === 'number') return sum;
  return (stats?.[`avgRatingAs${role}`] ?? 0) * (stats?.[`totalRatingsAs${role}`] ?? 0);
}

/** The plain average, for rules such as the verified-driver badge; 0 when unrated */
export function plainAverage(stats: Stats | undefined, role: RatingRole): number {
  const count = stats?.[`totalRatingsAs${role}`] ?? 0;
  return count ? round2(ratingSum(stats, role) / count) : 0;
}

/**
 * An update pipeline that adds one rating and recomputes the score in a single
 * step on the server, so two ratings arriving together are both counted.
 */
export function addRatingPipeline(role: RatingRole, score: number) {
  const count = { $ifNull: [`$stats.totalRatingsAs${role}`, 0] };
  const sum = { $ifNull: [`$stats.ratingSumAs${role}`, { $multiply: [{ $ifNull: [`$stats.avgRatingAs${role}`, 0] }, count] }] };
  const newSum = { $add: [sum, score] };
  const newCount = { $add: [count, 1] };
  return [
    {
      $set: {
        [`stats.ratingSumAs${role}`]: newSum,
        [`stats.totalRatingsAs${role}`]: newCount,
        [`stats.avgRatingAs${role}`]: {
          $round: [{ $divide: [{ $add: [RATING_PRIOR_COUNT * MAX_RATING, newSum] }, { $add: [RATING_PRIOR_COUNT, newCount] }] }, 2],
        },
      },
    },
  ];
}

/**
 * Moves accounts rated before scores to the score: keeps the sum of their
 * ratings and replaces the plain average with the score. Accounts never rated
 * start at 5. Safe to run again: accounts that already have a sum are skipped.
 */
export async function backfillRatingScores(): Promise<number> {
  const { User } = await import('../models/User');
  let updated = 0;
  for (const role of ['Driver', 'Rider', 'Organizer'] as RatingRole[]) {
    const count = { $ifNull: [`$stats.totalRatingsAs${role}`, 0] };
    const sum = { $multiply: [{ $ifNull: [`$stats.avgRatingAs${role}`, 0] }, count] };
    const result = await User.updateMany({ [`stats.ratingSumAs${role}`]: { $exists: false } }, [
      {
        $set: {
          [`stats.ratingSumAs${role}`]: sum,
          [`stats.avgRatingAs${role}`]: {
            $round: [{ $divide: [{ $add: [RATING_PRIOR_COUNT * MAX_RATING, sum] }, { $add: [RATING_PRIOR_COUNT, count] }] }, 2],
          },
        },
      },
    ]);
    updated += result.modifiedCount;
  }
  return updated;
}
