/**
 * What the rider pays for a booking: the fare less any part their company
 * pays (UC-C01). The server charges and refunds exactly this (riderPays in
 * the backend's utils/fares.ts), so screens show it from the booking itself.
 */
export function riderPays(booking: { estimatedFare?: number; finalFare?: number; companyShare?: number }): number {
  const fare = booking.finalFare ?? booking.estimatedFare ?? 0;
  return Math.round(Math.max(0, fare - (booking.companyShare ?? 0)) * 100) / 100;
}
