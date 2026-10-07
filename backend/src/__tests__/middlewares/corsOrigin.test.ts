/**
 * The Confirm buttons on the work-email and emergency-contact pages post back
 * to the API's own address; CORS must not refuse them.
 */
jest.mock('../../config', () => ({
  config: { isProduction: true, app: { baseUrl: 'https://api.siham.test' }, cors: { origin: ['https://admin.siham.test'] } },
}));

import { corsOriginAllowed } from '../../middlewares/corsOrigin';

describe('corsOriginAllowed', () => {
  it("allows the API's own pages posting back to it", () => {
    expect(corsOriginAllowed('https://api.siham.test')).toBe(true);
  });

  it('allows the listed sites and the mobile app (no Origin)', () => {
    expect(corsOriginAllowed('https://admin.siham.test')).toBe(true);
    expect(corsOriginAllowed(undefined)).toBe(true);
  });

  it('refuses other sites, and localhost in production', () => {
    expect(corsOriginAllowed('https://evil.example')).toBe(false);
    expect(corsOriginAllowed('http://localhost:3000')).toBe(false);
    expect(corsOriginAllowed('null')).toBe(false);
  });
});
