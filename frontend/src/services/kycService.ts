/**
 * services/kycService.ts
 *
 * Driver verification: uploads documents straight to storage with a
 * short-lived presigned policy from the backend, then submits the references.
 */

import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import { logger } from '../utils/logger';
import { submitKycToBackend } from './authService';
import type { ApiResponse, User, VehicleType } from '../types/api';

export type KycDocumentPurpose = 'licence' | 'registration' | 'insurance' | 'vehicle-photo';

export interface LocalFile {
  uri: string;
  mimeType: 'image/jpeg' | 'image/png' | 'application/pdf';
  name: string;
}

export interface KycSubmission {
  licenseNumber: string;
  vehicle: {
    make: string;
    model: string;
    year: number;
    color: string;
    plateNumber: string;
    vehicleType: VehicleType;
    hasAC: boolean;
  };
  licence: LocalFile;
  registration: LocalFile;
  insurance: LocalFile;
  vehiclePhoto: LocalFile;
}

async function uploadDocument(purpose: KycDocumentPurpose, file: LocalFile): Promise<string> {
  const { data } = await apiClient.post<
    ApiResponse<{ url: string; fields: Record<string, string>; fileUrl: string }>
  >(API_ENDPOINTS.uploads.kyc, { purpose, contentType: file.mimeType });
  const { url, fields, fileUrl } = data.data;

  const form = new FormData();
  Object.entries(fields).forEach(([k, v]) => form.append(k, v));
  // React Native's FormData accepts { uri, name, type } for files; the file must be the last field
  form.append('file', { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);

  const res = await fetch(url, { method: 'POST', body: form });
  if (!res.ok) {
    logger.error('KYC document upload failed', { purpose, status: res.status });
    throw new Error('A document could not be uploaded. Check the file is under 10 MB and try again.');
  }
  return fileUrl;
}

export const kycService = {
  async submit(input: KycSubmission, onProgress?: (done: number, total: number) => void): Promise<User> {
    const steps: [KycDocumentPurpose, LocalFile][] = [
      ['licence', input.licence],
      ['registration', input.registration],
      ['insurance', input.insurance],
      ['vehicle-photo', input.vehiclePhoto],
    ];
    const urls: string[] = [];
    for (const [i, [purpose, file]] of steps.entries()) {
      onProgress?.(i, steps.length);
      urls.push(await uploadDocument(purpose, file));
    }
    onProgress?.(steps.length, steps.length);

    const [licenceUrl, registrationUrl, insuranceUrl, photoUrl] = urls;
    return submitKycToBackend({
      licenseNumber: input.licenseNumber,
      drivingLicenseUrl: licenceUrl,
      vehicle: {
        ...input.vehicle,
        registrationDocUrl: registrationUrl,
        insuranceDocUrl: insuranceUrl,
        photos: [photoUrl],
      },
    });
  },
};
