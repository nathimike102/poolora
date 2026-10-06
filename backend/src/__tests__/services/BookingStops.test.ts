/**
 * Stops a rider adds between their pickup and drop: checked against the
 * ride's route, ordered as the car meets them, and priced per stop. Also the
 * route-deviation rule that lets the car reach the points riders chose.
 */

import { planBooking } from '../../services/BookingService';
import { onPlannedDetour } from '../../utils/routeGeometry';

jest.mock('../../config', () => ({
  config: {
    ride: { maxPickupDistanceFromRouteKm: 2, maxStopsPerBooking: 2, extraStopFee: 0.5, platformFeeRate: 0.15 },
    tracking: { routeDeviationMeters: 500 },
  },
}));

// A ride due south along longitude 31.0, from -17.80 to -17.90 (about 11 km)
const point = (lng: number, lat: number) => ({ type: 'Point' as const, coordinates: [lng, lat] as [number, number] });
const ride = {
  routePolyline: '',
  pickup: { location: point(31.0, -17.8), address: 'Start' },
  dropoff: { location: point(31.0, -17.9), address: 'End' },
  waypoints: [],
  pricePerSeat: 3,
} as unknown as Parameters<typeof planBooking>[0];

const at = (lat: number, address = `at ${lat}`, lng = 31.0) => ({ lat, lng, address });

describe('planBooking', () => {
  test('without stops the fare is the seats alone', () => {
    const plan = planBooking(ride, { seatsBooked: 2, pickup: at(-17.81), dropoff: at(-17.89) });
    expect(plan.fare).toBe(6);
    expect(plan.stops).toEqual([]);
    expect(plan.stopsFee).toBe(0);
  });

  test('stops come back in route order and add the stop fee once per stop, not per seat', () => {
    const plan = planBooking(ride, {
      seatsBooked: 2,
      pickup: at(-17.81),
      dropoff: at(-17.89),
      stops: [at(-17.87, 'Later'), at(-17.83, 'Sooner')],
    });
    expect(plan.stops.map((s) => s.address)).toEqual(['Sooner', 'Later']);
    expect(plan.stopsFee).toBe(1);
    expect(plan.fare).toBe(7);
  });

  test('a stop before the pickup or after the drop is refused', () => {
    expect(() => planBooking(ride, { seatsBooked: 1, pickup: at(-17.83), dropoff: at(-17.87), stops: [at(-17.81)] }))
      .toThrow(expect.objectContaining({ errorId: 'STOP_OUT_OF_ORDER' }));
    expect(() => planBooking(ride, { seatsBooked: 1, pickup: at(-17.83), dropoff: at(-17.87), stops: [at(-17.89)] }))
      .toThrow(expect.objectContaining({ errorId: 'STOP_OUT_OF_ORDER' }));
  });

  test('a stop far from the route is refused, like a far pickup', () => {
    // 0.05 degrees of longitude is about 5 km here
    expect(() => planBooking(ride, { seatsBooked: 1, pickup: at(-17.81), dropoff: at(-17.89), stops: [at(-17.85, 'Off', 31.05)] }))
      .toThrow(expect.objectContaining({ errorId: 'STOP_TOO_FAR' }));
  });

  test('more stops than the setting allows are refused', () => {
    expect(() => planBooking(ride, {
      seatsBooked: 1, pickup: at(-17.81), dropoff: at(-17.89), stops: [at(-17.82), at(-17.84), at(-17.86)],
    })).toThrow(expect.objectContaining({ errorId: 'TOO_MANY_STOPS' }));
  });
});

describe('onPlannedDetour', () => {
  // A pickup 1.5 km east of the route
  const pickup = { lat: -17.85, lng: 31.0142, offRouteKm: 1.5 };

  test('the car on its way to a rider\'s off-route pickup is on plan', () => {
    expect(onPlannedDetour({ lat: -17.85, lng: 31.007 }, [pickup], 0.5)).toBe(true);
  });

  test('the car going somewhere nobody asked for is not', () => {
    // 3 km west of the route, the other way from the pickup
    expect(onPlannedDetour({ lat: -17.85, lng: 30.9716 }, [pickup], 0.5)).toBe(false);
  });

  test('with no off-route points nothing is excused', () => {
    expect(onPlannedDetour({ lat: -17.85, lng: 31.007 }, [], 0.5)).toBe(false);
  });
});
