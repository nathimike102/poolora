import { maxSeatsFor, REGISTRABLE_VEHICLES, vehicleCategory, VEHICLE_CATEGORIES } from '../vehicles';

describe('vehicle classes', () => {
  it('groups registered vehicles into what riders choose between', () => {
    expect(vehicleCategory('sedan')).toBe('car');
    expect(vehicleCategory('mini')).toBe('car');
    expect(vehicleCategory('pickup')).toBe('suv');
    expect(vehicleCategory('minivan')).toBe('minivan');
    expect(vehicleCategory('auto')).toBe('auto');
    expect(vehicleCategory('bike')).toBe('bike');
    expect(vehicleCategory(undefined)).toBe('car');
  });

  it('lets drivers register every class a rider can pick', () => {
    const offered = new Set(REGISTRABLE_VEHICLES.map(v => vehicleCategory(v.value)));
    expect([...offered].sort()).toEqual(Object.keys(VEHICLE_CATEGORIES).sort());
  });

  it('caps seats by vehicle, as the backend does', () => {
    expect(maxSeatsFor('bike')).toBe(1);
    expect(maxSeatsFor('auto')).toBe(3);
    expect(maxSeatsFor('minivan')).toBe(7);
    expect(maxSeatsFor(undefined)).toBe(6);
  });
});
