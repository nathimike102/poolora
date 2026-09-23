/**
 * Geometry behind the ride simulator: routes are decoded from the stored
 * polyline and walked in even steps.
 */
import { bearing, decodePolyline, distanceToPathKm, resample } from '../../utils/routeGeometry';
import { haversineDistanceKm } from '../../utils/helpers';

describe('ride simulator geometry', () => {
  it('decodes an encoded polyline', () => {
    expect(decodePolyline('_p~iF~ps|U_ulLnnqC_mqNvxq`@')).toEqual([
      { lat: 38.5, lng: -120.2 },
      { lat: 40.7, lng: -120.95 },
      { lat: 43.252, lng: -126.453 },
    ]);
  });

  it('resamples a path into evenly spaced steps from start to end', () => {
    // A straight road drawn with unevenly spaced points
    const path = [
      { lat: 12.9, lng: 77.6 },
      { lat: 12.901, lng: 77.6 },
      { lat: 12.93, lng: 77.6 },
    ];

    const points = resample(path, 10);

    expect(points).toHaveLength(11);
    expect(points[0]).toEqual(path[0]);
    expect(points[10].lat).toBeCloseTo(12.93);
    const gaps = points.slice(1).map((p, i) => haversineDistanceKm(points[i].lat, points[i].lng, p.lat, p.lng));
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0], 2);
  });

  it('gives compass bearings between 0 and 360', () => {
    expect(bearing({ lat: 12.9, lng: 77.6 }, { lat: 13, lng: 77.6 })).toBeCloseTo(0);
    expect(bearing({ lat: 12.9, lng: 77.6 }, { lat: 12.9, lng: 77.5 })).toBeCloseTo(270, 0);
  });
});

describe('distanceToPathKm', () => {
  // A straight east-west road about 11 km long at Bengaluru's latitude
  const road = [{ lat: 12.97, lng: 77.55 }, { lat: 12.97, lng: 77.65 }];

  it('is zero on the road', () => {
    expect(distanceToPathKm({ lat: 12.97, lng: 77.6 }, road)).toBeCloseTo(0, 5);
  });

  it('measures to the middle of the road, not just its start', () => {
    // 1 km north of the midpoint; 5.5 km from either end
    const d = distanceToPathKm({ lat: 12.97 + 1 / 111.32, lng: 77.6 }, road);
    expect(d).toBeCloseTo(1, 2);
  });

  it('measures past the end of the road to the end point', () => {
    const d = distanceToPathKm({ lat: 12.97, lng: 77.66 }, road);
    expect(d).toBeGreaterThan(1);
    expect(d).toBeLessThan(1.2);
  });

  it('handles a one-point path', () => {
    expect(distanceToPathKm({ lat: 12.97, lng: 77.55 }, [road[0]])).toBeCloseTo(0, 5);
  });
});
