# API Specifications

**Poolora REST and real-time API**

This document describes the API the backend serves today (last checked against the code on 29 September 2026, after the move to Zimbabwe and Paynow). It was rebuilt from the route files in `backend/src/routes` and the request schemas in `backend/src/validators`. When the two disagree, the code wins, so update this file in the same change as the route.

---

## 1. Overview

### 1.1 Base URL

| Environment | Base URL |
|---|---|
| Local | `http://localhost:5002` (a phone on the same network uses `http://<LAN IP>:5002`) |
| Production | The value of `APP_BASE_URL`, served behind the Kubernetes ingress (`k8s/ingress.yaml`) |

Routes are served **without a version prefix**, for example `POST /bookings`. Old clients that still call `/api/v1/...` get a `307` redirect to the same path without the prefix, plus the header `X-API-Deprecation`.

**Market.** A deployment serves one country, chosen by `MARKET` (default `ZW`, Zimbabwe) from the registry in `backend/src/config/region.ts`. The market sets the time zone (Zimbabwe: `Africa/Harare`, CAT, UTC+2), the phone format (`+263`), the currency (US dollars) and the map area. "Local time" below means the market's time.

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

Request bodies give positions as `{ "lng": 31.05, "lat": -17.83, "address": "…" }`. Stored documents use GeoJSON, `{ "type": "Point", "coordinates": [lng, lat] }`, so responses carry `pickup.location.coordinates` in **longitude, latitude** order.

---

## 2. Auth — `/auth`

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/auth/send-otp` | public, 3 per hour | Send a 6-digit code. Body: `phone`, as `0771 234 567` or E.164 (`+263771234567`) |
| POST | `/auth/verify-otp` | public, 10 per 15 min | Body: `phone`, `otp`; `name` is required for a new account; `email` and `dateOfBirth` are optional. Returns the user and tokens |
| POST | `/auth/firebase-login` | public, 10 per 15 min | Exchange a Firebase ID token (phone or Google sign-in) for Poolora tokens |
| POST | `/auth/refresh-token` | public, 10 per 15 min | Body: `refreshToken`. Returns a new token pair |
| POST | `/auth/logout` | signed in | Ends the session |
| GET | `/auth/me` | signed in | The current user |
| POST | `/auth/kyc` | signed in | Submit driver KYC. Documents are uploaded first (see `/uploads/kyc`) and referenced as `s3://` URIs |
| POST | `/auth/kyc/:userId/approve` | admin | Approve a driver |
| POST | `/auth/kyc/:userId/reject` | admin | Reject with a reason |

A wrong OTP makes the next attempt wait longer (5 s, doubling, up to 15 min). After 5 wrong codes the code is discarded. Accounts are never locked, so nobody can lock out another person's number. A code lasts 5 minutes. For a new number, the first correct `verify-otp` without a `name` returns `{ needsProfile: true }` and keeps the code for another 10 minutes, so the profile form has time; the same code then comes back with `name` (and optional `email` and `dateOfBirth`). A taken email is refused (`409`) without using up the code. Users must be at least 18: a `dateOfBirth` under 18 years ago is refused (`422`), here and in `PATCH /users/me`.

---

## 3. Users — `/users`

| Method | Path | Purpose |
|---|---|---|
| GET | `/users/me` | Own profile |
| PATCH | `/users/me` | Update name, email, photo and preferences. `gender` (`female`, `male`, `other`) can be set until an identity check confirms it; then `409 IDENTITY_VERIFIED`. `language` is one of the market's languages (`en`, `sn`, `nd` in Zimbabwe; UC-X03) |
| GET | `/users/saved-routes` | Routes the rider searches often |
| GET | `/users/kyc/status` | Driver verification state |
| GET | `/users/me/statement` | A driver's earnings for a month (UC-D09). `?month=2026-09` (local time; defaults to this month). Returns `lines` (date, `Trip` / `Late cancellation` / `No-show`, route, rider's first name, fare, platform fee, earnings) and `totals`. Add `&format=csv` for a spreadsheet download |
| POST | `/users/me/statement/email` | Emails that statement to the profile's address with the CSV attached. Body: `month`. `409 NO_EMAIL` without an address, `503 EMAIL_UNAVAILABLE` when SMTP is not set up |
| GET | `/users/me/verified-status` | Progress towards the Verified Driver badge (UC-D10): `verified` and one `checks` entry per rule (`label`, `met`, `progress`) |
| GET | `/users/me/impact` | CO₂ saved by the caller's shared trips, as rider and driver (UC-R11): `allTime` and `thisMonth` (`co2SavedKg`, `kmShared`, `trips`), `months` (the last six, oldest first, `month` as YYYY-MM in market time) and `method` (the emission factors used). An estimate |
| GET | `/users/me/work` | The caller's company programme (UC-C02): `work` (`organisation` with `name` and `active`, `email`, `since`) or `null`, and `pending` (a work email waiting for its link, `email`, `sentAt`) or `null`. A member's `work.contribution` says what the company pays (`sharePercent`, `monthlyCapUsd`, `weekdaysOnly`, site names, `usedThisMonth`), or is `null` when it pays nothing |
| POST | `/users/me/work` | Body: `email`. Emails a confirmation link to a work address on a company's domain; the user joins when they confirm it. `404 NO_COMPANY_PROGRAMME` when no active company has the domain; `409` when the address belongs to another account; `429 WORK_LINK_RATE_LIMITED` within 10 minutes of the last link; `503 MAIL_UNAVAILABLE` without email |
| DELETE | `/users/me/work` | Leave the company programme |
| GET | `/users/me/identity` | The caller's identity check for women-only rides: `status` (`none`, `pending`, `verified`, `rejected`), `gender`, `declaredGender`, `submittedAt`, `reviewedAt`, `rejectionReason` |
| POST | `/users/me/identity` | Send an identity check. Body: `gender`, `documentUrl`, `selfieUrl` (both uploaded first through `/uploads/kyc` with purpose `identity` and `selfie`, and inside the caller's own folder, else `422 INVALID_DOCUMENT`). `409 IDENTITY_VERIFIED` once verified |
| GET | `/users/me/closure` | Whether the account can be closed now: `canClose`, `blockers` (plain-language reasons), `walletBalance`, `coins` |
| DELETE | `/users/me` | Close the account (data protection right to erasure; Google Play account deletion). Body: `confirm: true`, optional `reason`. Refused with `409 ACCOUNT_CLOSE_BLOCKED` while anything is under way (open bookings, upcoming rides, parcels, disputes, an SOS, an unfinished group trip, a withdrawal being paid) or the wallet holds money; admin accounts cannot close themselves. On closing: name, email, date of birth, photo, licence details, vehicles, KYC files in S3, emergency contacts, push tokens, ride alerts and notifications are removed; the Firebase user is deleted; every session is revoked; coins are forfeited. The phone number is freed and can sign up again as a new account. Bookings, payments, ratings and chats stay, attached to an anonymous "Deleted user", because tax law requires the payment records |
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
  "pickup":  { "lng": 31.0522, "lat": -17.8292, "address": "Harare CBD" },
  "dropoff": { "lng": 31.0950, "lat": -17.7600, "address": "Borrowdale, Harare" },
  "departureTime": "2026-09-24T08:30:00.000Z",
  "totalSeats": 3,
  "pricePerSeat": 1,
  "recurring": "none",
  "preferences": { "womenOnly": false, "colleaguesOnly": false, "smokingAllowed": false, "petsAllowed": false, "luggageSize": "medium", "maxDetourMins": 15 },
  "waypoints": [{ "lng": 31.0850, "lat": -17.7950, "address": "Highlands, Harare" }],
  "returnDepartureTime": "2026-09-24T18:00:00.000Z"
}
```

`waypoints` (optional, up to 3) are stops the route passes through, in order. `returnDepartureTime` (optional, after `departureTime`) also publishes the same ride the other way: ends swapped, stops reversed, same seats, price and rules. The response is `{ ride, returnRide?, returnError? }`; if the return ride breaks a rule, the outbound ride is still published and `returnError` says why.

Rules (UC-D02):

- The ride leaves **at least 2 hours** from now (`422 TOO_SOON`).
- The route, through its stops, is **at most 650 km** (`422 RIDE_TOO_LONG`), so the intercity corridors (Harare to Bulawayo, Mutare or Beitbridge) fit.
- The **seat price**, in US dollars, is within ±30% of the suggestion from `GET /rides/price-suggestion`, and never below US$0.02 or above US$0.20 a km (`422 PRICE_OUT_OF_RANGE`, with the allowed range in the message). The suggestion is the route distance times a rate for the vehicle (US$0.04 a km for a bike up to US$0.075 for an SUV, pitched against kombi and bus fares), plus 10% at commute hours (06:00–09:00 and 16:00–19:00 local time), plus surge of 20–50% when the demand forecast is high. It is rounded to 10 cents under US$5 and to 50 cents above, with a US$1 minimum seat price, which wins over the per-km ceiling on very short rides.
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

| POST | `/rides/:id/position` | the ride's driver or a rider on it | A phone on a ride in progress, from the app's background task: the driver's (the car) every 5 s, a rider's every 15 s from pickup to drop. Body: `location`, optional `speed`, `heading`, `accuracy`, `battery`. The car's position reaches each rider's live map as before. About one point every 15 s per phone is stored as the trip trail, kept 30 days, or for good once an SOS, safety report or dispute is attached. While an SOS is open on the ride, each phone's position goes to the admins live (`sos:alert` with `eventType: sos.trail`). Returns `tracking`; false once the ride is over or the rider dropped |

**Women-only rides.** Only a verified woman (an admin-approved identity check, `/users/me/identity`) sees them in search, can filter with `womenOnly=true`, and can book one; anyone else never sees them, `womenOnly=true` answers `403`, and booking one by its id answers `403`. Only a verified woman driver can post one (`preferences.womenOnly`). Search results carry `driver.identityVerified`, and a ride's driver carries `identity.status`.

**Colleagues-only rides (UC-C02).** A driver in an active company programme (`/users/me/work`) can post one (`preferences.colleaguesOnly`); anyone else gets `403 NOT_A_COMPANY_MEMBER`. The ride keeps the driver's company, and only that company's members see it in search, get ride alerts for it and can book it; booking it by id from outside answers `403 COLLEAGUES_ONLY`. While the company is suspended nobody sees it. Search results carry `driver.colleagueAt` (the company's name) only when the driver works at the searcher's company, and `GET /rides/:id` carries `colleagueAt` the same way; a driver's `GET /bookings/driver` carries `rider.colleagueAt` for riders from their company. Nobody's work email is ever sent to another user.

**Company-paid fares (UC-C01).** When a rider's company pays (an active programme with a share and sites; on weekdays and outside public holidays if it says so; a trip that starts or ends within a site's radius; within the person's monthly cap), the booking stores `companyShare`, `organisation` and `companyMonth`. The rider is charged, refunded and cancelled on their own part only (`estimatedFare` − `companyShare`); a cancelled trip costs the company nothing; when the company pays it all the request needs no payment. On completion the platform keeps `platformFeeRate` of the rider's part and `companyFeeRate` (a setting, 10% by default) of the company's part. Receipts carry `companyPaid` and `company`.
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
| POST | `/bookings` | signed in | Request seats. Optional `connection.departsAt`: the rider is catching a bus from the drop (UC-R12); it must leave after the ride and within a day, else `422 BAD_CONNECTION_TIME`. The booking keeps it, with the terminus at the drop if there is one, and the driver sees it on the request |
| POST | `/bookings/quote` | signed in | Same body as `/bookings`. What it would cost: `fare`, `companyShare` (what the rider's company pays, UC-C01), `youPay`, `company`, and `limitedBy: 'cap'` when the company's monthly cap cuts its share. `dropoffHub` (`name`, `kind`) when the drop is within 600 m of a switched-on rank or terminus |
| GET | `/bookings/as-rider` | signed in | The caller's bookings as a rider. Query: `status`, `page`, `limit` |
| GET | `/bookings/as-driver` | signed in | Requests and bookings on the caller's rides |
| POST | `/bookings/:id/confirm` | the ride's driver | Accept. Reserves the seats atomically; `409 PAYMENT_PENDING` until an online payment is in |
| POST | `/bookings/:id/reject` | the ride's driver | Decline. Body: optional `reason`. Full refund |
| GET | `/bookings/:id/cancellation-quote` | rider or driver | What cancelling now would refund (section 5.3) |
| POST | `/bookings/:id/cancel` | rider or driver | Cancel. Body: optional `reason` |
| POST | `/bookings/:id/complete` | the ride's driver | Complete one booking. Normally done for all bookings by `POST /rides/:id/complete` |
| POST | `/bookings/:id/arrived` | the ride's driver | At this rider's pickup (the ride must have started). The rider gets a push, and the no-show wait starts |
| POST | `/bookings/:id/picked-up` | the ride's driver | The rider is in the car. Body: `pin`, the rider's 4-digit pickup code, so the rider knows it is the right car before getting in (`422 WRONG_PICKUP_PIN`; after 5 wrong codes `409 PICKUP_PIN_LOCKED`, the rider is warned and admins are told). In-ride safety check-ins start |
| POST | `/bookings/:id/in-car` | the booking's rider | The rider confirms the pickup in their own app, when the code cannot be exchanged or is locked |
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
  "pickup":  { "lng": 31.0530, "lat": -17.8270, "address": "Samora Machel Ave" },
  "dropoff": { "lng": 31.0930, "lat": -17.7620, "address": "Borrowdale Village" },
  "note": "I'll wait at the kombi stop by the bank."
}
```

- With `useWallet: true`, the fare is taken from the wallet at once, and the response has `paidViaWallet: true`.
- `note` is optional (up to 300 characters) and is shown on the driver's request card.
- Otherwise the booking is created with `paymentMethod: "online"`, and the app pays for it with `POST /payments/start` (section 7). The driver can accept only once it is paid.

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
| An online-payment request is still unpaid **15 minutes** after it was made | `cancelled` |
| The driver has not answered a request within **6 hours**, or the ride has already departed | `rejected`, refunded in full |
| A driver accepts a request and the seats left no longer fit other requests | Those requests are `rejected` at once, refunded in full |

The rider gets a "Request closed" push in each case. A failed or cancelled payment does **not** close the request: the rider can try again, with the same or another method, until the 15 minutes are up. The sweeper also asks Paynow about payments still pending, in case a status update was lost. A payment that arrives after its request closed, or a second payment for the same request, goes to the rider's wallet.

### 5.3 Cancellation and refunds

A rider cancelling a **confirmed** booking gets back a share that depends on the time left before departure (UC-R09):

| Time before departure | Refund |
|---|---|
| More than 24 h | 100% |
| 12–24 h | 50% |
| 6–12 h | 25% |
| Under 6 h | 0% |

What the rider does not get back is paid to the driver as a cancellation fee, less the platform fee. A request that was never accepted, a request the driver declines, and any booking the driver cancels are always refunded in full. Every refund goes to the Poolora wallet, at once: Paynow has no refund API. Riders can then use the balance or withdraw it to mobile money (section 6).

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
| POST | `/wallet/topup` | signed in | Start a top-up of US$1–US$500, paid through Paynow. Body: `amount`, `channel`, `phone`, `currency` as for `POST /payments/start`. Returns the `charge`; follow it at `/payments/charges/:reference`. The wallet may hold at most US$1,000 |
| GET | `/wallet/withdrawals` | signed in | The caller's withdrawals |
| POST | `/wallet/withdrawals` | signed in | Cash out to mobile money. Body: `amount` (US$2–US$1,000), `channel` (`ecocash`, `onemoney`, `innbucks`), `payNumber`. The number must be on that network (EcoCash 077/078, OneMoney 071). The amount is held from the balance at once; one pending withdrawal at a time (`409 WITHDRAWAL_PENDING`). An admin sends the money and records the transaction id, or rejects it and the amount comes back |
| POST | `/wallet/withdrawals/:id/cancel` | signed in | Cancel a pending withdrawal; the amount comes back |
| GET | `/wallet/transactions` | signed in | Wallet history |
| GET | `/wallet/coins/history` | signed in | Coins earned and spent |
| POST | `/wallet/coins/convert` | signed in | Convert at least 100 coins to wallet money |

Coins are earned on completed rides by both rider and driver, and convert at US$0.01 each (`COIN_TO_USD_RATE`).

---

## 7. Payments — `/payments`

Online payments go through **Paynow** (paynow.co.zw): EcoCash, OneMoney, InnBucks and Visa/Mastercard, in US dollars, or in ZiG when an admin has set an exchange rate. Amounts owed are always in US dollars; a ZiG payment converts at the admin's rate when it starts, and the rate is stored on the payment.

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/payments/options` | signed in | Which currencies are enabled now (`currencies`, with `zwgPerUsd` for ZiG) and the payment `channels` |
| POST | `/payments/start` | signed in | Pay for a seat request or a parcel. Body: `purpose` (`booking` or `parcel`), `targetId`, `channel` (`ecocash`, `onemoney`, `innbucks`, `card`), `phone` (the mobile money number; not needed for `card`), `currency` (`USD` default, or `ZWG`). Returns the `charge` (below) |
| GET | `/payments/charges/:reference` | the payer | Where a payment stands. While it is pending, the backend asks Paynow at most every 5 seconds, so the app can poll this |
| GET | `/payments/history` | signed in | The caller's payments |
| POST | `/payments/paynow/result` | Paynow (hash-verified) | Paynow's status updates |
| GET | `/payments/paynow/return` | public | The page a card payer lands on after Paynow; it tells them to go back to the app |

**What the payer sees.** EcoCash and OneMoney push a PIN prompt to the phone. InnBucks returns an `authorizationCode` to enter or scan in the InnBucks app. Card returns a `redirectUrl` to Paynow's page. The `charge` carries `reference`, `status` (`pending`, `paid`, `failed`, `refunded`, `disputed`), `channel`, `currency`, `amountUsd`, `chargedAmount`, `exchangeRate`, `instructions`, `failureReason` and `creditedToWallet`.

**Status updates.** Paynow posts a URL-encoded form to `<APP_BASE_URL>/payments/paynow/result`; the backend sends that address with every payment, so nothing needs setting in Paynow. Each message is verified by its SHA-512 hash with the integration key (both integrations are tried, and the currency must match the charge). The endpoint always answers `200`. A paid charge is applied exactly once: the booking or parcel is marked paid, or the top-up credited. A payment that is no longer needed goes to the payer's wallet. A reported amount lower than the charge marks it `disputed` for an admin. Charges nobody pays are failed after 24 hours.

**References.** Each attempt has its own reference, such as `BK-<booking id>-<6 hex characters>` (`PC-` for parcels, `WT-` for top-ups), so two quick taps on Pay never send Paynow the same reference.

**Refunds.** Paynow has no authorise-then-capture and no refund API. So a request is paid before the driver can accept, and refunds go to the Poolora wallet.

**Fraud checks.** A failed payment is recorded for the fraud check, which scores the payer: high risk flags the account for admin review, and critical risk suspends it until an admin reviews it (see `/admin/fraud`). The check never blocks an account by itself.

---

## 8. Ratings — `/ratings`

| Method | Path | Purpose |
|---|---|---|
| POST | `/ratings` | Body: `bookingId`, `score` 1–5 (overall), optional `categories` (`behavior`, `cleanliness`, `punctuality`, each 1–5), `tags` (`cleanliness`, `punctuality`, `driving`, `politeness`, `communication`, `safety`, `comfort`, `navigation`, `vehicle_condition`), `comment` (up to 500 characters), `issues` (any of `safety`, `route`, `payment`), `issueDetails`, and `safety`: the confidential answer to "Did you feel safe?" (1 no, 3 mostly, 5 yes). `safety` is never returned by the rating endpoints; it is averaged apart from the public rating, shown only to admins, and used in ride ranking once a driver has three. An answer of 2 or less alerts admins like a safety issue. Only for a completed booking you were part of, within 7 days of the drop (`422 RATING_WINDOW_CLOSED`). The score counts at once; the comment is public only after an admin approves it. Issues are private, and a safety issue alerts admins at once (`rating:safety` socket event) |
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
| POST | `/safety/ride-check-in` | the booking's rider | Answer an in-ride "Are you OK?" prompt. Body: `bookingId`, `status` (`ok` or `help`), optional `location`. `help` raises an SOS at once. `ok` also stands down an SOS raised for missed prompts if the contacts have not been texted yet |
| GET | `/safety/sos/current` | signed in | What the SOS screen opens with: `sos` (the caller's open SOS, or null) and `bookingId` (that SOS's booking, else the ride under way, else the confirmed ride leaving closest to now within 3 hours; never a later one) |
| POST | `/safety/sos` | the booking's rider or driver | Raise an SOS. Body: `bookingId`, optional `location {lng, lat}`: without it the car's last reported position, else the pickup point, is used. Every admin is paged at once (push and SMS) and the dashboard is alerted. The caller's SOS contacts are texted `contactsDueAt` later (10 seconds by default, an admin setting). Raising again while one is open returns it re-raised (risk high, team paged again), never `409` |
| POST | `/safety/sos/:id/cancel` | the person who raised it | Cancel an accidental SOS inside the window: closed as a false alarm, contacts never texted, team told. After the contacts are texted, `409 SOS_CANCEL_WINDOW_CLOSED` |
| GET | `/safety/sos/:id` | the person who raised it, or an admin | SOS state. The other person on the ride gets `403`: they may be the reason for it |
| POST | `/safety/sos/:id/location` | the person who raised it | Live position during an SOS, every 5 seconds, also from the app's background task with the screen off. Also shows the phone is still with them: three intervals without one (`checkInIntervalSeconds`, by risk level) mark it out of contact and page the team. Optional `battery` (0 to 1): when the phone goes quiet, staff are told whether it probably ran out or was switched off. Returns `open`; once it is false the app stops tracking |
| POST | `/safety/sos/:id/check-in` | the person who raised it | Body: `status` (`ok`, `partial_ok`, `not_ok`), optional `notes`, `location`. `ok` inside the cancel window cancels; after it, it sets `userSafeAt` and tells the team and the texted contacts, but the SOS stays open until an admin closes it. `partial_ok` and `not_ok` raise the risk level; `not_ok` pages the team by SMS |
| POST | `/safety/sos/:id/details` | the person who raised it | "What's happening?" after the alert has gone. Body: `threat` (`driver`, `passenger`, `outside`, `medical`, `accident`, `other`). Naming someone on the ride raises the risk; medical or accident tells the team the other person may help |
| POST | `/safety/sos/:id/audio-upload` | the person who raised it | A presigned upload for one part of SOS audio. Body: `contentType` (`audio/mp4`, `audio/m4a` or `audio/aac`). Stored with the incident (`sos/<id>/`), not the user, so closing an account never deletes it |
| POST | `/safety/sos/:id/evidence` | the person who raised it | Body: `type` (`audio` or `screenshot`), `url`: an https link, or an `s3://` file from this incident's audio upload (`422 INVALID_DOCUMENT` otherwise) |
| GET | `/safety/sos/active` | admin | Open incidents |
| POST | `/safety/sos/:id/acknowledge` | admin | Take the incident; the user is told who has it. `400` if someone already has |
| POST | `/safety/sos/:id/resolve` | admin | Close it with a note, optionally as a false alarm. The user and texted contacts are told. `409 SOS_CLOSED` if already closed |
| POST | `/safety/sos/:id/notify-police` | admin | Record that police were called |
| GET | `/safety/emergency-contacts` | signed in | The caller's contacts, each with `_id`, `name`, `phone`, `relation`, `email`, `primary`, `notifyOnSos`, `verified` and `verificationSentAt` |
| PUT | `/safety/emergency-contacts` | signed in | Replace the list (UC-R10). Each contact has `name`, `phone` (E.164), `relation`, optional `email`, `primary` and `notifyOnSos` (default true). At most 3, each with a different number. Exactly one is primary: the one marked, or the first. A contact whose number is unchanged stays verified. Only contacts with `notifyOnSos` get the SOS text |
| POST | `/safety/emergency-contacts/:contactId/verify` | signed in | Texts the contact a link to confirm. The link works for 7 days. At most one text every 10 minutes per contact (`429 VERIFY_RATE_LIMITED`). Returns `503 SMS_UNAVAILABLE` when Twilio is not set up. An unconfirmed contact still gets SOS texts |

An SOS record carries, besides the above: `contactsState` (`pending` in the cancel window, then `sent`, or `none`, `unavailable`, `cancelled`), `contactsDueAt`, `locationSource` (`device`, `ride`, `pickup`), `userSafeAt`, `lostContactAt`, `cancelledAt`, `lastPagedAt` and `pageCount`. A background job (`jobs/SosMonitor.ts`, every 15 seconds) sends due contact texts, marks phones out of contact, and pages every admin again while nobody has taken an SOS (every 5 minutes by default).

### 10.1 Public tracking page — `/track`

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/track/contact/:token` | public, token in the link | The page an emergency contact opens from their verification text. It shows who added them and has a Confirm button. Opening it changes nothing, so link previews cannot confirm |
| POST | `/track/contact/:token` | public, token in the link | Confirms the contact. The user gets a notification |
| GET | `/track/work/:token` | public, token in the link | The page opened from a work-email link (UC-C02), with a Confirm button. Opening it changes nothing, so mail scanners cannot confirm. Links work for 24 hours |
| POST | `/track/work/:token` | public, token in the link | Confirms the work email: the user joins the company and is notified |
| GET | `/track/sos/:token` | public, token in the link | A web page for emergency contacts without the app: the first name, the latest position, whether the safety team has it, whether the person says they are safe or the phone is out of contact, and while open the trip, the other person's first name and the car with its plate. Never phone numbers. Refreshes every 15 seconds; the token is random and lasts 7 days |
| GET | `/track/trip/:token` | public, token in the link | A trip a rider shared (UC-R08): first names, the car, the route, the car's latest position and an ETA. Refreshes itself, has no scripts, stops working an hour after the trip ends or when it is cancelled, and logs every visit |

**In-ride safety check-ins (UC-R05).** Every 30 minutes a rider who is in the car gets a push and a `safety:check-in` socket event asking "Are you OK?". An unanswered prompt is repeated after 10 minutes; a second miss raises an SOS automatically. That SOS pages the team at once but gives the rider 5 minutes to answer before their contacts are texted. The interval is an admin setting.

---

## 11. Maps — `/maps`

The provider is chosen by `MAPS_PROVIDER`, which defaults to `google` when `GOOGLE_MAPS_API_KEY` is set and to `osm` otherwise:
- `osm`: Photon for suggestions, Nominatim for addresses, OSRM for routes. No key needed
- `google`: the Google APIs

Results are cached in Redis.

| Method | Path | Purpose |
|---|---|---|
| GET | `/maps/autocomplete?input=&lat=&lng=` | Place suggestions (2–200 characters). Optional `lat`/`lng` (the user's position) ranks nearby places first. Switched-on kombi ranks and bus termini that match come first (UC-R12), with `hub` (`kombi_rank`, `bus_terminus`), `lat` and `lng` |
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

## 11.5 Car trackers

A GPS tracker in a driver's car (UC-D11) reports to Poolora's Traccar gateway (`infra/traccar`), which stores nothing and posts each position here.

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/users/me/trackers` | signed in | The caller's cars with their trackers (`deviceId`, `linkedAt`, `lastReportAt`, `tracked`: reported in the last day), and `gateway` (`host`, `port`, `protocol`) to point a tracker at |
| PUT | `/users/me/vehicles/:vehicleId/tracker` | the car's owner | Body: `deviceId` (6 to 20 letters or digits; spaces are removed). `409 TRACKER_IN_USE` if another car has it |
| DELETE | `/users/me/vehicles/:vehicleId/tracker` | the car's owner | Unlink |
| POST | `/trackers/traccar` | the gateway, with `X-Poolora-Tracker-Key` (`TRACKER_GATEWAY_KEY`; off when unset) | One position as Traccar posts it (`forward.type=json`): `device.uniqueId`, `position.latitude`, `longitude`, `speed` (knots), `valid`, `attributes.batteryLevel` (%) and `attributes.alarm`. Stored as the car's trail (`role: vehicle`) only while the car is on a ride in progress or an SOS on one of its rides is open; otherwise only the report time is kept. Alarm `sos` during a ride raises an SOS (`raisedVia: tracker`); `powerCut`, `removing` and `tampering` alert the safety team. Each alarm counts once per ride per 5 minutes. Always `200`, so the gateway does not retry |

Search results carry `driver.trackedCar`, and a ride carries `trackedCar`.

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
| POST | `/uploads/kyc` | Presigned S3 upload for one private document. Body: `purpose` (`licence`, `registration`, `insurance`, `vehicle-photo` for driver KYC; `identity`, `selfie` for the identity check), `contentType`. The app uploads directly to S3, then sends the `s3://` reference in `POST /auth/kyc` or `POST /users/me/identity` |

### Parcels — `/parcels` (Phase 4)

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/parcels/quote` | signed in | Price before sending. Query: `pickupLat`, `pickupLng`, `deliveryLat`, `deliveryLng`, `weight` (kg), optional `insuranceValue`. US$2, plus US$0.35 a km for the first 20 km and US$0.02 a km after that (straight-line distance), US$0.50 a kg over 5 kg, rounded to 10 cents, plus 1% of the insured value. Set against Harare's motorbike couriers in town and Zimpost between cities. Returns `total` and `distanceKm` |
| POST | `/parcels/create` | signed in | Send a parcel on a ride that has not left, and is not your own (`409 SELF_PARCEL`, `409 RIDE_NOT_AVAILABLE`). With `useWallet: true` the wallet pays at once; otherwise it is paid with `POST /payments/start` (`purpose: parcel`). The response has the one-time `deliveryOtp` to share with the recipient |
| POST | `/parcels/:id/accept` | driver | Carry it. Only once it is paid (`409 PARCEL_NOT_PAID`) |
| POST | `/parcels/:id/reject` | driver | Decline. Body: optional `reason`. The sender is refunded in full |
| POST | `/parcels/:id/pickup` | driver | Picked up |
| POST | `/parcels/:id/deliver` | driver | Delivered, with the recipient's code. 70% of the cost is counted in the driver's earnings |
| POST | `/parcels/:id/cancel` | sender | Cancel before pickup, with a full refund to the wallet. Refused once the driver has it (`409 PARCEL_PICKED_UP`) |
| POST | `/parcels/:id/photos` | sender, driver or recipient | Photo proof (UC-P03). Body: `stage` (`pickup`, `delivery`, `claim`), `data` (base64 JPEG or PNG, up to 5 MB), optional `lat`, `lng` |
| GET | `/parcels/:id/photos` | parties or admin | The parcel's photos |
| GET | `/parcels/:id/photos/:photoId` | parties or admin | One image |
| POST | `/parcels/:id/claims` | sender or recipient | Claim for a damaged or lost parcel (UC-P05). Body: `kind` (`damaged`, `lost`), `description`, `amount`, `photoIds` (up to 6). Cover is the declared value for insured parcels, otherwise the delivery charge. One open claim per parcel |
| GET | `/parcels/:id/claims` | parties or admin | Claims on the parcel |
| GET | `/parcels/track/:trackingNumber` | signed in | Status by tracking number |
| GET | `/parcels` | signed in | The caller's parcels. `role` (`sender`, `driver`, `receiver`), optional `rideId`. Drivers see only paid requests |

In the app: Services > Parcels. The sender describes the parcel and picks a ride on the route, pays from the wallet or through Paynow, and gets the delivery code once to pass to the recipient. The driver accepts or declines, marks the pickup and hands the parcel over with the code, from the ride screen.

### Admin — `/admin` (admin only)

Used by the web admin (`admin-web/`) and the app's admin screens. Every action that changes something takes a written `reason` of at least a few words and is recorded in the audit log.

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/overview` | Dashboard figures (users, rides, money, safety, system health), `impact` (CO₂ saved by every completed booking, UC-R11) and anomalies (UC-A02) |
| GET | `/admin/applications` | Driver applications waiting for review, with document status, risk indicators and an `overdue` flag after 48 hours (UC-A01) |
| POST | `/admin/applications/:userId/recheck` | Run the automatic document checks again (Zimbabwe plate format, licence, driver age, vehicle age, duplicates), and the vendor background check when `KYC_VERIFY_URL` is set |
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
| GET | `/admin/accounts/:id/duplicates` | Accounts that look like the same person: same name, or the same phone (push token) |
| POST | `/admin/accounts/:id/merge` | Ask to merge this duplicate into another account. Body: `targetId`, `reason`. The duplicate must have nothing under way |
| GET | `/admin/merges` | Merge requests. `?status=` |
| POST | `/admin/merges/:id/approve` | A different admin approves; history, wallet money and coins move, and the duplicate is closed (`SECOND_ADMIN_REQUIRED` for the admin who asked) |
| POST | `/admin/merges/:id/reject` | Body: `reason` |
| GET | `/admin/appeals` | Appeals against suspensions and blocks (UC-A05 3a) |
| POST | `/admin/appeals/:id/decide` | Body: `decision`, `note`. Decided by an admin other than the one who acted |
| GET | `/admin/accounts/:id/calls` | Masked calls the user made or received |
| GET | `/admin/calls/:id/recording` | A call's recording, when recording is on |
| GET | `/admin/withdrawals` | Wallet withdrawals. `?status=pending` (default), `paid`, `rejected` |
| POST | `/admin/withdrawals/:id/paid` | Record that the money was sent. Body: `payoutReference` (the mobile money transaction id). The user is notified |
| POST | `/admin/withdrawals/:id/reject` | Body: `note`. The amount goes back to the wallet |
| GET | `/admin/organisations` | Companies with a programme (UC-C01), with their member counts |
| POST | `/admin/organisations` | Body: `name`, `domains` (the company's own email domains; public services such as gmail.com are refused, and a domain belongs to one company), `billingContact` (`name`, `email`, `phone`), `notes`. Audited |
| GET | `/admin/organisations/:id` | The company and its members (name, phone, work email, joined) |
| PATCH | `/admin/organisations/:id` | Any of the fields above, and `status` (`active`, `suspended`). Removing a domain stops new joins with it; members stay. Audited. `policy` (UC-C01): `sharePercent` (0–100), `monthlyCapUsd` (0 for no limit), `weekdaysOnly`, and `sites` (up to 10: `name`, `address`, `radiusKm` 0.2–20; a site without `lat`/`lng` is found on the map from its address, else `422 SITE_NOT_FOUND`). Applies to bookings made afterwards |
| DELETE | `/admin/organisations/:id/members/:userId` | Removes someone from the company. `?reason=` for the audit log |
| GET | `/admin/organisations/:id/invoices` | The company's monthly bills (UC-C03), newest first, without their lines: `number`, `month`, `trips`, `members`, `amount`, `adjustments`, `total`, `status` (`issued`, `paid`), `overdue`, `issuedAt`, `dueAt` (30 days on), `emailedAt` or `emailError`, `paidAt`, `paidReference`. The company's `billingHold` (on `GET /admin/organisations/:id`) is set while a bill is more than 30 days unpaid; its contribution to fares pauses until then |
| POST | `/admin/organisations/:id/invoices` | Bills last month now for trips not billed yet, and emails it. `409 NOTHING_TO_BILL` when there is nothing. Audited |
| GET | `/admin/invoices/:id` | One bill with its lines (date, member, fare, company share, CO₂; never routes or places) |
| GET | `/admin/invoices/:id/file` | The bill as a file: `?format=pdf` (default) or `xlsx` |
| POST | `/admin/invoices/:id/paid` | Body: `reference` (the bank transfer's). Lifts the billing hold once nothing else is overdue. Audited |
| POST | `/admin/invoices/:id/adjust` | Body: `amount` (negative for a credit), `reason`. Only before payment; the total never goes below zero. Audited |
| POST | `/admin/organisations/:id/admins` | Body: `name`, `email`. Names a company admin (UC-C01 step 3): the address must be on the company's domains or be its billing contact; Poolora admins and another company's admins are refused. Without an account they get one, and an email with a link to set a password (Firebase). Audited |
| GET | `/admin/hubs` | Kombi ranks and bus termini (UC-R12), and `suggestions`: names in the market registry not added yet |
| POST | `/admin/hubs` | Body: `name`, `kind` (`kombi_rank`, `bus_terminus`), `city`, `address`, `aliases`, and `lat`/`lng` or else it is found on the map from its address (`422 HUB_NOT_FOUND`; outside the market `422 OUTSIDE_MARKET`). Starts switched off. Audited |
| PATCH | `/admin/hubs/:id` | Any of the fields, and `active` to show it to riders. Audited |
| DELETE | `/admin/hubs/:id` | Audited |
| DELETE | `/admin/organisations/:id/admins/:userId` | Removes a company admin. Audited |
| GET | `/admin/parcel-claims` | Parcel claims |
| POST | `/admin/parcel-claims/:id/decide` | Body: `decision` (`approve`, `reject`), `note` (the claimant sees it), optional `payout` (up to the cover limit; paid to the wallet) and `insurerReference` |
| GET | `/admin/parcels/:id/photos/:photoId` | A parcel photo |
| GET, POST | `/admin/alert-rules` | Custom alert rules (UC-A02): `metric` (new or open SOS, SOS waiting over 5 minutes, bookings or cancellations today as % of normal, fraud flags, urgent support, open disputes, overdue driver applications, server error rate), `comparator` (`above`, `below`), `threshold`, `channels` (`email`, `sms`), admins to tell, `cooldownMins` (5–1440) |
| PATCH, DELETE | `/admin/alert-rules/:id` | Change or remove a rule |
| POST | `/admin/alert-rules/:id/test` | Send a test alert |
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
| GET | `/admin/identity` | Identity checks for women-only rides. Query: `status` (`pending` default, `verified`, `rejected`). Oldest first |
| GET | `/admin/identity/:userId` | One check, with 5-minute links to the ID photo and the selfie while it waits. Both are deleted as soon as it is decided (`photosDeleted`) |
| POST | `/admin/identity/:userId/approve` | Body: `gender`, the gender the person lives as. The ID proves identity, not gender. The user is told |
| POST | `/admin/identity/:userId/reject` | Body: `reason` (at least 5 characters), shown to the user, who can send it again |
| GET | `/admin/sos` | Incidents. Query: `status` (`open`, `resolved`, `false_alarm`, or empty for all) (UC-A03) |
| GET | `/admin/sos/:id` | The incident with rider, driver (including emergency contacts), booking and ride; `history` (the person's other SOS and false alarms in the last 90 days), the market's `emergencyNumbers`, and `evidence` with 15-minute links to play recordings; to identify everyone: `vehicle` (make, model, colour, year, plate, photos), `coPassengers` (every other rider on the ride), `moneyNumbers` (mobile money numbers each person has paid or been paid with), `messages` and `calls` between them, and `trails` (every phone on the ride from the trip trail) |
| POST | `/admin/sos/:id/acknowledge` | Take the incident |
| POST | `/admin/sos/:id/log` | Add a call or action to the timeline. Body: `text` |
| POST | `/admin/sos/:id/police` | Record that police were called. Body: optional `notes` |
| POST | `/admin/sos/:id/resolve` | Body: `notes`, `isFalseAlarm` |
| GET | `/admin/reports/:type` | `type`: `users`, `rides`, `financial`, `performance`, `safety`. Query: `from`, `to` (at most two years apart; default the last 30 days), `groupBy` (`day`, `week`, `month`), `format=csv`, `xlsx` or `pdf` for a download. Periods are in local time (UC-A06) |
| GET | `/admin/report-schedules` | Scheduled report emails, and `emailEnabled` (false when the server has no SMTP) |
| POST | `/admin/report-schedules` | `{ name, types[], frequency: daily\|weekly\|monthly, format?: xlsx\|pdf\|csv, recipients }` (up to 10 addresses, as an array or comma-separated). Sent at 07:00 local time: daily covers yesterday, weekly (Mondays) the last seven days, monthly (the 1st) last month |
| PATCH | `/admin/report-schedules/:id` | Any of the fields above, or `active`. A new frequency or resuming starts from the next send time |
| DELETE | `/admin/report-schedules/:id` | Stops and removes a schedule |
| POST | `/admin/report-schedules/:id/send` | Sends it now for the period just ended, without moving the schedule. 503 `EMAIL_UNAVAILABLE` without SMTP |
| GET | `/admin/settings` | Every editable setting with its value, default and limits (UC-A07) |
| PUT | `/admin/settings` | Body: `changes` (key to value) and `reason`. All values are validated first; nothing changes unless all are valid. Applies at once, and on other servers within a minute. **Critical settings** (platform commission, the ZiG exchange rate, keeping the platform fee on cancellation, and rider refund tiers) are not applied: they wait in `pending` for a second admin |
| GET | `/admin/settings/pending` | Critical changes waiting for approval |
| POST | `/admin/settings/pending/:id/approve` | A different admin applies it. Body: optional `note` |
| POST | `/admin/settings/pending/:id/reject` | Body: `note` |
| GET | `/admin/settings/history` | Recent changes with before and after values |
| POST | `/admin/settings/revert/:auditId` | Put back what a change replaced, within 24 hours. Body: `reason` |
| GET | `/admin/audit` | The audit log. Query: `action` (prefix such as `user` or `sos`), `actor`, `targetId`, `page`, `limit` |
| GET | `/admin/metrics`, `/admin/rides`, `/admin/users`, `/admin/payments`, `/admin/demand-heatmap` | Older summary endpoints used by the app's admin screens |

Settings an admin can change: platform commission, the ZiG exchange rate (ZiG per US dollar; 0 turns ZiG off), rider cancellation refund tiers, payment time limit, driver response time, empty-ride cancellation, the SOS cancel window before contacts are texted, how often an untaken SOS pages admins again, the SOS signal intervals by risk level, match-score weights (must add up to 100%), distance from the route, default search radius and time window, active rides per driver, and open requests per rider. Payment credentials and message templates are deliberately not editable.

### Trips — `/trips` (Phase 4)

Group trips (UC-T01 to UC-T05). Only members see expenses, activities, settlements, the invite code and members' mobile money numbers.

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
| PUT | `/trips/:id/pay-number` | The caller's mobile money number for this trip. Body: `payNumber` (empty to remove) |
| GET, POST | `/trips/:id/expenses` | List, or add: `description`, `amount`, optional `paidBy` (default the caller) and `splitAmong` (default everyone). Split equally, to the cent |
| DELETE | `/trips/:id/expenses/:expenseId` | Whoever added it, or the organiser |
| GET | `/trips/:id/settlement` | `total`, `perPerson`, each member's `paid`, `share` and `balance`, and `transfers`: the fewest payments that settle everyone, each with an `ecocashLink` (a `tel:` link that dials EcoCash send-money, `*151*1*1*<number>*<amount>#`) when the payee added an EcoCash number |
| POST | `/trips/:id/settlements` | The payer or payee marks a payment made. Body: `from`, `to`, `amount` |
| POST | `/trips/:id/settlement/notify` | Tells each member what they owe or are owed |
| POST | `/trips/:id/rate-organizer` | A member rates the organiser once the trip is over. Body: `score` 1–5, optional `comment` |
| GET | `/trips/:id/calendar-link` | A private calendar feed URL for the trip's confirmed activities (UC-T04) |
| GET | `/trips/:id/calendar.ics?token=` | The feed itself, for calendar apps; no login, the token is signed per member |
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
| GET | `/support/assistant` | `{ enabled }`: whether the in-app assistant is on (it needs `ANTHROPIC_API_KEY`) |
| POST | `/support/assistant` | Body: `messages`, the conversation so far (1–40 turns of `{ role: 'user' \| 'assistant', text }`, ending with the user). Returns `reply`, and `ticketId` when the assistant opened a support request. The assistant reads the caller's recent bookings and cancellation quotes; it never changes a booking or moves money. 40 messages an hour per user (`429 CHATBOT_LIMIT`); `503 CHATBOT_UNAVAILABLE` when switched off |

### Disputes — `/disputes`

| Method | Path | Purpose |
|---|---|---|
| POST | `/disputes` | A rider or driver disputes one of their bookings. Body: `bookingId`, `category` (`payment`, `cancellation`, `behavior`, `route`, `quality`), `description` (at least 10 characters), optional `evidenceUrls` (https, up to 5). Allowed up to 30 days after the ride or cancellation, one open dispute per booking per person |
| GET | `/disputes/mine` | Disputes the caller raised or is named in |

### Appeals — `/appeals`

A suspended or blocked account can appeal within 30 days (UC-A05 3a). Blocked accounts can reach these routes and nothing else.

| Method | Path | Purpose |
|---|---|---|
| GET | `/appeals/mine` | The account's restriction, whether it can be appealed, and past appeals |
| POST | `/appeals` | Body: `message` (20–2000 characters) |

### Masked calls — `/calls`

Riders and drivers call each other through a Twilio number, so neither sees the other's number (UC-D06). Needs `TWILIO_VOICE_NUMBER`; recording is optional (`TWILIO_RECORD_CALLS`).

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/calls/available` | signed in | `masked` and `recorded`; without masked calls the app dials directly |
| POST | `/calls` | rider or driver of the booking | Body: `bookingId`. Rings the caller, then connects them to the other person |
| POST | `/calls/twilio/status`, `/calls/twilio/recording` | Twilio (signature-checked) | Call progress and recordings |

### Background checks — `/kyc-verify`

| Method | Path | Access | Purpose |
|---|---|---|---|
| POST | `/kyc-verify/callback` | the vendor, with `X-Kyc-Verify-Key` | The background-check vendor's answer. Body: `reference` (the user id), `status`, optional `summary` |

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
| `sos:triggered`, `sos:alert`, `sos:location:updated` | SOS (alerts go to the `admin:sos` room). `sos:alert` carries `eventType`: `sos.triggered`, `sos.escalated`, `sos.updated`, `sos.resolved`, `sos.police_notified`, `sos.location.updated` |
| `sos:updated` | To the person who raised an SOS: `emergencyId` and `change` (`contacts`, `acknowledged`, `resolved`, `raised`). Their SOS screen reloads it |
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
| 403 | `FORBIDDEN`, `ACCOUNT_BLOCKED`, `ACCOUNT_SUSPENDED`, `SECOND_ADMIN_REQUIRED`, `WOMEN_ONLY`, `IDENTITY_NOT_VERIFIED`, `IDENTITY_PENDING` | Signed in, but not allowed. A blocked account gets `ACCOUNT_BLOCKED` on every request; a suspended one gets `ACCOUNT_SUSPENDED` when it tries to post a ride, book or send a parcel. Women-only rides refuse anyone but a verified woman: `IDENTITY_NOT_VERIFIED` or `IDENTITY_PENDING` for a woman who has not finished the identity check, `WOMEN_ONLY` for anyone else |
| 404 | `NOT_FOUND` | No such resource |
| 409 | `CONFLICT`, `PAYMENT_PENDING`, `WITHDRAWAL_PENDING`, `ACCOUNT_CLOSE_BLOCKED`, `SOS_CANCEL_WINDOW_CLOSED`, `SOS_CLOSED`, `IDENTITY_VERIFIED` | The state does not allow it, for example a booking already answered |
| 422 | `VALIDATION_ERROR`, `TOO_SOON`, `RIDE_TOO_LONG`, `PRICE_OUT_OF_RANGE` | The body or query failed validation (`details` lists the fields), or a ride breaks a publishing rule (section 4.1) |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected failure |
| 503 | `SERVICE_UNAVAILABLE`, `PAYMENT_CURRENCY_UNAVAILABLE`, `MAPS_SERVICE_UNAVAILABLE` | A dependency is down or not configured (Paynow keys, ZiG without a rate, a Google-only map call without a key) |
| 502 | `PAYMENT_PROVIDER_UNAVAILABLE` | Paynow could not be reached, or its reply failed the hash check |

## 15. Rate limits

Limits are counted in Redis, or in memory when Redis is unavailable:

Each limit is keyed by what it protects. Mobile networks put many subscribers behind one public IP address (carrier-grade NAT), so per-IP limits are only a high ceiling against a single source flooding the API; the real limits are per signed-in user and per phone number.

| Scope | Key | Limit |
|---|---|---|
| Every request | IP | 1000 per minute (`RATE_LIMIT_IP_PER_MIN`) |
| Every authenticated request | user | 120 per minute (`RATE_LIMIT_USER_PER_MIN`) |
| `send-otp` | phone number | 3 per hour (UC-R01) |
| `send-otp` | IP | 30 per hour |
| `verify-otp` | phone number | 10 per 15 minutes, on top of the wrong-code back-off (section 2) |
| `verify-otp` | IP | 100 per 15 minutes |
| `refresh-token`, `firebase-login` | IP | 300 per 15 minutes |

Paynow's result callback, Twilio's callbacks and the background-check callback are not limited: they come from a few addresses and carry their own signatures. A limited request gets `429 RATE_LIMITED`, with the wait in the message.

## Company dashboard (UC-C01 step 3)

For company admins, signed in like web admins. Every call answers about the caller's own company only, and `403` for anyone who is not a company admin. Nothing here says where anyone went: no routes, places, positions, ratings or safety reports.

| Method | Path | Description |
|---|---|---|
| GET | `/company/me` | The company: `name`, `status`, `domains`, `contributionPaused`, and its `policy` (share, cap, weekdays, site names and addresses). Contract notes are left out |
| GET | `/company/overview` | `?month=YYYY-MM`, default this month: `members`, `newMembers`, `ridersThisMonth`, `trips` (completed, company-paid), `companyPaid`, `staffPaid`, `co2SavedKg` |
| GET | `/company/members` | Staff who joined: name, work email, joined, this month's trips and what the company paid for them |
| DELETE | `/company/members/:userId` | Removes someone who left the company from the programme. Audited |
| GET | `/company/bills` | The company's bills, without lines |
| GET | `/company/bills/:id/file` | A bill as a file: `?format=pdf` or `xlsx` |

