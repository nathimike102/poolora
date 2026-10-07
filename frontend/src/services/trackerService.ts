/**
 * services/trackerService.ts
 *
 * A GPS tracker fitted in the driver's car, linked by its device id. It
 * reports to Siham's tracker gateway and keeps the car traceable during a
 * ride even when every phone in it is off. Outside rides Siham keeps only
 * when it last reported, never where the car was.
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import type { ApiResponse } from '../types/api';

export interface TrackerStatus {
  /** Where to point a tracker; null until the gateway is set up */
  gateway: { host: string; port: number; protocol: string } | null;
  vehicles: Array<{
    _id: string;
    name: string;
    plateNumber: string;
    tracker: { deviceId: string; linkedAt: string; lastReportAt: string | null; tracked: boolean } | null;
  }>;
}

export const trackerService = {
  async status(): Promise<TrackerStatus> {
    const { data } = await apiClient.get<ApiResponse<TrackerStatus>>(API_ENDPOINTS.users.trackers);
    return data.data;
  },
  async link(vehicleId: string, deviceId: string): Promise<TrackerStatus> {
    const { data } = await apiClient.put<ApiResponse<TrackerStatus>>(API_ENDPOINTS.users.vehicleTracker(vehicleId), { deviceId });
    return data.data;
  },
  async unlink(vehicleId: string): Promise<TrackerStatus> {
    const { data } = await apiClient.delete<ApiResponse<TrackerStatus>>(API_ENDPOINTS.users.vehicleTracker(vehicleId));
    return data.data;
  },
};
