# API Specifications

**Poolora REST and real-time API**

This document describes the API the backend serves today (September 2026). It was rebuilt from the route files in `backend/src/routes` and the request schemas in `backend/src/validators`. When the two disagree, the code wins, so update this file in the same change as the route.

---

## 1. Overview

### 1.1 Base URL

| Environment | Base URL |
|---|---|
| Local | `http://localhost:5002` (a phone on the same network uses `http://<LAN IP>:5002`) |
| Production | The value of `APP_BASE_URL`, served behind the Kubernetes ingress (`k8s/ingress.yaml`) |

Routes are served **without a version prefix**, for example `POST /bookings`. Old clients that still call `/api/v1/...` get a `307` redirect to the same path without the prefix, plus the header `X-API-Deprecation`. The Razorpay webhook is the exception: `/api/v1/payments/webhook` is still answered directly, because webhook senders may not follow redirects.

### 1.2 Authentication

Every endpoint needs an access token unless the tables below say *public*. Send it as:

```
Authorization: Bearer <accessToken>
```

The `access_token` cookie is also accepted. Access tokens last 15 minutes and refresh tokens 7 days (`JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY`). Sign-in goes through Firebase phone or Google authentication (`POST /auth/firebase-login`) or the backend's own OTP (`POST /auth/send-otp` and `POST /auth/verify-otp`). `AUTH_PROVIDER` chooses between `firebase`, `custom` and `hybrid`.

Some routes need more than a signed-in user:

- **verified driver**: an approved KYC and a registered vehicle (`requireDriverVerification`)
- **driver capability**: the user has become a driver (`requireCapability(DRIVER)`)
- **admin**: an admin account (`requireAdmin`)

### 1.3 Response format

Success:

```json
{
  "status": "success",
  "code": 200,
  "data": { },
  "timestamp": "2026-09-23T10:30:00.000Z",
  "requestId": "3f1c…"
}
```

Error:

```json
{
  "status": "error",
  "code": 409,
  "error": {
    "id": "PAYMENT_PENDING",
    "message": "The rider has not completed payment for this booking yet",
    "details": []
  },
  "timestamp": "2026-09-23T10:30:00.000Z",
  "requestId": "3f1c…"
}
```

Paginated lists take `page` (from 1) and `limit` query parameters and return the items with `total`, `page` and `limit`.

### 1.4 Coordinates

Request bodies give positions as `{ "lng": 77.59, "lat": 12.97, "address": "…" }`. Stored documents use GeoJSON, `{ "type": "Point", "coordinates": [lng, lat] }`, so responses carry `pickup.location.coordinates` in **longitude, latitude** order.

---

## 2. Auth — `/auth`

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/auth/send-otp` | public, 3 per hour | Send a 6-digit code. Body: `phone` in E.164 form (`+919876543210`) |
| POST | `/auth/verify-otp` | public, 10 per 15 min | Body: `phone`, `otp`; `name` is required for a new account; `email` and `dateOfBirth` are optional. Returns the user and tokens |
| POST | `/auth/firebase-login` | public, 10 per 15 min | Exchange a Firebase ID token (phone or Google sign-in) for Poolora tokens |
| POST | `/auth/refresh-token` | public, 10 per 15 min | Body: `refreshToken`. Returns a new token pair |
| POST | `/auth/logout` | signed in | Ends the session |
| GET | `/auth/me` | signed in | The current user |
| POST | `/auth/kyc` | signed in | Submit driver KYC. Documents are uploaded first (see `/uploads/kyc`) and referenced as `s3://` URIs |
| POST | `/auth/kyc/:userId/approve` | admin | Approve a driver |
| POST | `/auth/kyc/:userId/reject` | admin | Reject with a reason |

A wrong OTP makes the next attempt wait longer (5 s, doubling, up to 15 min). After 5 wrong codes the code is discarded. Accounts are never locked, so nobody can lock out another person's number.

---

## 3. Users — `/users`

| Method | Path | Purpose |
|---|---|---|
| GET | `/users/me` | Own profile |
| PATCH | `/users/me` | Update name, email, photo and preferences |
| GET | `/users/saved-routes` | Routes the rider searches often |
| GET | `/users/kyc/status` | Driver verification state |
| GET | `/users/me/statement` | A driver's earnings for a month (UC-D09). `?month=2026-09` (India time; defaults to this month). Returns `lines` (date, `Trip` / `Late cancellation` / `No-show`, route, rider's first name, fare, platform fee, earnings) and `totals`. Add `&format=csv` for a spreadsheet download |
| POST | `/users/me/statement/email` | Emails that statement to the profile's address with the CSV attached. Body: `month`. `409 NO_EMAIL` without an address, `503 EMAIL_UNAVAILABLE` when SMTP is not set up |
| GET | `/users/me/verified-status` | Progress towards the Verified Driver badge (UC-D10): `verified` and one `checks` entry per rule (`label`, `met`, `progress`) |
| GET | `/users/:id` | Public profile of another user (no phone number) |

---

## 4. Rides — `/rides`

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/rides` | verified driver | Publish a ride |
| GET | `/rides/search` | signed in | Search rides |
| GET | `/rides/upcoming` | signed in | Rides the caller has booked that have not finished |
| GET | `/rides/my-rides` | signed in | The driver's own rides |
| GET | `/rides/demand-prediction` | signed in | Busy times and routes from the ML service |
| GET | `/rides/price-suggestion` | signed in | Suggested seat price and the allowed range for a route (UC-D02 steps 6-7). Query: `pickupLat`, `pickupLng`, `dropoffLat`, `dropoffLng`, `departureTime`, optional `vehicleType` and `stops` (`lat,lng\|lat,lng`, up to 3). Returns `suggested`, `min`, `max`, `distanceKm`, `durationMins`, `surge`, `peak` and a plain-language `explanation` |
| GET | `/rides/:id` | signed in | One ride |
| PATCH | `/rides/:id` | verified driver | Change a published ride (UC-D08): `departureTime` (at most 2 hours earlier or later), `totalSeats` (up only), `pricePerSeat` (within 20%, and only while nobody has booked or asked). Allowed until 4 hours before departure. Booked riders are notified; a new departure time lets them cancel for a full refund |
| POST | `/rides/:id/cancel` | the ride's driver | Cancel the ride. Every pending and confirmed booking is cancelled and refunded in full |
| POST | `/rides/:id/start` | verified driver | Start the ride. Needs at least one confirmed rider. Riders get a "your driver is on the way" push |
| POST | `/rides/:id/complete` | verified driver | Finish the ride. Settles every confirmed booking (earnings, platform fee, coins) and unlocks ratings |
| POST | `/rides/:id/optimize` | verified driver | Best pickup order for the confirmed riders |
| POST | `/rides/:id/message` | the ride's driver | One message to every confirmed rider (UC-D06 step 6). Body: `content`. It lands in each rider's chat for their booking, with a push. Returns `sent`; `409 NO_RIDERS` when nobody is booked |
| POST | `/rides/driver/location` | verified driver | HTTP fallback for a position update. Body: `bookingId`, `lng`, `lat`, optional `speed`, `heading`, `accuracy`, `timestamp`. The app normally sends positions over the socket (section 13) |

### 4.1 Publish a ride — `POST /rides`

```json
{
  "vehicleId": "66f0…",
  "rideType": "car_pool",
  "pickup":  { "lng": 77.6408, "lat": 12.9784, "address": "Indiranagar, Bengaluru" },
  "dropoff": { "lng": 77.6974, "lat": 12.9591, "address": "Marathahalli, Bengaluru" },
  "departureTime": "2026-09-24T08:30:00.000Z",
  "totalSeats": 3,
  "pricePerSeat": 120,
  "recurring": "none",
  "preferences": { "womenOnly": false, "smokingAllowed": false, "petsAllowed": false, "luggageSize": "medium", "maxDetourMins": 15 },
  "waypoints": [{ "lng": 77.6387, "lat": 12.9609, "address": "Domlur" }],
  "returnDepartureTime": "2026-09-24T18:00:00.000Z"
}
```

`waypoints` (optional, up to 3) are stops the route passes through, in order. `returnDepartureTime` (optional, after `departureTime`) also publishes the same ride the other way: ends swapped, stops reversed, same seats, price and rules. The response is `{ ride, returnRide?, returnError? }`; if the return ride breaks a rule, the outbound ride is still published and `returnError` says why.

Rules (UC-D02):

- The ride leaves **at least 2 hours** from now (`422 TOO_SOON`).
- The route, through its stops, is **at most 300 km** (`422 RIDE_TOO_LONG`).
- The **seat price** is within ±30% of the suggestion from `GET /rides/price-suggestion`, and never below ₹2 or above ₹15 a km (`422 PRICE_OUT_OF_RANGE`, with the allowed range in the message). The suggestion is the route distance times a rate for the vehicle (₹2.5 a km for a bike up to ₹5 for an SUV), plus 10% at commute hours (7–10 am, 5–8 pm India time), plus surge of 20–50% when the demand forecast is high. It is rounded to the nearest ₹5, with a ₹20 minimum.
- 1–8 seats, and at most 5 active future rides per driver.

The backend fetches the driving route and stores its polyline, distance and duration.

`GET /rides/:id` adds `driverVerified`, whether the driver has the Verified Driver badge; search results carry the same as `driver.verified`. The badge needs approved documents, 20 or more trips, a rating of 4.7 or higher from at least 10 riders, under 5% cancellations, 90 days on Poolora and no warnings or suspensions.

A ride nobody has booked is **cancelled automatically 1 hour before departure**, and the driver gets a push. A ride posted less than an hour before departure is left alone until it has been up for an hour.

### 4.2 Search — `GET /rides/search`

| Query | Required | Default | Notes |
|---|---|---|---|
| `pickupLng`, `pickupLat`, `dropoffLng`, `dropoffLat` | yes | | |
| `departureTime` | yes | | ISO date |
| `radiusKm` | no | 5 | 1–50 |
| `timeDeviationMins` | no | 120 | 0–480 |
| `maxPrice`, `womenOnly`, `hasAC`, `vehicleType`, `minRating`, `rideType` | no | | Filters |
| `page`, `limit` | no | 1, 20 | `limit` at most 50 |

A ride matches when its **route** passes within `radiusKm` of the rider's pickup and of their drop, in that order, so riders can join part-way. Each ride stores its road route as a GeoJSON LineString (`routeLine`, `2dsphere` index); search runs `$geoNear` on it near the pickup, requires it to cross a circle around the drop, then drops rides going the other way. Up to 200 candidates are considered per search.

The app books a matched ride from the rider's own search points, not from the ride's start and end.

When nothing matches (UC-R02 6a), the response carries `alternatives`: rides found with the radius doubled (up to 50 km) and a window of at least ±3 hours, with the `radiusKm` and `timeDeviationMins` used. The app shows them as "no exact matches" and offers a ride alert.

### 4.3 Ride alerts — `/ride-alerts`

| Method | Path | Purpose |
|---|---|---|
| POST | `/ride-alerts` | "Tell me when a ride appears". Body: `pickup` and `dropoff` (`lng`, `lat`, `address`), optional `departureTime`. With a time, rides leaving within ±3 hours match and the alert ends then; without one it lasts 30 days. Up to 10 open alerts per rider |
| GET | `/ride-alerts` | The caller's open alerts |
| DELETE | `/ride-alerts/:id` | Remove one |

Every new ride is checked against open alerts: when its route passes the rider's pickup and then their drop (within the usual 2 km), the rider gets one push for that ride.

Results are ranked by the in-process matching score in `MatchingEngineClient`: distance from the rider's pickup to the route 40%, closeness of departure time 30%, driver rating 15%, driver acceptance rate 10%, and a low driver cancellation rate 5%. The Python ML service's `/api/match` endpoint is not called.

---

## 5. Bookings — `/bookings`

A booking is a rider's request for seats on a ride. The rider **pays when requesting**, and the driver can accept only once the money is in:

```
rider requests ──► pending ──(driver accepts, payment in)──► confirmed ──(ride completes)──► completed
                     │  │                                        │
                     │  └─ driver declines ─► rejected (refund)  └─ rider/driver cancels ─► cancelled (refund by policy)
                     └──── times out ───────► rejected or cancelled (refund)
```

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/bookings` | signed in | Request seats |
| GET | `/bookings/as-rider` | signed in | The caller's bookings as a rider. Query: `status`, `page`, `limit` |
| GET | `/bookings/as-driver` | signed in | Requests and bookings on the caller's rides |
| POST | `/bookings/:id/confirm` | the ride's driver | Accept. Reserves the seats atomically; `409 PAYMENT_PENDING` until a card or UPI payment is authorized |
| POST | `/bookings/:id/reject` | the ride's driver | Decline. Body: optional `reason`. Full refund |
| GET | `/bookings/:id/cancellation-quote` | rider or driver | What cancelling now would refund (section 5.3) |
| POST | `/bookings/:id/cancel` | rider or driver | Cancel. Body: optional `reason` |
| POST | `/bookings/:id/complete` | the ride's driver | Complete one booking. Normally done for all bookings by `POST /rides/:id/complete` |
| POST | `/bookings/:id/arrived` | the ride's driver | At this rider's pickup (the ride must have started). The rider gets a push, and the no-show wait starts |
| POST | `/bookings/:id/picked-up` | the ride's driver | The rider is in the car. In-ride safety check-ins start |
| POST | `/bookings/:id/dropped-off` | the ride's driver | The rider has been dropped. Settles this booking as `POST …/complete` does |
| POST | `/bookings/:id/no-show` | the ride's driver | After waiting 10 minutes at the pickup (`WAIT_FOR_RIDER` before then). Cancels the booking with no refund; the fare goes to the driver less the platform fee (UC-D07) |
| POST | `/bookings/:id/share` | the booking's rider | A link to `/track/trip/:token` for trusted contacts (UC-R08). Returns `url` and `expiresAt` |
| GET | `/bookings/:id/receipt` | rider or driver | The receipt: trip, fare, service fee, refund, amount paid and method, plus a plain-text version |
| POST | `/bookings/:id/receipt/email` | rider or driver | Emails the receipt to the caller's address (`NO_EMAIL` or `EMAIL_UNAVAILABLE` otherwise). Riders also get it automatically when a trip completes, if they have an email address |

Phone numbers of the other party appear only on confirmed bookings.

### 5.1 Request seats — `POST /bookings`

```json
{
  "rideId": "66f0…",
  "seatsBooked": 1,
  "useWallet": false,
  "pickup":  { "lng": 77.6412, "lat": 12.9760, "address": "100 Feet Rd" },
  "dropoff": { "lng": 77.6950, "lat": 12.9600, "address": "Marathahalli Bridge" },
  "note": "I'll wait at the bus stop by the metro exit."
}
```

- With `useWallet: true`, the fare is taken from the wallet at once, and the response has `paidViaWallet: true`.
- `note` is optional (up to 300 characters) and is shown on the driver's request card.
- Otherwise the response carries a Razorpay order (`razorpayOrder.id`, amount in paise). The app opens Razorpay Checkout with that order, and the result arrives by webhook (section 7).

Rules:
- the pickup and the drop must each be within **2 km of the ride's route** (measured against the road route, so riders can join and leave part-way)
- along the route, the pickup must come before the drop
- at most **3 pending requests** per rider
- no booking of one's own ride
- one active booking per ride

Errors: `PICKUP_TOO_FAR`, `DROPOFF_TOO_FAR`, `WRONG_DIRECTION`, `MAX_PENDING_BOOKINGS`, `INSUFFICIENT_SEATS`, `SELF_BOOKING`, `CONFLICT`.

### 5.2 Automatic rules

A background sweep runs every minute (`backend/src/jobs/BookingSweeper.ts`):

| Rule | Result |
|---|---|
| A card or UPI request is still unpaid **15 minutes** after it was made | `cancelled` |
| The driver has not answered a request within **6 hours**, or the ride has already departed | `rejected`, refunded in full |
| A driver accepts a request and the seats left no longer fit other requests | Those requests are `rejected` at once, refunded in full |

The rider gets a "Request closed" push in each case. A failed card attempt does **not** close the request: the rider can retry on the same order until the 15 minutes are up.

### 5.3 Cancellation and refunds

A rider cancelling a **confirmed** booking gets back a share that depends on the time left before departure (UC-R09):

| Time before departure | Refund |
|---|---|
| More than 24 h | 100% |
| 12–24 h | 50% |
| 6–12 h | 25% |
| Under 6 h | 0% |

What the rider does not get back is paid to the driver as a cancellation fee, less the platform fee. A request that was never accepted, a request the driver declines, and any booking the driver cancels are always refunded in full. Wallet payments go back to the wallet. Captured card and UPI payments are refunded through Razorpay. An authorization that was never captured is released by Razorpay in full.

`GET /bookings/:id/cancellation-quote` returns:

```json
{
  "fare": 400,
  "refundAmount": 200,
  "refundPercent": 50,
  "policy": [
    { "minHoursBeforeDeparture": 24, "refundPercent": 100 },
    { "minHoursBeforeDeparture": 12, "refundPercent": 50 },
    { "minHoursBeforeDeparture": 6,  "refundPercent": 25 },
    { "minHoursBeforeDeparture": 0,  "refundPercent": 0 }
  ]
}
```

The cancelled booking records `refundAmount` and `cancellationFee`.

---

## 6. Wallet — `/wallet`

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/wallet/tiers` | public | Coin tiers and their benefits |
| GET | `/wallet` | signed in | Balance, coins and tier |
| POST | `/wallet/topup` | signed in | Start a top-up of ₹50–₹50,000. Returns a Razorpay order |
| POST | `/wallet/topup/confirm` | signed in | Body: `razorpayOrderId`, `razorpayPaymentId`, `razorpaySignature`. The signature is checked before crediting |
| GET | `/wallet/transactions` | signed in | Wallet history |
| GET | `/wallet/coins/history` | signed in | Coins earned and spent |
| POST | `/wallet/coins/convert` | signed in | Convert at least 100 coins to wallet money |

Coins are earned on completed rides by both rider and driver.

---

## 7. Payments — `/payments`

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/payments/webhook` | Razorpay (HMAC-signed) | Payment events |
| GET | `/payments/history` | signed in | The caller's payments |

The webhook checks `X-Razorpay-Signature` against the raw body with `RAZORPAY_WEBHOOK_SECRET`, and always answers `200` so Razorpay does not retry endlessly. Events:

- `payment.authorized`: records the payment. The driver can now accept the booking.
- `payment.captured`: marks the payment captured. It does **not** confirm the booking; only the driver's accept does, because that is what reserves the seats.
- `payment.failed`: records the failure for fraud checks. The booking stays pending so the rider can retry, and a payment that already went through is never overwritten. The fraud check then scores the rider: high risk flags the account for admin review, and critical risk suspends it until an admin reviews it (see `/admin/fraud`). The check never blocks an account by itself.

In the Razorpay dashboard, the webhook URL is `<APP_BASE_URL>/payments/webhook`, with events `payment.authorized`, `payment.captured` and `payment.failed`.

There are no `/payments/orders` or `/payments/verify` endpoints: booking orders are created by `POST /bookings`, and payments are confirmed by the webhook.

---

## 8. Ratings — `/ratings`

| Method | Path | Purpose |
|---|---|---|
| POST | `/ratings` | Body: `bookingId`, `score` 1–5 (overall), optional `categories` (`behavior`, `cleanliness`, `punctuality`, each 1–5), `tags` (`cleanliness`, `punctuality`, `driving`, `politeness`, `communication`, `safety`, `comfort`, `navigation`, `vehicle_condition`), `comment` (up to 500 characters), `issues` (any of `safety`, `route`, `payment`) and `issueDetails`. Only for a completed booking you were part of, within 7 days of the drop (`422 RATING_WINDOW_CLOSED`). The score counts at once; the comment is public only after an admin approves it. Issues are private, and a safety issue alerts admins at once (`rating:safety` socket event) |
| GET | `/ratings/pending` | Trips the caller finished in the last 7 days and has not rated: `bookingId`, `role`, `rateeName`, `from`, `to`, `completedAt`, `closesAt` |
| GET | `/ratings/user/:userId` | Ratings a user has received. Comments waiting for approval or rejected are left out, and reported issues are never included |
| GET | `/ratings/user/:userId/summary` | `?as=driver` (default) or `rider`. `count`, `overall` and `categories` averages |

A rider who has not rated gets one push reminder a day after the trip (UC-R06 3a).

---

## 9. Chat — `/chat`

Chat is per booking, between its rider and driver.

| Method | Path | Purpose |
|---|---|---|
| POST | `/chat/messages` | Body: `bookingId`, `content` (1–2000 characters), `contentType` `text`, `image` or `location` |
| GET | `/chat/:bookingId/messages` | Conversation history |
| POST | `/chat/:bookingId/read` | Mark as read |
| GET | `/chat/unread-count` | Unread messages across all bookings |

Messages also flow over the socket (section 13). Profanity is filtered.

---

## 10. Safety — `/safety`

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/safety/ride-check-in` | the booking's rider | Answer an in-ride "Are you OK?" prompt. Body: `bookingId`, `status` (`ok` or `help`), optional `location`. `help` raises an SOS at once |
| POST | `/safety/sos` | signed in | Start an SOS. Body: `bookingId`, `location {lng, lat}`. Admins are alerted at once, and emergency contacts get an SMS with a tracking link when Twilio is enabled |
| GET | `/safety/sos/:id` | participant or admin | SOS state |
| POST | `/safety/sos/:id/location` | participant | Live position during an SOS |
| POST | `/safety/sos/:id/check-in` | participant | Body: `status` (`ok`, `partial_ok`, `not_ok`), optional `notes`, `location`. `not_ok` or missed check-ins escalate |
| POST | `/safety/sos/:id/evidence` | participant | Body: `type` (`audio` or `screenshot`), `url` (https) |
| GET | `/safety/sos/active` | admin | Open incidents |
| POST | `/safety/sos/:id/acknowledge` | admin | Take the incident |
| POST | `/safety/sos/:id/resolve` | admin | Close it, optionally as a false alarm |
| POST | `/safety/sos/:id/notify-police` | admin | Record that police were called |
| GET | `/safety/emergency-contacts` | signed in | The caller's contacts, each with `_id`, `name`, `phone`, `relation`, `email`, `primary`, `notifyOnSos`, `verified` and `verificationSentAt` |
| PUT | `/safety/emergency-contacts` | signed in | Replace the list (UC-R10). Each contact has `name`, `phone` (E.164), `relation`, optional `email`, `primary` and `notifyOnSos` (default true). At most 3, each with a different number. Exactly one is primary: the one marked, or the first. A contact whose number is unchanged stays verified. Only contacts with `notifyOnSos` get the SOS text |
| POST | `/safety/emergency-contacts/:contactId/verify` | signed in | Texts the contact a link to confirm. The link works for 7 days. At most one text every 10 minutes per contact (`429 VERIFY_RATE_LIMITED`). Returns `503 SMS_UNAVAILABLE` when Twilio is not set up. An unconfirmed contact still gets SOS texts |

### 10.1 Public tracking page — `/track`

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/track/contact/:token` | public, token in the link | The page an emergency contact opens from their verification text. It shows who added them and has a Confirm button. Opening it changes nothing, so link previews cannot confirm |
| POST | `/track/contact/:token` | public, token in the link | Confirms the contact. The user gets a notification |
| GET | `/track/sos/:token` | public, token in the link | A web page with the live SOS position, for emergency contacts without the app. The token is random and expires |
| GET | `/track/trip/:token` | public, token in the link | A trip a rider shared (UC-R08): first names, the car, the route, the car's latest position and an ETA. Refreshes itself, has no scripts, stops working an hour after the trip ends or when it is cancelled, and logs every visit |

**In-ride safety check-ins (UC-R05).** Every 30 minutes a rider who is in the car gets a push and a `safety:check-in` socket event asking "Are you OK?". An unanswered prompt is repeated after 10 minutes; a second miss raises an SOS automatically. The interval is an admin setting.

---

## 11. Maps — `/maps`

The provider is chosen by `MAPS_PROVIDER`, which defaults to `google` when `GOOGLE_MAPS_API_KEY` is set and to `osm` otherwise:
- `osm`: Photon for suggestions, Nominatim for addresses, OSRM for routes. No key needed
- `google`: the Google APIs

Results are cached in Redis.

| Method | Path | Purpose |
|---|---|---|
| GET | `/maps/autocomplete?input=&lat=&lng=` | Place suggestions (2–200 characters). Optional `lat`/`lng` (the user's position) ranks nearby places first |
| GET | `/maps/geocode?address=` | Address to position |
| GET | `/maps/reverse-geocode?lat=&lng=` | Position to address |
| GET | `/maps/directions` | Route with polyline, distance and duration |
| GET | `/maps/distance` | Distance and time between points |
| GET | `/maps/pickup-to-drop` | Route summary for a trip |
| POST | `/maps/optimize-route` | Best order for several stops |
| POST | `/maps/nearest-driver` | Closest available driver |
| GET | `/maps/traffic-route`, `/maps/navigation`, `/maps/nearby` | Traffic-aware route, turn-by-turn steps, nearby places |
| POST | `/maps/geolocation`, `/maps/grounding`, `/maps/validate-address` | Network-based location, place grounding, address validation |

Under `osm`, the free services answer autocomplete, geocoding, reverse geocoding, routes and distances, which is everything the ride flow needs. The remaining endpoints always call Google. Without `GOOGLE_MAPS_API_KEY` they answer `503 MAPS_SERVICE_UNAVAILABLE` with a plain-language message, and the missing key is logged on the server.

---

## 12. Other endpoints

### Notifications — `/notifications`

| Method | Path | Purpose |
|---|---|---|
| GET | `/notifications` | In-app notifications, paginated |
| GET | `/notifications/unread-count` | Unread count |
| PATCH | `/notifications/:id/read` | Mark one read |
| PATCH | `/notifications/read-all` | Mark all read |

Push notifications go through Firebase Cloud Messaging using the service account. Booking, ride and payment pushes are driven by events: Kafka consumers handle them when Kafka is running, and the API handles them in-process otherwise, so they are sent either way. Chat pushes are sent directly.

### Uploads — `/uploads`

| Method | Path | Purpose |
|---|---|---|
| POST | `/uploads/kyc` | Presigned S3 upload for one KYC document. The app uploads directly to S3, then sends the `s3://` reference in `POST /auth/kyc` |

### Parcels — `/parcels` (Phase 4)

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/parcels/quote` | signed in | Price before sending. Query: `pickupLat`, `pickupLng`, `deliveryLat`, `deliveryLng`, `weight` (kg), optional `insuranceValue`. ₹50, plus ₹5 a km, ₹10 a kg over 5 kg, and 1% of the insured value. Returns `total` and `distanceKm` |
| POST | `/parcels/create` | signed in | Send a parcel on a ride that has not left, and is not your own (`409 SELF_PARCEL`, `409 RIDE_NOT_AVAILABLE`). With `useWallet: true` the wallet pays at once; otherwise the response has a Razorpay order, and the payment webhook records the payment. The response has the one-time `deliveryOtp` to share with the recipient |
| POST | `/parcels/:id/accept` | driver | Carry it. Only once it is paid (`409 PARCEL_NOT_PAID`) |
| POST | `/parcels/:id/reject` | driver | Decline. Body: optional `reason`. The sender is refunded in full |
| POST | `/parcels/:id/pickup` | driver | Picked up |
| POST | `/parcels/:id/deliver` | driver | Delivered, with the recipient's code. 70% of the cost is counted in the driver's earnings |
| POST | `/parcels/:id/cancel` | sender | Cancel before pickup, with a full refund to the wallet or card. Refused once the driver has it (`409 PARCEL_PICKED_UP`) |
| GET | `/parcels/track/:trackingNumber` | signed in | Status by tracking number |
| GET | `/parcels` | signed in | The caller's parcels. `role` (`sender`, `driver`, `receiver`), optional `rideId`. Drivers see only paid requests |

In the app: Services > Parcels. The sender describes the parcel and picks a ride on the route, pays from the wallet or by card, and gets the delivery code once to pass to the recipient. The driver accepts or declines, marks the pickup and hands the parcel over with the code, from the ride screen.

### Admin — `/admin` (admin only)

Used by the web admin (`admin-web/`) and the app's admin screens. Every action that changes something takes a written `reason` of at least a few words and is recorded in the audit log.

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/overview` | Dashboard figures (users, rides, money, safety, system health) and anomalies (UC-A02) |
| GET | `/admin/applications` | Driver applications waiting for review, with document status, risk indicators and an `overdue` flag after 48 hours (UC-A01) |
| POST | `/admin/applications/:userId/request-changes` | Ask for documents again. Body: `documents` (any of `licence`, `registration`, `insurance`, `photo`) and `note`. The driver is notified and can resubmit |
| GET | `/admin/kyc/:userId/documents` | Short-lived links to a driver's KYC documents. A document that cannot be signed is listed in `unavailable` instead of failing the request |
| GET | `/admin/accounts` | Search users. Query: `q` (name, phone or email), `status` (`active`, `suspended`, `blocked`, `pending_block`), `role`, `kycStatus`, `page`, `limit` |
| GET | `/admin/accounts/:id` | Everything about an account: profile, bookings, rides, ratings, payments, disputes, SOS, internal notes, audit entries (UC-A05) |
| POST | `/admin/accounts/:id/suspend` | Body: `days` (7, 15, 30, or `null` for until lifted) and `reason`. The user can sign in but cannot post or book |
| POST | `/admin/accounts/:id/reinstate` | Lift a suspension. Body: `reason` |
| POST | `/admin/accounts/:id/block` | Ask to block permanently. Body: `reason`. Takes effect only when another admin approves |
| POST | `/admin/accounts/:id/block/approve` | Approve a block. Refused (`SECOND_ADMIN_REQUIRED`) for the admin who asked for it |
| POST | `/admin/accounts/:id/block/reject` | Reject a block request. Body: `reason` |
| POST | `/admin/accounts/:id/unblock` | Body: `reason` |
| POST | `/admin/accounts/:id/notes` | Internal note, seen only by admins. Body: `text` |
| GET | `/admin/support` | Support requests. `?status=open` (default: urgent first, then oldest), `answered` or `closed`; optional `category` |
| GET | `/admin/support/:id` | The request with the user, the trip and the thread |
| POST | `/admin/support/:id/reply` | Body: `text`, optional `close`. The user is notified in the app, by push and by email |
| POST | `/admin/support/:id/close` | Close without a reply |
| GET | `/admin/reviews` | Review moderation (UC-R06). `?status=pending` (default: reviews waiting for approval and unhandled safety reports, safety first), `reported` (every rating that reported a problem) or `done` |
| POST | `/admin/reviews/:id/moderate` | Body: `decision` (`approve` publishes the review, `reject` keeps it hidden; either marks a report handled) and optional `note`. Recorded in the audit log |
| GET | `/admin/fraud` | Accounts flagged by the fraud check on failed payments (UC-AI02). `?view=open` (default: waiting, oldest first, `overdue` after 2 hours) or `?view=reviewed` (recent decisions). Each has `fraudLevel` (`flagged` for high risk, `blocked` for critical), `fraudFlags` and `fraudFlaggedAt` |
| POST | `/admin/fraud/:id/review` | Body: `decision` (`cleared` for a false positive, `confirmed`) and `note`. Clearing sets the level back to `clear` and lifts a suspension the check placed; confirming changes nothing else. A block still needs two admins |
| GET | `/admin/disputes` | Query: `status` (`open`, `in_review`, `resolved`), `category`, `page`, `limit` (UC-A04) |
| GET | `/admin/disputes/:id` | The case file: both parties, booking, payments, chat, ratings, SOS, earlier disputes, and `refundable` (what can still be refunded) |
| POST | `/admin/disputes/:id/assign` | Take the case |
| POST | `/admin/disputes/:id/resolve` | Body: `outcome` (`rider`, `driver`, `both`, `dismissed`), `refundAmount`, `driverCompensation`, `warn` and `suspend` (arrays of `rider`/`driver`), `suspendDays`, `justification`. Carries out the refund and wallet payment, records warnings and suspensions, and notifies both parties. `decision.refundStatus` says whether the refund went through or needs a manual one |
| GET | `/admin/sos` | Incidents. Query: `status` (`open`, `resolved`, `false_alarm`, or empty for all) (UC-A03) |
| GET | `/admin/sos/:id` | The incident with rider, driver (including emergency contacts), booking and ride |
| POST | `/admin/sos/:id/acknowledge` | Take the incident |
| POST | `/admin/sos/:id/log` | Add a call or action to the timeline. Body: `text` |
| POST | `/admin/sos/:id/police` | Record that police were called. Body: optional `notes` |
| POST | `/admin/sos/:id/resolve` | Body: `notes`, `isFalseAlarm` |
| GET | `/admin/reports/:type` | `type`: `users`, `rides`, `financial`, `performance`, `safety`. Query: `from`, `to` (at most two years apart; default the last 30 days), `groupBy` (`day`, `week`, `month`), `format=csv`, `xlsx` or `pdf` for a download. Periods are in India time (UC-A06) |
| GET | `/admin/report-schedules` | Scheduled report emails, and `emailEnabled` (false when the server has no SMTP) |
| POST | `/admin/report-schedules` | `{ name, types[], frequency: daily\|weekly\|monthly, format?: xlsx\|pdf\|csv, recipients }` (up to 10 addresses, as an array or comma-separated). Sent at 07:00 India time: daily covers yesterday, weekly (Mondays) the last seven days, monthly (the 1st) last month |
| PATCH | `/admin/report-schedules/:id` | Any of the fields above, or `active`. A new frequency or resuming starts from the next send time |
| DELETE | `/admin/report-schedules/:id` | Stops and removes a schedule |
| POST | `/admin/report-schedules/:id/send` | Sends it now for the period just ended, without moving the schedule. 503 `EMAIL_UNAVAILABLE` without SMTP |
| GET | `/admin/settings` | Every editable setting with its value, default and limits (UC-A07) |
| PUT | `/admin/settings` | Body: `changes` (key to value) and `reason`. All values are validated first; nothing changes unless all are valid. Applies at once, and on other servers within a minute |
| GET | `/admin/settings/history` | Recent changes with before and after values |
| POST | `/admin/settings/revert/:auditId` | Put back what a change replaced, within 24 hours. Body: `reason` |
| GET | `/admin/audit` | The audit log. Query: `action` (prefix such as `user` or `sos`), `actor`, `targetId`, `page`, `limit` |
| GET | `/admin/metrics`, `/admin/rides`, `/admin/users`, `/admin/payments`, `/admin/demand-heatmap` | Older summary endpoints used by the app's admin screens |

Settings an admin can change: platform commission, rider cancellation refund tiers, payment time limit, driver response time, empty-ride cancellation, SOS check-in intervals by risk level, match-score weights (must add up to 100%), distance from the route, default search radius and time window, active rides per driver, and open requests per rider. Payment credentials and message templates are deliberately not editable.

### Trips — `/trips` (Phase 4)

Group trips (UC-T01 to UC-T05). Only members see expenses, activities, settlements, the invite code and members' UPI ids.

| Method | Path | Purpose |
|---|---|---|
| POST | `/trips` | Plan a trip. Body: `title`, `tripType` (`vacation`, `weekend`, `business`), `startDate`, `endDate` (1 to 90 days), `destinations` (`name`, optional `lat`, `lng`; up to 10), `maxGroupSize` (2 to 8, including the organiser), optional `description`, `budgetPerPerson`, `interests`, `itinerary` (`day`, `title`, `notes`) and `visibility` (`public` or `private`) |
| GET | `/trips/search` | Public trips still being planned, with room, that the caller is not on. Query: optional `destination`, `from`, `to`, `interests` (comma-separated), `maxBudget`. Ranked by `compatibility` (0 to 100): shared interests 50%, overlapping dates 30%, budget 20%. Each has `spotsLeft` |
| GET | `/trips/mine` | Trips the caller organises or is on; `pendingRequests` for the organiser |
| GET | `/trips/invite/:code` | Opens a trip by its invite code, including private ones |
| GET | `/trips/:id` | One trip. Private trips need `?code=`. Adds `isMember`, `isOrganizer`, `myRequestStatus` and `viewerId` |
| PATCH | `/trips/:id` | Organiser: change the plan, or `status` (`ongoing`, `completed`, `cancelled`) |
| POST | `/trips/:id/join` | Ask to join. Body: optional `message`, and `code` for a private trip. `409 TRIP_FULL` when full |
| POST | `/trips/:id/requests/:requestId` | Organiser answers. Body: `accept` |
| POST | `/trips/:id/leave` | A member leaves, once their balance is settled |
| PUT | `/trips/:id/upi` | The caller's UPI id for this trip. Body: `upiId` (empty to remove) |
| GET, POST | `/trips/:id/expenses` | List, or add: `description`, `amount`, optional `paidBy` (default the caller) and `splitAmong` (default everyone). Split equally, to the paisa |
| DELETE | `/trips/:id/expenses/:expenseId` | Whoever added it, or the organiser |
| GET | `/trips/:id/settlement` | `total`, `perPerson`, each member's `paid`, `share` and `balance`, and `transfers`: the fewest payments that settle everyone, each with a `upiLink` when the payee added a UPI id |
| POST | `/trips/:id/settlements` | The payer or payee marks a payment made. Body: `from`, `to`, `amount` |
| POST | `/trips/:id/settlement/notify` | Tells each member what they owe or are owed |
| POST | `/trips/:id/activities` | Propose an activity: `title`, optional `date`, `cost`, `durationMins`, `notes`. The proposer votes yes |
| POST | `/trips/:id/activities/:activityId/vote` | Body: `vote` (`yes`, `no`, `maybe`). More than half the group voting yes confirms it and adds its cost to the expenses, paid by the proposer; more than half voting no rejects it |

### Support — `/support`

Help and support requests (UC-X02). The FAQ and the phone line for urgent safety and payment problems are in the app.

| Method | Path | Purpose |
|---|---|---|
| POST | `/support/tickets` | Body: `category` (`account`, `payment`, `dispute`, `technical`, `safety`, `feature`, `feedback`), `subject`, `message`, optional `bookingId` (one of the caller's trips) and `appInfo`. Safety and payment requests are `urgent`; a safety request alerts admins at once (`support:safety` socket event). At most 5 open requests per user (`409 TOO_MANY_TICKETS`) |
| GET | `/support/tickets` | The caller's requests, newest activity first |
| GET | `/support/tickets/:id` | One request with its messages |
| POST | `/support/tickets/:id/reply` | Body: `text`. Adds to the thread; a closed request opens again |

### Disputes — `/disputes`

| Method | Path | Purpose |
|---|---|---|
| POST | `/disputes` | A rider or driver disputes one of their bookings. Body: `bookingId`, `category` (`payment`, `cancellation`, `behavior`, `route`, `quality`), `description` (at least 10 characters), optional `evidenceUrls` (https, up to 5). Allowed up to 30 days after the ride or cancellation, one open dispute per booking per person |
| GET | `/disputes/mine` | Disputes the caller raised or is named in |

### Ride simulator — `/dev/simulate`

Available when `NODE_ENV` is not `production`, or with `ENABLE_RIDE_SIMULATION=true`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/dev/simulate` | Whether simulation is enabled |
| POST | `/dev/simulate/as-rider` | A bot driver posts a ride near you, your seat is confirmed, and the car drives the trip |
| POST | `/dev/simulate/as-driver` | Creates a ride for you with a bot rider's paid request |
| POST | `/dev/simulate/rides/:id/drive` | Move your car along the route instead of using GPS |
| POST | `/dev/simulate/rides/:id/stop` | Stop moving it |

Simulation state lives in memory, so it works on a single backend instance only.

### Health

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Liveness (public) |
| GET | `/` | Service name (public) |

---

## 13. Real-time events (Socket.IO)

Connect to the API origin with the access token:

```js
io(API_BASE_URL, { auth: { token: accessToken } })
```

Every socket joins the room `user:<userId>`.

**Client to server**

| Event | Payload | Purpose |
|---|---|---|
| `driver:location:update` | `bookingId`, `lng`, `lat`, `speed`, `heading`, `accuracy`, `timestamp` | Driver position, every 5 s during a ride |
| `tracking:join` / `tracking:leave` | `bookingId` | Follow a booking's car (rider, driver or admin only) |
| `chat:message:send` | `bookingId`, `content`, `contentType` | Send a chat message |
| `chat:messages:read` | `bookingId` | Mark read |
| `chat:typing:start` / `chat:typing:stop` | `bookingId` | Typing indicator |
| `sos:trigger` | `bookingId`, `location` | Start an SOS |
| `sos:location:update` | `emergencyId`, `location` | SOS position |
| `admin:sos:join` | none | Admins: receive SOS alerts |

**Server to client**

| Event | Purpose |
|---|---|
| `driver:location:updated` | New car position, with ETA and distance to pickup |
| `driver:milestone` | Approach alerts before pickup: within 5 km, within 1 km ("~5 mins"), and "Driver has arrived" within 500 m once stopped. "About 5 minutes away" and "arrived" are also sent as pushes, once each |
| `route:deviated` | The car is more than 500 m (admin setting) from the ride's planned route. Sent to the rider, the driver (with `askReason`) and the `admin:sos` room, with a push to the rider; at most once every 5 minutes per booking |
| `safety:check-in` | An in-ride "Are you OK?" prompt; answer with `POST /safety/ride-check-in` |
| `chat:message:receive`, `chat:message:sent`, `chat:messages:read`, `chat:typing:*` | Chat |
| `sos:triggered`, `sos:alert`, `sos:location:updated` | SOS (alerts go to the `admin:sos` room) |
| `support:safety` | A user opened a safety support request; sent to the `admin:sos` room with `ticketId`, `userId` and `subject` |
| `rating:safety` | A rider reported a safety problem in a rating; sent to the `admin:sos` room with `ratingId`, `bookingId`, `raterId` and `rateeId` |
| `fraud:flagged` | The fraud check flagged (`action: flagged`) or suspended (`action: suspended`) an account; sent to the `admin:sos` room with `userId` and `flags` |
| `tracking:error`, `chat:error`, `sos:error` | The request was refused |

With several backend instances, events are shared through the Socket.IO Redis adapter.

---

## 14. Error codes

| HTTP | `error.id` | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` and specific ids such as `PICKUP_TOO_FAR`, `DROPOFF_TOO_FAR`, `WRONG_DIRECTION`, `MAX_PENDING_BOOKINGS`, `INSUFFICIENT_SEATS`, `SELF_BOOKING` | The request cannot be carried out |
| 401 | `UNAUTHORIZED` | Missing or expired token |
| 403 | `FORBIDDEN`, `ACCOUNT_BLOCKED`, `ACCOUNT_SUSPENDED`, `SECOND_ADMIN_REQUIRED` | Signed in, but not allowed. A blocked account gets `ACCOUNT_BLOCKED` on every request; a suspended one gets `ACCOUNT_SUSPENDED` when it tries to post a ride, book or send a parcel |
| 404 | `NOT_FOUND` | No such resource |
| 409 | `CONFLICT`, `PAYMENT_PENDING` | The state does not allow it, for example a booking already answered |
| 422 | `VALIDATION_ERROR`, `TOO_SOON`, `RIDE_TOO_LONG`, `PRICE_OUT_OF_RANGE` | The body or query failed validation (`details` lists the fields), or a ride breaks a publishing rule (section 4.1) |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected failure |
| 503 | `SERVICE_UNAVAILABLE`, `MAPS_SERVICE_UNAVAILABLE` | A dependency is down or not configured (Razorpay keys, a Google-only map call without a key) |

## 15. Rate limits

Limits are counted in Redis, or in memory when Redis is unavailable:

| Scope | Limit |
|---|---|
| All requests, per IP | 100 per minute |
| `verify-otp`, `firebase-login`, `refresh-token` | 10 per 15 minutes |
| `send-otp` | 3 per hour |

A limited request gets `429 RATE_LIMITED`.
