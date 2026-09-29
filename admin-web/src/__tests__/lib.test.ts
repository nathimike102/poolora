import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, qs, tokens, ApiError } from '../lib/api';
import { money, pct, titleCase } from '../lib/format';

describe('format', () => {
  it('formats US dollars, with cents only when there are some', () => {
    expect(money(1234567)).toBe('US$1,234,567');
    expect(money(12.5)).toBe('US$12.50');
    expect(money(null)).toBe('—');
  });
  it('formats fractions as percentages', () => {
    expect(pct(0.1234, 1)).toBe('12.3%');
  });
  it('turns ids into words', () => {
    expect(titleCase('false_alarm')).toBe('False alarm');
  });
});

describe('qs', () => {
  it('skips empty values', () => {
    expect(qs({ status: 'open', q: '', page: 2, role: undefined })).toBe('?status=open&page=2');
    expect(qs({})).toBe('');
  });
});

describe('api', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    tokens.clear();
  });

  const reply = (status: number, body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status }));

  it('refreshes an expired token once and retries the call', async () => {
    tokens.set('old', 'refresh-1');
    const fetchMock = vi.fn()
      .mockImplementationOnce(() => reply(401, { error: { message: 'expired' } }))
      .mockImplementationOnce(() => reply(200, { data: { accessToken: 'new', refreshToken: 'refresh-2' } }))
      .mockImplementationOnce((_url: string, init: RequestInit) => {
        expect(new Headers(init.headers).get('Authorization')).toBe('Bearer new');
        return reply(200, { data: { ok: true } });
      });
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/admin/overview')).resolves.toEqual({ ok: true });
    expect(tokens.refresh).toBe('refresh-2');
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('passes on the backend\'s plain-language error', async () => {
    tokens.set('t', 'r');
    vi.stubGlobal('fetch', vi.fn(() => reply(409, { error: { id: 'CONFLICT', message: 'This dispute is already resolved' } })));
    const err = await api.post('/admin/disputes/1/resolve').catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 409, id: 'CONFLICT', message: 'This dispute is already resolved' });
  });
});
