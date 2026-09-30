/**
 * Event payloads are made JSON-safe before they are validated and sent.
 * Publishing a ride with its pickup subdocument used to overflow the stack,
 * because a subdocument points back at its parent: posting any ride failed.
 */
import { Types } from 'mongoose';
import { Ride } from '../../models/Ride';
import { normalizeIds } from '../../events';

it('turns a subdocument into plain data without walking into its parent', () => {
  const ride = new Ride({ pickup: { location: { type: 'Point', coordinates: [31.05, -17.83] }, address: 'Harare CBD' } });
  const out = normalizeIds({ rideId: ride._id, pickup: ride.pickup }) as Record<string, unknown>;
  expect(out.rideId).toBe(ride._id.toString());
  expect(out.pickup).toMatchObject({ address: 'Harare CBD', location: { type: 'Point', coordinates: [31.05, -17.83] } });
});

it('keeps an object used twice, converts ids in arrays and survives a cycle', () => {
  const place = { address: 'Borrowdale' };
  const id = new Types.ObjectId();
  const loop: Record<string, unknown> = { name: 'loop' };
  loop.self = loop;
  const out = normalizeIds({ from: place, to: place, riderIds: [id], when: new Date(0), loop }) as Record<string, any>;
  expect(out.from).toEqual(place);
  expect(out.to).toEqual(place);
  expect(out.riderIds).toEqual([id.toString()]);
  expect(out.when).toEqual(new Date(0));
  expect(out.loop).toEqual({ name: 'loop', self: undefined });
});
