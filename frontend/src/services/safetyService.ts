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
  riskLevel?: 'low' | 'medium' | 'high';
  monitoringState?: 'active' | 'escalated' | 'resolved';
  checkInIntervalSeconds?: number;
  lastCheckInAt?: string;
  nextCheckInAt?: string;
  missedCheckIns?: number;
  escalatedAt?: string;
  escalationReason?: string;
  triggerLocation?: { type: string; coordinates: [number, number] };
  locationHistory?: Array<{ location: { type: string; coordinates: [number, number] }; timestamp: string }>;
  timeline?: Array<{ event: string; timestamp: string; details?: string }>;
  liveTrackingUrl?: string;
  /** Contacts whose SMS was accepted by the provider. Empty if none could be reached. */
  emergencyContactsNotified?: Array<{ name: string; phone: string; notifiedAt: string }>;
}

export interface IncidentData {
  id: string;
  userId: string;
  userName: string;
  status: 'triggered' | 'acknowledged' | 'resolved' | 'false_alarm';
  location: { lat: number; lng: number };
  timestamp: Date;
  bookingId: string;
}

/** An EmergencyRecord as GET /safety/sos/active returns it. */
interface EmergencyRecordResponse {
  _id: string;
  status: IncidentData['status'];
  triggeredBy?: { _id: string; name?: string } | string;
  booking?: { _id: string } | string;
  triggerLocation?: { coordinates?: [number, number] };
  createdAt?: string;
}

function refId(ref: { _id: string } | string | undefined): string {
  return typeof ref === 'string' ? ref : ref?._id ?? '';
}

function toIncident(record: EmergencyRecordResponse): IncidentData {
  const [lng, lat] = record.triggerLocation?.coordinates ?? [0, 0];
  const user = record.triggeredBy;
  return {
    id: record._id,
    userId: refId(user),
    userName: typeof user === 'object' ? user.name ?? '' : '',
    status: record.status,
    location: { lat, lng },
    timestamp: new Date(record.createdAt ?? Date.now()),
    bookingId: refId(record.booking),
  };
}

export interface EmergencyContact {
  name: string;
  phone: string;
  relation: string;
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
      const response = await apiClient.post<ApiResponse<{ emergency: SOSResponse }>>(
        API_ENDPOINTS.safety.triggerSos,
        { bookingId, location },
      );
      logger.info('SOS triggered');
      return response.data.data.emergency;
    } catch (error) {
      logger.error('Failed to trigger SOS', { error });
      throw error;
    }
  },

  /**
   * Push the user's current position to an active SOS.
   */
  async updateSOSLocation(sosId: string, location: { lat: number; lng: number }): Promise<void> {
    try {
      await apiClient.post(API_ENDPOINTS.safety.updateSosLocation(sosId), { location });
    } catch (error) {
      logger.error('Failed to update SOS location', { sosId, error });
      throw error;
    }
  },

  /**
   * Send a user safety check-in for an active SOS session.
   */
  async updateSOSCheckIn(
    sosId: string,
    status: 'ok' | 'partial_ok' | 'not_ok',
    notes?: string,
    location?: { lat: number; lng: number },
  ): Promise<SOSResponse> {
    try {
      const response = await apiClient.post<ApiResponse<{ emergency: SOSResponse }>>(
        API_ENDPOINTS.safety.checkIn(sosId),
        { status, notes, location },
      );
      logger.info('SOS check-in sent', { sosId, status });
      return response.data.data.emergency;
    } catch (error) {
      logger.error('Failed to send SOS check-in', { sosId, status, error });
      throw error;
    }
  },

  /**
   * Get SOS status by emergency record ID
   */
  async getSOSStatus(sosId: string): Promise<SOSResponse> {
    try {
      const response = await apiClient.get<ApiResponse<{ emergency: SOSResponse }>>(
        API_ENDPOINTS.safety.sosStatus(sosId),
      );
      logger.info('SOS status fetched', { sosId });
      return response.data.data.emergency;
    } catch (error) {
      logger.error('Failed to get SOS status', { sosId, error });
      throw error;
    }
  },

  /**
   * Get active SOS incidents (admin only)
   */
  async getActiveIncidents(): Promise<IncidentData[]> {
    try {
      const response = await apiClient.get<ApiResponse<{ records: EmergencyRecordResponse[]; total: number }>>(
        API_ENDPOINTS.safety.activeIncidents,
      );
      logger.info('Active incidents fetched');
      return response.data.data.records.map(toIncident);
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
      await apiClient.post(API_ENDPOINTS.safety.acknowledge(incidentId));
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
      await apiClient.post(API_ENDPOINTS.safety.resolve(incidentId), {
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
   * Notify police for an incident (admin only)
   */
  async notifyPolice(incidentId: string, notes?: string): Promise<void> {
    try {
      await apiClient.post(API_ENDPOINTS.safety.notifyPolice(incidentId), { notes });
      logger.info('Police notified for incident', { incidentId });
    } catch (error) {
      logger.error('Failed to notify police', { incidentId, error });
      throw error;
    }
  },

  /**
   * Get emergency contacts for the authenticated user
   */
  async getEmergencyContacts(): Promise<EmergencyContact[]> {
    try {
      const response = await apiClient.get<ApiResponse<{ contacts: EmergencyContact[] }>>(
        API_ENDPOINTS.safety.emergencyContacts,
      );
      logger.info('Emergency contacts fetched');
      return response.data.data.contacts;
    } catch (error) {
      logger.error('Failed to fetch emergency contacts', { error });
      throw error;
    }
  },

  /**
   * Update emergency contacts for the authenticated user
   */
  async updateEmergencyContacts(contacts: EmergencyContact[]): Promise<EmergencyContact[]> {
    try {
      const response = await apiClient.put<ApiResponse<{ contacts: EmergencyContact[] }>>(
        API_ENDPOINTS.safety.emergencyContacts,
        { contacts },
      );
      logger.info('Emergency contacts updated');
      return response.data.data.contacts;
    } catch (error) {
      logger.error('Failed to update emergency contacts', { error });
      throw error;
    }
  },
};
