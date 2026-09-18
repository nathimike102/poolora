# Mobility Platform Backend

This is the backend service for the unified mobility platform encompassing Car-Pooling, Parcel-Pooling, and Trip-Pooling services.

## Architecture & Tech Stack

The backend is built using a modern, scalable architecture:

- **Runtime**: Node.js (>=18.0.0)
- **Language**: TypeScript
- **Framework**: Express.js
- **Database**: MongoDB (via Mongoose)
- **Caching & Pub/Sub**: Redis (via ioredis)
- **Message Broker**: Kafka (via kafkajs)
- **Real-time Communication**: Socket.io (with Redis adapter)
- **Authentication**: JWT & Firebase Admin
- **Cloud Storage**: AWS S3
- **Payment Gateway**: Razorpay
- **Logging**: Winston
- **Testing**: Jest & Supertest

## Safety and SOS Subsystem

The current backend already exposes a real-time SOS flow through `SafetyService`, `EmergencyRecord`, and Socket.IO admin channels. The planned differentiator is to evolve that into a monitored emergency session with dynamic escalation.

- **Trigger**: passenger or driver starts an SOS from an active booking
- **Session state**: create a tracked emergency record with live location history, timeline events, and admin assignment
- **Monitoring**: send periodic health checks and increase polling frequency when risk rises
- **Escalation**: move from `TRIGGERED` to `ACKNOWLEDGED`, then to `RESOLVED` or `FALSE_ALARM` after admin review
- **Admin channel**: broadcast alerts on `admin:sos` for live dashboard handling
- **Evidence**: attach audio, screenshots, and telemetry to the emergency record when available
- **Security**: keep identity and location data behind authenticated, role-based access and tokenized live tracking URLs

Suggested event names for this layer:

- `SOS_TRIGGERED`
- `STATUS_UPDATED`
- `USER_NOT_RESPONDING`
- `EMERGENCY_ESCALATED`
- `POLICE_NOTIFIED`

## Getting Started

### Prerequisites

Ensure you have the following installed on your local development machine:

- Node.js (v18+)
- npm or yarn
- MongoDB (or Docker)
- Redis (or Docker)
- Kafka (or Docker)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   Copy the example environment file and configure your credentials.
   ```bash
   cp .env.example .env
   ```

### Running the Application

**Development Mode** (with auto-reload):

```bash
npm run dev
```

**Production Build & Run**:

```bash
npm run build
npm run start
```

## Scripts

- `npm run dev` - Starts the development server using `ts-node-dev`.
- `npm run build` - Compiles the TypeScript code to JavaScript in the `dist/` directory.
- `npm start` - Runs the compiled production server.
- `npm run lint` - Runs ESLint to check for code quality issues.
- `npm run typecheck` - Verifies TypeScript types without emitting compiled files.
- `npm test` - Runs the Jest test suite.
- `npm run test:watch` - Runs Jest in watch mode for active development.
- `npm run test:coverage` - Generates a test coverage report.

## Project Structure

```
├── src/
│   ├── controllers/      # Route controllers mapping HTTP requests to logic
│   ├── services/         # Core business logic
│   ├── models/           # Mongoose schemas and models
│   ├── events/           # Socket.io and Kafka event handlers
│   ├── routes/           # Express route definitions
│   └── server.ts         # Application entry point
├── tests/                # Jest test files
├── scripts/              # Utility scripts
└── dist/                 # Compiled JavaScript output (generated)
```

## License

ISC License (or proprietary, see package.json)
