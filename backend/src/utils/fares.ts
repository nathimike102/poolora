/**
 * utils/fares.ts
 *
 * What the rider pays for a booking. A company may pay part of the fare
 * (UC-C01); every charge, refund and cancellation split works on the
 * rider's own part, and the company is billed its part only for trips that
 * complete.
 */

export const round2 = (n: number) => Math.round(n * 100) / 100;

export function riderPays(booking: { estimatedFare: number; companyShare?: number }): number {
  return round2(Math.max(0, booking.estimatedFare - (booking.companyShare ?? 0)));
}
