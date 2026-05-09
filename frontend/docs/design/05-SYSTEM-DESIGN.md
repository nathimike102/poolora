# System Design & Technical Specifications

**Smart Scheduled Car Pooling Platform**

---

## 1. System Design Principles

### 1.1 Design Goals

- **Scalability**: Support millions of rides per day
- **Reliability**: 99.9% uptime SLA
- **Performance**: Sub-500ms API response times
- **Security**: Enterprise-grade encryption and compliance
- **Maintainability**: Clean, modular, well-documented code
- **Extensibility**: Easy to add new features and services

### 1.2 Core Design Principles

1. **Separation of Concerns**: Each service has single responsibility
2. **Statelessness**: Services are stateless, state stored in databases
3. **Idempotency**: Operations safe to retry without side effects
4. **Fault Tolerance**: Graceful degradation, circuit breakers implemented
5. **Observability**: Comprehensive logging, metrics, tracing

---

## 2. Core Algorithms & Data Processing

### 2.1 Ride Matching Algorithm (5-Factor Weighted Scoring)

**Formula**:

```
MATCH_SCORE =
  (Proximity_Score × 0.40) +
  (Time_Score × 0.30) +
  (Rating_Score × 0.15) +
  (Acceptance_Score × 0.10) +
  (Safety_Score × 0.05)
```

**Calculation Example**:

- Proximity: 2 km away = 85/100 → 85 × 0.40 = 34.0
- Time: Can arrive in 8 mins vs requested 10 mins = 90/100 → 90 × 0.30 = 27.0
- Rating: 4.7 average = 94/100 → 94 × 0.15 = 14.1
- Acceptance: 96% acceptance rate = 96/100 → 96 × 0.10 = 9.6
- Safety: No fraud flags = 100/100 → 100 × 0.05 = 5.0

**Final Score**: 34.0 + 27.0 + 14.1 + 9.6 + 5.0 = **89.7/100** (Excellent match)

### 2.2 Route Optimization (Traveling Salesman Problem)

**Problem**: Given N pickup/dropoff points, find shortest viable route  
**Solution**: Google OR-Tools with time window constraints

```
Input:
- Pickup A: (28.6, 77.2), time: 10:00-10:15
- Pickup B: (28.7, 77.3), time: 10:05-10:25
- Dropoff A: (28.8, 77.4), time: 10:30+
- Dropoff B: (28.9, 77.5), time: 10:45+

Constraints:
- Pickup before dropoff
- Time windows respected
- One ride per vehicle
- Maximize utilization

Output:
- Optimal sequence: A pickup → B pickup → A dropoff → B dropoff
- Total distance: 15.2 km (vs 18.5 km random)
- Savings: 15-20% improvement per ride area
```

### 2.3 Fraud Detection (ML with XGBoost)

**Features Analyzed** (20+ risk signals):

- GPS anomalies (spoofing detection, impossible movements)
- Timing patterns (pickup/dropoff consistency)
- Pricing anomalies (unusual surge usage)
- User behavior (cancellation rate, frequency)
- Payment patterns (failed attempts, refund requests)
- Device/network info (IP changes, VPNs)

**When Triggered**: Every ride booking and payment request  
**Processing**: < 500ms inference time  
**Accuracy**: 90% precision with < 2% false positives

### 2.4 ETA Calculation with Traffic

**Algorithm**:

```
Base Distance: 12 km
Base Speed: 40 km/h (urban average)
Base Duration: 18 minutes

Real-time Traffic Multiplier: ×1.25
ETA: 18 × 1.25 = 22.5 minutes

Adjustments:
  + Pickup buffer: 2 minutes
  + Driver response: 1 minute

Final ETA: 22.5 + 2 + 1 = 25.5 minutes ≈ 26 minutes

Accuracy Target: ±5 minutes (90% of rides)
```

---

## 3. Data Flow & Communication Patterns

### 3.1 Synchronous Request-Response (REST)

Used for: User requests, real-time lookups, immediate responses

```
Client Request
  ↓
API Gateway (Rate Limiting, Auth)
  ↓
Service Handler
  ↓
Database Query
  ↓
Response (target: < 500ms)

Characteristics:
- Blocking: Must wait for response
- Timeout: 30 seconds maximum
- Retries: 2 automatic with exponential backoff
- Circuit Breaker: Open after 5 failures
```

### 3.2 Asynchronous Event-Driven (Kafka)

Used for: Location updates, notifications, analytics events

```
Event Producer (Service A)
  ↓
Kafka Topic (Event Stream)
  ├─→ Consumer 1 (Notification Service)
  ├─→ Consumer 2 (Analytics Service)
  ├─→ Consumer 3 (Safety/Fraud Service)
  └─→ Dead Letter Queue (if all fail)

Characteristics:
- Non-blocking: Producer doesn't wait
- Persistent: Retained for 30 days
- Scalable: Multiple consumers scale independently
- Reliable: At-least-once delivery guarantee
```

### 3.3 Real-Time Pub-Sub (WebSocket + Redis)

Used for: Live location tracking, chat, notifications

```
WebSocket Client (Driver/Rider)
  ↓
WebSocket Server (Node.js Socket.io)
  ↓
Redis Pub/Sub (Channel: ride:{rideId})
  ├─→ WebSocket Server A → Rider 1
  ├─→ WebSocket Server B → Rider 2
  └─→ WebSocket Server C → Admin

Characteristics:
- Real-time: < 100ms latency
- Scalable: Redis adapter connects multiple servers
- Persistent: Last 100 messages cached
- Rooms: Permission-based subscriptions
```

---

## 4. Database Design

### 4.1 MongoDB Collections Structure

**Users Collection**

```javascript
{
  _id: ObjectId,
  phone: String,        // unique, indexed
  email: String,        // unique, indexed
  password: String,     // bcrypt hashed
  firstName: String,
  lastName: String,
  role: Enum,           // "rider" | "driver" | "admin"
  status: Enum,         // "active" | "suspended" | "banned"
  profilePicture: String,  // S3 URL
  isPhoneVerified: Boolean,
  isEmailVerified: Boolean,
  kycVerified: Boolean,  // drivers only
  rating: Float,        // 1-5, calculated avg
  rideCount: Integer,
  cancelCount: Integer,
  createdAt: Timestamp,
  updatedAt: Timestamp,
  lastLogin: Timestamp,

  // Driver-specific fields
  licensePath: String,  // S3 URL
  licenseNumber: String,
  licenseExpiry: Date,
  vehicleRegistration: String,
  vehicleType: String,
  vehicleNumber: String,
  vehicleColor: String,
  insurance: String,
  documents: Array,
  background_check: Boolean
}
```

**Rides Collection**

```javascript
{
  _id: ObjectId,
  driverId: ObjectId,   // indexed
  sourceLocation: {
    type: "Point",      // GeoJSON
    coordinates: [lng, lat]
  },
  destinationLocation: {
    type: "Point",
    coordinates: [lng, lat]
  },
  address: {
    source: String,
    destination: String
  },
  scheduledTime: Timestamp,  // indexed
  route: {
    distance: Float,    // km
    duration: Integer,  // minutes
    encoded: String     // polyline
  },
  seatsAvailable: Integer,   // indexed
  seatsBooked: Integer,
  pricePerSeat: Float,
  baseFare: Float,
  vehicleType: String,
  preferences: {
    womenOnly: Boolean,
    acEnabled: Boolean,
    allowMusic: Boolean,
    talkative: Boolean
  },
  amenities: Array,     // ["wifi", "outlet", "music"]
  status: Enum,         // "pending" | "confirmed" | "started" | "completed" | "cancelled"
  bookings: Array,      // [ObjectId]
  isRecurring: Boolean,
  recurringPattern: {
    daysOfWeek: Array,  // ["MON", "TUE", ...]
    pattern: String,    // "weekdays" | "weekends"
  },
  createdAt: Timestamp,
  updatedAt: Timestamp,

  // Indexes
  indexes: [
    { driverId: 1, scheduledTime: 1 },
    { "sourceLocation": "2dsphere" },
    { "destinationLocation": "2dsphere" },
    { scheduledTime: 1, status: 1 }
  ]
}
```

**Bookings Collection**

```javascript
{
  _id: ObjectId,
  rideId: ObjectId,     // indexed
  riderId: ObjectId,    // indexed
  driverId: ObjectId,
  numberOfPassengers: Integer,
  status: Enum,         // "pending" | "confirmed" | "started" | "cancelled" | "completed"
  totalFare: Float,
  fare: {
    baseFare: Float,
    distanceFare: Float,
    timeFare: Float,
    surgeFare: Float,
    discount: Float,
    total: Float
  },
  paymentId: ObjectId,
  paymentStatus: Enum,  // "pending" | "completed" | "failed" | "refunded"
  pickupTime: Timestamp,
  dropoffTime: Timestamp,
  cancellationReason: String,
  cancelledBy: Enum,    // "rider" | "driver" | "system"
  rating: {
    ratedBy: ObjectId,
    ratedTo: ObjectId,
    score: Integer,     // 1-5
    review: String,
    categories: {
      driving: Integer,
      cleanliness: Integer,
      communication: Integer
    }
  },
  createdAt: Timestamp,
  updatedAt: Timestamp,

  indexes: [
    { rideId: 1, riderId: 1 },
    { status: 1, createdAt: -1 }
  ]
}
```

**Payments Collection**

```javascript
{
  _id: ObjectId,
  bookingId: ObjectId,  // indexed, unique
  userId: ObjectId,
  amount: Float,
  currency: String,     // "INR"
  status: Enum,         // "pending" | "completed" | "failed" | "refunded"
  method: Enum,         // "card" | "upi" | "netbanking" | "wallet"

  // Stripe Test Mode (Razorpay for production)
  orderId: String,
  paymentId: String,
  signature: String,    // verification

  // Refund
  refund: {
    id: String,
    amount: Float,
    reason: String,
    status: Enum,       // "pending" | "completed" | "failed"
    initiatedAt: Timestamp
  },

  metadata: {
    ip: String,
    userAgent: String,
    deviceId: String
  },

  createdAt: Timestamp,
  updatedAt: Timestamp,

  indexes: [
    { bookingId: 1 },
    { orderId: 1 },
    { status: 1, createdAt: -1 }
  ]
}
```

### 4.2 Essential Indexes

```javascript
// Performance-critical indexes
db.users.createIndex({ phone: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1, status: 1 });

db.rides.createIndex({ driverId: 1 });
db.rides.createIndex({ sourceLocation: "2dsphere" });
db.rides.createIndex({ destinationLocation: "2dsphere" });
db.rides.createIndex({ scheduledTime: 1, status: 1 });
db.rides.createIndex({ createdAt: -1 });

db.bookings.createIndex({ rideId: 1, riderId: 1 }, { unique: true });
db.bookings.createIndex({ status: 1, createdAt: -1 });

db.payments.createIndex({ bookingId: 1 }, { unique: true });
db.payments.createIndex({ status: 1, createdAt: -1 });

// TTL indexes (auto-delete old data)
db.locations.createIndex({ timestamp: 1 }, { expireAfterSeconds: 86400 });
db.notifications.createIndex({ createdAt: 1 }, { expireAfterSeconds: 604800 });
```

### 4.3 Query Optimization Patterns

**❌ SLOW: N+1 Problem**

```javascript
const rides = await Ride.find({ status: "completed" });
for (let ride of rides) {
  const bookings = await Booking.find({ rideId: ride._id }); // Repeated!
}
```

**✅ FAST: Batch Loading**

```javascript
const rides = await Ride.find({ status: "completed" });
const rideIds = rides.map((r) => r._id);
const bookings = await Booking.find({ rideId: { $in: rideIds } });
const bookingsByRide = groupBy(bookings, "rideId");
```

**❌ SLOW: Fetch All Fields**

```javascript
const rides = await Ride.find({ status: "active" });
```

**✅ FAST: Project Only Needed**

```javascript
const rides = await Ride.find(
  { status: "active" },
  { driverId: 1, scheduledTime: 1, sourceLocation: 1 },
);
```

---

## 5. Caching Strategy

### 5.1 Multi-Layer Cache

```
Level 1: Browser Cache (localStorage, sessionStorage)
  └─ User preferences, offline bookings (30+ days)

Level 2: Redis Cache (Application)
  └─ ride:{rideId} (10 min TTL)
  └─ user:{userId}:profile (30 min TTL)
  └─ driver:{driverId}:location (2 min TTL)
  └─ activeRides (1 min TTL, SORTED SET)

Level 3: Database
  └─ MongoDB for persistent data
  └─ Postgresql for analytics
```

### 5.2 Cache Invalidation

**Event-Based**: Invalidate immediately on data change
**TTL-Based**: Auto-expire after time limit
**Dependency-Based**: Related caches cascade invalidate

```javascript
// Example: When ride is booked
userUpdated(user_id) →
  invalidate('user:' + user_id + ':profile')
  invalidate('ride:search:*')
  invalidate('user:' + user_id + ':earnings')
```

---

## 6. API Design

### 6.1 Versioning & Response Format

**API Version**: v1  
**Base URL**: `/api/v1`

**Success Response**

```json
{
  "status": "success",
  "code": 200,
  "data": {},
  "timestamp": "2026-02-26T10:30:00Z"
}
```

**Error Response**

```json
{
  "status": "error",
  "code": 400,
  "error": {
    "message": "Validation failed",
    "details": [...],
    "errorId": "error-id-123"
  },
  "timestamp": "2026-02-26T10:30:00Z"
}
```

### 6.2 Rate Limiting

```
Public users:     100 requests/minute per IP
Authenticated:    1000 requests/minute per user
Admin:            5000 requests/minute

Headers returned:
  X-RateLimit-Limit: 1000
  X-RateLimit-Remaining: 875
  X-RateLimit-Reset: 1645090800
```

### 6.3 Pagination

```
Query: /api/v1/rides?page=1&limit=20&sort=-createdAt

Response:
{
  "data": [...],
  "pagination": {
    "total": 500,
    "page": 1,
    "limit": 20,
    "pages": 25,
    "hasNext": true
  }
}
```

---

## 7. Security Implementation

### 7.1 Authentication & Authorization

- **HTTPS**: TLS 1.3 mandatory
- **JWT**: 24-hour expiration, refresh tokens for rotation
- **Encryption**: AES-256 for sensitive data at rest
- **RBAC**: Fine-grained role-based access control

### 7.2 Input Validation

All API inputs validated using Joi schemas:

```javascript
const rideSchema = Joi.object({
  sourceLocation: Joi.object({
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
  }).required(),
  destinationLocation: Joi.object({
    latitude: Joi.number().required(),
    longitude: Joi.number().required(),
  }).required(),
  scheduledTime: Joi.date().iso().required(),
  seatsAvailable: Joi.number().integer().min(1).max(8).required(),
});
```

### 7.3 Data Protection

- **PII Tokenization**: Phone/email never exposed in logs
- **Encryption**: Credit card data encrypted before storage
- **Backup**: Encrypted, geographically redundant (3 regions)
- **Audit Logs**: All data access immutably recorded

---

## 8. Scalability Patterns

### 8.1 Horizontal Scaling Architecture

```
Load Balancer (AWS ALB)
  ├─ API Server 1
  ├─ API Server 2
  ├─ API Server 3
  └─ API Server N (auto-scaling)

Shared Infrastructure:
  ├─ MongoDB Atlas Cluster (M30+, 3+ nodes)
  ├─ Redis Cluster (6+ nodes)
  ├─ Kafka Cluster (3+ brokers)
  ├─ Elasticsearch (5+ nodes)
  └─ RabbitMQ (3+ nodes)

Auto-Scaling Triggers:
- CPU > 70% for 5 mins → Add instance
- Memory > 85% → Alert operations
- Network > 80% → Scale out immediately
```

---

## 9. Integration with Advanced Services (Phase 3)

The following production-grade services from **02-SYSTEM-ARCHITECTURE.md sections 3.8-3.13** enhance this core design:

| Service                         | Purpose                         | Integration                                         | Reference    |
| ------------------------------- | ------------------------------- | --------------------------------------------------- | ------------ |
| Intelligent Matching Engine     | 5-factor weighted ride matching | Kafka events on booking                             | Section 3.8  |
| Fraud Detection & Safety        | ML-based fraud scoring          | Real-time via XGBoost                               | Section 3.9  |
| Advanced WebSocket              | 35+ real-time event types       | Redis Pub/Sub adapter                               | Section 3.10 |
| ELK Stack Monitoring            | Observability & dashboards      | Logstash pipeline ingestion                         | Section 3.11 |
| Enhanced Payment Service        | Idempotent payments & refunds   | Stripe webhook processing (Razorpay for production) | Section 3.12 |
| Enhanced Trip Service (Phase 4) | ML-based traveler matching      | Collaborative filtering                             | Section 3.13 |

---
