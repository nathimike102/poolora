/**
 * The backend API. Every call carries the admin's access token; an expired
 * token is refreshed once and the call retried. Errors come back as ApiError
 * with the backend's plain-language message.
 */

export const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? 'http://localhost:5002';

const ACCESS = 'siham-admin-access';
const REFRESH = 'siham-admin-refresh';

export class ApiError extends Error {
  constructor(message: string, readonly status: number, readonly id?: string) {
    super(message);
  }
}

// Tokens live in sessionStorage: they end with the tab, and nothing else
// on this origin runs third-party scripts
export const tokens = {
  get access() {
    return sessionStorage.getItem(ACCESS);
  },
  get refresh() {
    return sessionStorage.getItem(REFRESH);
  },
  set(access: string, refresh: string) {
    sessionStorage.setItem(ACCESS, access);
    sessionStorage.setItem(REFRESH, refresh);
  },
  clear() {
    sessionStorage.removeItem(ACCESS);
    sessionStorage.removeItem(REFRESH);
  },
};

let onSignedOut: () => void = () => undefined;
export function whenSignedOut(fn: () => void): void {
  onSignedOut = fn;
}

let refreshing: Promise<boolean> | null = null;
async function refreshTokens(): Promise<boolean> {
  const refresh = tokens.refresh;
  if (!refresh) return false;
  refreshing ??= fetch(`${API_URL}/auth/refresh-token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: refresh }),
  })
    .then(async (res) => {
      if (!res.ok) return false;
      const body = await res.json();
      const data = body.data ?? body;
      if (!data.accessToken) return false;
      tokens.set(data.accessToken, data.refreshToken ?? refresh);
      return true;
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function send(path: string, init: RequestInit, retry = true): Promise<Response> {
  const headers = new Headers(init.headers);
  if (tokens.access) headers.set('Authorization', `Bearer ${tokens.access}`);
  if (init.body && !headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection.', 0);
  }
  if (res.status === 401 && retry && (await refreshTokens())) return send(path, init, false);
  if (res.status === 401) {
    tokens.clear();
    onSignedOut();
  }
  return res;
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const err = body?.error;
    throw new ApiError(err?.message ?? `Request failed (${res.status})`, res.status, err?.id);
  }
  return (body?.data ?? body) as T;
}

export const api = {
  get: <T>(path: string) => send(path, { method: 'GET' }).then(parse<T>),
  post: <T>(path: string, body?: unknown) =>
    send(path, { method: 'POST', body: JSON.stringify(body ?? {}) }).then(parse<T>),
  put: <T>(path: string, body?: unknown) =>
    send(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }).then(parse<T>),
  patch: <T>(path: string, body?: unknown) =>
    send(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }).then(parse<T>),
  del: <T>(path: string) => send(path, { method: 'DELETE' }).then(parse<T>),
  /** A private image (parcel photo) as a local object URL for an <img>; revoke it when done */
  async objectUrl(path: string): Promise<string> {
    const res = await send(path, { method: 'GET' });
    if (!res.ok) await parse(res);
    return URL.createObjectURL(await res.blob());
  },
  /** Downloads a file the API returns (a report as CSV, Excel or PDF) */
  async download(path: string, filename: string): Promise<void> {
    const res = await send(path, { method: 'GET' });
    if (!res.ok) await parse(res);
    const url = URL.createObjectURL(await res.blob());
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },
};

/** Builds a query string, skipping empty values */
export function qs(params: Record<string, string | number | boolean | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : '';
}
