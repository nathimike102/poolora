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

export interface IncidentData {
  id: string;
  userId: string;
  userName: string;
  status: 'triggered' | 'acknowledged' | 'resolved';
  location: { lat: number; lng: number };
  timestamp: Date;
  bookingId: string;
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
   * Get active SOS incidents (admin only)
   */
  async getActiveIncidents(): Promise<IncidentData[]> {
    try {
      const response = await apiClient.get<ApiResponse<{ incidents: IncidentData[] }>>(
        '/api/v1/safety/sos/active',
      );
      logger.info('Active incidents fetched');
      return response.data.data.incidents;
    } catch (error) {
      logger.error('Failed to fetch active incidents', { error });
      throw error;
    }
  },

  /**
   * Acknowledge SOS incident (admin only)
   */
  async acknowledgeIncident(incidentId: string): Promise<void> {
    try {
      await apiClient.post(`/api/v1/safety/sos/${incidentId}/acknowledge`);
      logger.info('SOS acknowledged', { incidentId });
    } catch (error) {
      logger.error('Failed to acknowledge SOS', { incidentId, error });
      throw error;
    }
  },

  /**
   * Resolve SOS incident (admin only)
   */
  async resolveIncident(
    incidentId: string,
    notes?: string,
    isFalseAlarm?: boolean,
  ): Promise<void> {
    try {
      await apiClient.post(`/api/v1/safety/sos/${incidentId}/resolve`, {
        notes,
        isFalseAlarm,
      });
      logger.info('SOS resolved', { incidentId });
    } catch (error) {
      logger.error('Failed to resolve SOS', { incidentId, error });
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
