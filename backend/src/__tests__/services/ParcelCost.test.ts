/**
 * Parcel prices against what people pay now (September 2026): Harare's
 * motorbike couriers in town, Zimpost and overnight couriers between cities.
 */
import { parcelCost } from '../../services/ParcelPoolingService';

const harare = { lat: -17.8292, lng: 31.0522 };
const bulawayo = { lat: -20.1325, lng: 28.6265 };
const mutare = { lat: -18.9707, lng: 32.6709 };
/** A point about `km` due north of Harare */
const north = (km: number) => ({ lat: harare.lat + km / 111.2, lng: harare.lng });

describe('parcel prices', () => {
  it.each([
    // km, what a motorbike courier charges in town (US$)
    [5, 3],
    [10, 5],
    [15, 8],
  ])('stays within a dollar of a motorbike courier for %i km in Harare', (km, courier) => {
    const { total } = parcelCost({ pickup: harare, delivery: north(km), weightKg: 2 });
    expect(Math.abs(total - courier)).toBeLessThanOrEqual(1);
  });

  it('prices Harare to Bulawayo near Zimpost and below an overnight courier', () => {
    const { total, distanceKm } = parcelCost({ pickup: harare, delivery: bulawayo, weightKg: 5 });
    expect(distanceKm).toBeGreaterThan(350);
    expect(total).toBeGreaterThanOrEqual(13.1); // Zimpost, 5 kg
    expect(total).toBeLessThan(24); // Swift, 5 kg
  });

  it('prices Harare to Mutare near Zimpost', () => {
    const { total } = parcelCost({ pickup: harare, delivery: mutare, weightKg: 5 });
    expect(Math.abs(total - 13.1)).toBeLessThanOrEqual(2);
  });

  it('rounds to 10 cents, then adds 50 cents a kg over 5 kg and 1% of the insured value', () => {
    const light = parcelCost({ pickup: harare, delivery: north(10), weightKg: 5 });
    const heavy = parcelCost({ pickup: harare, delivery: north(10), weightKg: 9, insuranceValue: 200 });
    expect(Math.round(light.total * 10)).toBeCloseTo(light.total * 10, 6);
    expect(heavy.total).toBeCloseTo(light.total + 2 + 2, 2);
    expect(heavy.insuranceCost).toBe(2);
  });
});
