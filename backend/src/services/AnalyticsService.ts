import { Ride } from '../models/Ride';
import { mlClient } from '../utils/mlClient';
import { logger } from '../utils/logger';
import { AppError } from '../utils/AppError';

export class AnalyticsService {
  /**
   * Get demand prediction for a specific area.
   * Calls the AI microservice.
   */
  async getDemandPrediction(lat: number, lng: number): Promise<any> {
    try {
      const response = await mlClient.post('/api/predict-demand', {
        lat,
        lng,
        hour: new Date().getHours(),
        day_of_week: new Date().getDay(),
        historical_rides: await this.getHistoricalRideCount(lat, lng),
      });

      return response.data;
    } catch (error) {
      logger.error('Demand prediction failed', { error: (error as Error).message });
      throw new AppError('Analytics service unavailable', 503);
    }
  }

  /**
   * Perform geospatial clustering of active rides.
   * Useful for identifying high-demand "heat" zones.
   */
  async getRideClusters(lat: number, lng: number, radiusKm: number = 10): Promise<any> {
    // Simple implementation using MongoDB geospatial aggregation
    const clusters = await Ride.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [lng, lat] },
          distanceField: 'distance',
          maxDistance: radiusKm * 1000,
          spherical: true,
          query: { status: 'scheduled' },
        },
      },
      {
        $group: {
          _id: {
            $concat: [
              { $toString: { $round: [{ $arrayElemAt: ['$pickup.location.coordinates', 1] }, 2] } },
              ',',
              { $toString: { $round: [{ $arrayElemAt: ['$pickup.location.coordinates', 0] }, 2] } },
            ],
          },
          count: { $sum: 1 },
          avgPrice: { $avg: '$pricePerSeat' },
          center: { $first: '$pickup.location.coordinates' },
        },
      },
      { $match: { count: { $gte: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    return clusters.map((c) => ({
      location: { lat: c.center[1], lng: c.center[0] },
      density: c.count,
      avgPrice: Math.round(c.avgPrice),
    }));
  }

  private async getHistoricalRideCount(lat: number, lng: number): Promise<number> {
    // Count rides in last 30 days within 5km
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    return Ride.countDocuments({
      'pickup.location': {
        $near: {
          $geometry: { type: 'Point', coordinates: [lng, lat] },
          $maxDistance: 5000,
        },
      },
      createdAt: { $gte: thirtyDaysAgo },
    });
  }
}
