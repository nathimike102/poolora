/** Appeals against a suspension or block (UC-A05 3a) */
import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import type { ApiResponse } from '../types/api';

export interface Appeal {
  _id: string;
  kind: 'suspension' | 'block';
  message: string;
  status: 'open' | 'upheld' | 'overturned';
  decisionNote?: string;
  createdAt: string;
  decidedAt?: string;
}

export interface AccountStanding {
  status: 'active' | 'suspended' | 'blocked';
  reason?: string;
  suspendedUntil?: string;
  appealDeadline?: string;
  canAppeal: boolean;
  appeals: Appeal[];
}

export const appealService = {
  mine: () => apiClient.get<ApiResponse<AccountStanding>>(API_ENDPOINTS.appeals.mine).then(r => r.data.data),
  file: (message: string) =>
    apiClient.post<ApiResponse<{ appeal: Appeal }>>(API_ENDPOINTS.appeals.base, { message }).then(r => r.data.data.appeal),
};
