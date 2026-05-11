/**
 * services/safetyService.ts
 *
 * Safety and SOS operations API integration
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import { logger } from '../utils/logger';
import type { ApiResponse } from '../types/api';

export interface SOSRequest {
  location: { lat: number; lng: number };
  reason?: string;
  emergencyContacts?: string[]; // contact IDs
}

export interface SOSResponse {
  _id: string;
  status: string;
  location: { lat: number; lng: number };
  createdAt: string;
}

/**
 * Service for safety operations
 */
export const safetyService = {
  /**
   * Trigger SOS alert
   */
  async triggerSOS(bookingId: string, location: { lat: number; lng: number }): Promise<SOSResponse> {
    try {
      const response = await apiClient.post<ApiResponse<{ incident: SOSResponse }>>(
        API_ENDPOINTS.safety.triggerSos,
        { bookingId, location },
      );
      logger.info('SOS triggered');
      return response.data.data.incident;
    } catch (error) {
      logger.error('Failed to trigger SOS', { error });
      throw error;
    }
  },

  /**
   * Get SOS status
   */
  async getSOSStatus(_sosId: string): Promise<SOSResponse> {
    throw new Error('Direct SOS status endpoint is not available in the current backend API.');
  },

  /**
   * Get emergency contacts
   */
  async getEmergencyContacts(): Promise<unknown[]> {
    throw new Error('Emergency contacts endpoint is not available in the current backend API.');
  },
};
