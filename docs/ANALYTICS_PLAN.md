# Analytics plan

How Poolora measures real use and progress: what is recorded, where it goes, and how each KPI is worked out.

## Where the numbers live

| Tool | What it covers | Environments |
|---|---|---|
| **Web admin → Analytics** (`/analytics`) | The KPI dashboard: users, sign-ups, DAU/WAU/MAU, activation, retention, the rider funnel, top errors. Built from our own database, so it works without any third-party account | Every environment shows its own database |
| **PostHog** (EU cloud) | The same events, for ad-hoc funnels, cohorts and retention charts | **Production only.** Events are sent only when `NODE_ENV=production` and `POSTHOG_API_KEY` is set. Use a separate PostHog project if staging ever needs one |
| **Sentry** | Crashes and server errors, app and backend | Per `SENTRY_ENVIRONMENT` |
| **Google Analytics 4** | Website page views, only after cookie consent; Global Privacy Control is honoured | Production website, when `analytics.googleAnalyticsId` is set in `web-landing/src/config/site.ts` |

Events are sent from the **backend** when the action really happens (a booking saved, a payment confirmed), not from the app. That means no tracking SDK in the app, no app rebuild, no ad blockers or offline gaps, and no bots: only signed-in use is counted.

**Excluded:** admin accounts (from activity, events and every KPI), signed-out traffic, crawlers, and every non-production environment (from PostHog).

## Tracking plan

Every event's distinct id is the user's account id. Every event carries `market` (for example `ZW`).

| Event | Trigger (domain event) | Properties |
|---|---|---|
| `user_signed_up` | Account created after the phone code is verified (`user.registered`) | `method` = `phone_otp` |
| `user_logged_in` | Session created (`user.logged_in`) | `method` = `phone_otp` or `firebase` |
| `ride_published` | A driver posts a ride (`ride.created`) — supply-side core action | `ride_id` |
| `booking_requested` | A rider requests a seat (`booking.created`) — **the primary value action** | `booking_id`, `ride_id` |
| `booking_confirmed` | The driver accepts (`booking.confirmed`) | `booking_id` |
| `payment_completed` | Paynow confirms a payment (`payment.captured`) | `booking_id`, `amount_usd` |
| `trip_completed` | The rider is dropped off (`booking.completed`) | `booking_id`, `fare_usd` |
| `booking_cancelled` | A booking is cancelled (`booking.cancelled`) | `booking_id`, `cancelled_by` |
| `driver_application_submitted` | Driver documents submitted (`kyc.submitted`) | — |
| `onboarding_completed` | A driver is approved (`kyc.approved`). Riders finish onboarding when they sign up: name and details are taken in the same step | `flow` = `driver`, `duration_hours` (account creation to approval) |
| `sos_raised` | An SOS is raised (`sos.triggered`) | — (never the location) |
| `error_shown` | The API returned an error to a signed-in user | `code` (e.g. `VALIDATION_ERROR`), `status`, `route` (the pattern, e.g. `/bookings/:id/cancel`) |

Names are `snake_case`. **Never sent:** phone numbers, names, email addresses, locations, messages, tokens, passwords, document images. The mapping lives in `EVENT_MAP` in `backend/src/services/ProductAnalyticsService.ts`, and a test checks that a phone number in a domain event never reaches PostHog.

## KPIs and how each is calculated

All days are Zimbabwe local days (`Africa/Harare`).

| KPI | Definition |
|---|---|
| Total users | Accounts that are not admins |
| New sign-ups | Accounts created today, in the last 7 days and in the last 30 days, plus a daily series |
| DAU / WAU / MAU | Distinct users with a signed-in request today / in the last 7 days / in the last 30 days. One `UserActivity` row is written per user per day; nothing else about the visit is kept |
| Stickiness | DAU ÷ MAU |
| Activation rate | Of users who signed up in the last 30 days, the share who requested a seat or published a ride |
| Retention (day 1, 7, 30) | Of users who signed up in the 90 days before the last complete day-N window, the share active exactly N days after signing up |
| Rider funnel | Users who signed up in the last 30 days → requested a seat → had a seat confirmed → completed a trip |
| Error rate | Failed share of this server's recent requests (live), and the 10 most common error ids shown to users in the last 7 days |

Activity rows are deleted automatically after about 13 months (TTL index). Daily error counts are kept 9 days in Redis.

## Setting up PostHog (owner)

1. Sign up at <https://eu.posthog.com/signup> (EU region; free up to 1 million events a month). Create a project called **Poolora Production**.
2. Project settings → copy the **Project API key** (starts `phc_`).
3. Put it in the **production** backend environment only: `POSTHOG_API_KEY=phc_…` (and `POSTHOG_HOST=https://eu.i.posthog.com` if you chose the EU region, which is the default). Restart the backend.
4. Check: sign in on the production app, then PostHog → Activity should show `user_logged_in` within a minute. The web admin's Analytics page will say "Events also go to PostHog".
5. Build a dashboard in PostHog: insights for each KPI above, a funnel `user_signed_up → booking_requested → booking_confirmed → trip_completed`, and a retention insight `user_signed_up → any event`.
6. Settings → Project → **Filter out internal and test users**: add a filter for your own test accounts' ids.

Never put the production key in a development or staging `.env`.
