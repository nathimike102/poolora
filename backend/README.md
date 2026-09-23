# Poolora Backend

The API behind the Poolora app: scheduled car pooling, with parcel pooling in progress. One Node.js service, organised by domain, plus a separate Python ML service in `../ml-service`.

- **API reference:** [frontend/docs/technical/07-API-SPECIFICATIONS.md](../frontend/docs/technical/07-API-SPECIFICATIONS.md)
- **Keys and environment variables:** [docs/SECRETS.md](../docs/SECRETS.md)
- **What is built and what is missing:** [frontend/docs/planning/11-FEATURE-GAP-ANALYSIS.md](../frontend/docs/planning/11-FEATURE-GAP-ANALYSIS.md)

## Stack

Node.js 20+, TypeScript, Express 5, MongoDB (Mongoose 8), Redis (ioredis), Socket.IO with the Redis adapter, Kafka (kafkajs, optional), Firebase Admin, Razorpay, AWS S3, Twilio, Winston, and Jest with Supertest.

## Running it

```bash
npm install
cp .env.example .env   # then fill it in; see docs/SECRETS.md
npm run dev            # http://localhost:5002, reloads on change
```

The whole stack (API, ML service, MongoDB, Redis, Kafka, Elasticsearch, Prometheus and Grafana) runs with `docker compose up -d`. See the root README.

Only MongoDB is required. Without Redis, rate limits and caches fall back to memory. Without Kafka, events are handled in-process, so push notifications still go out; the API reconnects to Kafka in the background when it becomes available. Without a Google Maps key, maps use the free OpenStreetMap services.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Development server with reload |
| `npm run build` / `npm start` | Compile to `dist/` and run it |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript without emitting |
| `npm test` | Jest |
| `npm run test:coverage` | Jest with a coverage report |

## Layout

```
src/
├── app.ts, server.ts   Express setup and startup (also starts the booking sweeper)
├── routes/             URL to controller, with auth and validation middleware
├── controllers/        HTTP in and out
├── services/           Business rules: rides, bookings, payments, safety, wallet, maps
├── jobs/               BookingSweeper (payment timeout, request expiry, empty rides) and the route backfill
├── models/             Mongoose schemas
├── sockets/            Socket.IO gateway: live tracking, chat, SOS
├── events/             Event handlers that send notifications; run by Kafka consumers, or in-process without Kafka
├── auth/               Firebase and JWT strategies
├── validators/         Joi schemas for requests and events
├── middlewares/        Auth, rate limits, errors, logging
├── utils/              Helpers, route geometry, clients
└── __tests__/          Jest tests
```

## Booking rules in brief

Riders pay when they request a seat, from the wallet or through Razorpay. The driver accepts once the payment is in, which reserves the seats atomically. Razorpay webhooks only record payments; they never confirm a booking. The booking sweeper then:
- cancels card and UPI requests still unpaid after 15 minutes
- expires requests the driver has not answered within 6 hours
- cancels rides nobody booked, 1 hour before departure

When a rider cancels a confirmed seat, the refund is 100%, 50%, 25% or 0%, depending on how soon the ride leaves. The API specification has the details.

## Safety

An SOS creates an `EmergencyRecord` with live location history, alerts admins on the `admin:sos` socket room, and texts emergency contacts a tokenized tracking link (`/track/sos/:token`) when Twilio is enabled. Riders answer check-ins as `ok`, `partial_ok` or `not_ok`, and `not_ok` or missed check-ins escalate the incident. Admins acknowledge the incident, resolve it or record a police call.
