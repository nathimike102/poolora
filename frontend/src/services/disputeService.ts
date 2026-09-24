/**
 * Disputes: a rider or driver reports a problem with a booking, and the
 * Poolora team decides (see admin-web).
 */
import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import type { ApiResponse } from '../types/api';

export type DisputeCategory = 'payment' | 'cancellation' | 'behavior' | 'route' | 'quality';

export interface Dispute {
  _id: string;
  booking: string;
  category: DisputeCategory;
  description: string;
  status: 'open' | 'in_review' | 'resolved';
  decision?: { outcome: string; refundAmount: number; justification: string; decidedAt: string };
  createdAt: string;
}

export const disputeService = {
  async raise(data: { bookingId: string; category: DisputeCategory; description: string; evidenceUrls?: string[] }): Promise<Dispute> {
    const response = await apiClient.post<ApiResponse<Dispute>>(API_ENDPOINTS.disputes.create, data);
    return response.data.data;
  },

  async mine(): Promise<Dispute[]> {
    const response = await apiClient.get<ApiResponse<{ disputes: Dispute[] }>>(API_ENDPOINTS.disputes.mine);
    return response.data.data.disputes;
  },
};
