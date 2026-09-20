import type { Request } from 'express';

/**
 * Query strings arrive as string | string[] | nested object, because a client
 * can repeat or nest any parameter. These read one value of the shape a
 * handler expects and fall back when it is missing or malformed, so handlers
 * do not have to cast req.query.
 */

export function queryString(req: Request, name: string, fallback: string): string;
export function queryString(req: Request, name: string): string | undefined;
export function queryString(req: Request, name: string, fallback?: string): string | undefined {
  const raw = req.query[name];
  if (typeof raw === 'string') return raw;
  // A repeated parameter (?status=a&status=b): take the first usable value.
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0];
  return fallback;
}

/** Reads a positive integer, e.g. a page number. Falls back when unparseable. */
export function queryInt(req: Request, name: string, fallback: number): number {
  const raw = queryString(req, name);
  if (raw === undefined) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/** Reads a number that may be fractional, e.g. a coordinate. */
export function queryFloat(req: Request, name: string): number | undefined {
  const raw = queryString(req, name);
  if (raw === undefined) return undefined;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Reads a query value that must be one of an enum's members, e.g. a status
 * filter. Anything else is treated as absent rather than passed through, so a
 * caller cannot filter on a status the system does not have.
 */
export function queryEnum<T extends Record<string, string>>(
  req: Request,
  name: string,
  values: T,
): T[keyof T] | undefined {
  const raw = queryString(req, name);
  if (raw === undefined) return undefined;
  return (Object.values(values) as string[]).includes(raw) ? (raw as T[keyof T]) : undefined;
}
