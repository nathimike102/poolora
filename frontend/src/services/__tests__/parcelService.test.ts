import { parcelStage, type Parcel } from '../parcelService';

const base = { status: 'pending', paymentStatus: 'paid' } as Parcel;

describe('parcelStage', () => {
  test('follows a parcel from payment to delivery', () => {
    expect(parcelStage({ ...base, paymentStatus: 'unpaid' })).toEqual({ label: 'Waiting for payment', step: 0 });
    expect(parcelStage(base).label).toBe('Waiting for the driver to accept');
    expect(parcelStage({ ...base, status: 'confirmed' }).step).toBe(1);
    expect(parcelStage({ ...base, status: 'confirmed', actualPickupTime: '2026-09-24T10:00:00Z' })).toEqual({ label: 'On the way', step: 2 });
    expect(parcelStage({ ...base, status: 'completed' }).step).toBe(3);
    expect(parcelStage({ ...base, status: 'cancelled' }).step).toBe(-1);
  });
});
