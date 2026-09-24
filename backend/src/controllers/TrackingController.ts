import { Request, Response, NextFunction } from 'express';
import { SafetyService } from '../services/SafetyService';
import { SOSStatus } from '../types';

const safetyService = new SafetyService();

const TOKEN_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatTime(date: Date): string {
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function page(title: string, body: string, refreshSeconds?: number): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
${refreshSeconds ? `<meta http-equiv="refresh" content="${refreshSeconds}">` : ''}
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; --bg:#f7f7f5; --fg:#1a1a1a; --muted:#555; --card:#fff; --line:#ddd; --alert:#b42318; --ok:#1b6e3a; --link:#1d4ed8; }
  @media (prefers-color-scheme: dark) { :root { --bg:#121212; --fg:#f2f2f2; --muted:#b5b5b5; --card:#1e1e1e; --line:#333; --alert:#ff8a80; --ok:#7bd88f; --link:#8ab4ff; } }
  body { margin:0; background:var(--bg); color:var(--fg); font:16px/1.5 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width:480px; margin:0 auto; padding:24px 16px; }
  .card { background:var(--card); border:1px solid var(--line); border-radius:8px; padding:20px; }
  h1 { font-size:1.25rem; margin:0 0 8px; }
  p { margin:0 0 12px; }
  .alert { color:var(--alert); font-weight:600; }
  .ok { color:var(--ok); font-weight:600; }
  .muted { color:var(--muted); font-size:0.9rem; }
  a.button { display:block; text-align:center; padding:12px 16px; border-radius:6px; background:var(--link); color:#fff; text-decoration:none; font-weight:600; margin:16px 0; }
  a.button:focus-visible { outline:3px solid var(--fg); outline-offset:2px; }
  a { color:var(--link); }
</style>
</head>
<body><main><div class="card">${body}</div></main></body>
</html>`;
}

export class TrackingController {
  /**
   * GET /track/sos/:token
   * Public page linked from the SOS text message sent to emergency contacts.
   */
  static async sosPage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      );

      const token = String(req.params.token);
      const tracking = TOKEN_RE.test(token) ? await safetyService.getPublicTracking(token) : null;

      if (!tracking) {
        res.status(404).type('html').send(
          page(
            'Tracking link expired',
            `<h1>This tracking link is no longer active</h1>
<p>It may have expired or been typed incorrectly.</p>
<p>If you think someone is in danger, call <a href="tel:112">112</a>.</p>`,
          ),
        );
        return;
      }

      const name = escapeHtml(tracking.firstName);
      const isActive = tracking.status === SOSStatus.TRIGGERED || tracking.status === SOSStatus.ACKNOWLEDGED;

      let status: string;
      if (isActive) {
        status = `<p class="alert">${name} raised an SOS alert. It is still active.</p>`;
        if (tracking.status === SOSStatus.ACKNOWLEDGED) {
          status += '<p>The Poolora safety team has seen this alert.</p>';
        }
      } else {
        const closedAt = tracking.resolvedAt ? ` at ${escapeHtml(formatTime(tracking.resolvedAt))}` : '';
        status = tracking.status === SOSStatus.FALSE_ALARM
          ? `<p class="ok">This alert was closed as a false alarm${closedAt}.</p>`
          : `<p class="ok">This alert was closed${closedAt}.</p>`;
      }

      let location = '<p>No location has been shared yet.</p>';
      if (tracking.lastLocation) {
        const { lat, lng } = tracking.lastLocation;
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        const updated = tracking.lastUpdatedAt
          ? `<p class="muted">Location last updated ${escapeHtml(formatTime(tracking.lastUpdatedAt))} (IST).</p>`
          : '';
        location = `<a class="button" href="${escapeHtml(mapsUrl)}" rel="noopener noreferrer">Open last known location in Google Maps</a>${updated}`;
      }

      const footer = isActive
        ? `<p>If you think ${name} is in danger, call <a href="tel:112">112</a>.</p>
<p class="muted">This page refreshes every 30 seconds.</p>`
        : '';

      res.status(200).type('html').send(
        page(
          isActive ? `SOS alert from ${tracking.firstName}` : 'SOS alert closed',
          `<h1>Poolora SOS alert</h1>${status}${location}${footer}`,
          isActive ? 30 : undefined,
        ),
      );
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /track/trip/:token
   * Public page a rider shares with people they trust (UC-R08). Refreshes
   * itself; no scripts, and the link dies an hour after the trip.
   */
  static async tripPage(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('X-Robots-Tag', 'noindex, nofollow');
      res.setHeader('Referrer-Policy', 'no-referrer');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'",
      );
      const { TripShareService } = await import('../services/TripShareService');
      const trip = await new TripShareService().publicView(String(req.params.token), req.ip);
      if (!trip) {
        res.status(404).type('html').send(
          page('Trip link expired', `<h1>This trip link is no longer active</h1>
<p>Links stop working an hour after the trip ends, or when it is cancelled.</p>
<p>If you think someone is in danger, call <a href="tel:112">112</a>.</p>`),
        );
        return;
      }
      const rider = escapeHtml(trip.riderFirstName);
      const statusText: Record<typeof trip.status, string> = {
        waiting: `${rider}'s ride has not started yet.`,
        on_the_way: `The driver is on the way to pick ${rider} up${trip.etaMins ? `, about ${trip.etaMins} min away` : ''}.`,
        in_car: `${rider} is in the car${trip.etaMins ? ` and about ${trip.etaMins} min from the drop` : ''}.`,
        arrived: `${rider} has arrived.`,
      };
      let location = '';
      if (trip.position) {
        const { lat, lng } = trip.position;
        const url = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`;
        location = `<a class="button" href="${escapeHtml(url)}" rel="noopener noreferrer">See where the car is on a map</a>
<p class="muted">Position updated ${escapeHtml(formatTime(trip.position.at))} (IST).</p>`;
      }
      const live = trip.status === 'on_the_way' || trip.status === 'in_car';
      res.status(200).type('html').send(
        page(
          `${trip.riderFirstName}'s Poolora trip`,
          `<h1>${rider} is sharing a Poolora trip</h1>
<p class="${trip.status === 'arrived' ? 'ok' : ''}">${statusText[trip.status]}</p>
<p><strong>${escapeHtml(trip.from)}</strong> to <strong>${escapeHtml(trip.to)}</strong><br>
<span class="muted">Leaves ${escapeHtml(formatTime(trip.departure))} (IST)</span></p>
<p>Driver ${escapeHtml(trip.driverFirstName)} · ${escapeHtml(trip.vehicle)}</p>
${location}
<p>If you think ${rider} is in danger, call <a href="tel:112">112</a>.</p>
${live ? '<p class="muted">This page refreshes every 20 seconds.</p>' : ''}`,
          live ? 20 : 60,
        ),
      );
    } catch (error) {
      next(error);
    }
  }
}
