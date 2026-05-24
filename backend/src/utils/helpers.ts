import { Response } from 'express';
import crypto from 'crypto';
import { ApiResponse, PaginatedResult, GeoPoint } from '../types';

export function sendSuccess<T>(
  res: Response,
  data: T,
  code = 200,
  requestId = '',
): void {
  const response: ApiResponse<T> = {
    status: 'success',
    code,
    data,
    timestamp: new Date().toISOString(),
    requestId,
  };
  res.status(code).json(response);
}

export function sendPaginated<T>(
  res: Response,
  result: PaginatedResult<T>,
  requestId = '',
): void {
  const response: ApiResponse<PaginatedResult<T>> = {
    status: 'success',
    code: 200,
    data: result,
    timestamp: new Date().toISOString(),
    requestId,
  };
  res.status(200).json(response);
}

export function sendError(
  res: Response,
  message: string,
  code = 500,
  details?: unknown,
  requestId = '',
): void {
  const response: ApiResponse = {
    status: 'error',
    code,
    error: {
      id: code.toString(),
      message,
      details,
    },
    timestamp: new Date().toISOString(),
    requestId,
  };
  res.status(code).json(response);
}

export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResult<T> {
  const totalPages = Math.ceil(total / limit);
  return {
    items,
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

export function toGeoPoint(lng: number, lat: number): GeoPoint {
  return { type: 'Point', coordinates: [lng, lat] };
}

export function haversineDistanceKm(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

export function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString();
}

export function minutesBetween(d1: Date, d2: Date): number {
  return Math.abs(d1.getTime() - d2.getTime()) / 60000;
}

export function generateTrackingNumber(): string {
  const prefix = 'TRK';
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
}

export function generateReferralCode(): string {
  return crypto.randomBytes(6).toString('hex').toUpperCase();
}

/**
 * Executes an async function with exponential backoff retry.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delay = 1000,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries <= 0) throw error;
    await new Promise((resolve) => setTimeout(resolve, delay));
    return withRetry(fn, retries - 1, delay * 2);
  }
}
