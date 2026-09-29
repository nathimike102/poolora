/**
 * Parcels sent with a driver who is already making the trip (Phase 4,
 * UC-P01 to UC-P04). The sender pays when sending; the driver accepts,
 * picks up, and completes delivery with the code the recipient was given.
 */
import { apiClient } from '../api/axios';
import { API_ENDPOINTS } from '../api/constants';
import type { ApiResponse } from '../types/api';

export type ParcelType = 'document' | 'fragile' | 'perishable' | 'general';

export interface ParcelPlace {
  lat: number;
  lng: number;
  address: string;
  contactPerson: string;
  contactPhone: string;
}

export interface Parcel {
  _id: string;
  ride: string | { _id: string; pickup?: { address?: string }; dropoff?: { address?: string }; departureTime?: string; status?: string };
  sender: string | { _id: string; name?: string; phone?: string };
  driver: string | { _id: string; name?: string; phone?: string };
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  parcelWeight: number;
  parcelType: ParcelType;
  pickupLocation: { address: string; contactPerson: string; contactPhone: string };
  deliveryLocation: { address: string; contactPerson: string; contactPhone: string };
  estimatedDeliveryTime: string;
  actualPickupTime?: string;
  actualDeliveryTime?: string;
  estimatedCost: number;
  /** Declared value when the sender insured it */
  insuranceValue?: number;
  specialInstructions?: string;
  trackingNumber: string;
  paymentMethod?: 'wallet' | 'razorpay';
  paymentStatus?: 'unpaid' | 'authorized' | 'paid' | 'refunded' | 'refund_failed';
  refundAmount?: number;
  driverEarnings?: number;
  cancellationReason?: string;
  createdAt: string;
}

/** What the sender filled in, carried to the ride choice */
export interface ParcelDraft {
  pickupLocation: ParcelPlace;
  deliveryLocation: ParcelPlace;
  /** When the parcel should leave, ISO */
  departureTime: string;
  parcelWeight: number;
  parcelType: ParcelType;
  specialInstructions?: string;
  useWallet: boolean;
}

export interface CreateParcelResult {
  parcel: Parcel;
  /** Present when paying by card or UPI */
  razorpayOrder?: { id: string; amount: number } | null;
  razorpayKeyId?: string;
  /** Shown once: the recipient gives it to the driver on delivery */
  deliveryOtp: string;
}

/** Where a parcel is, in words */
export function parcelStage(p: Parcel): { label: string; step: number } {
  if (p.status === 'cancelled') return { label: 'Cancelled', step: -1 };
  if (p.status === 'completed') return { label: 'Delivered', step: 3 };
  if (p.actualPickupTime) return { label: 'On the way', step: 2 };
  if (p.status === 'confirmed') return { label: 'Accepted, waiting for pickup', step: 1 };
  if (p.paymentStatus === 'unpaid') return { label: 'Waiting for payment', step: 0 };
  return { label: 'Waiting for the driver to accept', step: 0 };
}

export interface ParcelPhoto {
  id: string;
  stage: 'pickup' | 'delivery' | 'claim';
  takenAt: string;
  /** API path of the image; needs the signed-in user's token */
  path: string;
}

export interface ParcelClaim {
  _id: string;
  kind: 'damaged' | 'lost';
  amountClaimed: number;
  coverLimit: number;
  status: 'submitted' | 'with_insurer' | 'approved' | 'rejected';
  payout?: number;
  decisionNote?: string;
  createdAt: string;
}

export const parcelService = {
  /** The price before sending */
  async quote(from: { lat: number; lng: number }, to: { lat: number; lng: number }, weight: number): Promise<{ total: number; distanceKm: number }> {
    const response = await apiClient.get<ApiResponse<{ total: number; distanceKm: number }>>(API_ENDPOINTS.parcels.quote, {
      params: { pickupLat: from.lat, pickupLng: from.lng, deliveryLat: to.lat, deliveryLng: to.lng, weight },
    });
    return response.data.data;
  },

  async create(data: {
    rideId: string;
    parcelWeight: number;
    parcelType: ParcelType;
    pickupLocation: ParcelPlace;
    deliveryLocation: ParcelPlace;
    estimatedDeliveryTime: string;
    specialInstructions?: string;
    useWallet: boolean;
  }): Promise<CreateParcelResult> {
    const response = await apiClient.post<ApiResponse<CreateParcelResult>>(API_ENDPOINTS.parcels.create, data);
    return response.data.data;
  },

  async list(role: 'sender' | 'driver' | 'receiver' = 'sender', rideId?: string): Promise<Parcel[]> {
    const response = await apiClient.get<ApiResponse<{ parcels: Parcel[] }>>(API_ENDPOINTS.parcels.list, { params: { role, rideId, limit: 50 } });
    return response.data.data.parcels;
  },

  async track(trackingNumber: string): Promise<Parcel> {
    const response = await apiClient.get<ApiResponse<{ parcel: Parcel }>>(API_ENDPOINTS.parcels.track(trackingNumber));
    return response.data.data.parcel;
  },

  async cancel(id: string, reason?: string): Promise<Parcel> {
    const response = await apiClient.post<ApiResponse<{ parcel: Parcel }>>(API_ENDPOINTS.parcels.cancel(id), { reason });
    return response.data.data.parcel;
  },

  async accept(id: string): Promise<Parcel> {
    const response = await apiClient.post<ApiResponse<{ parcel: Parcel }>>(API_ENDPOINTS.parcels.accept(id), {});
    return response.data.data.parcel;
  },

  async reject(id: string): Promise<Parcel> {
    const response = await apiClient.post<ApiResponse<{ parcel: Parcel }>>(API_ENDPOINTS.parcels.reject(id), {});
    return response.data.data.parcel;
  },

  async pickup(id: string): Promise<Parcel> {
    const response = await apiClient.post<ApiResponse<{ parcel: Parcel }>>(API_ENDPOINTS.parcels.pickup(id), {});
    return response.data.data.parcel;
  },

  /** A photo as evidence: the driver at pickup or delivery (UC-P03), or for a claim (UC-P05) */
  async addPhoto(id: string, stage: 'pickup' | 'delivery' | 'claim', base64: string, at?: { lat: number; lng: number }): Promise<ParcelPhoto> {
    const response = await apiClient.post<ApiResponse<{ photo: ParcelPhoto }>>(API_ENDPOINTS.parcels.photos(id), { stage, data: base64, ...at }, { timeout: 60_000 });
    return response.data.data.photo;
  },

  async photos(id: string): Promise<ParcelPhoto[]> {
    const response = await apiClient.get<ApiResponse<{ photos: ParcelPhoto[] }>>(API_ENDPOINTS.parcels.photos(id));
    return response.data.data.photos;
  },

  async claims(id: string): Promise<ParcelClaim[]> {
    const response = await apiClient.get<ApiResponse<{ claims: ParcelClaim[] }>>(API_ENDPOINTS.parcels.claims(id));
    return response.data.data.claims;
  },

  async fileClaim(id: string, claim: { kind: 'damaged' | 'lost'; description: string; amount: number; photoIds: string[] }): Promise<ParcelClaim> {
    const response = await apiClient.post<ApiResponse<{ claim: ParcelClaim }>>(API_ENDPOINTS.parcels.claims(id), claim);
    return response.data.data.claim;
  },

  /** `signature` is the recipient's name as they confirm receipt */
  async deliver(id: string, otp: string, signature: string): Promise<Parcel> {
    const response = await apiClient.post<ApiResponse<{ parcel: Parcel }>>(API_ENDPOINTS.parcels.deliver(id), { proof: { otp, signature } });
    return response.data.data.parcel;
  },
};
