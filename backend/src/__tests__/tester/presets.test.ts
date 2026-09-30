/**
 * The API tester's sample requests must pass the real validators; otherwise
 * the tester fails before it reaches the rule it was opened to try.
 */
import { testerPresets } from '../../tester/presets';
import { createRideSchema, submitKycSchema } from '../../validators';

/** Builds a request body from a preset's `body.*` default values */
function sampleBody(name: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const preset = testerPresets.find((p) => p.name === name);
  if (!preset) throw new Error(`No preset named ${name}`);
  const body: Record<string, unknown> = {};
  for (const field of preset.fields) {
    const value = extra[field.key] ?? field.defaultValue;
    if (!field.key.startsWith('body.') || value === undefined) continue;
    const path = field.key.slice(5).split('.');
    let node = body;
    for (const part of path.slice(0, -1)) node = (node[part] ??= {}) as Record<string, unknown>;
    node[path[path.length - 1]] = value;
  }
  return body;
}

it('the Create Ride sample is a valid ride in Zimbabwe', () => {
  const body = sampleBody('Create Ride (Driver Auth)', {
    'body.vehicleId': '66f000000000000000000001',
    'body.departureTime': new Date(Date.now() + 3 * 3600_000).toISOString(),
  });
  const { error } = createRideSchema.body.validate(body);
  expect(error?.message).toBeUndefined();
  // Harare, not the Indian Ocean
  const { pickup, dropoff } = body as { pickup: { lng: number; lat: number }; dropoff: { lng: number; lat: number } };
  for (const p of [pickup, dropoff]) {
    expect(p.lat).toBeGreaterThan(-23);
    expect(p.lat).toBeLessThan(-15);
    expect(p.lng).toBeGreaterThan(25);
    expect(p.lng).toBeLessThan(34);
  }
});

it('the Submit KYC sample uses a valid vehicle type', () => {
  const body = sampleBody('Submit KYC (Auth)', { 'body.drivingLicenseUrl': 's3://bucket/kyc/x/licence/a.jpg' });
  const { error } = submitKycSchema.body.validate(body, { allowUnknown: true, abortEarly: false });
  expect(error?.details.map((d) => d.path.join('.')) ?? []).not.toContain('vehicle.vehicleType');
});
