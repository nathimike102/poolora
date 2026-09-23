# Feature Gap Analysis

What the documents in `frontend/docs` promise, compared with what the app and backend do today (September 2026). Each gap says what the feature should do and where it would go. Use-case IDs (UC-…) refer to `design/03-USE-CASES.md`.

---

## 1. Fixed alongside this analysis

These blocked the core ride flow and are now in the code:

| Area | Before | Now |
|---|---|---|
| Start ride (UC-D04, API spec §3.7) | No endpoint. Rides stayed `scheduled` forever, so "Complete ride" always failed. | `POST /rides/:id/start` (needs one confirmed rider), a **Start ride** button, and a "Your driver is on the way" push to riders. |
| Live tracking (UC-R05, UC-D05) | The rider screen listened for positions, but the driver app never sent any. | While a ride is in progress, the driver's phone shares its GPS position every 5 s with each confirmed rider. |
| Completing a ride | Completing a ride left its bookings `confirmed`, so riders could never rate and drivers never earned. | Completing a ride settles every confirmed booking: earnings, platform fee, coins, and rating unlocked. |
| Maps cost | Google Maps key needed for tiles, search and routing. | Free OpenStreetMap stack: MapLibre + OpenFreeMap tiles in the app; Photon, Nominatim and OSRM on the backend (`MAPS_PROVIDER=osm`). Google stays available with `MAPS_PROVIDER=google`. |
| Road route on the map | Straight dashed line between pickup and drop. | The actual driving route from the stored polyline. |
| Testing a trip | Needed two phones and two accounts. | Ride simulator (Settings → Testing), described in section 5. |

### 1.1 Fixed in the second pass (23 September 2026)

| Area | Before | Now |
|---|---|---|
| Card payments skipped the driver (bug) | The `payment.captured` webhook set the booking to `confirmed` itself. Razorpay captures automatically, so card and UPI bookings were confirmed without the driver, and `availableSeats` never went down, which allowed overbooking. | The webhook only records the capture. The driver's Accept confirms the booking and reserves seats atomically. |
| A failed card attempt killed the booking (bug) | Any `payment.failed` set the booking to `payment_failed`, even when a retry on the same order then succeeded, and could overwrite an authorized payment as failed. | Failures are recorded for fraud checks. The booking stays pending, and a successful payment is never overwritten. |
| Webhooks on Docker Compose (bug) | `payment.captured` ran in a MongoDB transaction, which needs a replica set; the Compose database is a standalone server. | No transaction is needed any more. |
| Payment timeout (UC-R04) | Unpaid requests stayed pending forever. | Cancelled after 15 minutes by the booking sweeper (`backend/src/jobs/BookingSweeper.ts`, every minute, Redis lock across instances). |
| Request expiry (UC-D03) | Unanswered requests stayed pending forever. | Expire after 6 hours, or once the ride has left, with a full refund and a push. |
| Auto-reject when full (UC-D03 5a) | Other requests stayed open after the last seat went. | Requests that no longer fit are rejected and refunded as soon as the driver accepts. |
| Auto-cancel empty rides (UC-D02) | Not done. | Rides with no bookings are cancelled 1 hour before departure, and the driver gets a push. A ride posted inside that hour gets a full hour first. |
| Tiered cancellation refunds (UC-R09) | Every cancellation refunded in full. | 100% / 50% / 25% / 0% by hours before departure for a rider cancelling a confirmed seat. The rest goes to the driver less the platform fee (UC-D04 7b). The app shows the exact refund before the rider confirms (`GET /bookings/:id/cancellation-quote`). |
| Pickup near the route (UC-R03) | Pickup had to be within 2 km of the ride's *start*. | Measured against the stored route polyline, so riders can book part-way along the route. |
| Frontend linting | `eslint-plugin-react-hooks` was missing and there was no `lint` script. | Installed; `npm run lint` passes and runs in CI. |
| API specification | Described endpoints that do not exist. | Rewritten from the route files (`technical/07-API-SPECIFICATIONS.md`). |
| Search along the route (UC-R03) | Search found rides only by their *start*, so riders on the route but far from its start never saw them. | Rides store their route as an indexed GeoJSON line; search matches the rider's pickup and drop anywhere along it, in the right direction, and the app books from the rider's own points. |
| Kafka (bug) | The API tried Kafka once at startup and gave up; on a fresh cluster every consumer failed because the topics did not exist; without Kafka every booking, ride and payment push was dropped; the Kubernetes Kafka could not start at all. | Background reconnect, topics created before subscribing, events handled in-process when Kafka is down, and a working three-broker KRaft StatefulSet. |

---

## 2. Missing features

### 2.1 Core ride flow (MVP and Phase 1 in the docs)

| Feature | Docs | Today | What to build |
|---|---|---|---|
| **Per-rider pickup and drop-off** | UC-D04 steps 4–12 | One Start and one Complete for the whole ride | "Arrived", "Picked up" and "Dropped off" per booking, using the unused `Booking.actualPickupTime`, with ETA updates for the remaining riders. |
| **No-show handling** | UC-D07: 10-min wait timer, then report; full fee to driver | Missing | "Arrived" starts a 10-minute timer; "Report no-show" cancels the booking with the fee paid to the driver. |
| **Modify a published ride** | UC-D08 | Cancel only | Edit time, seats and price with rider notification. Changing the time or route lets booked riders cancel with a full refund. |
| **Route deviation alerts** | UC-R05: alert when the car is more than 500 m off the planned route | Alerts when the car is more than 10 km from the *pickup point*, so long trips raise false alarms | Measure distance to the route polyline (`utils/routeGeometry.ts` decodes it) and use the 500 m threshold. |
| **Approach push notifications** | UC-R05: "5 min away", "arrived", "started" | "Started" is a push; the others appear only while the ride screen is open | Send the approach milestones as pushes, once each. |
| **Periodic safety check-ins** | UC-R05, project scope: every 30 min during a ride | Check-ins exist only inside an active SOS | Prompt the rider every 30 min in a ride; escalate to SOS if a prompt goes unanswered. |
| **Live trip sharing link** | UC-R08: secure link that expires, no login needed | "Share trip" sends plain text; secure public links exist only for SOS (`/track/sos/:token`) | Reuse the SOS token page for rides: token per ride, map and ETA, expires 1 h after completion, access logged. |
| **Receipts** | UC-R04 step 11 | None for riders | Receipt screen and PDF/email after payment and after completion. |
| **Email notifications** | Plan: Mailgun or SendGrid | No email provider is wired in | One provider for receipts, KYC decisions and SOS alerts to contacts. |

### 2.2 Search and booking

| Feature | Docs | Today | What to build |
|---|---|---|---|
| No results | UC-R02 6a: suggest other times or nearby places | Empty list | Retry with ±3 h and a wider radius; offer "Save this route" for alerts. |
| Message to driver | UC-R03 step 6 | Not in the booking form | Optional note on the booking, shown in the driver's request card. |
| Location-biased suggestions | Implied by "enter origin" | Place search is not biased to the user's position, so "Indiranagar" can list Maharashtra first | Pass the phone's location to `/maps/autocomplete`; Photon accepts `lat`/`lon` for bias. |

### 2.3 Driver

| Feature | Docs | Today | What to build |
|---|---|---|---|
| Suggested price | UC-D02 steps 6–7: from distance, fuel and demand; driver may adjust ±30% | Driver types any price (minimum ₹0) | Suggest a price from `estimatedDistanceKm`, enforce ₹2–₹15 per km per seat and the ±30% band. |
| Ride rules | UC-D02: at least 2 h in advance, at most 300 km | Only "in the future" is checked | Add both checks to `createRideSchema`. |
| Waypoints and return trip | UC-D02 steps 2 and 9 | Not in the form | Optional stops (the backend already accepts waypoints for directions) and "Also create return trip". |
| Turn-by-turn navigation | UC-D05 | Not in the app; the backend `/maps/navigation` endpoint is Google-only | Cheapest route: an "Open in Maps" button that deep-links to Google Maps or OsmAnd with the stops in order. |
| Masked calls | UC-D06 | Direct phone numbers | A call-proxy service such as Exotel if privacy is required; otherwise drop it from the docs. |
| Broadcast message | UC-D06 step 6 | Chat is one booking at a time | "Message all riders" on the ride screen. |
| Earnings statements | UC-D09: download statements | Totals and charts only | Monthly statement export (CSV or PDF). |
| Verified driver badge | UC-D10 | Missing | Eligibility rules, application flow and a badge on ride cards. |

### 2.4 Admin

The docs describe a **web** admin dashboard. The app has an in-app admin area with verifications, incidents and metrics.

| Feature | Docs | Today | What to build |
|---|---|---|---|
| Disputes | UC-A04 | Missing | Dispute model, submission from a booking, admin decision with refund or warning. |
| User management | UC-A05 | Backend `GET /admin/users` exists; no screen | Search, suspend or reinstate, internal notes, audit log. |
| Reports | UC-A06 | Metrics screen only | Scheduled and exported reports. |
| Platform settings | UC-A07 | Values are hard-coded in `config` | Settings collection, read at runtime, with an admin editor. |

### 2.5 AI/ML

Matching (UC-AI01) is a weighted score computed inside the backend (`MatchingEngineClient`); the ML service's `/api/match` endpoint is never called. The ML service is used for route optimization, fraud checks and demand prediction. Fraud detection runs on failed payments. Missing: **surge pricing applied to fares** (UC-AI03; demand prediction exists but never changes a price) and **review of false positives** (UC-AI02 step 6).

### 2.6 Parcel and Trip pooling (Phase 4)

- **Parcel pooling:** the backend has a service and routes, but all three app screens show "coming later". Next: connect the screens to `/parcels`, then photo proof at pickup (UC-P03) and insurance claims (UC-P05).
- **Trip pooling:** nothing in the backend, and the three app screens are placeholders. Everything in UC-T01 to UC-T05 is still to build.

### 2.7 Cross-cutting

- **Help and support (UC-X02):** only a contact link. Add an FAQ, a support ticket form and a priority safety line.
- **Rating rules (UC-R06):** single score plus tags. The docs ask for four category scores, a 7-day window, a 24-hour reminder and admin moderation.
- **Emergency contacts (UC-R10):** the app limits the list to 3 as documented, but the API accepts 5, and contacts are not verified by SMS.
- **Platform fee on refunds (UC-R09):** the docs call the platform fee non-refundable. The fee is part of the fare here, so a full refund returns it too. Deciding whether to keep it is a business call.

---

## 3. Documentation cleanup

The documents disagree with each other and with the code in several places:

1. **Vendors.** Done, except email: every document now names Razorpay for payments and OpenStreetMap (Google optional) for maps. No email provider is wired in, so the documents say "not chosen yet". Pick one when receipts or KYC emails are built.
2. ~~**API specification is out of date.**~~ Rewritten from the code in September 2026.
3. ~~**Contradictions in the use cases.**~~ UC-D02 now refuses rides over 300 km, and parcel pooling is Phase 4 everywhere.
4. ~~**Numbering.**~~ `08-TECHNICAL-REQUIREMENTS.md` runs 1–15 (the second "Quality Metrics" was the database configuration), and `03-USE-CASES.md` runs 1–12.
5. ~~**Naming.**~~ The documents say Poolora.
6. **Admin.** The documents describe a web dashboard; the admin area is inside the mobile app. Every design document now carries a status note saying so. A web dashboard remains a product decision.
7. ~~**Tracking interval.**~~ 5 seconds everywhere, as in the app.
8. **Aspirational design.** `02-SYSTEM-ARCHITECTURE.md`, `05-SYSTEM-DESIGN.md`, `06-DATABASE-SCHEMAS.md` and `08-TECHNICAL-REQUIREMENTS.md` still describe a larger target design (PostgreSQL, RabbitMQ, Redux, a web dashboard) that was never built. Each now opens with a status note pointing here and to the API specification. Rewrite them only if they are needed as a reference for new work.

Code hygiene: ~~frontend linting could not run~~ fixed; `npm run lint` passes and CI runs it.

---

## 4. Suggested order

1. ~~Background jobs (payment timeout, request expiry, empty-ride auto-cancel).~~ Done.
2. ~~Tiered cancellation refunds, and search and booking along the route.~~ Done.
3. Per-rider pickup and drop-off, no-show handling, and deviation alerts measured against the route.
4. Live trip-share link, approach push notifications and periodic safety check-ins.
5. Price suggestion and ride-creation rules.
6. Admin disputes and user management.
7. Parcel app screens, then Trip pooling.
8. Documentation cleanup (section 3), which can happen at any point.

---

## 5. Free maps and the ride simulator

### Maps without a key

- **App:** MapLibre draws OpenFreeMap vector tiles (liberty style for light mode, dark style for dark mode). No key, sign-up or usage limit. `MAP_STYLE_LIGHT` and `MAP_STYLE_DARK` in `frontend/.env` switch to another style. A native rebuild is needed once (`npx expo run:android`) because the map library changed.
- **Backend:** with `MAPS_PROVIDER=osm`, or no Google key, place suggestions come from Photon, addresses from Nominatim (with Photon as a fallback), and routes and distances from OSRM. Results are cached in Redis.
- **Production:** the public Nominatim and OSRM servers are meant for light use (Nominatim allows 1 request per second). For real traffic, self-host them (both have Docker images) or use a hosted OSM provider, and set `PHOTON_URL`, `NOMINATIM_URL` and `OSRM_URL`.

### Simulating a ride

Available when the backend runs with `NODE_ENV` other than `production`, or with `ENABLE_RIDE_SIMULATION=true`. The **Testing** section then appears in Settings.

**As a rider:** Settings → Testing → *Simulate a ride as rider*. A bot driver ("Sim Driver") posts a ride from your location, your seat is confirmed, and the live ride screen opens. The car drives about 2 km to you and waits at the pickup ("Driver has arrived"). It then starts the ride, follows the real road route to a drop about 4 km away, and completes the ride so you can rate it. The whole run takes about 2–3 minutes.

**As a driver** (needs an approved driver account with a vehicle): Settings → Testing → *Simulate a ride as driver*. A ride is created from your location, and a bot rider ("Sim Rider") requests a seat, paid from its wallet.
1. Accept the request under Requests.
2. On the ride screen, tap **Start ride**.
3. Tap **Simulate the drive** to move the car along the route instead of using your GPS. Without it, your real GPS is shared.
4. Tap **Complete ride** at the end.

For an existing ride, *Get a test rider request* on its details screen adds the bot rider to that ride.

Simulation state is kept in memory, so it works with a single backend instance only. The API is `/dev/simulate` (`as-rider`, `as-driver`, `rides/:id/drive`, `rides/:id/stop`).
