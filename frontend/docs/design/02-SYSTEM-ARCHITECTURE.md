# System Architecture Document

## Smart Scheduled Car Pooling Platform

---

## 1. Architecture Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │   iOS App        │  │   Android App    │  │  Admin Web    │  │
│  │  (React Native)  │  │  (React Native)  │  │  (React.js)   │  │
│  └──────────────────┘  └──────────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ├─── HTTPS/WSS ───┐
                              ▼                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                         API GATEWAY LAYER                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Load Balancer (Nginx / AWS ALB for production)          │   │
│  │  - SSL Termination                                       │   │
│  │  - Rate Limiting                                         │   │
│  │  - Request Routing                                       │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│                         APPLICATION LAYER                                     │
├───────────────────────────────────────────────────────────────────────────────┤
│  Core Services (Node.js)                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │    Auth      │  │     Ride     │  │   Payment    │  │     Chat     │       │
│  │   Service    │  │   Service    │  │   Service    │  │   Service    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │     User     │  │ Notification │  │    Admin     │  │    Safety    │       │
│  │   Service    │  │   Service    │  │   Service    │  │   Service    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘       │
│                                                                               │
│  Advanced Services (Node.js + Python ML)                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Geospatial  │  │   Location   │  │   Matching   │  │     ETA      │       │
│  │   Service    │  │   Tracking   │  │   Engine     │  │   Routing    │       │
│  │ (Geohashing) │  │  (WebSocket) │  │  (AI/ML)     │  │   Service    │       │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                         │
│  │    Fraud     │  │   Analytics  │  │   Logging    │                         │
│  │  Detection   │  │   Service    │  │  (ELK Stack) │                         │
│  │     (ML)     │  │  (BigQuery)  │  │              │                         │
│  └──────────────┘  └──────────────┘  └──────────────┘                         │
└───────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DATA LAYER                                 │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   MongoDB    │  │    Redis     │  │  PostgreSQL  │           │
│  │ Atlas M0 Free│  │ Cloud Free   │  │ (Analytics)  │           │
│  │ (Paid tiers  │  │ (Paid tiers  │  │              │           │
│  │  for prod)   │  │  for prod)   │  │              │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│  ┌──────────────┐  ┌──────────────┐                             │
│  │  Cloudinary  │  │ Elasticsearch│                             │
│  │  Free Tier   │  │   (Search)   │                             │
│  │ (AWS S3 prod)│  │              │                             │
│  └──────────────┘  └──────────────┘                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   EXTERNAL SERVICES LAYER                       │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │    Mapbox    │  │ Stripe Test  │  │   Firebase   │           │
│  │  Free Tier   │  │     Mode     │  │     FCM      │           │
│  │ (Google Maps │  │  (Razorpay   │  │              │           │
│  │  for prod)   │  │   for prod)  │  │              │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Firebase   │  │   Mailgun    │  │   Sentry     │           │
│  │  Phone Auth  │  │  Free Tier   │  │  Free Tier   │           │
│  │   (Twilio    │  │  (SendGrid   │  │  (Logging)   │           │
│  │   for prod)  │  │   for prod)  │  │              │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Architecture Patterns

### 2.1 Microservices Architecture

The application follows a microservices architecture pattern where different functionalities are separated into independent services.

**Benefits:**

- Independent scaling of services
- Technology flexibility
- Fault isolation
- Easy deployment and updates

### 2.2 RESTful API Design

All services expose RESTful APIs following standard HTTP methods and status codes.

### 2.3 Event-Driven Architecture

Services communicate through events for asynchronous operations using message queues (RabbitMQ/AWS SQS).

### 2.4 CQRS Pattern (for Analytics)

Command Query Responsibility Segregation for separating read and write operations in analytics service.

---

## 3. Detailed Component Architecture

### 3.1 Client Layer

#### 3.1.1 Mobile Applications (React Native)

```
mobile-app/
├── src/
│   ├── components/         # Reusable UI components
│   ├── screens/           # Screen components
│   ├── navigation/        # Navigation configuration
│   ├── redux/             # State management
│   │   ├── actions/
│   │   ├── reducers/
│   │   └── store/
│   ├── services/          # API services
│   ├── utils/             # Utility functions
│   ├── hooks/             # Custom React hooks
│   ├── constants/         # App constants
│   └── assets/            # Images, fonts, etc.
├── ios/                   # iOS native code
├── android/               # Android native code
└── package.json
```

**Key Libraries:**

- React Navigation (routing)
- Redux Toolkit (state management)
- Axios (HTTP client)
- React Native Maps (mapping)
- Socket.io-client (real-time communication)
- React Native Firebase (push notifications)
- AsyncStorage (local storage)

#### 3.1.2 Admin Web Dashboard (React.js)

```
admin-dashboard/
├── src/
│   ├── components/        # Reusable components
│   ├── pages/            # Page components
│   ├── layouts/          # Layout components
│   ├── redux/            # State management
│   ├── services/         # API services
│   ├── utils/            # Utilities
│   ├── hooks/            # Custom hooks
│   └── assets/           # Static assets
└── package.json
```

**Key Libraries:**

- React Router (routing)
- Material-UI (UI components)
- Redux Toolkit (state management)
- Recharts (data visualization)
- Axios (HTTP client)

---

### 3.2 API Gateway Layer

#### 3.2.1 Load Balancer

- **Technology**: AWS Application Load Balancer (ALB) or Nginx
- **Functions**:
  - Distribute traffic across multiple backend instances
  - SSL/TLS termination
  - Health checks
  - Session persistence (sticky sessions)

#### 3.2.2 API Gateway

- **Technology**: Express Gateway or AWS API Gateway

- **Functions**:
  - Request routing
  - Rate limiting (per user/IP)
  - Authentication/Authorization
  - Request/Response transformation
  - API versioning
  - Logging and monitoring

**Rate Limiting Strategy:**

```javascript
// Example rate limiting rules
{
  "anonymous": "10 requests per minute",
  "authenticated": "100 requests per minute",
  "premium": "500 requests per minute"
}
```

---

### 3.3 Application Layer (Microservices)

#### 3.3.1 Authentication Service

**Responsibilities:**

- User registration and login
- OTP generation and verification
- JWT token generation and validation
- Session management
- Password reset

**Technology Stack:**

- Node.js + Express
- JWT for tokens
- Bcrypt for password hashing
- Redis for session storage

**API Endpoints:**

```
POST   /api/v1/auth/register
POST   /api/v1/auth/send-otp
POST   /api/v1/auth/verify-otp
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh-token
POST   /api/v1/auth/logout
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
```

#### 3.3.2 User Service

**Responsibilities:**

- User profile management
- Driver verification
- Document uploads
- User preferences
- Rating and reviews

**Technology Stack:**

- Node.js + Express
- MongoDB for user data
- AWS S3 for document storage

**API Endpoints:**

```
GET    /api/v1/users/profile
PUT    /api/v1/users/profile
POST   /api/v1/users/documents
GET    /api/v1/users/:userId
POST   /api/v1/users/verify-driver
GET    /api/v1/users/:userId/ratings
POST   /api/v1/users/:userId/rate
```

#### 3.3.3 Ride Service

**Responsibilities:**

- Create and manage rides
- Search rides
- Ride requests and acceptances
- Ride status updates
- Ride history

**Technology Stack:**

- Node.js + Express
- MongoDB for ride data
- Elasticsearch for advanced search
- Redis for caching popular routes

**API Endpoints:**

```
POST   /api/v1/rides
GET    /api/v1/rides
GET    /api/v1/rides/:rideId
PUT    /api/v1/rides/:rideId
DELETE /api/v1/rides/:rideId
POST   /api/v1/rides/search
POST   /api/v1/rides/:rideId/request
POST   /api/v1/rides/:rideId/accept
POST   /api/v1/rides/:rideId/reject
POST   /api/v1/rides/:rideId/cancel
GET    /api/v1/rides/:rideId/requests
PUT    /api/v1/rides/:rideId/status
```

#### 3.3.4 Geospatial Service (Location Indexing)

**Responsibilities:**

- Geospatial indexing and querying
- Convert 2D geographic data to 1D for efficient search
- Find nearby drivers/riders within radius
- Grid-based spatial partitioning
- Manage location cells and chunks

**Technology Stack:**

- Node.js + Express for API layer
- Redis with geospatial commands
- Google S2 Geometry Library
- PostGIS for advanced spatial queries
- In-memory spatial index cache

**Geospatial Indexing Strategies:**

```
┌──────────────────────────────────────────────────────────────┐
│                  Geospatial Indexing Comparison              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. GEOHASHING (SELECTED FOR OUR SYSTEM)                     │
│     - Converts lat/lng to base32 string: "tu3qwu9m"          │
│     - Prefix matching for proximity search                   │
│     - Simple, fast, good enough for ride sharing             │
│     - Example: geohash(28.6139, 77.2090, precision=7)        │
│     - Precision 6: ~1.2 km × 0.6 km grid                     │
│     - Used by: Redis GEOADD/GEORADIUS commands               │
│                                                              │
│  2. QUADTREES                                                │
│     - Recursively divides 2D space into 4 quadrants          │
│     - Each node has 4 children (NE, NW, SE, SW)              │
│     - Good for dynamic data, variable density regions        │
│     - More complex than geohashing                           │
│                                                              │
│  3. GOOGLE S2 (Optional for future)                          │
│     - Divides earth into hierarchical cells                  │
│     - Uses Hilbert curve for 1D mapping                      │
│     - Excellent for coverage queries and unions              │
│     - Used by: Google Maps, Uber                             │
│     - More accurate than geohash but complex                 │
│                                                              │
│  4. H3 (Uber's Hexagonal Hierarchical System)                │
│     - Hexagonal grid (better spatial uniformity)             │
│     - K nearest neighbors more efficient                     │
│     - Complex to implement, overkill for MVP                 │
│                                                              │
│  DECISION: Use Geohashing with Redis for MVP                 │
│            Migrate to S2 if scaling beyond 1M users          │
└──────────────────────────────────────────────────────────────┘
```

**Geohashing Implementation:**

```javascript
// Geospatial Service Implementation
class GeospatialService {
  constructor(redisClient) {
    this.redis = redisClient;
    this.DRIVER_LOCATION_KEY = "drivers:locations";
    this.LOCATION_TTL = 300; // 5 minutes
  }

  /**
   * Update driver location in geospatial index
   */
  async updateDriverLocation(driverId, latitude, longitude) {
    await this.redis.geoadd(
      this.DRIVER_LOCATION_KEY,
      longitude,
      latitude,
      driverId,
    );

    // Set TTL for automatic cleanup of inactive drivers
    await this.redis.expire(this.DRIVER_LOCATION_KEY, this.LOCATION_TTL);

    // Also store in cell-based index for distributed queries
    const geohash = this.encodeGeohash(latitude, longitude, 6);
    await this.redis.sadd(`drivers:cell:${geohash}`, driverId);
  }

  /**
   * Find nearby drivers within radius
   */
  async findNearbyDrivers(latitude, longitude, radiusKm = 5, limit = 20) {
    const results = await this.redis.georadius(
      this.DRIVER_LOCATION_KEY,
      longitude,
      latitude,
      radiusKm,
      "km",
      "WITHDIST",
      "WITHCOORD",
      "ASC",
      "COUNT",
      limit,
    );

    return results.map(([driverId, distance, [lng, lat]]) => ({
      driverId,
      distance: parseFloat(distance),
      location: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
    }));
  }

  /**
   * Get geohash cell for location
   */
  encodeGeohash(lat, lng, precision = 6) {
    // Base32 encoding implementation
    const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
    let latRange = [-90, 90];
    let lngRange = [-180, 180];
    let hash = "";
    let bits = 0;
    let bit = 0;
    let ch = 0;

    while (hash.length < precision) {
      const mid = (lngRange[0] + lngRange[1]) / 2;
      if (bits % 2 === 0) {
        if (lng > mid) {
          ch |= 1 << (4 - bit);
          lngRange[0] = mid;
        } else {
          lngRange[1] = mid;
        }
      } else {
        const latMid = (latRange[0] + latRange[1]) / 2;
        if (lat > latMid) {
          ch |= 1 << (4 - bit);
          latRange[0] = latMid;
        } else {
          latRange[1] = latMid;
        }
      }

      bits++;
      bit++;
      if (bit === 5) {
        hash += BASE32[ch];
        bit = 0;
        ch = 0;
      }
    }

    return hash;
  }

  /**
   * Get chunk ID for distributed load balancing
   */
  getChunkId(latitude, longitude) {
    const geohash = this.encodeGeohash(latitude, longitude, 4);
    return geohash; // 4-char geohash defines chunk (20km × 20km approx)
  }
}
```

**API Endpoints:**

```
POST   /api/v1/geospatial/update-location
POST   /api/v1/geospatial/find-nearby
GET    /api/v1/geospatial/chunk/:chunkId
POST   /api/v1/geospatial/cells-in-radius
```

---

### 3.3.5 Location Tracking Service

**Responsibilities:**

- Real-time driver location updates
- Location history storage
- Live tracking during ride
- Location accuracy validation
- Route deviation detection

**Technology Stack:**

- Node.js + WebSocket (Socket.io)
- Redis Pub/Sub for real-time events
- MongoDB with TTL for location history
- Apache Kafka for location event streaming

**Real-Time Location Architecture:**

```
┌────────────────────────────────────────────────────────────┐
│              Real-Time Location Flow                       │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Driver Mobile App                                         │
│       │                                                    │
│       │ Every 5 seconds: send { lat, lng, heading, speed } │
│       ▼                                                    │
│  WebSocket Server (Socket.io)                              │
│       │                                                    │
│       ├──► Validate location accuracy                      │
│       ├──► Update Redis geospatial index                   │
│       ├──► Publish to Kafka topic "location-events"        │
│       └──► Broadcast to subscribed riders via WebSocket    │
│                                                            │
│  Kafka Consumer Services:                                  │
│       ├──► Persist to MongoDB (TTL: 24 hours)              │
│       ├──► Check route deviation                           │
│       ├──► Update ETA calculations                         │
│       └──► Trigger safety alerts if anomaly detected       │
│                                                            │
│  Rider Mobile App (Subscribed to ride:${rideId})           │
│       │                                                    │
│       └──► Receives location updates every 3-5 seconds     │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

**Location Update Handler:**

```javascript
// WebSocket location tracking implementation
class LocationTrackingService {
  constructor(io, redis, kafka) {
    this.io = io;
    this.redis = redis;
    this.kafka = kafka;
  }

  /**
   * Handle driver location update
   */
  async handleLocationUpdate(socket, data) {
    const { rideId, driverId, latitude, longitude, heading, speed, accuracy } =
      data;

    // Validate location accuracy (reject if > 50m uncertainty)
    if (accuracy > 50) {
      socket.emit("location:error", { message: "Poor GPS accuracy" });
      return;
    }

    // Update geospatial index
    await this.redis.geoadd("drivers:locations", longitude, latitude, driverId);

    // Store location with metadata
    const locationData = {
      rideId,
      driverId,
      location: { latitude, longitude },
      heading,
      speed,
      accuracy,
      timestamp: new Date(),
    };

    // Publish to Kafka for async processing
    await this.kafka.send({
      topic: "location-events",
      messages: [{ value: JSON.stringify(locationData) }],
    });

    // Broadcast to riders tracking this ride
    this.io.to(`ride:${rideId}`).emit("location:updated", {
      location: { latitude, longitude },
      heading,
      speed,
      timestamp: new Date(),
    });

    // Calculate and emit updated ETA
    const eta = await this.calculateETA(rideId, latitude, longitude);
    this.io.to(`ride:${rideId}`).emit("eta:updated", { eta });
  }

  /**
   * Detect route deviation
   */
  async checkRouteDeviation(rideId, currentLocation) {
    const ride = await Ride.findById(rideId);
    const expectedRoute = ride.route.coordinates;

    const deviationDistance = this.calculateDistanceFromRoute(
      currentLocation,
      expectedRoute,
    );

    // Alert if deviated more than 500m from route
    if (deviationDistance > 0.5) {
      this.io.to(`ride:${rideId}`).emit("route:deviated", {
        deviation: deviationDistance,
        currentLocation,
      });

      // Trigger safety alert
      await this.triggerSafetyAlert(rideId, "route_deviation", {
        deviation: deviationDistance,
      });
    }
  }
}
```

**WebSocket Events:**

```
// Client → Server
location:update          - Driver sends location update
location:subscribe       - Rider subscribes to ride tracking
location:unsubscribe     - Stop tracking

// Server → Client
location:updated         - New location for tracked ride
eta:updated              - Updated ETA
route:deviated           - Route deviation detected
location:error           - Invalid location data
```

---

### 3.3.6 Matching Service (AI/ML Enhanced)

**Responsibilities:**

- Intelligent ride-rider matching
- Pickup route optimization (TSP variation)
- Demand prediction and surge pricing
- Fraud detection with ML
- Driver score calculation

**Technology Stack:**

- Python (Flask/FastAPI) for ML models
- Node.js for API layer
- TensorFlow/PyTorch for ML models
- Redis for caching matching scores
- PostgreSQL for analytics data

**Enhanced Matching Algorithm:**

```python
# Advanced ride matching with multiple factors
class RideMatchingEngine:
    """
    Intelligent matching engine using weighted scoring
    """

    def calculate_matching_score(self, ride, passenger):
        """
        Multi-factor matching score (0-100)
        """
        score = 0

        # 1. Proximity Score (40% weight)
        # Measures how close passenger pickup is to driver's route
        proximity_score = self.calculate_proximity_score(
            passenger.pickup_location,
            ride.route
        )
        score += proximity_score * 0.40

        # 2. Time Compatibility (30% weight)
        # Checks if pickup time aligns with ride schedule
        time_score = self.calculate_time_compatibility(
            passenger.desired_time,
            ride.scheduled_time,
            ride.route_duration
        )
        score += time_score * 0.30

        # 3. Driver Rating (15% weight)
        # Prefer highly rated drivers
        rating_score = (ride.driver.rating / 5.0) * 100
        score += rating_score * 0.15

        # 4. Acceptance Rate (10% weight)
        # Prioritize drivers with high acceptance history
        acceptance_score = ride.driver.acceptance_rate
        score += acceptance_score * 0.10

        # 5. Safety Compatibility (5% weight)
        # Match preferences (e.g., women-only rides)
        safety_score = self.check_safety_compatibility(ride, passenger)
        score += safety_score * 0.05

        return score

    def calculate_proximity_score(self, pickup, route):
        """
        Calculate how close pickup point is to driver's route
        Returns score 0-100
        """
        # Find nearest point on route to pickup
        min_distance = float('inf')
        for point in route.waypoints:
            distance = self.haversine_distance(pickup, point)
            if distance < min_distance:
                min_distance = distance

        # Score: 100 if 0km, 0 if 5km+
        # Linear decay: score = 100 - (distance * 20)
        if min_distance >= 5:
            return 0
        return 100 - (min_distance * 20)

    def calculate_time_compatibility(self, desired_time, ride_time, duration):
        """
        Time window matching score
        """
        time_diff_minutes = abs((desired_time - ride_time).total_seconds() / 60)

        # Perfect match: 0-10 min difference
        if time_diff_minutes <= 10:
            return 100
        # Acceptable: 10-30 min difference
        elif time_diff_minutes <= 30:
            return 100 - ((time_diff_minutes - 10) * 2.5)
        # Poor match: 30-60 min
        elif time_diff_minutes <= 60:
            return 50 - ((time_diff_minutes - 30) * 1.67)
        # Unacceptable: 60+ min
        else:
            return 0

    def optimize_pickup_route(self, ride, passengers):
        """
        Optimize pickup order using TSP (Traveling Salesman Problem) variation
        Minimize total distance and time while respecting ride schedule
        """
        from ortools.constraint_solver import routing_enums_pb2
        from ortools.constraint_solver import pywrapcp

        # Create distance matrix between all points
        locations = [ride.origin] + [p.pickup for p in passengers] + [ride.destination]
        distance_matrix = self.create_distance_matrix(locations)

        # Initialize OR-Tools routing model
        manager = pywrapcp.RoutingIndexManager(
            len(distance_matrix),
            1,  # One vehicle (driver)
            0   # Start at origin
        )
        routing = pywrapcp.RoutingModel(manager)

        # Define distance callback
        def distance_callback(from_index, to_index):
            from_node = manager.IndexToNode(from_index)
            to_node = manager.IndexToNode(to_index)
            return distance_matrix[from_node][to_node]

        transit_callback_index = routing.RegisterTransitCallback(distance_callback)
        routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

        # Solve
        search_parameters = pywrapcp.DefaultRoutingSearchParameters()
        search_parameters.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )

        solution = routing.SolveWithParameters(search_parameters)

        if solution:
            return self.extract_optimized_route(manager, routing, solution)

        return None

    def detect_fraud_pattern(self, driver_id, ride_data):
        """
        ML-based fraud detection
        """
        # Load trained model
        model = self.load_fraud_model()

        # Extract features
        features = {
            'route_deviation_count': ride_data['route_deviations'],
            'cancellation_rate': driver_id.cancellation_rate,
            'rating_drop': driver_id.rating_trend,
            'unusual_route_length': ride_data['route_length_deviation'],
            'time_of_day': ride_data['hour'],
            'surge_pricing_correlation': ride_data['surge_correlation']
        }

        # Predict fraud probability
        fraud_probability = model.predict_proba([list(features.values())])[0][1]

        if fraud_probability > 0.7:
            return {
                'is_fraud': True,
                'confidence': fraud_probability,
                'reasons': self.explain_fraud_detection(features, model)
            }

        return {'is_fraud': False, 'confidence': 1 - fraud_probability}
```

**API Endpoints:**

```
POST   /api/v1/matching/find-matches
POST   /api/v1/matching/optimize-route
POST   /api/v1/matching/calculate-score
POST   /api/v1/matching/predict-demand
GET    /api/v1/matching/surge-pricing
POST   /api/v1/matching/detect-fraud
POST   /api/v1/matching/preferred-pickups
```

---

### 3.3.7 ETA Calculation & Routing Service

**Responsibilities:**

- Real-time ETA calculation
- Route optimization with traffic data
- Preferred pickup points identification
- Multi-stop route planning
- Traffic prediction

**Technology Stack:**

- Node.js + Express
- Google Maps Directions API
- Google Maps Distance Matrix API
- Redis for caching routes
- Machine learning for ETA refinement

**ETA Calculation Engine:**

```javascript
class ETACalculationService {
  constructor(googleMapsClient, redis) {
    this.maps = googleMapsClient;
    this.redis = redis;
  }

  /**
   * Calculate accurate ETA with real-time traffic
   */
  async calculateETA(origin, destination, waypoints = []) {
    // Check cache first
    const cacheKey = this.getCacheKey(origin, destination, waypoints);
    const cached = await this.redis.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // Call Google Maps Directions API
    const route = await this.maps.directions({
      origin: `${origin.latitude},${origin.longitude}`,
      destination: `${destination.latitude},${destination.longitude}`,
      waypoints: waypoints.map((w) => `${w.latitude},${w.longitude}`),
      departure_time: "now",
      traffic_model: "best_guess",
      mode: "driving",
    });

    const result = {
      duration: route.routes[0].legs.reduce(
        (sum, leg) => sum + leg.duration.value,
        0,
      ),
      durationInTraffic: route.routes[0].legs.reduce(
        (sum, leg) => sum + leg.duration_in_traffic.value,
        0,
      ),
      distance: route.routes[0].legs.reduce(
        (sum, leg) => sum + leg.distance.value,
        0,
      ),
      polyline: route.routes[0].overview_polyline.points,
      steps: route.routes[0].legs.flatMap((leg) => leg.steps),
    };

    // Cache for 2 minutes
    await this.redis.setex(cacheKey, 120, JSON.stringify(result));

    return result;
  }

  /**
   * Identify preferred pickup points using ML
   * Analyzes historical data to suggest optimal pickup locations
   */
  async findPreferredPickupPoints(area, radius = 200) {
    // Get historical pickup data for this area
    const historicalPickups = await PickupHistory.aggregate([
      {
        $geoNear: {
          near: { type: "Point", coordinates: [area.longitude, area.latitude] },
          distanceField: "distance",
          maxDistance: radius,
          spherical: true,
        },
      },
      {
        $group: {
          _id: {
            $round: ["$location.coordinates", 4], // Cluster nearby points
          },
          count: { $sum: 1 },
          avgWaitTime: { $avg: "$waitTime" },
          location: { $first: "$location" },
        },
      },
      {
        $match: { count: { $gte: 10 } }, // At least 10 pickups
      },
      {
        $sort: { count: -1 },
      },
      {
        $limit: 5,
      },
    ]);

    return historicalPickups.map((point) => ({
      location: point.location,
      popularity: point.count,
      avgWaitTime: point.avgWaitTime,
      type: this.categorizePickupPoint(point.location),
    }));
  }

  /**
   * Recalculate ETA during active ride
   */
  async updateLiveETA(rideId, currentLocation) {
    const ride = await Ride.findById(rideId);
    const remainingWaypoints = this.getRemainingWaypoints(
      ride,
      currentLocation,
    );

    const eta = await this.calculateETA(
      currentLocation,
      ride.destination,
      remainingWaypoints,
    );

    // Publish updated ETA
    await this.publishETAUpdate(rideId, {
      eta: eta.durationInTraffic,
      distance: eta.distance,
      updatedAt: new Date(),
    });

    return eta;
  }
}
```

**API Endpoints:**

```
POST   /api/v1/routing/calculate-eta
POST   /api/v1/routing/optimize-route
POST   /api/v1/routing/preferred-pickups
POST   /api/v1/routing/update-live-eta
GET    /api/v1/routing/traffic-prediction
```

---

### 3.3.8 Driver Finder Service (Load Balanced)

**Responsibilities:**

- Find and assign available drivers to ride requests
- Distributed locking to prevent double-assignment
- Consistent hashing for horizontal scaling
- Gossip protocol for server coordination
- Request queue management

**Technology Stack:**

- Node.js + Express
- Redis for distributed locks
- Consistent hashing ring
- WebSocket for driver communication
- Apache Kafka for event processing

**Distributed Architecture:**

```
┌──────────────────────────────────────────────────────────────┐
│           Driver Finder Service - Distributed Design         │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Load Balancer (ALB/Nginx)                                   │
│       │                                                      │
│       ├──► Driver Finder Server 1 (Chunk: tu3q, tu3r)        │
│       ├──► Driver Finder Server 2 (Chunk: tu3s, tu3t)        │
│       ├──► Driver Finder Server 3 (Chunk: tu3u, tu3v)        │
│       └──► Driver Finder Server N (Chunk: ...)               │
│                                                              │
│  Consistent Hashing:                                         │
│    - Rider request → Hash(pickup_lat, pickup_lng) → Chunk ID │
│    - Chunk ID → Responsible Server (via hash ring)           │
│    - If server down, requests route to next server in ring   │
│                                                              │
│  Gossip Protocol (Memberlist):                               │
│    - Servers exchange: active_drivers, chunk_assignments     │
│    - Heartbeat every 1 second                                │
│    - Failure detection within 3 seconds                      │
│    - Automatic rebalancing on server add/remove              │
│                                                              │
│  Distributed Locking (Redis):                                │
│    - Lock key: ride:request:{requestId}                      │
│    - TTL: 30 seconds                                         │
│    - Ensures only ONE driver receives request at a time      │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Driver Finder Implementation:**

```javascript
const Redlock = require("redlock");
const ConsistentHash = require("consistent-hash");

class DriverFinderService {
  constructor(redis, kafka, websocket) {
    this.redis = redis;
    this.kafka = kafka;
    this.io = websocket;

    // Initialize distributed lock manager
    this.redlock = new Redlock([redis], {
      driftFactor: 0.01,
      retryCount: 3,
      retryDelay: 200,
      retryJitter: 200,
    });

    // Initialize consistent hashing ring
    this.hashRing = new ConsistentHash({
      distribution: "uniform",
      nodes: process.env.SERVER_NODES.split(","), // ['server1', 'server2', 'server3']
    });

    this.setupGossipProtocol();
  }

  /**
   * Find and assign driver to ride request
   */
  async findDriver(rideRequest) {
    const { requestId, pickup, dropoff, scheduledTime, passengerId } =
      rideRequest;

    // Step 1: Determine responsible server using consistent hashing
    const pickupChunk = this.getGeohashChunk(pickup.latitude, pickup.longitude);
    const responsibleServer = this.hashRing.get(pickupChunk);

    // If this server is responsible, process the request
    if (responsibleServer === process.env.SERVER_ID) {
      return await this.processRideRequest(rideRequest);
    } else {
      // Forward to responsible server
      return await this.forwardToServer(responsibleServer, rideRequest);
    }
  }

  /**
   * Process ride request with distributed locking
   */
  async processRideRequest(rideRequest) {
    const lockKey = `ride:request:${rideRequest.requestId}`;
    let lock;

    try {
      // Acquire distributed lock (prevents double-assignment)
      lock = await this.redlock.lock(lockKey, 30000); // 30 second TTL

      // Step 1: Find nearby available drivers
      const nearbyDrivers = await this.findNearbyDrivers(
        rideRequest.pickup,
        5, // 5km radius
      );

      if (nearbyDrivers.length === 0) {
        throw new Error("No drivers available in your area");
      }

      // Step 2: Score and rank drivers
      const rankedDrivers = await this.rankDrivers(nearbyDrivers, rideRequest);

      // Step 3: Send request to top driver
      const topDriver = rankedDrivers[0];
      const requestSent = await this.sendRideRequestToDriver(
        topDriver.driverId,
        rideRequest,
      );

      // Step 4: Start timeout timer (30 seconds to accept)
      this.startAcceptanceTimer(rideRequest.requestId, topDriver.driverId, 30);

      // Publish event to Kafka
      await this.kafka.send({
        topic: "ride-requests",
        messages: [
          {
            value: JSON.stringify({
              event: "ride_request_sent",
              requestId: rideRequest.requestId,
              driverId: topDriver.driverId,
              timestamp: new Date(),
            }),
          },
        ],
      });

      return {
        status: "pending",
        requestId: rideRequest.requestId,
        driverId: topDriver.driverId,
        eta: topDriver.eta,
      };
    } finally {
      // Release lock
      if (lock) await lock.unlock();
    }
  }

  /**
   * Find nearby drivers using geospatial index
   */
  async findNearbyDrivers(location, radiusKm) {
    const results = await this.redis.georadius(
      "drivers:available",
      location.longitude,
      location.latitude,
      radiusKm,
      "km",
      "WITHDIST",
      "WITHCOORD",
      "ASC",
    );

    return results.map(([driverId, distance, [lng, lat]]) => ({
      driverId,
      distance: parseFloat(distance),
      location: { latitude: parseFloat(lat), longitude: parseFloat(lng) },
    }));
  }

  /**
   * Rank drivers by matching score
   */
  async rankDrivers(drivers, rideRequest) {
    const scoredDrivers = await Promise.all(
      drivers.map(async (driver) => {
        const driverData = await User.findById(driver.driverId);

        const score = this.calculateDriverScore({
          distance: driver.distance,
          rating: driverData.rating,
          acceptanceRate: driverData.acceptanceRate,
          completedRides: driverData.completedRides,
        });

        return { ...driver, score, driverData };
      }),
    );

    // Sort by score descending
    return scoredDrivers.sort((a, b) => b.score - a.score);
  }

  /**
   * Calculate driver matching score
   */
  calculateDriverScore({ distance, rating, acceptanceRate, completedRides }) {
    let score = 0;

    // Distance factor (50% weight) - closer is better
    const distanceScore = Math.max(0, 100 - distance * 10);
    score += distanceScore * 0.5;

    // Rating factor (30% weight)
    const ratingScore = (rating / 5.0) * 100;
    score += ratingScore * 0.3;

    // Acceptance rate (15% weight)
    score += acceptanceRate * 0.15;

    // Experience factor (5% weight)
    const experienceScore = Math.min(100, completedRides / 10);
    score += experienceScore * 0.05;

    return score;
  }

  /**
   * Send ride request to driver via WebSocket
   */
  async sendRideRequestToDriver(driverId, rideRequest) {
    const driverSocket = this.io.sockets.sockets.get(driverId);

    if (driverSocket && driverSocket.connected) {
      driverSocket.emit("ride:request", {
        requestId: rideRequest.requestId,
        passenger: {
          name: rideRequest.passengerName,
          rating: rideRequest.passengerRating,
        },
        pickup: rideRequest.pickup,
        dropoff: rideRequest.dropoff,
        scheduledTime: rideRequest.scheduledTime,
        fare: rideRequest.estimatedFare,
        expiresIn: 30, // seconds
      });

      return true;
    }

    return false;
  }

  /**
   * Start acceptance timeout timer
   */
  startAcceptanceTimer(requestId, driverId, timeoutSeconds) {
    setTimeout(async () => {
      const request = await RideRequest.findOne({
        _id: requestId,
        status: "pending",
      });

      if (request) {
        // Request not accepted, try next driver
        await this.assignNextDriver(request);
      }
    }, timeoutSeconds * 1000);
  }

  /**
   * Setup gossip protocol for server coordination
   */
  setupGossipProtocol() {
    // Using hashicorp/memberlist pattern
    const gossip = new GossipProtocol({
      nodes: process.env.PEER_SERVERS.split(","),
      port: process.env.GOSSIP_PORT || 7946,
    });

    // Share state with peers
    setInterval(() => {
      gossip.broadcast({
        serverId: process.env.SERVER_ID,
        activeDrivers: this.getActiveDriverCount(),
        chunks: this.getAssignedChunks(),
        load: this.getCurrentLoad(),
        timestamp: Date.now(),
      });
    }, 1000);

    // Handle peer state updates
    gossip.on("state", (peerId, state) => {
      this.updatePeerState(peerId, state);
    });

    // Handle peer failure
    gossip.on("failed", (peerId) => {
      this.rebalanceChunks(peerId);
    });
  }

  /**
   * Get geohash chunk for location
   */
  getGeohashChunk(lat, lng) {
    return geohash.encode(lat, lng, 4); // 4-char geohash
  }
}
```

**WebSocket Events for Driver Finder:**

```
// Server → Driver
ride:request             - New ride request for driver
ride:request:cancelled   - Request cancelled
ride:request:timeout     - Request expired (not accepted in time)

// Driver → Server
ride:accept              - Driver accepts ride
ride:reject              - Driver rejects ride

// Server → Passenger
driver:assigned          - Driver found and assigned
driver:approaching       - Driver heading to pickup
no_drivers_available     - No drivers in area
```

**API Endpoints:**

```
POST   /api/v1/driver-finder/request-ride
POST   /api/v1/driver-finder/cancel-request
GET    /api/v1/driver-finder/available-drivers
POST   /api/v1/driver-finder/driver-status
GET    /api/v1/driver-finder/chunk-assignment
```

---

### 3.3.9 Fraud Detection & Machine Learning Service

**Responsibilities:**

- Real-time fraud detection
- Driver behavior profiling
- Anomaly detection in routes
- Fake GPS detection
- Suspicious pattern identification
- ML model training and deployment

**Technology Stack:**

- Python (FastAPI) for ML inference
- TensorFlow/PyTorch for models
- Apache Kafka for event streaming
- MLflow for model versioning
- Redis for feature caching
- PostgreSQL for training data

**Fraud Detection Architecture:**

```
┌──────────────────────────────────────────────────────────────┐
│         Fraud Detection ML Pipeline                          │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Event Sources (Kafka Topics):                               │
│    ├─ ride-events                                            │
│    ├─ location-events                                        │
│    ├─ payment-events                                         │
│    └─ rating-events                                          │
│           │                                                  │
│           ▼                                                  │
│  Feature Extraction Service                                  │
│    ├─ Calculate route deviation                              │
│    ├─ Detect GPS spoofing                                    │
│    ├─ Analyze timing patterns                                │
│    ├─ Track cancellation frequency                           │
│    └─ Monitor rating anomalies                               │
│           │                                                  │
│           ▼                                                  │
│  ML Inference Engine                                         │
│    ├─ Load trained models (XGBoost, Random Forest)           │
│    ├─ Real-time prediction (fraud probability)               │
│    ├─ Confidence scoring                                     │
│    └─ Explainability (SHAP values)                           │
│           │                                                  │
│           ▼                                                  │
│  Alert & Action System                                       │
│    ├─ High Risk (>0.8): Block transaction immediately        │
│    ├─ Medium Risk (0.5-0.8): Flag for manual review          │
│    ├─ Low Risk (<0.5): Log for monitoring                    │
│    └─ Notify admin dashboard                                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Fraud Detection Implementation:**

```python
import pandas as pd
import numpy as np
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import shap
from typing import Dict, List
import redis
import json

app = FastAPI()

# Load trained models
fraud_model = joblib.load('models/fraud_detection_model.pkl')
anomaly_detector = joblib.load('models/anomaly_detector.pkl')
explainer = shap.TreeExplainer(fraud_model)

# Redis client for feature caching
redis_client = redis.Redis(host='redis', port=6379, decode_responses=True)

class RideEvent(BaseModel):
    ride_id: str
    driver_id: str
    passenger_id: str
    route_data: Dict
    payment_data: Dict
    driver_history: Dict

class FraudDetectionService:
    """
    ML-based fraud detection for ride-sharing platform
    """

    def __init__(self):
        self.fraud_threshold = 0.7
        self.anomaly_threshold = 0.6

    def extract_features(self, ride_event: RideEvent) -> Dict:
        """
        Extract features for fraud detection
        """
        features = {}

        # Route-based features
        features['route_deviation'] = self.calculate_route_deviation(
            ride_event.route_data['actual_route'],
            ride_event.route_data['expected_route']
        )
        features['route_length_ratio'] = (
            ride_event.route_data['actual_distance'] /
            ride_event.route_data['expected_distance']
        )
        features['unusual_stops'] = len(ride_event.route_data.get('stops', []))

        # Driver behavior features
        driver = ride_event.driver_history
        features['cancellation_rate'] = driver.get('cancellation_rate', 0)
        features['acceptance_rate'] = driver.get('acceptance_rate', 100)
        features['avg_rating'] = driver.get('rating', 5.0)
        features['rating_drop'] = driver.get('rating_drop_30d', 0)
        features['completed_rides'] = driver.get('completed_rides', 0)
        features['days_since_registration'] = driver.get('account_age_days', 0)

        # Payment-based features
        payment = ride_event.payment_data
        features['surge_multiplier'] = payment.get('surge_multiplier', 1.0)
        features['fare_deviation'] = abs(
            payment['actual_fare'] - payment['estimated_fare']
        ) / payment['estimated_fare']
        features['payment_method_changes'] = payment.get('method_changes_30d', 0)

        # Time-based features
        features['hour_of_day'] = ride_event.route_data['start_time'].hour
        features['is_weekend'] = 1 if ride_event.route_data['start_time'].weekday() >= 5 else 0
        features['ride_duration_minutes'] = ride_event.route_data['duration']

        # GPS integrity features
        features['gps_spoofing_score'] = self.detect_gps_spoofing(
            ride_event.route_data['location_points']
        )
        features['location_jumps'] = self.count_location_jumps(
            ride_event.route_data['location_points']
        )

        return features

    def predict_fraud(self, features: Dict) -> Dict:
        """
        Predict fraud probability using trained model
        """
        # Convert features to DataFrame
        feature_df = pd.DataFrame([features])

        # Predict fraud probability
        fraud_probability = fraud_model.predict_proba(feature_df)[0][1]

        # Get feature importance for explainability
        shap_values = explainer.shap_values(feature_df)
        top_features = self.get_top_contributing_features(
            features, shap_values[0]
        )

        # Determine risk level
        if fraud_probability >= 0.8:
            risk_level = 'HIGH'
            action = 'BLOCK'
        elif fraud_probability >= 0.5:
            risk_level = 'MEDIUM'
            action = 'REVIEW'
        else:
            risk_level = 'LOW'
            action = 'ALLOW'

        return {
            'is_fraud': fraud_probability >= self.fraud_threshold,
            'fraud_probability': float(fraud_probability),
            'risk_level': risk_level,
            'recommended_action': action,
            'contributing_factors': top_features,
            'model_version': '1.2.3'
        }

    def detect_gps_spoofing(self, location_points: List[Dict]) -> float:
        """
        Detect GPS spoofing based on impossible movement patterns
        """
        spoofing_score = 0.0

        for i in range(1, len(location_points)):
            prev = location_points[i-1]
            curr = location_points[i]

            # Calculate time difference
            time_diff = (curr['timestamp'] - prev['timestamp']).total_seconds()

            # Calculate distance
            distance = self.haversine_distance(
                prev['latitude'], prev['longitude'],
                curr['latitude'], curr['longitude']
            )

            # Calculate speed (km/h)
            speed = (distance / time_diff) * 3600 if time_diff > 0 else 0

            # Flag impossible speeds (>250 km/h)
            if speed > 250:
                spoofing_score += 0.3

            # Check altitude changes (suspicious if jumping between -100m and 10000m)
            if abs(curr.get('altitude', 0) - prev.get('altitude', 0)) > 1000:
                spoofing_score += 0.2

            # Check accuracy inconsistencies
            if curr.get('accuracy', 10) > 100:
                spoofing_score += 0.1

        return min(1.0, spoofing_score)

    def calculate_route_deviation(self, actual_route, expected_route) -> float:
        """
        Calculate deviation from expected route
        """
        # Simplified calculation - in production use proper route matching
        total_deviation = 0
        for actual_point in actual_route:
            min_dist = min([
                self.haversine_distance(
                    actual_point['lat'], actual_point['lng'],
                    exp_point['lat'], exp_point['lng']
                )
                for exp_point in expected_route
            ])
            total_deviation += min_dist

        avg_deviation = total_deviation / len(actual_route)
        return avg_deviation

    def get_top_contributing_features(self, features: Dict, shap_values: np.ndarray, top_n=5):
        """
        Get top features contributing to fraud score
        """
        feature_importance = sorted(
            zip(features.keys(), shap_values),
            key=lambda x: abs(x[1]),
            reverse=True
        )[:top_n]

        return [
            {'feature': name, 'impact': float(impact)}
            for name, impact in feature_importance
        ]

    @staticmethod
    def haversine_distance(lat1, lon1, lat2, lon2) -> float:
        """
        Calculate distance between two GPS coordinates (km)
        """
        from math import radians, cos, sin, asin, sqrt

        lon1, lat1, lon2, lat2 = map(radians, [lon1, lat1, lon2, lat2])
        dlon = lon2 - lon1
        dlat = lat2 - lat1
        a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
        c = 2 * asin(sqrt(a))
        km = 6371 * c
        return km


@app.post("/fraud/detect")
async def detect_fraud(ride_event: RideEvent):
    """
    Detect fraud for completed ride
    """
    service = FraudDetectionService()

    # Extract features
    features = service.extract_features(ride_event)

    # Cache features for future analysis
    redis_client.setex(
        f"fraud:features:{ride_event.ride_id}",
        86400,  # 24 hours
        json.dumps(features)
    )

    # Predict fraud
    result = service.predict_fraud(features)

    # Log to Kafka for monitoring
    # kafka_producer.send('fraud-alerts', result)

    return result


@app.post("/fraud/driver-profile")
async def analyze_driver_behavior(driver_id: str):
    """
    Analyze driver behavior patterns
    """
    # Get driver history from database
    driver_rides = await get_driver_ride_history(driver_id, days=30)

    # Calculate behavioral metrics
    metrics = {
        'avg_route_deviation': np.mean([r['route_deviation'] for r in driver_rides]),
        'cancellation_pattern': detect_suspicious_cancellations(driver_rides),
        'rating_trend': calculate_rating_trend(driver_rides),
        'peak_hour_preference': analyze_time_patterns(driver_rides),
        'surge_correlation': calculate_surge_correlation(driver_rides)
    }

    return {
        'driver_id': driver_id,
        'risk_score': calculate_driver_risk_score(metrics),
        'metrics': metrics,
        'recommendations': generate_recommendations(metrics)
    }
```

**API Endpoints:**

```
POST   /api/v1/fraud/detect
POST   /api/v1/fraud/driver-profile
POST   /api/v1/fraud/real-time-check
GET    /api/v1/fraud/alerts
POST   /api/v1/fraud/report-suspicious
GET    /api/v1/fraud/model-metrics
```

---

### 3.3.10 Enhanced WebSocket Architecture

**Responsibilities:**

- Real-time bidirectional communication
- Location tracking updates
- Ride status notifications
- In-app messaging
- Connection management and scaling

**Technology Stack:**

- Socket.io with Redis adapter
- Sticky sessions for load balancing
- Multiple WebSocket servers
- Redis Pub/Sub for cross-server messaging

**WebSocket Scaling Architecture:**

```
┌──────────────────────────────────────────────────────────────┐
│         WebSocket Horizontal Scaling Architecture            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Mobile/Web Clients (100,000+ concurrent connections)        │
│       │                                                      │
│       ▼                                                      │
│  Load Balancer (ALB) with Sticky Sessions                    │
│   (IP hash or cookie-based stickiness)                       │
│       │                                                      │
│       ├──► WebSocket Server 1 (20,000 connections)           │
│       │    Port: 3000                                        │
│       │                                                      │
│       ├──► WebSocket Server 2 (20,000 connections)           │
│       │    Port: 3000                                        │
│       │                                                      │
│       ├──► WebSocket Server 3 (20,000 connections)           │
│       │    Port: 3000                                        │
│       │                                                      │
│       └──► WebSocket Server N                                │
│                                                              │
│  Redis Pub/Sub Cluster (Cross-server messaging)              │
│       │                                                      │
│       ├─ Channel: ride:${rideId}                             │
│       ├─ Channel: user:${userId}                             │
│       └─ Channel: driver:${driverId}                         │
│                                                              │
│  How it works:                                               │
│    1. Driver on Server 1 sends location update               │
│    2. Server 1 publishes to Redis channel: ride:123          │
│    3. All servers subscribed to ride:123 receive message     │
│    4. Server 2 (where passenger connected) emits to client   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**WebSocket Implementation:**

```javascript
const io = require("socket.io");
const redisAdapter = require("socket.io-redis");
const jwt = require("jsonwebtoken");

class WebSocketService {
  constructor(httpServer, redis) {
    // Initialize Socket.io with Redis adapter for scaling
    this.io = io(httpServer, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS.split(","),
        methods: ["GET", "POST"],
        credentials: true,
      },
      transports: ["websocket", "polling"],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    // Setup Redis adapter for cross-server communication
    this.io.adapter(
      redisAdapter({
        host: process.env.REDIS_HOST,
        port: process.env.REDIS_PORT,
      }),
    );

    this.setupMiddleware();
    this.setupEventHandlers();
    this.setupNamespaces();
  }

  /**
   * Authentication middleware
   */
  setupMiddleware() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;

        if (!token) {
          return next(new Error("Authentication token required"));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.userId;
        socket.userRole = decoded.role; // 'driver' or 'rider'

        // Load user data
        socket.user = await User.findById(decoded.userId);

        if (!socket.user) {
          return next(new Error("User not found"));
        }

        next();
      } catch (error) {
        next(new Error("Invalid authentication token"));
      }
    });
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    this.io.on("connection", (socket) => {
      console.log(`User connected: ${socket.userId} (${socket.userRole})`);

      // Join user-specific room
      socket.join(`user:${socket.userId}`);

      // Handle role-specific connections
      if (socket.userRole === "driver") {
        this.handleDriverConnection(socket);
      } else {
        this.handleRiderConnection(socket);
      }

      // Common event handlers
      this.setupCommonHandlers(socket);

      // Handle disconnection
      socket.on("disconnect", () => {
        this.handleDisconnection(socket);
      });
    });
  }

  /**
   * Driver-specific handlers
   */
  handleDriverConnection(socket) {
    // Location update handler
    socket.on("location:update", async (data) => {
      const { latitude, longitude, heading, speed, accuracy } = data;

      // Validate location
      if (!latitude || !longitude) {
        socket.emit("error", { message: "Invalid location data" });
        return;
      }

      // Update Redis geospatial index
      await this.updateDriverLocation(socket.userId, latitude, longitude);

      // If driver is on active ride, broadcast to passengers
      const activeRide = await this.getActiveRide(socket.userId);
      if (activeRide) {
        // Broadcast to all clients in ride room
        this.io.to(`ride:${activeRide._id}`).emit("driver:location", {
          driverId: socket.userId,
          location: { latitude, longitude },
          heading,
          speed,
          timestamp: new Date(),
        });

        // Publish to Kafka for persistence
        await this.publishLocationEvent(activeRide._id, {
          driverId: socket.userId,
          latitude,
          longitude,
          heading,
          speed,
          accuracy,
        });
      }
    });

    // Driver goes online/offline
    socket.on("driver:status", async (data) => {
      const { status } = data; // 'online' | 'offline'

      await this.updateDriverStatus(socket.userId, status);

      socket.emit("driver:status:updated", {
        status,
        timestamp: new Date(),
      });
    });

    // Accept ride request
    socket.on("ride:accept", async (data) => {
      const { requestId } = data;

      try {
        const result = await this.acceptRideRequest(socket.userId, requestId);

        // Notify passenger
        this.io.to(`user:${result.passengerId}`).emit("ride:accepted", {
          driver: result.driver,
          ride: result.ride,
          eta: result.eta,
        });

        socket.emit("ride:accept:success", result);
      } catch (error) {
        socket.emit("ride:accept:error", { message: error.message });
      }
    });

    // Reject ride request
    socket.on("ride:reject", async (data) => {
      const { requestId, reason } = data;

      await this.rejectRideRequest(socket.userId, requestId, reason);

      socket.emit("ride:reject:success");
    });
  }

  /**
   * Rider-specific handlers
   */
  handleRiderConnection(socket) {
    // Subscribe to ride tracking
    socket.on("ride:track", async (data) => {
      const { rideId } = data;

      // Verify rider is part of this ride
      const ride = await Ride.findById(rideId);
      if (!ride || !ride.passengers.includes(socket.userId)) {
        socket.emit("error", { message: "Unauthorized" });
        return;
      }

      // Join ride room
      socket.join(`ride:${rideId}`);

      // Send current driver location
      const driverLocation = await this.getDriverLocation(ride.driverId);
      socket.emit("driver:location", driverLocation);
    });

    // Unsubscribe from ride tracking
    socket.on("ride:untrack", (data) => {
      const { rideId } = data;
      socket.leave(`ride:${rideId}`);
    });

    // Request ride
    socket.on("ride:request", async (data) => {
      try {
        const result = await this.createRideRequest(socket.userId, data);
        socket.emit("ride:request:success", result);
      } catch (error) {
        socket.emit("ride:request:error", { message: error.message });
      }
    });
  }

  /**
   * Common handlers for both driver and rider
   */
  setupCommonHandlers(socket) {
    // Real-time chat messages
    socket.on("message:send", async (data) => {
      const { conversationId, message, recipientId } = data;

      // Save message to database
      const savedMessage = await Message.create({
        conversationId,
        senderId: socket.userId,
        recipientId,
        message,
        timestamp: new Date(),
      });

      // Send to recipient
      this.io.to(`user:${recipientId}`).emit("message:received", {
        conversationId,
        message: savedMessage,
      });

      // Acknowledge to sender
      socket.emit("message:sent", {
        messageId: savedMessage._id,
        timestamp: savedMessage.timestamp,
      });
    });

    // Typing indicator
    socket.on("typing:start", (data) => {
      const { recipientId } = data;
      this.io.to(`user:${recipientId}`).emit("typing:indicator", {
        userId: socket.userId,
        isTyping: true,
      });
    });

    socket.on("typing:stop", (data) => {
      const { recipientId } = data;
      this.io.to(`user:${recipientId}`).emit("typing:indicator", {
        userId: socket.userId,
        isTyping: false,
      });
    });

    // SOS emergency alert
    socket.on("sos:trigger", async (data) => {
      const { rideId, location } = data;

      // Create SOS record
      const sos = await SOS.create({
        userId: socket.userId,
        rideId,
        location,
        timestamp: new Date(),
      });

      // Notify admin immediately
      this.io.to("admin").emit("sos:alert", {
        sosId: sos._id,
        user: socket.user,
        ride: await Ride.findById(rideId),
        location,
      });

      // Notify emergency contacts
      await this.notifyEmergencyContacts(socket.userId, sos);

      socket.emit("sos:triggered", { sosId: sos._id });
    });
  }

  /**
   * Handle disconnection
   */
  handleDisconnection(socket) {
    console.log(`User disconnected: ${socket.userId}`);

    // If driver disconnected, mark as offline after grace period
    if (socket.userRole === "driver") {
      setTimeout(async () => {
        const isStillConnected = await this.checkDriverConnection(
          socket.userId,
        );
        if (!isStillConnected) {
          await this.updateDriverStatus(socket.userId, "offline");
        }
      }, 30000); // 30 second grace period
    }
  }

  /**
   * Setup namespaces (optional advanced feature)
   */
  setupNamespaces() {
    // Admin namespace for admin dashboard
    const adminNamespace = this.io.of("/admin");

    adminNamespace.use(async (socket, next) => {
      // Admin-only authentication
      if (socket.user && socket.user.role === "admin") {
        next();
      } else {
        next(new Error("Admin access only"));
      }
    });

    adminNamespace.on("connection", (socket) => {
      socket.join("admin");
      console.log("Admin connected");
    });
  }

  /**
   * Utility: Broadcast event to specific room
   */
  broadcastToRoom(room, event, data) {
    this.io.to(room).emit(event, data);
  }

  /**
   * Utility: Send notification to specific user
   */
  sendToUser(userId, event, data) {
    this.io.to(`user:${userId}`).emit(event, data);
  }
}

module.exports = WebSocketService;
```

**WebSocket Event Catalog:**

```
┌──────────────────────────────────────────────────────────────┐
│                WebSocket Events Reference                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  LOCATION EVENTS                                             │
│    location:update (C→S)     - Driver sends GPS update       │
│    driver:location (S→C)     - Server sends driver location  │
│    location:error (S→C)      - Invalid location data         │
│                                                              │
│  RIDE LIFECYCLE EVENTS                                       │
│    ride:request (C→S)        - Request new ride              │
│    ride:accept (C→S)         - Driver accepts request        │
│    ride:reject (C→S)         - Driver rejects request        │
│    ride:accepted (S→C)       - Ride request accepted         │
│    ride:started (S→C)        - Ride in progress              │
│    ride:completed (S→C)      - Ride finished                 │
│    ride:cancelled (S→C)      - Ride cancelled                │
│                                                              │
│  TRACKING EVENTS                                             │
│    ride:track (C→S)          - Subscribe to ride tracking    │
│    ride:untrack (C→S)        - Unsubscribe from tracking     │
│    eta:updated (S→C)         - ETA recalculated              │
│    route:deviated (S→C)      - Off-route alert               │
│                                                              │
│  MESSAGING EVENTS                                            │
│    message:send (C→S)        - Send chat message             │
│    message:received (S→C)    - New message received          │
│    message:sent (S→C)        - Message sent confirmation     │
│    typing:start (C→S)        - User started typing           │
│    typing:stop (C→S)         - User stopped typing           │
│    typing:indicator (S→C)    - Typing indicator              │
│                                                              │
│  DRIVER STATUS EVENTS                                        │
│    driver:status (C→S)       - Set online/offline status     │
│    driver:status:updated     - Status change confirmation    │
│                                                              │
│  EMERGENCY EVENTS                                            │
│    sos:trigger (C→S)         - Trigger SOS alert             │
│    sos:triggered (S→C)       - SOS alert confirmation        │
│    sos:alert (S→Admin)       - Admin receives SOS            │
│                                                              │
│  CONNECTION EVENTS                                           │
│    connection                - Client connected              │
│    disconnect                - Client disconnected           │
│    error                     - Generic error message         │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

### 3.3.11 Logging & Monitoring Service (ELK Stack)

**Responsibilities:**

- Centralized log aggregation
- Real-time log analysis
- Application performance monitoring
- Error tracking and alerting
- System health dashboards

**Technology Stack:**

- Elasticsearch (log storage & search)
- Logstash (log processing pipeline)
- Kibana (visualization & dashboards)
- Filebeat (log shipping)
- APM (Application Performance Monitoring)

**ELK Stack Architecture:**

```
┌──────────────────────────────────────────────────────────────┐
│             ELK Stack Logging Architecture                   │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Application Servers (Node.js Microservices)                 │
│       │                                                      │
│       ├─ Ride Service     → Winston logger                   │
│       ├─ Payment Service  → Winston logger                   │
│       ├─ Auth Service     → Winston logger                   │
│       └─ ... (12+ services)                                  │
│              │                                               │
│              ▼                                               │
│  Log Shippers (Filebeat)                                     │
│       │                                                      │
│       │ Collects logs from:                                  │
│       ├─ Application logs (JSON format)                      │
│       ├─ System logs (/var/log)                              │
│       ├─ Docker container logs                               │
│       └─ Nginx access logs                                   │
│              │                                               │
│              ▼                                               │
│  Logstash (Processing Pipeline)                              │
│       │                                                      │
│       ├─ Parse logs (JSON, Grok patterns)                    │
│       ├─ Enrich with metadata (geo-location, user-agent)     │
│       ├─ Filter (remove sensitive data like passwords)       │
│       └─ Transform (normalize timestamps, add tags)          │
│              │                                               │
│              ▼                                               │
│  Elasticsearch Cluster (3+ nodes)                            │
│       │                                                      │
│       ├─ Index: logs-app-*                                   │
│       ├─ Index: logs-system-*                                │
│       ├─ Index: logs-nginx-*                                 │
│       └─ Retention: 30 days (hot), 90 days (warm)            │
│              │                                               │
│              ▼                                               │
│  Kibana (Visualization & Dashboards)                         │
│       │                                                      │
│       ├─ Real-time log viewer                                │
│       ├─ Custom dashboards (ride metrics, errors, latency)   │
│       ├─ Alerts (error spike, high latency)                  │
│       └─ APM performance monitoring                          │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Winston Logger Configuration:**

```javascript
// logger.js - Structured logging implementation
const winston = require("winston");
const { ElasticsearchTransport } = require("winston-elasticsearch");

const esTransportOpts = {
  level: "info",
  clientOpts: {
    node: process.env.ELASTICSEARCH_URL,
    auth: {
      username: process.env.ES_USERNAME,
      password: process.env.ES_PASSWORD,
    },
  },
  index: "logs-app",
};

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  defaultMeta: {
    service: process.env.SERVICE_NAME,
    environment: process.env.NODE_ENV,
    host: process.env.HOSTNAME,
  },
  transports: [
    // Console output for development
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple(),
      ),
    }),

    // File transport
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
    }),
    new winston.transports.File({
      filename: "logs/combined.log",
    }),

    // Elasticsearch transport for production
    new ElasticsearchTransport(esTransportOpts),
  ],
});

// Add request logging middleware
logger.requestLogger = (req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;

    logger.info("HTTP Request", {
      method: req.method,
      url: req.originalUrl,
      status: res.statusCode,
      duration,
      userId: req.userId,
      ip: req.ip,
      userAgent: req.get("user-agent"),
    });
  });

  next();
};

// Add correlation ID for request tracing
logger.correlationMiddleware = (req, res, next) => {
  req.correlationId = req.get("X-Correlation-ID") || require("uuid").v4();
  res.set("X-Correlation-ID", req.correlationId);

  // Add correlation ID to all logs in this request
  req.log = logger.child({ correlationId: req.correlationId });

  next();
};

module.exports = logger;
```

**Usage in Application:**

```javascript
const logger = require("./logger");

// Info log
logger.info("Ride created successfully", {
  rideId: ride._id,
  driverId: ride.driverId,
  origin: ride.origin.address,
});

// Error log with stack trace
try {
  await processPayment(paymentData);
} catch (error) {
  logger.error("Payment processing failed", {
    error: error.message,
    stack: error.stack,
    paymentId: paymentData.id,
    userId: paymentData.userId,
  });
}

// Performance monitoring
const start = Date.now();
const result = await database.query();
const duration = Date.now() - start;

if (duration > 1000) {
  logger.warn("Slow database query", {
    query: "findRides",
    duration,
    resultCount: result.length,
  });
}
```

**Kibana Dashboards:**

```
┌──────────────────────────────────────────────────────────────┐
│                 Kibana Dashboard Examples                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  1. RIDE METRICS DASHBOARD                                   │
│     ├─ Total rides created (last 24h)                        │
│     ├─ Ride success rate                                     │
│     ├─ Average ride duration                                 │
│     ├─ Rides by city (map visualization)                     │
│     └─ Peak hours heatmap                                    │
│                                                              │
│  2. ERROR MONITORING DASHBOARD                               │
│     ├─ Error count by service                                │
│     ├─ Error rate trend (last 7 days)                        │
│     ├─ Top 10 error messages                                 │
│     ├─ Error distribution by HTTP status                     │
│     └─ Error spike alerts                                    │
│                                                              │
│  3. PERFORMANCE DASHBOARD                                    │
│     ├─ API response time (p50, p95, p99)                     │
│     ├─ Database query latency                                │
│     ├─ External API call duration (Maps, Payment)            │
│     ├─ WebSocket connection count                            │
│     └─ Redis cache hit rate                                  │
│                                                              │
│  4. USER ACTIVITY DASHBOARD                                  │
│     ├─ Active users (drivers vs riders)                      │
│     ├─ User signup/login trends                              │
│     ├─ Geographic distribution                               │
│     └─ User session duration                                 │
│                                                              │
│  5. FRAUD DETECTION DASHBOARD                                │
│     ├─ Fraud alerts count                                    │
│     ├─ Flagged drivers/riders                                │
│     ├─ Route deviation incidents                             │
│     └─ GPS spoofing detection                                │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

**Alert Configuration:**

```javascript
// Kibana Watcher alerts configuration
{
  "alerts": [
    {
      "name": "High Error Rate",
      "condition": "error_count > 100 per 5 minutes",
      "actions": [
        "Send Slack notification",
        "Email on-call engineer",
        "Create PagerDuty incident"
      ]
    },
    {
      "name": "Payment Processing Failure",
      "condition": "payment_failures > 5% of total payments",
      "actions": [
        "Email finance team",
        "Trigger investigation workflow"
      ]
    },
    {
      "name": "Database Slow Query",
      "condition": "query_duration > 3000ms",
      "actions": [
        "Log to performance tracking",
        "Alert database team"
      ]
    },
    {
      "name": "SOS Alert",
      "condition": "sos.trigger event detected",
      "actions": [
        "Immediate admin notification",
        "SMS to safety team",
        "Create high-priority ticket"
      ]
    }
  ]
}
```

**API Endpoints:**

```
GET    /api/v1/logs/search
GET    /api/v1/logs/errors
GET    /api/v1/logs/performance
GET    /api/v1/logs/exports
POST   /api/v1/logs/query
```

#### 3.3.5 Payment Service

**Responsibilities:**

- Payment processing via Stripe Test Mode (Razorpay for production)
- Wallet management
- Refund processing
- Transaction history
- Invoice generation

**Technology Stack:**

- Node.js + Express
- Stripe SDK (Razorpay SDK for production)
- MongoDB Atlas M0 Free Tier (Paid tiers for production) for transaction records
- Redis Cloud Free Tier (Paid for production) for payment session caching

**Payment Flow:**

```
1. User initiates payment
2. Payment service creates Stripe order (Razorpay for production)
3. Client completes payment with Stripe (Razorpay for production)
4. Stripe webhook (Razorpay for production) notifies payment service
5. Payment service verifies payment signature
6. Update booking status
7. Trigger notification service
```

**API Endpoints:**

```
POST   /api/v1/payments/create-order
POST   /api/v1/payments/verify
POST   /api/v1/payments/webhook
GET    /api/v1/payments/transactions
POST   /api/v1/payments/refund
GET    /api/v1/payments/wallet
POST   /api/v1/payments/wallet/add-money
```

#### 3.3.6 Notification Service

**Responsibilities:**

- Push notifications (Firebase FCM)
- SMS notifications (Twilio)
- Email notifications (SendGrid)
- In-app notifications
- Notification preferences

**Technology Stack:**

- Node.js + Express
- Firebase Admin SDK
- Twilio SDK
- SendGrid SDK
- Message Queue (RabbitMQ/SQS)

**Notification Events:**

- Ride request received
- Ride request accepted/rejected
- Payment successful
- Ride starting soon
- Driver arrived
- Ride completed
- Rating reminder
- Safety alerts

**API Endpoints:**

```
POST   /api/v1/notifications/send
GET    /api/v1/notifications
PUT    /api/v1/notifications/:id/read
PUT    /api/v1/notifications/preferences
POST   /api/v1/notifications/test
```

#### 3.3.7 Chat Service

**Responsibilities:**

- Real-time messaging between drivers and passengers
- Message history
- File sharing (images, location)
- Chat moderation

**Technology Stack:**

- Node.js + Express
- Socket.io for real-time communication
- MongoDB for message storage
- Redis for online user tracking

**WebSocket Events:**

```javascript
// Client -> Server
socket.emit("join_room", { rideId, userId });
socket.emit("send_message", { rideId, message, type });
socket.emit("typing", { rideId, userId });

// Server -> Client
socket.on("new_message", (message) => {});
socket.on("user_typing", (data) => {});
socket.on("user_online", (userId) => {});
```

**API Endpoints:**

```
GET    /api/v1/chat/rooms
GET    /api/v1/chat/rooms/:rideId/messages
POST   /api/v1/chat/rooms/:rideId/messages
POST   /api/v1/chat/upload
DELETE /api/v1/chat/messages/:messageId
```

#### 3.3.8 Tracking Service

**Responsibilities:**

- Real-time GPS location tracking
- Route tracking and recording
- Geofencing and route deviation alerts
- ETA calculation
- Location sharing

**Technology Stack:**

- Node.js + Express
- Socket.io for real-time updates
- MongoDB (time-series collection) for location data
- Redis for current location cache
- Google Maps API for routing

**Location Update Flow:**

```
1. Mobile app sends location every 10 seconds
2. Tracking service validates and stores location
3. Check for route deviations
4. Calculate updated ETA
5. Broadcast location to passengers via WebSocket
6. Trigger alerts if needed
```

**API Endpoints:**

```
POST   /api/v1/tracking/location
GET    /api/v1/tracking/rides/:rideId/location
GET    /api/v1/tracking/rides/:rideId/route
POST   /api/v1/tracking/rides/:rideId/share-location
GET    /api/v1/tracking/rides/:rideId/eta
```

#### 3.3.9 Safety Service

**Responsibilities:**

- SOS alert handling
- Emergency contact notifications
- Safety check-ins
- Route monitoring
- Incident reporting
- Safe place recommendations

**Technology Stack:**

- Node.js + Express
- MongoDB for incident data
- Integration with notification service
- Geolocation services

**SOS Flow:**

```
1. User presses SOS button
2. Safety service captures current location
3. Immediately notify emergency contacts
4. Alert admin dashboard
5. Notify local authorities (if configured)
6. Start recording ride data
7. Trigger continuous location tracking
```

**API Endpoints:**

```
POST   /api/v1/safety/sos
POST   /api/v1/safety/emergency-contacts
GET    /api/v1/safety/emergency-contacts
POST   /api/v1/safety/check-in
POST   /api/v1/safety/report-incident
GET    /api/v1/safety/safe-places
POST   /api/v1/safety/fake-call
```

#### 3.3.10 Admin Service

**Responsibilities:**

- User management
- Ride management
- Analytics and reporting
- System configuration
- Dispute resolution
- Content moderation

**Technology Stack:**

- Node.js + Express
- MongoDB for data
- PostgreSQL for complex analytics
- Redis for caching

**API Endpoints:**

```
GET    /api/v1/admin/users
PUT    /api/v1/admin/users/:userId/status
GET    /api/v1/admin/rides
GET    /api/v1/admin/analytics/overview
GET    /api/v1/admin/analytics/revenue
GET    /api/v1/admin/disputes
PUT    /api/v1/admin/disputes/:disputeId/resolve
GET    /api/v1/admin/reports
POST   /api/v1/admin/config
```

#### 3.3.11 Analytics Service

**Responsibilities:**

- User behavior analytics
- Business metrics tracking
- Performance monitoring
- Report generation
- Data warehousing

**Technology Stack:**

- Node.js + Express
- PostgreSQL for analytical data
- Apache Kafka for event streaming
- Elasticsearch for log analytics
- Grafana for visualization

---

### 3.4 Data Layer

#### 3.4.1 MongoDB (Primary Database)

**Collections:**

- users
- rides
- bookings
- payments
- messages
- notifications
- reviews
- locations (time-series)
- incidents
- vehicles
- documents

**Indexing Strategy:**

```javascript
// Users collection indexes
db.users.createIndex({ phone: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { sparse: true });
db.users.createIndex({ role: 1 });

// Rides collection indexes
db.rides.createIndex({ driverId: 1 });
db.rides.createIndex({ status: 1 });
db.rides.createIndex({ departureTime: 1 });
db.rides.createIndex({ "origin.coordinates": "2dsphere" });
db.rides.createIndex({ "destination.coordinates": "2dsphere" });
db.rides.createIndex({ createdAt: -1 });

// Bookings collection indexes
db.bookings.createIndex({ rideId: 1 });
db.bookings.createIndex({ passengerId: 1 });
db.bookings.createIndex({ status: 1 });
db.bookings.createIndex({ createdAt: -1 });
```

#### 3.4.2 Redis (Cache & Session Store)

**Use Cases:**

- Session management
- JWT token blacklist
- API rate limiting
- Real-time location cache
- Frequently accessed data cache
- Matching algorithm cache
- Leaderboards

**Cache Strategy:**

```javascript
// Example caching patterns
const CACHE_TTL = {
  userProfile: 300, // 5 minutes
  rideDetails: 60, // 1 minute
  searchResults: 120, // 2 minutes
  activeLocations: 10, // 10 seconds
  popularRoutes: 3600, // 1 hour
};
```

#### 3.4.3 PostgreSQL (Analytics)

**Use Cases:**

- Complex analytical queries
- Reporting
- Data warehousing
- Financial records (for compliance)

#### 3.4.4 Elasticsearch

**Use Cases:**

- Advanced ride search
- User search
- Log aggregation and analysis
- Full-text search

#### 3.4.5 AWS S3

**Use Cases:**

- Profile pictures
- Document uploads (license, ID)
- Chat media files
- Invoice PDFs
- Backup storage

---

### 3.5 External Services Integration

#### 3.5.1 Google Maps Integration

**APIs Used:**

- Geocoding API (address to coordinates)
- Reverse Geocoding API (coordinates to address)
- Directions API (route calculation)
- Distance Matrix API (distance between points)
- Places API (location autocomplete)
- Geolocation API

**Usage Examples:**

```javascript
// Calculate route
const route = await googleMaps.directions({
  origin: ride.origin,
  destination: ride.destination,
  waypoints: pickupPoints,
  optimize: true,
  mode: "driving",
});

// Geocode address
const location = await mapboxClient.geocode(address); // Mapbox (Google Maps for production)
```

#### 3.5.2 Stripe Integration (Razorpay for Production)

**Features:**

- Payment orders
- Payment verification
- Webhooks for payment events
- Refund processing
- Settlement reports

#### 3.5.3 Firebase Cloud Messaging (FCM)

**Features:**

- Push notifications to iOS/Android
- Topic-based messaging
- Token management
- Multi-device support

#### 3.5.4 Twilio Integration

**Features:**

- SMS for OTP
- Voice calls (for safety)
- WhatsApp notifications (future)

#### 3.5.5 SendGrid Integration

**Features:**

- Transactional emails
- Email templates
- Email analytics

---

## 4. Security Architecture

### 4.1 Authentication & Authorization

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ 1. Login Request (phone + OTP)
       ▼
┌─────────────┐
│ Auth Service│
└──────┬──────┘
       │ 2. Verify Credentials
       ▼
┌─────────────┐
│   MongoDB   │
└──────┬──────┘
       │ 3. User Found
       ▼
┌─────────────┐
│ Auth Service│────── Generate JWT Token
└──────┬──────┘      (Access + Refresh)
       │
       │ 4. Return Tokens
       ▼
┌─────────────┐
│   Client    │────── Store Tokens Securely
└─────────────┘
```

**JWT Structure:**

```javascript
{
  header: {
    alg: "HS256",
    typ: "JWT"
  },
  payload: {
    userId: "user_id",
    role: "driver|rider|admin",
    iat: 1234567890,
    exp: 1234571490
  },
  signature: "..."
}
```

### 4.2 Data Security

- **Encryption at Rest**: MongoDB encryption, S3 encryption
- **Encryption in Transit**: HTTPS/TLS for all communications
- **Password Hashing**: Bcrypt with salt rounds
- **Sensitive Data**: PII encrypted in database
- **API Keys**: Stored in environment variables/secrets manager

### 4.3 Network Security

- **Firewall**: AWS Security Groups
- **DDoS Protection**: AWS Shield
- **WAF**: Web Application Firewall for API protection
- **VPC**: Services in private subnet
- **Bastion Host**: For secure server access

---

## 5. Scalability Architecture

### 5.1 Horizontal Scaling

```
                ┌─────────────┐
                │Load Balancer│
                └──────┬──────┘
         ┌─────────────┼─────────────┐
         ▼             ▼             ▼
    ┌────────┐    ┌────────┐    ┌────────┐
    │ Server  │    │ Server │    │ Server │
    │    1    │    │    2   │    │    3   │
    └────────┘    └────────┘    └────────┘
```

**Auto-Scaling Rules:**

- Scale up when CPU > 70% for 5 minutes
- Scale up when memory > 80% for 5 minutes
- Scale down when CPU < 30% for 10 minutes
- Minimum instances: 2
- Maximum instances: 10

### 5.2 Database Scaling

- **MongoDB Replica Set**: Primary + 2 Secondaries
- **Read Replicas**: Route read queries to secondaries
- **Sharding**: Horizontal partitioning for large collections
- **Connection Pooling**: Reuse database connections

### 5.3 Caching Strategy

- **Application-level caching**: Redis
- **CDN caching**: CloudFront for static assets
- **Browser caching**: Cache-Control headers
- **API response caching**: For frequently requested data

---

## 6. Resilience & Fault Tolerance

### 6.1 Failure Handling

- **Retry Logic**: Exponential backoff for failed requests
- **Circuit Breaker**: Prevent cascading failures
- **Fallback Mechanisms**: Default responses when services are down
- **Health Checks**: Regular service health monitoring

### 6.2 Data Backup

- **MongoDB**: Daily automated backups, 30-day retention
- **Point-in-Time Recovery**: Restore to any point in last 7 days
- **Cross-Region Replication**: Disaster recovery
- **S3 Versioning**: File version history

### 6.3 Disaster Recovery

- **RTO** (Recovery Time Objective): 4 hours
- **RPO** (Recovery Point Objective): 1 hour
- **Backup Restoration**: Automated scripts
- **Failover**: Automatic regional failover

---

## 7. Monitoring & Observability

### 7.1 Application Monitoring

- **APM**: New Relic / Datadog
- **Error Tracking**: Sentry
- **Logging**: ELK Stack (Elasticsearch, Logstash, Kibana)
- **Metrics**: Prometheus + Grafana

### 7.2 Infrastructure Monitoring

- **AWS CloudWatch**: Server metrics, alarms
- **Uptime Monitoring**: Pingdom / UptimeRobot
- **Performance Monitoring**: Load times, API response times

### 7.3 Key Metrics to Monitor

- API response time (p50, p95, p99)
- Error rate by endpoint
- Request throughput
- Database query performance
- Cache hit ratio
- Active user count
- Ride completion rate
- Payment success rate

---

## 8. Deployment Architecture

### 8.1 Environments

```
Development → Staging → Production
    ↓            ↓          ↓
  Dev DB      Staging DB   Prod DB
```

### 8.2 CI/CD Pipeline

```
Code Push → GitHub → CI Testing → Build → Deploy to Staging
                                             ↓
                                    Manual Approval
                                             ↓
                                    Deploy to Production
```

### 8.3 Container Architecture (Docker)

```dockerfile
# Example Node.js service Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
```

### 8.4 Orchestration (Kubernetes - Optional)

```yaml
# Example Kubernetes deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ride-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: ride-service
  template:
    metadata:
      labels:
        app: ride-service
    spec:
      containers:
        - name: ride-service
          image: carpooling/ride-service:latest
          ports:
            - containerPort: 3000
```

---

## 9. Performance Optimization

### 9.1 Backend Optimization

- **Database Indexing**: Proper indexes on frequently queried fields
- **Query Optimization**: Avoid N+1 queries, use aggregation
- **Caching**: Redis for frequently accessed data
- **Connection Pooling**: Reuse database connections
- **Async Processing**: Background jobs for non-critical tasks
- **Pagination**: Limit response sizes

### 9.2 Frontend Optimization

- **Code Splitting**: Load only necessary code
- **Lazy Loading**: Load images and components on demand
- **Image Optimization**: Compress and resize images
- **Memoization**: Cache component renders
- **Bundle Size**: Minimize JavaScript bundle size

### 9.3 API Optimization

- **Response Compression**: Gzip/Brotli compression
- **Field Selection**: Return only requested fields
- **Batch Requests**: Combine multiple requests
- **GraphQL** (Future): Flexible data fetching

---

## 10. Technology Stack Summary

### Frontend

- **Mobile**: React Native, Redux Toolkit, React Navigation
- **Admin Web**: React.js, Material-UI, Redux Toolkit
- **Maps**: React Native Maps, Mapbox (alternative)

### Backend

- **Runtime**: Node.js 18 LTS
- **Framework**: Express.js
- **Language**: JavaScript/TypeScript
- **ML Service**: Python (Flask/FastAPI)

### Database

- **Primary**: MongoDB 6.0
- **Cache**: Redis 7.0
- **Analytics**: PostgreSQL 15
- **Search**: Elasticsearch 8.0

### Infrastructure

- **Cloud Provider**: AWS
- **Compute**: EC2, Lambda (for specific functions)
- **Storage**: S3
- **CDN**: CloudFront
- **Load Balancer**: Application Load Balancer
- **Monitoring**: CloudWatch, New Relic, Sentry

### DevOps

- **Version Control**: Git, GitHub
- **CI/CD**: GitHub Actions
- **Containerization**: Docker
- **Orchestration**: Kubernetes (optional)
- **IaC**: Terraform

### External Services

- **Maps**: Google Maps Platform
- **Payments**: Stripe Test Mode (Razorpay for production)
- **Notifications**: Firebase FCM
- **SMS**: Twilio
- **Email**: SendGrid
- **Analytics**: Google Analytics, Mixpanel

---

## 11. Architecture Decision Records (ADRs)

### 3.6 Parcel Service (Phase 4)

**Purpose**: Manage parcel shipping logistics between travelers on same routes

**Key Responsibilities**:

- Parcel posting and management
- Parcel-to-rider matching algorithm
- Tracking and location updates
- Insurance calculation and management

**Technology**: Node.js + Express, MongoDB (parcels collection), Redis (real-time tracking)

---

### 3.7 Trip Service (Phase 4)

**Purpose**: Connect travelers planning similar trips for shared experiences and cost savings

**Key Responsibilities**:

- Trip creation and management
- Travel companion matching
- Group expense tracking and splitting
- Itinerary coordination

**Technology**: Node.js + Express, MongoDB (trips, trip_groups collections), Redis (group state)

---

### 3.8 Intelligent Matching Engine (Advanced)

**Purpose**: Maximize ride matches and driver utilization using sophisticated algorithms

**Key Responsibilities**:

- Multi-factor ride matching algorithm
- Route optimization using Traveling Salesman Problem (TSP)
- Dynamic surge pricing calculation
- Preferred pickup point recommendations
- Machine learning-based driver selection

**Technology Stack**:

- Node.js + Python (ML models)
- TensorFlow/XGBoost for ML inference
- Google OR-Tools for route optimization
- Redis for caching match scores
- MongoDB for historical data

**Matching Algorithm (5-Factor Weighted Scoring)**:

```
Match Score = (Proximity × 0.40) +
              (Time Compatibility × 0.30) +
              (Driver Rating × 0.15) +
              (Acceptance Rate × 0.10) +
              (Safety Score × 0.05)

Where:
- Proximity: Distance from rider pickup (normalized 0-100)
- Time: Driver's ETA vs requested time (normalized 0-100)
- Rating: Driver rating 4.0-5.0 scaled to 0-100
- Acceptance: Historical acceptance rate percentage
- Safety: Fraud/safety risk assessment score (0-100)

Returns: Sorted list of drivers by match score
```

**Route Optimization**:

- Traveling Salesman Problem (TSP) solver using Google OR-Tools
- Considers multiple pickups and dropoffs
- Minimizes total distance while respecting time constraints
- Reduces average trip distance by 15-25%
- Real-time recalculation when new requests arrive

**Preferred Pickup Points Analysis**:

```javascript
// Machine Learning: Identify optimal pickup points
const preferredPickupPoints = await this.mlService.analyzeHistoricalData({
  area: riderArea,
  timeOfDay: currentTime,
  dayOfWeek: dayOfWeek,
  weatherCondition,
});

// Returns top 5 pickup points with success rates
// Example:
// [
//   { location: "Main Gate", successRate: 92%, avgWaitTime: 3.2 },
//   { location: "South Entrance", successRate: 87%, avgWaitTime: 4.1 },
//   { location: "Parking Lot", successRate: 79%, avgWaitTime: 5.3 },
// ]
```

**API Endpoints**:

```
POST   /api/v1/matching/find-drivers
POST   /api/v1/matching/optimize-route
GET    /api/v1/matching/preferred-pickups/:area
POST   /api/v1/matching/calculate-score
```

---

### 3.9 Fraud Detection & Safety Service

**Purpose**: Protect users from fraudulent activities, GPS spoofing, and unsafe drivers

**Key Responsibilities**:

- Real-time fraud detection using ML
- GPS spoofing detection
- Route deviation detection
- Driver behavior monitoring
- Automated flags and blocks

**Technology Stack**:

- Python ML service (XGBoost, scikit-learn)
- Redis for real-time scoring
- Kafka for event streaming
- MongoDB for historical fraud patterns
- SHAP for model explainability

**Fraud Detection Signals**:

```
20+ Risk Features:
- GPS anomalies: Impossible speeds (>200 km/h)
- Altitude jumps: Sudden elevation changes
- Route deviation: >20% deviation from planned route
- Timing patterns: Frequent long waits, unusual schedules
- Payment patterns: Multiple payment failures, chargebacks
- User behavior: Account created <7 days, no profile picture
- Rating manipulation: Sudden rating changes
- Acceptance patterns: Unusual acceptance/rejection patterns
- Location spoofing: Multiple locations simultaneously
- Trip patterns: Rides only at night, high-risk areas

Real-Time Scoring:
- ML inference: <500ms per ride request
- Returns risk score 0-100
- Automated actions: Block, require verification, alert admin
- 90% fraud detection precision with <2% false positives
```

**SHAP Model Explainability**:

```
When a ride is flagged, show WHY:
"Ride flagged (Score: 78) because:
  - GPS speed spike: +25 risk points (driver exceeded 150 km/h)
  - Unusual timing: +18 risk points (pickup at 3 AM in remote area)
  - Route deviation: +15 risk points (20% off planned route)
  - New account: +12 risk points (profile <7 days old)
  - Low ride count: +8 risk points (only 2 completed rides)"
```

**GPS Spoofing Detection**:

```
Detect fake GPS:
1. Acceleration check: Is velocity physically possible?
2. Altitude validation: Sudden height changes unlikely
3. Multi-point consistency: Multiple sources cross-check
4. Network signature: Cell tower consistency with GPS
5. Timestamp validation: Time jumps detected

Action: Flag ride for manual review, block if score > 85
```

**API Endpoints**:

```
POST   /api/v1/fraud/analyze-ride
POST   /api/v1/fraud/report-suspicious
GET    /api/v1/fraud/dashboard
POST   /api/v1/fraud/block-user/:userId
GET    /api/v1/fraud/patterns
```

---

### 3.10 Advanced WebSocket Real-Time Service

**Purpose**: Enable real-time communication for 35+ event types with 100K+ concurrent users

**Key Responsibilities**:

- WebSocket server management and scaling
- Redis adapter for cross-server communication
- Room-based authorization
- Event broadcasting with filtering
- Sticky session management

**Technology Stack**:

- Socket.io with Redis adapter
- Node.js Express servers (horizontal scaling)
- Redis Pub/Sub for inter-server messaging
- JWT authentication

**Scalable WebSocket Architecture**:

```
┌─────────────────────────────────────────────────────────┐
│                   Load Balancer (ALB)                    │
│            (IP hash for sticky sessions)                 │
└────────────────┬────────────────┬──────────────┬────────┘
                 │                │              │
      ┌──────────▼─┐    ┌────────▼──┐   ┌──────▼──────┐
      │ WebSocket  │    │ WebSocket │   │ WebSocket   │
      │ Server 1   │    │ Server 2  │   │ Server N    │
      │ (WS:3000)  │    │(WS:3000)  │   │ (WS:3000)   │
      └──────────┬─┘    └────────┬──┘   └───────┬──────┘
                 │               │              │
                 └───────────────┼──────────────┘
                                 │
                      ┌──────────▼───────────┐
                      │  Redis Pub/Sub       │
                      │  (Cluster mode)      │
                      └─────────────────────┘

Per Server Capacity:
- 25K concurrent connections
- 3 servers = 75K+ concurrent users
- 5 servers = 125K+ concurrent users

Scaling:
- When CPU > 70%: Add new WebSocket server
- Automatic discovery via service registry
- Gossip protocol for state sync
```

**Real-Time Events (35+ Types)**:

```
LOCATION EVENTS:
- location:updated        → Driver location to riders
- route:deviated         → Route deviation alert
- eta:updated            → Recalculated ETA
- arrival:approaching    → Driver approaching pickup

RIDE EVENTS:
- ride:accepted          → Driver accepted ride
- ride:started           → Ride started
- ride:completed         → Ride completed
- ride:cancelled         → Ride cancelled by driver/rider
- request:sent           → Ride request to driver
- request:rejected       → Driver rejected request

CHAT EVENTS:
- message:sent           → New message
- message:read           → Message read receipt
- typing:started         → User typing indicator
- typing:stopped         → Typing stopped

PAYMENT EVENTS:
- payment:initiated      → Payment processing started
- payment:completed      → Payment successful
- refund:processed       → Refund completed
- invoice:generated      → Invoice ready

SAFETY EVENTS:
- sos:triggered          → Emergency SOS activated
- safe:checkin           → User check-in confirmation
- emergency:alert        → Safety alert to contacts
- suspicious:activity    → Fraud detection alert

NOTIFICATION EVENTS:
- notification:received  → Push notification
- rating:requested       → Request for rating
- promo:available        → New promo/offer

ADMIN EVENTS:
- fraud:flag             → Fraud flag alert
- driver:suspended       → Account suspended
- support:ticket         → Support ticket created
```

**Room-Based Authorization**:

```javascript
// User can only receive events for their own rides
// Architecture prevents unauthorized event access

// Rider can access:
socket.join(`ride:${rideId}`); // Their current ride
socket.join(`user:${userId}:chats`); // Their messages
socket.join(`user:${userId}:bookings`); // Their bookings

// Driver can access:
socket.join(`ride:${rideId}`); // Their active ride
socket.join(`driver:${driverId}:assignments`); // New requests
socket.join(`driver:${driverId}:earnings`); // Payment updates

// Admin can access:
socket.join(`admin:monitoring`); // System monitoring
socket.join(`admin:fraud:alerts`); // Fraud alerts
socket.join(`admin:support`); // Support tickets
```

**API Endpoints**:

```
WS     /socket.io                        → WebSocket connection
POST   /api/v1/realtime/subscribe
POST   /api/v1/realtime/unsubscribe
GET    /api/v1/realtime/status
GET    /api/v1/realtime/active-connections
```

---

### 3.11 ELK Stack: Logging, Monitoring & Alerting

**Purpose**: Comprehensive observability for system health, performance, and debugging

**Technology Stack**:

- Elasticsearch: Log storage and indexing (16 nodes, 30-day retention)
- Logstash: Log processing and transformation
- Kibana: Log visualization and dashboarding
- Prometheus: Metrics collection
- Grafana: Metrics visualization
- AlertManager: Automated alerting

**Log Processing Pipeline**:

```
┌──────────────────────────────────────────────────┐
│  Application Services                            │
│  (All services log to stdout/stderr)             │
└────────────────┬─────────────────────────────────┘
                 │
                 │ docker logs / journald
                 ▼
┌──────────────────────────────────────────────────┐
│  Filebeat (Log Shipper)                          │
│  - Collects from Docker containers               │
│  - Adds metadata (container ID, pod name)        │
│  - Sends to Logstash                             │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│  Logstash (Processing)                           │
│  - Parse JSON logs                               │
│  - Add context/environment variables             │
│  - Filter sensitive data (PII masking)           │
│  - Enrich with geolocation                       │
│  - Route to Elasticsearch indices                │
└────────────────┬─────────────────────────────────┘
                 │
                 ▼
┌──────────────────────────────────────────────────┐
│  Elasticsearch (Storage & Search)                │
│  - logs-{service}-{date}                         │
│  - Full-text search, aggregations                │
│  - 16 nodes, 30-day hot/warm/cold               │
│  - Daily index rollover                          │
│  - 0.5s query response time                      │
└────────────────┬─────────────────────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
        ▼                 ▼
     Kibana          AlertManager
     (UI)            (Alerts)

Dashboards:          Critical Alerts:
- System Health      - Error rate > 1%
- Performance        - Response time > 1s
- Request Rates      - CPU > 85%
- Error Rates        - Memory > 90%
- Fraud Alerts       - Service down
- User Engagement    - Payment failures
```

**Kibana Dashboards (5+ Pre-Built)**:

```
Dashboard 1: System Health
  - Service uptime (target: 99.9%)
  - Error rates by service
  - Request duration (p50, p95, p99)
  - Active user connections

Dashboard 2: Performance Metrics
  - API response times (breakdown by endpoint)
  - Database query performance
  - Cache hit/miss ratios
  - WebSocket concurrent connections

Dashboard 3: Fraud & Security
  - Flagged rides (count, reasons)
  - GPS anomalies detected
  - Failed login attempts
  - Suspicious payment patterns

Dashboard 4: Business Metrics
  - Rides per hour (by time, location)
  - Average ride distance & duration
  - Revenue per hour
  - Driver earnings distribution

Dashboard 5: Infrastructure
  - Pod restarts (Kubernetes)
  - Disk space usage
  - Network I/O
  - Docker container health
```

**Metrics to Track**:

```
APPLICATION METRICS:
- Request count per endpoint
- Request duration (by endpoint, method)
- Error rates (by service, error type)
- Active user sessions
- Rides in progress
- Driver locations updated/second

BUSINESS METRICS:
- Ride requests/hour
- Ride acceptance rate (%)
- Average ETA accuracy
- Surge pricing multiplier
- Revenue per ride
- Driver earnings/day

INFRASTRUCTURE METRICS:
- CPU usage (by service, container)
- Memory usage (by service)
- Disk I/O (reads/writes)
- Network bandwidth
- Pod restarts
- Database query times

QUALITY METRICS:
- Test coverage (%)
- Build duration
- Deployment success rate (%)
- MTTR (Mean Time To Recover)
- MTTD (Mean Time To Detect)
```

**Alert Rules (AutoML & Thresholds)**:

```
CRITICAL (Page on-call immediately):
- Error rate > 1% for 5 minutes
- API response time p99 > 5 seconds
- Service down (unreachable for 2 minutes)
- Database unavailable
- Payment processing failures > 5%

HIGH (Notify within 1 hour):
- Error rate > 0.5% for 10 minutes
- API response time p95 > 2 seconds
- CPU usage > 85% for 10 minutes
- Memory usage > 90%
- Fraud flag rate spike > 2x baseline

MEDIUM (Daily summary):
- Slow API endpoints identified
- Uncommon error patterns
- Deployment rollback triggered
- Low cache hit ratio (< 60%)

LOW (Weekly digest):
- License expiration warnings
- Security patches available
- DDoS mitigation triggered
- Log storage increasing > 20% month-over-month
```

---

### 3.12 Payment & Refund Service (Enhanced)

**Purpose**: Secure payment processing with fraud prevention and refund automation

**Technology Stack**:

- Node.js + Express
- Stripe payment gateway (Razorpay for production)
- Idempotency keys for retry safety
- MongoDB for transaction audit trail
- Redis for payment state caching

**Payment Flow**:

```
1. Create Order (Backend)
   POST /api/v1/payments/init
   ↓
2. Initialize Payment UI (Frontend)
   Display Razorpay modal
   ↓
3. User Enters Payment Details
   Card, UPI, NetBanking, Wallet
   ↓
4. Razorpay Processes Payment
   (Secured by PCI DSS)
   ↓
5. Razorpay Webhook Notification
   POST /webhook/razorpay
   ↓
6. Verify Signature & Update DB
   Payment status → "completed" or "failed"
   ↓
7. Trigger Payment Events
   Publish to Kafka topic "payment-events"
   ↓
8. Credit Driver Wallet
   Async via background job
   ↓
9. Generate Invoice
   Send via email/SMS
   ↓
10. Update Ride Status
    Mark as "completed" and save earnings
```

**Idempotent Payment Processing**:

```javascript
// Idempotency Key ensures payment processed once
const idempotencyKey = `payment:${bookingId}:${userId}:${timestamp}`;

// If request received twice:
// First: Creates payment entry
// Second: Returns existing payment entry (no duplicate charge)

// User safely clicks "Pay" button multiple times
// System processes only once
```

**Automated Refund Logic**:

```
Scenarios triggering automatic refunds:
1. Ride cancelled by driver (>5 minutes before)
   → Instant refund (100% amount)

2. Ride cancelled by rider (<2 minutes)
   → 90% refund (10% cancellation fee)

3. Driver marked unsafe/fraud
   → Instant refund + compensation credit

4. Ride not started after 15 minutes
   → 50% refund + rebooking credit

5. ETA exceeded by >50%
   → Partial refund based on time difference

All refunds processed within 3-5 business days
Refund status tracked in real-time via Stripe API (Razorpay for production)
```

---

### 3.13 Enhanced Trip Service (Phase 4)

**Purpose**: Connect travelers on similar routes for shared experiences

**Architecture Overview**:

```
TRIP LIFECYCLE:
1. User creates trip with:
   - Start/end locations
   - Travel dates/times
   - Budget preferences
   - Interests (sightseeing, food, etc.)

2. System matches with similar trip planners:
   - Location overlap (within 5km each endpoint)
   - Time overlap (within 24 hours)
   - Budget compatibility
   - Shared interests

3. Create trip group:
   - 2-8 travelers per group
   - Shared expenses tracking
   - Itinerary coordination
   - Activity planning

4. Real-time collaboration:
   - WebSocket for live updates
   - Expense splits calculated instantly
   - Activity voting system
   - Route adjustments

5. Post-trip:
   - Final settlement
   - Ratings and reviews
   - Photo sharing
   - Stay connected (social features)

ML-BASED MATCHING:
- Collaborative filtering: "Users like you"
- Content-based: Location, time, interests
- Hybrid approach for best results
- Cold start: New users matched by interests
```

**Technology Stack**:

- Node.js + Express
- MongoDB (trips, trip_groups, expenses, itineraries)
- Redis (real-time collaboration state)
- TensorFlow (ML matching)
- Socket.io (real-time updates)

---

## 11. Architecture Decision Records (ADRs)

### ADR-001: Choosing MongoDB over PostgreSQL for Primary Database

**Status**: Accepted  
**Context**: Need to choose primary database  
**Decision**: MongoDB  
**Consequences**: Flexible schema, better for rapid development, good geospatial support

### ADR-002: Microservices vs Monolith

**Status**: Accepted  
**Context**: Application architecture pattern  
**Decision**: Microservices for core services  
**Consequences**: Better scalability, more complex deployment

### ADR-003: REST vs GraphQL

**Status**: Accepted  
**Context**: API design pattern  
**Decision**: REST for MVP, GraphQL for future  
**Consequences**: Simpler initial implementation, may need refactoring

### ADR-004: React Native vs Native Development

**Status**: Accepted  
**Context**: Mobile app development approach  
**Decision**: React Native  
**Consequences**: Code sharing, faster development, slight performance trade-off

---
