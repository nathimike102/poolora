/**
 * services/identityService.ts
 *
 * The identity check behind women-only rides: a photo of an ID document and
 * a selfie, uploaded privately and reviewed by an admin, who confirms the
 * person and their gender.
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import type { ApiResponse } from '../types/api';
import { uploadDocument, type LocalFile } from './kycService';

export type Gender = 'female' | 'male' | 'other';

export interface IdentityStatus {
  status: 'none' | 'pending' | 'verified' | 'rejected';
  gender: Gender | null;
  declaredGender: Gender | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
}

/** The server's refusals for women-only rides; the app offers the identity check for these */
export const IDENTITY_ERRORS = ['IDENTITY_NOT_VERIFIED', 'IDENTITY_PENDING'];

export const identityService = {
  async status(): Promise<IdentityStatus> {
    const { data } = await apiClient.get<ApiResponse<{ identity: IdentityStatus }>>(API_ENDPOINTS.users.identity);
    return data.data.identity;
  },

  async submit(input: { gender: Gender; document: LocalFile; selfie: LocalFile }): Promise<IdentityStatus> {
    const documentUrl = await uploadDocument('identity', input.document);
    const selfieUrl = await uploadDocument('selfie', input.selfie);
    const { data } = await apiClient.post<ApiResponse<{ identity: IdentityStatus }>>(API_ENDPOINTS.users.identity, {
      gender: input.gender,
      documentUrl,
      selfieUrl,
    });
    return data.data.identity;
  },
};
