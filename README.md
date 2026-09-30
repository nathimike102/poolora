<p align="center"><img src="branding/poolora-mark.png" alt="Poolora logo" width="140"></p>

# Poolora — Smart AI-Powered Mobility & Pooling Ecosystem

> **"Share Seats. Save Costs. Travel Smarter."**

A full-stack mobility platform for Zimbabwe, encompassing Car-Pooling, Parcel-Pooling, and Trip-Pooling services with intelligent ride matching, real-time tracking, and safety-first infrastructure.

Built with **React Native (Expo)**, **Node.js / Express**, **MongoDB**, **Redis**, **Kafka**, **Elasticsearch**, **Docker**, and **Socket.IO**.

**GitHub:** [nathimike102/poolora](https://github.com/nathimike102/poolora)

**Logo:** the artwork is vector, in [branding/source/poolora-icon.svg](branding/source/poolora-icon.svg). After editing it, run `python3 scripts/render_brand_master.py` (adds the neon glow and writes `branding/poolora-icon.png`), then `python3 scripts/generate_brand_assets.py` to regenerate every app icon, splash, web logo and link preview (needs `cairosvg` and `pillow`).

---

## 📋 Table of Contents

- [Project Overview](#-project-overview)
- [Problem Statement](#-problem-statement)
- [Proposed Solution](#-proposed-solution)
- [Functional Requirements](#-functional-requirements)
- [Platform Features](#-platform-features)
- [AI-Powered Optimization Engine](#-ai-powered-optimization-engine)
- [Security & Safety Infrastructure](#-security--safety-infrastructure)
- [Architecture](#-architecture)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
- [Docker Setup](#-docker-setup)
- [CI/CD Pipeline](#-cicd-pipeline)
- [Development Workflow](#-development-workflow)
- [Available Scripts](#-available-scripts)
- [Environment Variables](#-environment-variables)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Environmental & Social Impact](#-environmental--social-impact)
- [Future Scalability & Expansion](#-future-scalability--expansion)
- [License](#-license)

---

## 🎯 Project Overview

Poolora is a scalable AI-powered ride-pooling and mobility platform designed to solve modern urban commuting challenges through intelligent shared transportation.

Unlike traditional ride-hailing apps focused on instant point-to-point rides, Poolora is built around **scheduled car-pooling**, **trip-pooling**, and **parcel-pooling** to maximise vehicle utilisation, reduce fuel consumption, and lower transportation costs.

### Core Mobility Services

| Service                             | Description                                               |
| ----------------------------------- | --------------------------------------------------------- |
| 🚗 **Car Pooling**                  | Share regular commutes with verified riders               |
| 🎒 **Trip Pooling**                 | Group trips and organised travel coordination             |
| 📦 **Parcel Pooling**               | Lightweight logistics through underutilised vehicle space |
| 📍 **Real-Time Route Coordination** | AI-driven pickup optimisation                             |
| 🚨 **Safety-First Shared Mobility** | Women-only rides, SOS systems, verified drivers           |

---

## 🚨 Problem Statement

Urban commuters — especially students, office workers, and daily travellers — face significant challenges:

- **High fuel consumption** — Single-passenger vehicles waste fuel and money
- **Traffic congestion** — Duplicate trips increase urban overcrowding
- **Underutilised vehicle capacity** — Most vehicles operate below 40% capacity
- **Weak safety systems** — Limited driver verification and emergency features
- **Poor ride compatibility** — Lack of intelligent matching algorithms
- **Fraud and security risks** — Fake bookings, payment anomalies, unverified users
- **Limited women-focused safety** — Insufficient gender-specific safety features
- **High commuting costs** — Rising fuel prices burden daily commuters

---

## 💡 Proposed Solution

Poolora is a cloud-native AI-powered mobility platform built to address these challenges:

- ✅ **Intelligent Ride Matching** — ML-based algorithms matching passengers & drivers with 95%+ compatibility
- ✅ **Real-Time Communication** — WebSocket-based live tracking, chat, and notifications
- ✅ **Predictive Analytics** — Demand forecasting and fraud detection engines
- ✅ **Geospatial Optimisation** — VRP/TSP algorithms minimising detours and fuel consumption
- ✅ **Safety-First Infrastructure** — Emergency SOS systems, live tracking, women-only rides
- ✅ **Mobile money payments** — Paynow: EcoCash, OneMoney, InnBucks and Visa/Mastercard, in US$ or ZiG
- ✅ **Scalable Architecture** — Node.js API with Kafka events, Redis caching and Socket.IO, plus a Python ML service
- ✅ **Production-Ready Deployment** — Docker Compose or Kubernetes, GitHub Actions CI/CD

### Design Targets

These are the targets the architecture is built for, not measured results.

- 50K+ concurrent users with sub-300ms API response times
- Sub-100ms WebSocket latency for real-time tracking and SOS events
- 99.9% uptime using high-availability distributed infrastructure
- Horizontal scalability through load-balanced microservices

---

## 📋 Functional Requirements

### Authentication & Authorisation

- ✅ OTP-based login and registration via Firebase, for adults (18+)
- ✅ JWT token issuance and secure refresh workflows
- ✅ Role-based access control (RBAC) for Rider, Driver, Admin
- ✅ Session validation middleware with multi-device support
- ✅ Hybrid auth provider: Firebase primary → custom JWT fallback

### Ride Coordination

- ✅ Ride publishing with scheduled datetime selection
- ✅ Dynamic seat booking workflows with real-time seat availability
- ✅ Real-time ride synchronisation across all connected clients
- ✅ AI-powered dynamic ride matching
- ✅ Smart pickup sequencing (VRP/TSP optimisation)
- ✅ Route deviation detection and user alerts

### Real-Time Communication

- ✅ WebSocket event streaming via Socket.IO
- ✅ Live GPS tracking (updates every 5 seconds)
- ✅ Real-time ETA synchronisation
- ✅ In-app encrypted messaging system
- ✅ SOS event broadcasting with emergency contacts
- ✅ Push notification workflows

### AI & Optimisation

- ✅ ML-based ride recommendation engine (weighted matching)
- ✅ Predictive demand analytics using historical patterns
- ✅ Fraud detection engine (cancellations, payment anomalies, IP risk)
- ✅ Traffic-aware route optimisation with real-time data
- ✅ Geospatial ride clustering for efficient dispatch
- ✅ Vehicle Routing Problem (VRP) solver
- ✅ Travelling Salesman Problem (TSP) optimisation

### Payment Processing

- ✅ Paynow payment integration with hash-verified status updates and reconciliation
- ✅ Wallet infrastructure with balance management
- ✅ Refund and retry workflows
- ✅ Driver payout processing and accounting
- ✅ Secure transaction validation with fraud checks

---

## ⭐ Platform Features

### 🚴 Rider Features

- 📱 Phone + OTP Authentication
- 🔍 Smart AI-powered Ride Search & Filtering
- 🎯 Real-time Driver Matching with compatibility scores
- 📍 Live GPS Tracking of driver location
- 💬 In-App Encrypted Chat
- ⭐ Ratings & Reviews with safety scores
- 🔗 Live Trip Sharing with emergency contacts
- 💳 Wallet, withdrawals to mobile money, and EcoCash / OneMoney / InnBucks / card payments
- 🆘 One-Tap Emergency SOS
- 👩 Women-Only Ride Preference
- 🔔 Safety Check-In Alerts
- 🚗 Cars, SUVs and bakkies, minivans, autos (tuk-tuks) and motorbikes
- 🤖 An in-app support assistant (Claude) that checks your trips and refunds, and hands anything else to a person
- 🗑️ Close the account in Settings: personal data is erased, trip and payment records are kept anonymously

### 🚗 Driver Features

- 📅 Scheduled Ride Creation with recurring options
- 🔄 Recurring Ride Scheduling for regular routes
- 💰 AI-Suggested Dynamic Pricing based on demand
- 🗺️ AI-Optimised Route Suggestions (VRP/TSP)
- 🎯 Smart Pickup Sequencing for efficiency
- 💹 Earnings Dashboard with analytics
- ✅ Driver verification with document management (driving licence, registration book, insurance)
- 🚙 Vehicle & Document Management

### 🛠️ Admin Features

The web admin (`admin-web/`, see its README) and the app's admin screens:


- 📊 Live dashboard: users, rides, money, safety and system health, with anomaly alerts
- 🆘 SOS incidents with a live map, one-tap calls, a communications log and resolution
- ✅ Driver applications with document review, a verification checklist and risk indicators
- ⚖️ Disputes with the full case file, refunds, driver compensation, warnings and suspensions
- 👥 User search and management: suspensions, two-admin permanent blocks, internal notes
- 📈 Reports on users, rides, money, performance and safety, with CSV export
- ⚙️ Editable platform settings (fees, refund tiers, time limits, matching) with a 24-hour revert
- 📋 An audit log of every admin action

---

## 🤖 AI-Powered Optimization Engine

### Smart Ride Matching Algorithm

Uses machine learning-based weighted scoring to match passengers and drivers:

```
Match Score = (Distance × 0.40) + (TimeMatch × 0.30) + (Rating × 0.15) +
              (AcceptanceRate × 0.10) + (SafetyScore × 0.05)
```

- 📍 **Route Proximity (40%)** — Pickup distance from passenger
- ⏱️ **Time Compatibility (30%)** — Schedule alignment
- ⭐ **Driver Rating (15%)** — Historical satisfaction
- ✅ **Acceptance Rate (10%)** — Driver reliability
- 🔒 **Safety Score (5%)** — Verified profile + background check

### Intelligent Pickup Optimisation

Employs Vehicle Routing Problem (VRP) and Travelling Salesman Problem (TSP) algorithms:

1. **Distance Matrix** — Calculate distances between all pickup points
2. **Traffic Analysis** — Factor real-time traffic data
3. **Detour Cost** — Minimise deviation from optimal route
4. **Optimal Sequence** — Generate best pickup order
5. **Fuel Reduction** — Minimise overall fuel consumption

> Result: 60%+ reduction in fuel waste per ride

### Fraud Detection & Demand Prediction

**Fraud Analysis:**

- 📊 Cancellation pattern analysis
- 💳 Payment anomaly detection
- 🌐 IP risk analysis
- ⚡ Booking velocity checks
- 🎯 Location spoofing detection

**Demand Prediction:**

- 📈 Hourly demand forecasting
- 🌍 Geographic demand clustering
- 📱 User behaviour prediction
- ⏰ Peak hour analytics
- 🎪 Event-based surge detection

---

## 🔐 Security & Safety Infrastructure

### Women's Safety Features

- 👩 Women-Only Ride Preferences — Filter drivers by gender
- ✅ Verified Female Driver/Passenger Matching
- 📍 Safety-Focused Route Recommendations
- 🔗 Live Ride Sharing — Share location with emergency contacts
- 🏅 Confidential Safety Ratings — Anonymous safety scores

### Emergency Systems

- 🆘 One-Tap SOS Activation — Immediate emergency alert
- 📍 Live GPS Emergency Tracking — Real-time location to contacts
- 📞 Emergency Contact Alerts — Automatic SMS/call to contacts
- ⚡ Real-Time Incident Escalation — Auto-notify admin

### Smart SOS Emergency Monitoring

The SOS layer is designed as an event-driven monitoring system, not just a panic button.

- **Actors** — Passenger, driver, admin/emergency control center, and verified emergency services
- **Trigger flow** — Create an emergency session, snapshot ride/identity data, start encrypted live tracking, and notify admin immediately
- **Monitoring states** — `OK` closes the incident, `PARTIAL_OK` keeps the case open with faster checks, and `NOT_OK` escalates the session
- **Escalation signals** — No response, route deviation, GPS loss, device disconnect, sudden stop, or motion anomalies
- **Emergency packet** — Share verified ride, driver, passenger, and telemetry data through a secure tokenized reference
- **Admin controls** — Join the live SOS room, acknowledge incidents, review evidence, and decide when to contact police or emergency services
- **MVP priority** — SOS button, live location, admin dashboard, periodic health checks, and real-time notifications

### Authentication, Security & Compliance

- 🔐 JWT-Based Authentication — Secure token-based access
- 📱 OTP Verification — Phone-based identity validation (Firebase)
- 🔑 Role-Based Access Control (RBAC) — Fine-grained permissions
- 🔒 TLS-Secured Communication — HTTPS for all endpoints
- 🔑 AES-256 Encrypted Payments — Military-grade encryption
- 🚫 Fraud Prevention Engine — Detect fake bookings & anomalies
- ✅ Device Verification — Secure session management via Redis
- 📋 Comprehensive Audit Logging — Track all user actions

---

## 🏗️ Architecture

### Technical Stack by Layer

| Layer             | Technology                                         |
| ----------------- | -------------------------------------------------- |
| Frontend          | React Native, TypeScript, Expo                     |
| API Gateway       | NGINX Reverse Proxy, RESTful API                   |
| Backend           | Node.js, Express.js                                |
| Authentication    | Firebase OTP, JWT, RBAC                            |
| Database          | MongoDB 7.0                                        |
| Real-Time         | Socket.IO, WebSockets                              |
| Cache & Messaging | Redis 7.2 Cluster, Kafka 7.5 (Confluent)           |
| Search            | Elasticsearch 8.11                                 |
| AI & Optimisation | ML Matching, Demand Prediction, Route Optimisation |
| Payments          | Paynow (EcoCash, OneMoney, InnBucks, card)         |
| DevOps            | Docker Compose, GitHub Actions CI/CD, EC2          |
| Cloud Storage     | AWS S3                                             |

### How It Fits Together

The backend is one Node.js service, organised by domain (auth, rides, bookings, payments, safety, notifications, wallet, maps). The ML features live in a separate Python service that the backend calls over HTTP.

```
React Native App ──HTTP/Socket.IO──► NGINX / Kubernetes ingress
                                          │
                                          ▼
                             Node.js API (Express + Socket.IO)
            ┌───────────────┬─────────────┼──────────────┬─────────────────┐
            ▼               ▼             ▼              ▼                 ▼
        MongoDB 7        Redis 7      Kafka (optional)  ML service     External services
     rides, users,    cache, rate    events that drive  (FastAPI):     Paynow, Firebase,  
     bookings,        limits, locks, push notifications route order,   Twilio, S3,
     payments         socket fan-out                    fraud, demand  OpenStreetMap / Google
```

- **Booking sweeper:** a job inside the API that runs every minute. It cancels unpaid requests after 15 minutes, expires unanswered ones after 6 hours, and cancels rides nobody booked an hour before departure.
- **Kafka is optional:** Without Kafka the API still works: events are handled in-process, so notifications still go out. The API keeps retrying Kafka in the background and switches to it once it is up; set `KAFKA_ENABLED=false` to run without it on purpose.
- **Elasticsearch** is provisioned by Docker Compose and Kubernetes but not used by the backend yet.

---

## 🛠️ Tech Stack

### Backend

| Component         | Technology                           |
| ----------------- | ------------------------------------ |
| Runtime           | Node.js 20 (Docker), ≥18.0.0 (local) |
| Language          | TypeScript 5.8                       |
| Framework         | Express.js 5                         |
| Database          | MongoDB 7.0 + Mongoose 8             |
| Caching & Pub/Sub | Redis 7.2 + ioredis                  |
| Message Broker    | Kafka 7.5 (Confluent) + kafkajs      |
| Real-Time         | Socket.IO 4 + Redis adapter          |
| Authentication    | JWT + Firebase Admin SDK 13          |
| Cloud Storage     | AWS S3 SDK v3                        |
| Payments          | Paynow                               |
| Maps              | OpenStreetMap (Photon, Nominatim, OSRM) or Google |
| Logging           | Winston                              |
| Testing           | Jest 30 + Supertest                  |

### Frontend

| Component        | Technology                                |
| ---------------- | ----------------------------------------- |
| Framework        | React Native 0.86 (Expo 57)               |
| Language         | TypeScript 6.0                            |
| Navigation       | React Navigation 7 (Native Stack)         |
| UI Library       | React Native Paper (Material Design 3)    |
| State Management | Context API                               |
| Maps             | MapLibre with OpenFreeMap tiles (no key)  |
| SVG Rendering    | react-native-svg                          |
| Animations       | Reanimated 4 + Animated API               |
| Gesture Handling | react-native-gesture-handler              |
| Safe Area        | react-native-safe-area-context            |
| Testing          | Jest + jest-expo                          |

---

## 📁 Project Structure

```
poolora/
├── backend/                          # Node.js/Express backend
│   ├── src/
│   │   ├── app.ts                    # Express app configuration
│   │   ├── server.ts                 # Server entry point (port 5002)
│   │   ├── controllers/              # Route controllers
│   │   ├── services/                 # Business logic
│   │   ├── models/                   # Mongoose schemas
│   │   ├── routes/                   # Express routes
│   │   ├── middlewares/              # Custom middleware
│   │   ├── events/                   # Kafka event bridge and consumers
│   │   ├── jobs/                     # Booking sweeper (timeouts, expiry, empty rides)
│   │   ├── sockets/                  # Socket.IO gateway (tracking, chat, SOS)
│   │   ├── config/                   # Configuration files
│   │   ├── validators/               # Input validation (Joi)
│   │   ├── types/                    # TypeScript types
│   │   ├── utils/                    # Utility functions
│   │   └── __tests__/                # Jest tests
│   ├── scripts/                      # Utility scripts
│   ├── frontend-tester/              # Browser page for trying the API (served at /tester in development)
│   ├── secrets/                      # Firebase service account (gitignored)
│   ├── jest.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   ├── Dockerfile                    # Multi-stage Node.js 20 Alpine build
│   ├── docker-compose.yml            # Full stack: API, ML, MongoDB, Redis, Kafka, Elasticsearch, Prometheus, Grafana
│   └── .env.example                  # Environment variable template
│
├── frontend/                         # React Native mobile app
│   ├── src/
│   │   ├── context/
│   │   │   └── AppContext.tsx        # Global state, theme, auth
│   │   ├── navigation/
│   │   │   ├── AppNavigator.tsx      # Navigation setup
│   │   │   └── types.ts              # Navigation types
│   │   ├── screens/
│   │   │   ├── SplashScreen.tsx
│   │   │   ├── OnboardingScreen.tsx
│   │   │   ├── PhoneLoginScreen.tsx
│   │   │   ├── OTPScreen.tsx
│   │   │   ├── rider/                # Rider screens
│   │   │   ├── driver/               # Driver screens (KYC, onboarding, etc.)
│   │   │   ├── parcel/               # Parcel screens
│   │   │   ├── trip/                 # Trip pooling screens
│   │   │   └── shared/               # Chat, SOS, Profile, Settings
│   │   ├── components/               # Reusable UI components
│   │   ├── services/                 # API service layer
│   │   ├── api/                      # Axios client & constants
│   │   ├── hooks/                    # Custom React hooks
│   │   ├── theme/                    # Colors, typography, spacing
│   │   └── types/                    # Shared TypeScript types
│   ├── android/                      # Generated by `expo run:android` (not committed)
│   ├── app.config.js                 # Expo dynamic config
│   ├── metro.config.js
│   ├── jest.config.js
│   ├── tsconfig.json
│   ├── eas.json                      # EAS Build config (dev/preview/production)
│   ├── docs/                         # Design, use cases, API spec, gap analysis
│   └── package.json
│
├── ml-service/                       # Python FastAPI ML service
├── web-landing/                      # Marketing website (Vite, deployed on Vercel)
├── admin-web/                        # Web admin dashboard (Vite + React)
├── k8s/                              # Kubernetes manifests
├── docs/SECRETS.md                   # Every key and where it goes
│
├── .github/
│   └── workflows/
│       └── ci.yml                    # CI (lint, typecheck, test, build, audit) and deploy
├── package.json                      # Root npm workspace config
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

**Common:**

- Git
- Node.js v18 or higher
- npm

**Backend (without Docker):**

- MongoDB 7.0
- Redis 7.2
- Kafka (Confluent 7.5), optional
- Elasticsearch 8.11

**Frontend:**

- Expo CLI: `npm install -g expo-cli`
- Android SDK / Android Studio (for Android builds)
- Xcode (for iOS builds, macOS only)

### Backend Setup (local)

```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials (see Environment Variables section)
npm run dev
```

The server starts on **port 5002** by default.

### Web Admin Setup

```bash
cd admin-web
cp .env.example .env   # API URL and the Firebase web app config
npm install
npm run dev            # http://localhost:5174
```

Add `http://localhost:5174` to the backend's `CORS_ORIGIN`. See [admin-web/README.md](admin-web/README.md) for making an account an admin.

### Frontend Setup

```bash
cd frontend
npm install
npx expo start
# Press 'a' for Android emulator
# Press 'i' for iOS simulator
# Scan QR code with Expo Go app on a physical device
```

---

## 🐳 Docker Setup

The backend ships with a full `docker-compose.yml` that spins up all infrastructure services. **This is the recommended way to run the full stack locally.**

### Services included

| Service         | Image                             | Port (localhost only) |
| --------------- | --------------------------------- | --------------------- |
| `app`           | Custom Node.js 20 Alpine build    | `127.0.0.1:5002`      |
| `ml-engine`     | Built from `ml-service/`          | `127.0.0.1:8000`      |
| `mongo`         | `mongo:7.0`                       | `127.0.0.1:27018`     |
| `redis`         | `redis:7.2-alpine`                | `127.0.0.1:6379`      |
| `zookeeper`     | `confluentinc/cp-zookeeper:7.5.0` | internal              |
| `kafka`         | `confluentinc/cp-kafka:7.5.0`     | `127.0.0.1:9092`      |
| `elasticsearch` | `elasticsearch:8.11.1`            | `127.0.0.1:9200`      |
| `prometheus`    | `prom/prometheus:v2.51.0`         | `127.0.0.1:9090`      |
| `grafana`       | `grafana/grafana:10.4.1`          | `127.0.0.1:3001`      |

> All ports are bound to `127.0.0.1` only — never exposed to the public internet. Put NGINX in front for TLS termination.

### Running with Docker Compose

```bash
cd backend

# 1. Copy and configure environment variables
cp .env.example .env
# Fill in MONGO_USER, MONGO_PASS, REDIS_PASSWORD, JWT secrets, GRAFANA_ADMIN_PASSWORD, etc.

# 2. Place your Firebase service account JSON
mkdir -p secrets
cp /path/to/firebase-service-account.json secrets/firebase-service-account.json

# 3. Start all services
docker compose up -d

# 4. Check service health
docker compose ps
docker compose logs app --follow

# 5. Stop all services
docker compose down

# 6. Stop and remove volumes (full reset)
docker compose down -v
```

### Building the Docker image manually

```bash
cd backend
docker build -t poolora-backend .
docker run -p 127.0.0.1:5002:5002 --env-file .env poolora-backend
```

### Dockerfile details

The backend uses a **multi-stage build**:

1. **Builder stage** (`node:20-alpine`): installs all dependencies and compiles TypeScript
2. **Runner stage** (`node:20-alpine`): installs production dependencies only, copies `dist/`, and runs as the non-root user `nodejs` (UID 1001) with a `/health` check and a 400 MB heap cap

See `backend/Dockerfile`.

### Docker Volumes & Networking

**Volumes:**

- `mongo-data`, `redis-data`, `kafka-data`, `zookeeper-data`, `zookeeper-logs`, `es-data`, `prometheus-data`, `grafana-data`

**Networks:**

- `mobility-net`: internal bridge network for service-to-service traffic

**Limits:** the API is capped at 512 MB and the ML service at 1 GB. Container logs rotate by size.

---

## 🤖 ML Algorithms & Optimisation

What runs today. The algorithms named in the PRD (Prophet, isolation forests, VRP solvers) are future work.

| Feature | Where | How it works today |
|---|---|---|
| Ride matching | Backend, `MatchingEngineClient` | Weighted score: pickup distance to the ride's start 40%, departure-time match 30%, driver rating 15%, acceptance rate 10%, low cancellation rate 5%. Used to rank search results |
| Pickup order | ML service, `POST /api/optimize-route` | Nearest-neighbour ordering over a haversine distance matrix |
| Fraud checks | ML service, `POST /api/fraud-check` | Rule-based risk score from cancellations, payment failures, IP risk, booking velocity, account age and location spoofing. Runs after a failed payment |
| Demand prediction | ML service, `POST /api/predict-demand` | Historical average adjusted for hour, weekday and public holidays (the market's calendar, moving holidays included), with a surge multiplier. Deterministic. A forecast of +20% or more raises the suggested seat price, capped at +50%; weather is supported by the model but not yet sent |
| Routing | Backend, `MapsService` | OSRM on OpenStreetMap, or Google Directions when configured |

The ML service's `/api/match` endpoint mirrors the matching score but is not called by the backend.

---

## 🔄 CI/CD Pipeline

### GitHub Actions (`.github/workflows/ci.yml`)

Runs on pushes and pull requests to `main` and `develop`:

| Job | Steps |
|---|---|
| `backend-checks` | lint, typecheck, test, build (Node 22) |
| `frontend-checks` | lint, typecheck, test |
| `web-landing-checks` | build (includes typecheck) |
| `admin-web-checks` | typecheck, test, build |
| `ml-checks` | install, start the service, check `/health` and that the internal key is required |
| `dependency-audit` | `npm audit` on production dependencies, `pip-audit` on the ML service |

On a push to `main` it also:

- **docker-build**: builds and pushes `poolora-backend` and `poolora-ml` to ghcr.io, tagged `latest` and with the commit SHA.
- **deploy**: logs in to the server over SSH, runs `git pull`, then `docker compose up -d --build` in `backend/`, and restarts NGINX. It is skipped with a notice when `EC2_HOST` is not set. Needs the secrets `EC2_HOST`, `EC2_USER` and `EC2_SSH_KEY`, and the repository checked out at `/home/ubuntu/Poolora`.

For Kubernetes, `scripts/deploy-k8s.sh` applies `k8s/` using the images from ghcr.io.

---

## 🔄 Development Workflow

### Backend

```bash
cd backend
npm run dev          # Start with auto-reload (ts-node-dev)
npm run test:watch   # Run tests in watch mode
npm run lint         # Check code quality
npm run typecheck    # Verify TypeScript types
npm run build        # Compile TypeScript → dist/
```

### Frontend

```bash
cd frontend
npx expo start       # Start Expo dev server
npm test             # Run Jest tests
npm run android      # Build & install on Android
npm run ios          # Build & install on iOS
npm run typecheck    # Verify TypeScript types
```

---

## 📜 Available Scripts

### Backend Scripts

| Script                  | Purpose                           |
| ----------------------- | --------------------------------- |
| `npm run dev`           | Start dev server with auto-reload |
| `npm run build`         | Compile TypeScript to JavaScript  |
| `npm start`             | Run production server             |
| `npm run lint`          | Run ESLint checks                 |
| `npm run typecheck`     | Verify TypeScript types           |
| `npm test`              | Run Jest tests                    |
| `npm run test:watch`    | Tests in watch mode               |
| `npm run test:coverage` | Generate coverage report          |

### Frontend Scripts

| Script              | Purpose                                 |
| ------------------- | --------------------------------------- |
| `npx expo start`    | Start Expo dev server                   |
| `npm test`          | Run Jest tests                           |
| `npm run android`   | Build & install on Android              |
| `npm run ios`       | Build & install on iOS                  |
| `npm run typecheck` | Verify TypeScript types                 |
| `npm run lint`      | Run ESLint checks                       |

---

## 🔧 Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in the values. **[docs/SECRETS.md](docs/SECRETS.md) lists every variable, key and credential file, and where to get each one.** Key variables:

| Variable                                       | Description                                      |
| ---------------------------------------------- | ------------------------------------------------ |
| `NODE_ENV`                                     | `production` \| `development` \| `test`          |
| `PORT`                                         | Server port (default: `5002`)                    |
| `APP_BASE_URL`                                 | Public API origin; required in production        |
| `MONGO_URI`                                    | MongoDB connection string                        |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis connection                                 |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`     | JWT signing secrets (at least 64 characters)     |
| `AUTH_PROVIDER`                                | `firebase` \| `custom` \| `hybrid`               |
| `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT_PATH` | Firebase sign-in and push                |
| `PAYNOW_USD_INTEGRATION_ID` / `PAYNOW_USD_INTEGRATION_KEY` / `PAYNOW_AUTH_EMAIL` | Paynow payments (US$); add `PAYNOW_ZWG_*` and `ZWG_PER_USD` for ZiG |
| `AWS_*`                                        | S3 bucket for KYC documents                      |
| `GOOGLE_MAPS_API_KEY`, `MAPS_PROVIDER`         | Optional. Without a key, free OpenStreetMap services are used |
| `ML_SERVICE_URL` / `ML_SERVICE_API_KEY`        | The Python ML service and its shared key         |
| `TWILIO_*`                                     | SMS to emergency contacts during an SOS          |
| `KAFKA_BROKERS` / `KAFKA_ENABLED`              | Kafka brokers; optional (`KAFKA_ENABLED=false` turns it off) |
| `CORS_ORIGIN`                                  | Allowed origins; never `*` in production         |
| `PLATFORM_FEE_RATE`                            | Platform commission (default `0.15` = 15%)       |
| `ENABLE_RIDE_SIMULATION`                       | Turn on the ride simulator in production         |
| `RATE_LIMIT_IP_PER_MIN` / `RATE_LIMIT_USER_PER_MIN` | Request limits; per user is the real limit, per IP a ceiling (mobile carriers share IPs) |

> **Never commit `.env` to version control.** Generate strong secrets with:
>
> ```bash
> openssl rand -base64 32          # For passwords
> node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"  # For JWT secrets
> ```

---

## 🧪 Testing

### Backend Testing

```bash
cd backend
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
```

Tests use **Jest 30** + **Supertest** + **mongodb-memory-server** (in-memory MongoDB for isolation).

### Frontend Testing

```bash
cd frontend
npm test                    # Run all tests
npm test -- --watch         # Watch mode
```

Frontend tests use **jest-expo** and React Native Testing Library. The coverage threshold is 10%, so coverage is a floor for now rather than a target.

Coverage reports are generated in `frontend/coverage/` and `backend/coverage/`.

---

## 🚢 Deployment

### Docker Compose (recommended for staging/production)

```bash
cd backend
cp .env.example .env
# Configure all production values in .env
mkdir -p secrets
cp /path/to/firebase-service-account.json secrets/firebase-service-account.json
docker compose up -d
```

### EAS Build (Expo Application Services)

```bash
cd frontend

# Install EAS CLI
npm install -g eas-cli
eas login

# Build for Android (APK for internal testing)
eas build --platform android --profile preview

# Build for Android (AAB for Play Store)
eas build --platform android --profile production

# Build for iOS
eas build --platform ios --profile production

# Submit to stores
eas submit --platform android
eas submit --platform ios
```

EAS profiles are defined in `frontend/eas.json`:

- `development` — APK with dev client, internal distribution
- `preview` — APK, internal distribution
- `production` — Store-ready build

### EC2 Deployment (via GitHub Actions)

A push to `main` runs the deploy job in `ci.yml`. It connects to the server over SSH, pulls the latest code, rebuilds and restarts the Compose stack, and restarts NGINX. Configure these GitHub secrets:

```
EC2_HOST       → Your EC2 public IP or hostname
EC2_USER       → SSH username (e.g. ubuntu)
EC2_SSH_KEY    → Private SSH key content
```

### Kubernetes Deployment

For production-scale deployments across multiple nodes, Poolora can be deployed on Kubernetes.

#### Prerequisites

- Kubernetes cluster (EKS, GKE, AKS, or self-hosted)
- `kubectl` CLI configured
- Helm 3+ (optional, for templated deployments)
- Container registry (ECR, Docker Hub, GCR)

#### Deployment Architecture

```
Ingress (NGINX)
  │
  ├── Backend Service (5 replicas)
  │   └── Pod: Node.js + Express
  │
  ├── MongoDB StatefulSet (3 replicas with PVC)
  │
  ├── Redis StatefulSet (1 master + 2 replicas)
  │
  ├── Kafka StatefulSet (3 brokers with PVC)
  │
  └── Elasticsearch StatefulSet (3 nodes with PVC)
```

#### Sample Kubernetes Manifests

**Backend Deployment (`k8s/backend-deployment.yaml`):**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: poolora-backend
  namespace: poolora
spec:
  replicas: 5
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: poolora-backend
  template:
    metadata:
      labels:
        app: poolora-backend
    spec:
      containers:
        - name: backend
          image: your-registry/poolora-backend:latest
          imagePullPolicy: Always
          ports:
            - containerPort: 5002
          env:
            - name: NODE_ENV
              value: production
            - name: MONGO_URI
              valueFrom:
                secretKeyRef:
                  name: mongo-secret
                  key: uri
            - name: REDIS_HOST
              value: redis-service
            - name: KAFKA_BROKERS
              value: kafka-0.kafka-headless:9092,kafka-1.kafka-headless:9092,kafka-2.kafka-headless:9092
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 1Gi
          livenessProbe:
            httpGet:
              path: /health
              port: 5002
            initialDelaySeconds: 40
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /ready
              port: 5002
            initialDelaySeconds: 20
            periodSeconds: 5
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchExpressions:
                    - key: app
                      operator: In
                      values:
                        - poolora-backend
                topologyKey: kubernetes.io/hostname
```

**MongoDB StatefulSet (`k8s/mongodb-statefulset.yaml`):**

```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: mongodb
  namespace: poolora
spec:
  serviceName: mongodb
  replicas: 3
  selector:
    matchLabels:
      app: mongodb
  template:
    metadata:
      labels:
        app: mongodb
    spec:
      containers:
        - name: mongodb
          image: mongo:7.0
          ports:
            - containerPort: 27017
          volumeMounts:
            - name: data
              mountPath: /data/db
          env:
            - name: MONGO_INITDB_ROOT_USERNAME
              valueFrom:
                secretKeyRef:
                  name: mongo-secret
                  key: username
            - name: MONGO_INITDB_ROOT_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: mongo-secret
                  key: password
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: 500m
              memory: 1Gi
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: 10Gi
```

#### Deploying to Kubernetes

```bash
# 1. Create namespace
kubectl create namespace poolora

# 2. Create secrets
kubectl create secret generic mongo-secret \
  --from-literal=username=admin \
  --from-literal=password=<strong-password> \
  --from-literal=uri=mongodb://admin:password@mongodb-0.mongodb:27017,mongodb-1.mongodb:27017,mongodb-2.mongodb:27017 \
  -n poolora

# 3. Apply manifests
kubectl apply -f k8s/mongodb-statefulset.yaml
kubectl apply -f k8s/redis-statefulset.yaml
kubectl apply -f k8s/kafka-statefulset.yaml
kubectl apply -f k8s/elasticsearch-statefulset.yaml
kubectl apply -f k8s/backend-deployment.yaml
kubectl apply -f k8s/ingress.yaml

# 4. Check rollout status
kubectl rollout status deployment/poolora-backend -n poolora

# 5. View logs
kubectl logs -f deployment/poolora-backend -n poolora

# 6. Port-forward for testing
kubectl port-forward service/poolora-backend 5002:5002 -n poolora
```

#### Auto-Scaling

**Horizontal Pod Autoscaler:**

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: poolora-backend-hpa
  namespace: poolora
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: poolora-backend
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 0
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
```

#### Monitoring & Observability

**Prometheus Scrape Config:**

```yaml
scrape_configs:
  - job_name: "poolora-backend"
    static_configs:
      - targets: ["poolora-backend:5002"]
    metrics_path: "/metrics"
```

**Recommended Dashboards:** Grafana + Prometheus for real-time monitoring

**Alerts to set up:**

- Pod restart rate > 5/hour
- API error rate > 1%
- p95 latency > 500ms
- Memory usage > 80%
- MongoDB connection pool exhaustion

---

## 🌍 Environmental & Social Impact

### How Poolora Helps

- ♻️ **Reduces duplicate vehicle trips** — 30–40% fewer vehicles on roads
- 📊 **Improves seat occupancy** — Targets 80%+ average utilisation
- ⛽ **Lowers fuel consumption** — ~60% reduction per trip
- 🌱 **Reduces carbon emissions** — ~0.5 tons CO₂ saved per 1,000 rides
- 💰 **Makes transportation affordable** — Users save 40–60% on costs
- 🏙️ **Improves urban mobility** — Enables sustainable transportation

> **Impact Chain:** Shared Pooling → Fewer Vehicles → Lower Fuel → Reduced Emissions → Sustainable Transportation

---

## 🚀 Future Scalability & Expansion

The roadmap builds on the platform's existing architecture — every item below extends an already-implemented subsystem.

| Timeline    | Feature                                                                                                                                   | Builds On                                             |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Q3 2026** | 📊 **Safety Analytics Dashboard** — Aggregate SOS response times, incident heatmaps, and driver safety scores into a dedicated admin view | Existing SOS system, EmergencyRecord model, Admin API |
| **Q3 2026** | 🗺️ **Demand Heatmaps** — Visualize ride demand density by region and time using existing booking data                                     | Booking + Ride models, Admin metrics endpoint         |
| **Q4 2026** | 🤖 **AI Ride Assistant** — Voice-based booking using the existing ride search and matching pipeline                                       | MatchingEngineClient, Ride search API                 |
| **Q4 2026** | 💰 **Driver Incentive Optimization** — Dynamic bonus allocation based on acceptance rate and peak-hour availability                       | Driver stats, WalletService coins system              |
| **H1 2027** | 🚌 **Multi-Modal Transport** — Integrate bus/metro schedules as first/last mile options alongside existing pooling                        | Ride model extensible with `rideType` enum            |
| **H1 2027** | 🌍 **Regional Expansion** — Multi-city support with city-scoped ride search using existing geospatial indexes                             | MongoDB 2dsphere indexes, GeoPoint schema             |
| **H2 2027** | 📈 **Advanced Fraud Detection** — Upgrade from rule-based to ML-based anomaly detection using accumulated transaction data                | Payment events pipeline, Kafka consumers              |
| **H2 2027** | 🔔 **Smart Notifications** — Context-aware notification timing based on user activity patterns                                            | NotificationService, FCM integration                  |

---

## 📝 License

ISC License — see individual `package.json` files for details.

---

## 🎓 Learning Resources

- [Express.js Documentation](https://expressjs.com/)
- [MongoDB + Mongoose](https://mongoosejs.com/)
- [React Native Documentation](https://reactnative.dev/)
- [React Navigation](https://reactnavigation.org/)
- [React Native Paper](https://callstack.github.io/react-native-paper/)
- [Socket.IO Documentation](https://socket.io/docs/)
- [Expo Documentation](https://docs.expo.dev/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Confluent Kafka](https://docs.confluent.io/)
- [EAS Build](https://docs.expo.dev/build/introduction/)

---

**TEAM POOLORA** — Built with ❤️ for sustainable urban mobility
