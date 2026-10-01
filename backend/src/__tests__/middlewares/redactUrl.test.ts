import { redactUrl } from '../../utils/redactUrl';

describe('redactUrl', () => {
  it.each([
    ['/track/sos/abc123def456', '/track/sos/[redacted]'],
    ['/api/v1/track/trip/abc123?lang=en', '/api/v1/track/trip/[redacted]?lang=en'],
    ['/track/contact/abc123', '/track/contact/[redacted]'],
    ['/payments/paynow/return?ref=B1&hash=ABCDEF', '/payments/paynow/return?ref=B1&hash=[redacted]'],
    ['/auth/x?token=t1&code=9&page=2', '/auth/x?token=[redacted]&code=[redacted]&page=2'],
  ])('hides the credential in %s', (url, expected) => {
    expect(redactUrl(url)).toBe(expected);
  });

  it('handles a full URL and a bare query string, as Sentry sends them', () => {
    expect(redactUrl('https://api.example.com/track/sos/abc123')).toBe('https://api.example.com/track/sos/[redacted]');
    expect(redactUrl('token=t1&page=2')).toBe('token=[redacted]&page=2');
  });

  it('leaves ordinary URLs alone', () => {
    expect(redactUrl('/bookings/64f0c0ffee00000000000001/receipt')).toBe('/bookings/64f0c0ffee00000000000001/receipt');
    expect(redactUrl('/parcels/track/PL123')).toBe('/parcels/track/PL123');
  });
});
