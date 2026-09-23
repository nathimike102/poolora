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
| GET | `/rides/:id` | signed in | One ride |
| POST | `/rides/:id/cancel` | the ride's driver | Cancel the ride. Every pending and confirmed booking is cancelled and refunded in full |
| POST | `/rides/:id/start` | verified driver | Start the ride. Needs at least one confirmed rider. Riders get a "your driver is on the way" push |
| POST | `/rides/:id/complete` | verified driver | Finish the ride. Settles every confirmed booking (earnings, platform fee, coins) and unlocks ratings |
| POST | `/rides/:id/optimize` | verified driver | Best pickup order for the confirmed riders |
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
  "preferences": { "womenOnly": false, "smokingAllowed": false, "petsAllowed": false, "luggageSize": "medium", "maxDetourMins": 15 }
}
```

Rules enforced today: the departure is in the future, 1–8 seats, a price of at least ₹0, and at most 5 active future rides per driver. The backend fetches the driving route and stores its polyline, distance and duration. The price bands and the "2 hours ahead" and "300 km" limits from UC-D02 are not enforced yet (see `planning/11-FEATURE-GAP-ANALYSIS.md`).

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

Phone numbers of the other party appear only on confirmed bookings.

### 5.1 Request seats — `POST /bookings`

```json
{
  "rideId": "66f0…",
  "seatsBooked": 1,
  "useWallet": false,
  "pickup":  { "lng": 77.6412, "lat": 12.9760, "address": "100 Feet Rd" },
  "dropoff": { "lng": 77.6950, "lat": 12.9600, "address": "Marathahalli Bridge" }
}
```

- With `useWallet: true`, the fare is taken from the wallet at once, and the response has `paidViaWallet: true`.
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
- `payment.failed`: records the failure for fraud checks. The booking stays pending so the rider can retry, and a payment that already went through is never overwritten.

In the Razorpay dashboard, the webhook URL is `<APP_BASE_URL>/payments/webhook`, with events `payment.authorized`, `payment.captured` and `payment.failed`.

There are no `/payments/orders` or `/payments/verify` endpoints: booking orders are created by `POST /bookings`, and payments are confirmed by the webhook.

---

## 8. Ratings — `/ratings`

| Method | Path | Purpose |
|---|---|---|
| POST | `/ratings` | Body: `bookingId`, `score` 1–5, optional `tags` (`cleanliness`, `punctuality`, `driving`, `politeness`, `communication`, `safety`, `comfort`, `navigation`, `vehicle_condition`) and `comment` (up to 500 characters). Only for a completed booking you were part of |
| GET | `/ratings/user/:userId` | Ratings a user has received |

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
| POST | `/safety/sos` | signed in | Start an SOS. Body: `bookingId`, `location {lng, lat}`. Admins are alerted at once, and emergency contacts get an SMS with a tracking link when Twilio is enabled |
| GET | `/safety/sos/:id` | participant or admin | SOS state |
| POST | `/safety/sos/:id/location` | participant | Live position during an SOS |
| POST | `/safety/sos/:id/check-in` | participant | Body: `status` (`ok`, `partial_ok`, `not_ok`), optional `notes`, `location`. `not_ok` or missed check-ins escalate |
| POST | `/safety/sos/:id/evidence` | participant | Body: `type` (`audio` or `screenshot`), `url` (https) |
| GET | `/safety/sos/active` | admin | Open incidents |
| POST | `/safety/sos/:id/acknowledge` | admin | Take the incident |
| POST | `/safety/sos/:id/resolve` | admin | Close it, optionally as a false alarm |
| POST | `/safety/sos/:id/notify-police` | admin | Record that police were called |
| GET | `/safety/emergency-contacts` | signed in | The caller's contacts |
| PUT | `/safety/emergency-contacts` | signed in | Replace the list. Each contact has `name`, `phone` (E.164) and `relation`. The API accepts up to 5; the app limits it to 3 |

### 10.1 Public tracking page — `/track`

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/track/sos/:token` | public, token in the link | A web page with the live SOS position, for emergency contacts without the app. The token is random and expires |

---

## 11. Maps — `/maps`

The provider is chosen by `MAPS_PROVIDER`, which defaults to `google` when `GOOGLE_MAPS_API_KEY` is set and to `osm` otherwise:
- `osm`: Photon for suggestions, Nominatim for addresses, OSRM for routes. No key needed
- `google`: the Google APIs

Results are cached in Redis.

| Method | Path | Purpose |
|---|---|---|
| GET | `/maps/autocomplete?input=` | Place suggestions (2–200 characters) |
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

### Parcels — `/parcels` (Phase 4, backend only)

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/parcels/create` | signed in | Send a parcel on a ride |
| POST | `/parcels/:id/accept` | driver | Carry it |
| POST | `/parcels/:id/pickup` | driver | Picked up |
| POST | `/parcels/:id/deliver` | driver | Delivered |
| POST | `/parcels/:id/cancel` | sender | Cancel |
| GET | `/parcels/track/:trackingNumber` | signed in | Status by tracking number |
| GET | `/parcels` | signed in | The caller's parcels |

The app's parcel screens are not connected yet.

### Admin — `/admin` (admin only)

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/metrics` | Platform totals |
| GET | `/admin/rides` | Rides; query `status`, `page`, `limit` |
| GET | `/admin/users` | Users; query `role`, `kycStatus`, `page`, `limit` |
| GET | `/admin/payments` | Payments; query `status`, `page`, `limit` |
| GET | `/admin/demand-heatmap` | Ride demand by area and time |
| GET | `/admin/kyc/:userId/documents` | Short-lived links to a driver's KYC documents |

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
| `driver:milestone` | Approach alerts: within 1 km ("~5 mins"), and "Driver has arrived" within 500 m once stopped |
| `route:deviated` | The car is far from where it should be |
| `chat:message:receive`, `chat:message:sent`, `chat:messages:read`, `chat:typing:*` | Chat |
| `sos:triggered`, `sos:alert`, `sos:location:updated` | SOS (alerts go to the `admin:sos` room) |
| `tracking:error`, `chat:error`, `sos:error` | The request was refused |

With several backend instances, events are shared through the Socket.IO Redis adapter.

---

## 14. Error codes

| HTTP | `error.id` | Meaning |
|---|---|---|
| 400 | `BAD_REQUEST` and specific ids such as `PICKUP_TOO_FAR`, `DROPOFF_TOO_FAR`, `WRONG_DIRECTION`, `MAX_PENDING_BOOKINGS`, `INSUFFICIENT_SEATS`, `SELF_BOOKING` | The request cannot be carried out |
| 401 | `UNAUTHORIZED` | Missing or expired token |
| 403 | `FORBIDDEN` | Signed in, but not allowed |
| 404 | `NOT_FOUND` | No such resource |
| 409 | `CONFLICT`, `PAYMENT_PENDING` | The state does not allow it, for example a booking already answered |
| 422 | `VALIDATION_ERROR` | The body or query failed validation; `details` lists the fields |
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
