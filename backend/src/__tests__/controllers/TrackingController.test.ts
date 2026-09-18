/**
 * Tests for the public SOS tracking page linked from emergency SMS messages.
 */
import express from 'express';
import request from 'supertest';

const mockGetPublicTracking = jest.fn();
jest.mock('../../services/SafetyService', () => ({
  SafetyService: jest.fn().mockImplementation(() => ({ getPublicTracking: mockGetPublicTracking })),
}));

import trackRoutes from '../../routes/track.routes';
import { SOSStatus } from '../../types';

const app = express();
app.use('/track', trackRoutes);

const TOKEN = '3f2b8a1c-9d4e-4f6a-8b7c-1234567890ab';

describe('GET /track/sos/:token', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows an active alert with a maps link, escaping the name, and is never cached or indexed', async () => {
    mockGetPublicTracking.mockResolvedValue({
      firstName: '<script>x</script>',
      status: SOSStatus.TRIGGERED,
      lastLocation: { lat: 17.08, lng: 82.13 },
      lastUpdatedAt: new Date('2026-09-16T10:00:00Z'),
      resolvedAt: null,
    });

    const res = await request(app).get(`/track/sos/${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('&lt;script&gt;x&lt;/script&gt; raised an SOS alert');
    expect(res.text).not.toContain('<script>x</script>');
    expect(res.text).toContain('https://www.google.com/maps/search/?api=1&amp;query=17.08,82.13');
    expect(res.text).toContain('http-equiv="refresh"');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-robots-tag']).toContain('noindex');
    expect(res.headers['content-security-policy']).toContain("default-src 'none'");
  });

  it('shows a closed alert without auto-refresh', async () => {
    mockGetPublicTracking.mockResolvedValue({
      firstName: 'Asha',
      status: SOSStatus.RESOLVED,
      lastLocation: null,
      lastUpdatedAt: null,
      resolvedAt: new Date('2026-09-16T10:30:00Z'),
    });

    const res = await request(app).get(`/track/sos/${TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.text).toContain('This alert was closed at');
    expect(res.text).not.toContain('http-equiv="refresh"');
  });

  it('returns 404 for unknown or expired tokens', async () => {
    mockGetPublicTracking.mockResolvedValue(null);
    const res = await request(app).get(`/track/sos/${TOKEN}`);
    expect(res.status).toBe(404);
    expect(res.text).toContain('no longer active');
  });

  it('does not look up malformed tokens', async () => {
    const res = await request(app).get('/track/sos/not-a-token');
    expect(res.status).toBe(404);
    expect(mockGetPublicTracking).not.toHaveBeenCalled();
  });
});
