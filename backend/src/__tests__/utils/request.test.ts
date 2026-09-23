import type { Request } from 'express';
import { queryFloat, queryInt, queryString } from '../../utils/request';

const req = (query: Record<string, unknown>) => ({ query }) as unknown as Request;

describe('query helpers', () => {
  it('read raw query strings', () => {
    const r = req({ lat: '16.97', page: '2', q: 'beach' });
    expect(queryFloat(r, 'lat')).toBe(16.97);
    expect(queryInt(r, 'page', 1)).toBe(2);
    expect(queryString(r, 'q')).toBe('beach');
  });

  // validate() swaps req.query for Joi's converted values
  it('read values Joi has already converted', () => {
    const when = new Date('2026-09-21T10:00:00.000Z');
    const r = req({ pickupLat: 16.9745, radiusKm: 5, womenOnly: true, departureTime: when });
    expect(queryFloat(r, 'pickupLat')).toBe(16.9745);
    expect(queryFloat(r, 'radiusKm')).toBe(5);
    expect(queryString(r, 'womenOnly')).toBe('true');
    expect(queryString(r, 'departureTime')).toBe('2026-09-21T10:00:00.000Z');
  });

  it('fall back for missing or unusable values', () => {
    const r = req({ bad: 'abc', when: new Date('nope'), nested: { a: 1 } });
    expect(queryFloat(r, 'bad')).toBeUndefined();
    expect(queryString(r, 'when', 'x')).toBe('x');
    expect(queryString(r, 'nested')).toBeUndefined();
    expect(queryInt(r, 'missing', 7)).toBe(7);
  });
});
