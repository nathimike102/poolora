/**
 * Help and support requests (UC-X02). The Poolora team answers in the same
 * thread; safety and payment requests are answered first.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import type { ApiResponse } from '../types/api';

export type SupportCategory = 'account' | 'payment' | 'dispute' | 'technical' | 'safety' | 'feature' | 'feedback';

export interface SupportTicket {
  _id: string;
  category: SupportCategory;
  subject: string;
  booking?: string;
  status: 'open' | 'answered' | 'closed';
  priority: 'urgent' | 'normal';
  messages: Array<{ from: 'user' | 'support'; text: string; at: string }>;
  createdAt: string;
  updatedAt: string;
}

export const supportService = {
  async create(data: { category: SupportCategory; subject: string; message: string; bookingId?: string }): Promise<SupportTicket> {
    const appInfo = `${Platform.OS} ${Platform.Version} · app ${Constants.expoConfig?.version ?? '?'}`;
    const response = await apiClient.post<ApiResponse<{ ticket: SupportTicket }>>(API_ENDPOINTS.support.tickets, { ...data, appInfo });
    return response.data.data.ticket;
  },

  async mine(): Promise<SupportTicket[]> {
    const response = await apiClient.get<ApiResponse<{ tickets: SupportTicket[] }>>(API_ENDPOINTS.support.tickets);
    return response.data.data.tickets;
  },

  async get(id: string): Promise<SupportTicket> {
    const response = await apiClient.get<ApiResponse<{ ticket: SupportTicket }>>(API_ENDPOINTS.support.ticket(id));
    return response.data.data.ticket;
  },

  async reply(id: string, text: string): Promise<SupportTicket> {
    const response = await apiClient.post<ApiResponse<{ ticket: SupportTicket }>>(API_ENDPOINTS.support.reply(id), { text });
    return response.data.data.ticket;
  },
};
