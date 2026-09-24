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
| Account blocks never enforced (bug) | Fraud detection set `isBlocked`, and users carry `isSuspended`, but nothing checked them: a user blocked for fraud could keep booking and paying. | Blocked accounts are refused on every request and socket; suspended ones can read but not post or book; suspensions lift themselves when they end. |
| Web admin (UC-A01 to UC-A07) | Only the app's admin screens: verifications, incidents, metrics. | `admin-web/` with a live dashboard, SOS handling, driver applications, disputes, user management, reports, settings and an audit log (section 2.4). |
| Partial refunds on card payments (bug) | A partial refund marked the Razorpay payment `refunded`, so any later refund on the rest was skipped silently. | Payments track the amount refunded and stay `captured` until fully refunded; a refund reports whether it went through. |

### 1.2 Closed in the third pass (24 September 2026)

| Area | Before | Now |
|---|---|---|
| Socket gateway (bug) | Code outside the socket server got an empty gateway, so the HTTP location fallback, the simulator and SOS alerts to admins sent nothing. | The running gateway is shared. |
| Per-rider pickup and drop (UC-D04) | One Start and one Complete for the whole ride. | Arrived, Picked up and Dropped off per rider; dropping a rider settles their booking. |
| No-shows (UC-D07) | Missing. | After "Arrived", a 10-minute wait, then "Report no-show" cancels the booking and pays the driver, less the platform fee. |
| Changing a ride (UC-D08) | Cancel only. | Time (within 2 hours either way), more seats, and the price (within 20%, only before anyone books), until 4 hours before departure. Booked riders are told, and a new time lets them cancel for a full refund. |
| Route deviation (UC-R05) | Measured from the pickup point, with a 10 km threshold. | Measured against the route, 500 m by default (an admin setting); rider, driver and admins are alerted. |
| Approach pushes and check-ins (UC-R05) | Only "started" was a push; no check-ins outside an SOS. | "5 minutes away" and "arrived" are pushes, sent once each. "Are you OK?" every 30 minutes in a ride; two missed prompts raise an SOS. |
| Trip sharing (UC-R08) | Plain text. | A public link with the car's position and ETA that expires an hour after the trip. |
| Receipts and email | No receipts; no email. | Receipt screen and emailed receipts. Email goes out over SMTP (`SMTP_HOST`) for receipts, KYC decisions, account actions, disputes and statements. |
| Disputes in the app | Endpoint only. | "Report a problem" on any past trip. |
| No results (UC-R02 6a) | Empty list. | Nearby and nearby-time alternatives, and "Tell me when a ride appears" (ride alerts). |
| Booking note, biased suggestions | Missing. | A note to the driver on the booking; place search prefers places near the user. |
| Posting a ride (UC-D02) | Any price; only "in the future" checked. | A suggested price from distance, vehicle, commute hours and surge (UC-AI03), with a ±30% band and ₹2–₹15 a km; at least 2 hours ahead; at most 300 km; up to 3 stops; an optional return trip. |
| Navigation, broadcast, statements, badge (UC-D05, D06, D09, D10) | Missing. | "Open route in Maps" with the stops; "Message all riders"; monthly statements shared as CSV or emailed; the Verified Driver badge with progress on the driver's profile. |
| Fraud checks (bug, UC-AI02) | A critical score blocked the account permanently, without the two-admin rule, and flags had no reasons or review. | Critical scores suspend the account until an admin reviews it; flags are stored with their reasons; the web admin's Fraud flags page clears false positives or confirms them. |
| Admin sign-in | No password reset. | "Forgot password?" on the web admin. |
| Emergency contacts (UC-R10) | The API accepted 5 (bug); no verification. | At most 3; one primary; the user chooses who gets the SOS text; contacts confirm by a link in a text message (unconfirmed contacts still get alerts). |
| Ratings (UC-R06) | A single score, any time, no moderation. | Overall plus behaviour, cleanliness and punctuality; within 7 days; a reminder after a day; private problem reports with an instant safety alert; reviews public only after an admin approves them (web admin Reviews page). |
| Help and support (UC-X02) | A contact link. | An in-app FAQ, an urgent safety and payment line, and support requests answered in a thread from the web admin. |
| Parcel payments (bug) | Payments were never recorded, cancelling refunded nothing, drivers were never credited, and Razorpay was required. | Payments recorded by the webhook or taken from the wallet; accepted only once paid; refunded when cancelled or declined before pickup; the driver's share added to earnings. |
| Parcel pooling (Phase 4) | Placeholder screens. | Send a parcel, choose a driver on the route, pay, track, and share the delivery code; drivers accept, pick up and hand over with the code from the ride screen. |
| Trip pooling (Phase 4) | Nothing. | UC-T01 to UC-T05: plan a trip, find partners by compatibility, join by request or invite code, split expenses, vote on activities, and settle up with UPI links. |

---

## 2. Still open

These need a paid outside service, a business decision, or more design:

| Item | Docs | Why it is open |
|---|---|---|
| Masked calls, call recording | UC-D06, UC-A03 | Needs a call-proxy service such as Exotel. Riders and drivers call each other's real numbers. |
| Background checks, automatic document validation | UC-A01 | Needs an identity or verification vendor. Admins check documents by hand, with a checklist. |
| Platform fee on refunds | UC-R09 calls it non-refundable | The fee is part of the fare, so full refunds return it. Keeping it is a business decision. |
| Merging duplicate accounts, appeals | UC-A05 | Needs a policy; merging moves money and history. Appeals go through support requests for now. |
| Chatbot | UC-X02 | Needs a language-model service. The FAQ and support requests cover the other channels. |
| Scheduled and emailed reports, PDF and Excel export; SMS alerts to admins; custom alert rules | UC-A02, UC-A06 | Email exists now, so scheduled reports can be built on it. SMS alerts need Twilio set up. Anomalies are rule-based. |
| Dual approval for critical settings | UC-A07 | A 24-hour revert is used instead. |
| Parcel photo proof and insurance claims | UC-P03, UC-P05 | Delivery uses the recipient's code and name. Photos need upload handling on the driver's side; claims need an insurer. |
| ML matching | UC-AI01 | Matching is a weighted score in the backend; the ML service's `/api/match` is not called. Demand prediction feeds price suggestions and surge. |
| Trip pooling extras | UC-T02, UC-T04 | Organiser ratings come from ride ratings; there is no shared calendar export for confirmed activities. |

---

## 3. Documentation cleanup

The documents disagree with each other and with the code in several places:

1. ~~**Vendors.**~~ Every document names Razorpay for payments and OpenStreetMap (Google optional) for maps. Email is plain SMTP (`SMTP_*` in `backend/.env.example`), so any provider works.
2. ~~**API specification is out of date.**~~ Rewritten from the code in September 2026.
3. ~~**Contradictions in the use cases.**~~ UC-D02 now refuses rides over 300 km, and parcel pooling is Phase 4 everywhere.
4. ~~**Numbering.**~~ `08-TECHNICAL-REQUIREMENTS.md` runs 1–15 (the second "Quality Metrics" was the database configuration), and `03-USE-CASES.md` runs 1–12.
5. ~~**Naming.**~~ The documents say Poolora.
6. ~~**Admin.**~~ The web dashboard the documents describe now exists (`admin-web/`), alongside the app's admin screens.
7. ~~**Tracking interval.**~~ 5 seconds everywhere, as in the app.
8. **Aspirational design.** `02-SYSTEM-ARCHITECTURE.md`, `05-SYSTEM-DESIGN.md`, `06-DATABASE-SCHEMAS.md` and `08-TECHNICAL-REQUIREMENTS.md` still describe a larger target design (PostgreSQL, RabbitMQ, Redux, a web dashboard) that was never built. Each now opens with a status note pointing here and to the API specification. Rewrite them only if they are needed as a reference for new work.

Code hygiene: ~~frontend linting could not run~~ fixed; `npm run lint` passes and CI runs it.

---

## 4. Suggested order

Everything in the earlier plan is done: background jobs, refunds and route search, per-rider pickup and no-shows, trip sharing and check-ins, price rules, admin tools, and the parcel and trip screens. What remains (section 2) depends on vendors or decisions. If one is chosen:

1. Scheduled and emailed admin reports, since email now works.
2. Parcel photo proof at pickup and delivery.
3. A call-proxy vendor for masked calls, if privacy requires it.

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
