/**
 * backfillRouteLines.ts
 *
 * Search matches riders anywhere along a ride's route using `routeLine`, a
 * GeoJSON copy of the route. Rides saved before that field existed do not
 * have it and would not show up in search, so it is filled in once at
 * startup for every ride that can still be booked. New rides get it from the
 * Ride model's save hook.
 */

import { Ride, rideRouteLine } from '../models/Ride';
import { RideStatus } from '../types';
import { logger } from '../utils/logger';

export async function backfillRouteLines(): Promise<number> {
  const rides = await Ride.find({
    status: { $in: [RideStatus.SCHEDULED, RideStatus.ACTIVE, RideStatus.IN_PROGRESS] },
    'routeLine.coordinates.1': { $exists: false },
  })
    .select('routePolyline pickup dropoff waypoints')
    .lean();

  let updated = 0;
  for (const ride of rides) {
    const routeLine = rideRouteLine(ride);
    if (!routeLine) continue;
    await Ride.updateOne({ _id: ride._id }, { $set: { routeLine } });
    updated++;
  }
  if (updated > 0) logger.info('Backfilled ride routes for search', { updated });
  return updated;
}
