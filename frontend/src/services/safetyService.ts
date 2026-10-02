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

export type SOSThreat = 'driver' | 'passenger' | 'outside' | 'medical' | 'accident' | 'other';

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
  /**
   * Contacts are texted at contactsDueAt, after a window to cancel an
   * accidental SOS; the safety team is alerted at once.
   */
  contactsState?: 'pending' | 'sending' | 'sent' | 'unavailable' | 'none' | 'cancelled';
  contactsDueAt?: string;
  /** The user said they are safe; the safety team still confirms and closes it */
  userSafeAt?: string;
  cancelledAt?: string;
  threat?: SOSThreat;
  resolvedAt?: string;
  /** Live video to the safety team (UC-X04) */
  video?: { requestedAt?: string; startedAt?: string; endedAt?: string; recording: boolean };
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
  _id?: string;
  name: string;
  phone: string;
  relation: string;
  email?: string;
  /** The first person to call; exactly one contact is primary */
  primary?: boolean;
  /** Gets the SOS text (default true) */
  notifyOnSos?: boolean;
  /** Confirmed by the link in the verification text (UC-R10) */
  verified?: boolean;
  verificationSentAt?: string;
}

/**
 * Service for safety operations
 */
export const safetyService = {
  /**
   * Trigger SOS alert
   */
  async triggerSOS(bookingId: string, location: { lat: number; lng: number } | null): Promise<SOSResponse> {
    try {
      const response = await apiClient.post<ApiResponse<{ emergency: SOSResponse }>>(
        API_ENDPOINTS.safety.triggerSos,
        // Without a position the server uses the car's last one; the alert still goes
        location ? { bookingId, location } : { bookingId },
      );
      logger.info('SOS triggered');
      return response.data.data.emergency;
    } catch (error) {
      logger.error('Failed to trigger SOS', { error });
      throw error;
    }
  },

  /** The caller's open SOS, if any, or else the booking an SOS would be about. */
  async getCurrentSOS(): Promise<{ sos: SOSResponse | null; bookingId: string | null; videoAvailable?: boolean; videoRecorded?: boolean }> {
    const response = await apiClient.get<ApiResponse<{ sos: SOSResponse | null; bookingId: string | null; videoAvailable?: boolean; videoRecorded?: boolean }>>(API_ENDPOINTS.safety.currentSos);
    return response.data.data;
  },

  /** "What's happening?": who or what the danger is, after the alert has gone */
  async setSOSThreat(sosId: string, threat: SOSThreat): Promise<SOSResponse> {
    const response = await apiClient.post<ApiResponse<{ emergency: SOSResponse }>>(API_ENDPOINTS.safety.sosDetails(sosId), { threat });
    return response.data.data.emergency;
  },

  /** Cancel an accidental SOS before emergency contacts are texted. */
  async cancelSOS(sosId: string): Promise<SOSResponse> {
    const response = await apiClient.post<ApiResponse<{ emergency: SOSResponse }>>(API_ENDPOINTS.safety.cancelSos(sosId), {});
    return response.data.data.emergency;
  },

  /**
   * Push the user's current position to an active SOS.
   */
  async updateSOSLocation(sosId: string, location: { lat: number; lng: number }, battery?: number): Promise<void> {
    try {
      await apiClient.post(API_ENDPOINTS.safety.updateSosLocation(sosId), { location, battery });
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
   * Answer an in-ride "Are you OK?" prompt. "help" raises an SOS at once.
   */
  async answerRideCheckIn(bookingId: string, status: 'ok' | 'help', location?: { lat: number; lng: number }): Promise<{ status: string; emergencyId?: string }> {
    const response = await apiClient.post<ApiResponse<{ status: string; emergencyId?: string }>>(API_ENDPOINTS.safety.rideCheckIn, { bookingId, status, location });
    return response.data.data;
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
      // Only what the user edits; verification is kept by the server for unchanged numbers
      const body = contacts.map(({ name, phone, relation, email, primary, notifyOnSos }) => ({
        name, phone, relation, email: email || undefined, primary: Boolean(primary), notifyOnSos: notifyOnSos !== false,
      }));
      const response = await apiClient.put<ApiResponse<{ contacts: EmergencyContact[] }>>(
        API_ENDPOINTS.safety.emergencyContacts,
        { contacts: body },
      );
      logger.info('Emergency contacts updated');
      return response.data.data.contacts;
    } catch (error) {
      logger.error('Failed to update emergency contacts', { error });
      throw error;
    }
  },

  /** Texts the contact a link to confirm they agree to be called (UC-R10) */
  async verifyEmergencyContact(contactId: string): Promise<{ sentTo: string }> {
    const response = await apiClient.post<ApiResponse<{ sentTo: string }>>(API_ENDPOINTS.safety.verifyEmergencyContact(contactId), {});
    return response.data.data;
  },
};
