/**
 * services/simulationService.ts
 *
 * Development ride simulator. A bot plays the other side of a ride and a
 * simulated car drives the route, so a whole trip can be tried on one phone.
 * The backend turns this off in production.
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import type { ApiResponse } from '../types/api';

export interface SimulatedRide {
  rideId: string;
  bookingId: string;
}

type Near = { lat: number; lng: number } | undefined;

export const simulationService = {
  /** Whether the server allows simulation; false when it cannot be reached. */
  async isEnabled(): Promise<boolean> {
    try {
      const response = await apiClient.get<ApiResponse<{ enabled: boolean }>>(API_ENDPOINTS.simulation.status, {
        noRetry: true,
      });
      return Boolean(response.data.data?.enabled);
    } catch {
      return false;
    }
  },

  /** A bot driver picks you up at `near` and drives you about 4 km. */
  async asRider(near: Near): Promise<SimulatedRide> {
    const response = await apiClient.post<ApiResponse<SimulatedRide>>(API_ENDPOINTS.simulation.asRider, near ?? {});
    return response.data.data;
  },

  /** A bot rider requests a seat on `rideId`, or on a new ride of yours from `near`. */
  async asDriver(near: Near, rideId?: string): Promise<SimulatedRide> {
    const response = await apiClient.post<ApiResponse<SimulatedRide>>(API_ENDPOINTS.simulation.asDriver, {
      ...near,
      rideId,
    });
    return response.data.data;
  },

  /** Drive your started ride along its route instead of using GPS. */
  async drive(rideId: string): Promise<{ estimatedSeconds: number }> {
    const response = await apiClient.post<ApiResponse<{ estimatedSeconds: number }>>(
      API_ENDPOINTS.simulation.drive(rideId),
      {},
    );
    return response.data.data;
  },

  async stop(rideId: string): Promise<void> {
    await apiClient.post(API_ENDPOINTS.simulation.stop(rideId), {});
  },
};
