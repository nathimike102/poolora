/**
 * Ride alerts: "tell me when a ride appears on this route". The server
 * checks every new ride and sends a push when one passes both stops.
 */
import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import type { ApiResponse } from '../types/api';

type Stop = { lat: number; lng: number; address: string };

export interface RideAlert {
  _id: string;
  pickup: { address: string };
  dropoff: { address: string };
  departureTime?: string;
  expiresAt: string;
}

export const rideAlertService = {
  /** `departureTime` limits the alert to rides within 3 hours of it; without it the alert lasts 30 days */
  async create(pickup: Stop, dropoff: Stop, departureTime?: string): Promise<RideAlert> {
    const response = await apiClient.post<ApiResponse<{ alert: RideAlert }>>(API_ENDPOINTS.rideAlerts.base, { pickup, dropoff, departureTime });
    return response.data.data.alert;
  },
  async list(): Promise<RideAlert[]> {
    const response = await apiClient.get<ApiResponse<{ alerts: RideAlert[] }>>(API_ENDPOINTS.rideAlerts.base);
    return response.data.data.alerts;
  },
  async remove(id: string): Promise<void> {
    await apiClient.delete(API_ENDPOINTS.rideAlerts.one(id));
  },
};
