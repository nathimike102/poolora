# Database Schemas

## Smart Scheduled Car Pooling Platform - Database Schema Design

---

## 1. Database Selection

**Primary Database**: MongoDB (Atlas)
**Rationale**:

- Flexible schema for evolving requirements
- Horizontal scalability with sharding
- Fast reads and writes
- Good fit for location-based queries with geospatial indexes
- Native support for transactions (4.0+)

**Secondary Databases**:

- **Redis**: Caching and session management
- **PostgreSQL** (optional): Structured analytics data

---

## 2. Collections & Schemas

### 2.1 Users Collection

**Collection Name**: `users`  
**Sharding Key**: `_id`

```javascript
db.createCollection("users", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["phone", "role", "status", "createdAt"],
      properties: {
        _id: { bsonType: "objectId" },
        phone: {
          bsonType: "string",
          pattern: "^\\+[0-9]{10,15}$",
          description: "E.164 format phone number",
        },
        email: {
          bsonType: "string",
          pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
        },
        password: {
          bsonType: "string",
          description: "Bcrypt hashed password",
        },
        firstName: { bsonType: "string" },
        lastName: { bsonType: "string" },
        role: {
          enum: ["rider", "driver", "admin"],
          description: "User role",
        },
        status: {
          enum: ["active", "suspended", "banned", "deactivated"],
          description: "Account status",
        },
        profilePicture: { bsonType: "string" }, // S3 URL
        dateOfBirth: { bsonType: "date" },
        gender: { enum: ["male", "female", "other"] },
        kycVerified: {
          bsonType: "bool",
          description: "KYC verification status",
        },
        kycDocuments: {
          bsonType: "object",
          properties: {
            drivingLicense: {
              bsonType: "object",
              properties: {
                documentUrl: { bsonType: "string" },
                documentNumber: { bsonType: "string" },
                expiryDate: { bsonType: "date" },
                verifiedAt: { bsonType: "date" },
                status: { enum: ["pending", "verified", "rejected"] },
              },
            },
            vehicleRegistration: {
              bsonType: "object",
              properties: {
                documentUrl: { bsonType: "string" },
                registrationNumber: { bsonType: "string" },
                ownerName: { bsonType: "string" },
                verifiedAt: { bsonType: "date" },
                status: { enum: ["pending", "verified", "rejected"] },
              },
            },
            insuranceCertificate: {
              bsonType: "object",
              properties: {
                documentUrl: { bsonType: "string" },
                policyNumber: { bsonType: "string" },
                expiryDate: { bsonType: "date" },
                verifiedAt: { bsonType: "date" },
                status: { enum: ["pending", "verified", "rejected"] },
              },
            },
          },
        },
        emergencyContacts: [
          {
            name: { bsonType: "string" },
            phone: { bsonType: "string" },
            relation: { bsonType: "string" },
            isPrimary: { bsonType: "bool" },
            verifiedAt: { bsonType: "date" },
          },
        ],
        vehicle: {
          bsonType: "object",
          properties: {
            type: { enum: ["sedan", "suv", "hatchback", "premium"] },
            registrationNumber: { bsonType: "string" },
            color: { bsonType: "string" },
            manufacturer: { bsonType: "string" },
            model: { bsonType: "string" },
            year: { bsonType: "int" },
            seatingCapacity: { bsonType: "int" },
            photos: [{ bsonType: "string" }],
          },
        },
        preferences: {
          bsonType: "object",
          properties: {
            language: { default: "en" },
            currency: { default: "INR" },
            notificationEnabled: { bsonType: "bool" },
            emailNotifications: { bsonType: "bool" },
            smsNotifications: { bsonType: "bool" },
            shareLocation: { bsonType: "bool" },
          },
        },
        ratings: {
          bsonType: "object",
          properties: {
            overall: { bsonType: "double", minimum: 0, maximum: 5 },
            count: { bsonType: "int" },
            safety: { bsonType: "double", minimum: 0, maximum: 5 },
            distribution: {
              5: { bsonType: "int" },
              4: { bsonType: "int" },
              3: { bsonType: "int" },
              2: { bsonType: "int" },
              1: { bsonType: "int" },
            },
          },
        },
        statistics: {
          bsonType: "object",
          properties: {
            totalRides: { bsonType: "int" },
            totalEarnings: { bsonType: "double" },
            acceptanceRate: { bsonType: "double" },
            cancellationRate: { bsonType: "double" },
            lastActive: { bsonType: "date" },
          },
        },
        blockedUsers: [{ bsonType: "objectId" }],
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
        deletedAt: { bsonType: "date" }, // Soft delete
      },
    },
  },
});

// Indexes
db.users.createIndex({ phone: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true, sparse: true });
db.users.createIndex({ role: 1, status: 1 });
db.users.createIndex({ createdAt: -1 });
db.users.createIndex({ "ratings.overall": -1 });
```

---

### 2.2 Rides Collection

**Collection Name**: `rides`  
**Sharding Key**: `driverId`

```javascript
db.createCollection("rides", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "driverId",
        "sourceLocation",
        "destinationLocation",
        "scheduledTime",
        "status",
        "createdAt",
      ],
      properties: {
        _id: { bsonType: "objectId" },
        driverId: { bsonType: "objectId" },
        sourceLocation: {
          bsonType: "object",
          properties: {
            address: { bsonType: "string" },
            coordinates: {
              bsonType: "object",
              properties: {
                type: { enum: ["Point"] },
                coordinates: {
                  bsonType: "array",
                  items: [
                    { bsonType: "double" }, // longitude
                    { bsonType: "double" }, // latitude
                  ],
                },
              },
            },
          },
        },
        destinationLocation: {
          // Same structure as sourceLocation
        },
        scheduledTime: { bsonType: "date" },
        departureTime: { bsonType: "date" },
        estimatedArrivalTime: { bsonType: "date" },
        actualArrivalTime: { bsonType: "date" },
        status: {
          enum: ["pending", "confirmed", "started", "completed", "cancelled"],
        },
        vehicle: {
          bsonType: "object",
          properties: {
            type: { bsonType: "string" },
            registrationNumber: { bsonType: "string" },
            color: { bsonType: "string" },
            model: { bsonType: "string" },
          },
        },
        seatsAvailable: { bsonType: "int" },
        seatsBooked: { bsonType: "int" },
        totalSeats: { bsonType: "int" },
        pricePerSeat: { bsonType: "double" },
        baseFare: { bsonType: "double" },
        distance: { bsonType: "double" }, // km
        duration: { bsonType: "int" }, // minutes
        preferences: {
          bsonType: "object",
          properties: {
            womenOnly: { bsonType: "bool" },
            acEnabled: { bsonType: "bool" },
            allowMusic: { bsonType: "bool" },
            musicGenre: { bsonType: "string" },
            talkative: { bsonType: "bool" },
            smokingAllowed: { bsonType: "bool" },
          },
        },
        route: {
          bsonType: "object",
          properties: {
            encoded: { bsonType: "string" }, // Encoded polyline
            waypoints: [
              {
                latitude: { bsonType: "double" },
                longitude: { bsonType: "double" },
              },
            ],
          },
        },
        pickupPoints: [
          {
            address: { bsonType: "string" },
            coordinates: {},
          },
        ],
        dropoffPoints: [
          {
            address: { bsonType: "string" },
            coordinates: {},
          },
        ],
        recurring: {
          bsonType: "object",
          properties: {
            isRecurring: { bsonType: "bool" },
            pattern: { enum: ["daily", "weekdays", "weekends", "specific"] },
            daysOfWeek: [
              { enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] },
            ],
            frequency: { bsonType: "int" },
            endDate: { bsonType: "date" },
          },
        },
        cancellationPolicy: {
          bsonType: "object",
          properties: {
            freeCancellationMinutes: { bsonType: "int" },
            partialChargePercentage: { bsonType: "int" },
          },
        },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
        expiresAt: { bsonType: "date" },
      },
    },
  },
});

// Indexes
db.rides.createIndex({ driverId: 1, status: 1 });
db.rides.createIndex({ scheduledTime: 1, status: 1 });
db.rides.createIndex({ "sourceLocation.coordinates": "2dsphere" });
db.rides.createIndex({ "destinationLocation.coordinates": "2dsphere" });
db.rides.createIndex({ status: 1, expiresAt: 1 });
db.rides.createIndex({ createdAt: -1 });

// TTL Index (auto-delete expired rides)
db.rides.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
```

---

### 2.3 Bookings Collection

**Collection Name**: `bookings`

```javascript
db.createCollection("bookings", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["rideId", "riderId", "driverId", "status", "createdAt"],
      properties: {
        _id: { bsonType: "objectId" },
        rideId: { bsonType: "objectId" },
        riderId: { bsonType: "objectId" },
        driverId: { bsonType: "objectId" },
        status: {
          enum: ["pending", "confirmed", "rejected", "cancelled", "completed"],
        },
        passengerCount: { bsonType: "int" },
        pickupAddress: { bsonType: "string" },
        dropoffAddress: { bsonType: "string" },
        pickupTime: { bsonType: "date" },
        dropoffTime: { bsonType: "date" },
        fare: {
          bsonType: "object",
          properties: {
            baseFare: { bsonType: "double" },
            distance: { bsonType: "double" },
            distanceFare: { bsonType: "double" },
            timeFare: { bsonType: "double" },
            surgeFare: { bsonType: "double" },
            discount: { bsonType: "double" },
            taxes: { bsonType: "double" },
            total: { bsonType: "double" },
          },
        },
        paymentStatus: {
          enum: ["pending", "completed", "refunded", "failed", "disputed"],
        },
        paymentId: { bsonType: "objectId" },
        notes: { bsonType: "string" },
        cancellationReason: { bsonType: "string" },
        cancelledBy: { enum: ["rider", "driver", "admin"] },
        refundStatus: { enum: ["none", "pending", "completed", "failed"] },
        refundAmount: { bsonType: "double" },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
        completedAt: { bsonType: "date" },
      },
    },
  },
});

// Indexes
db.bookings.createIndex({ rideId: 1, riderId: 1 }, { unique: true });
db.bookings.createIndex({ riderId: 1, status: 1 });
db.bookings.createIndex({ driverId: 1, status: 1 });
db.bookings.createIndex({ createdAt: -1 });
db.bookings.createIndex({ paymentStatus: 1 });
```

---

### 2.4 Payments Collection

**Collection Name**: `payments`

```javascript
db.payments.createIndex({ orderId: 1 }, { unique: true });
db.payments.createIndex({ paymentId: 1 }, { unique: true, sparse: true });
db.payments.createIndex({ userId: 1, status: 1 });
db.payments.createIndex({ bookingId: 1 });
db.payments.createIndex({ createdAt: -1 });
db.payments.createIndex({ status: 1 });
```

---

### 2.5 Messages Collection

**Collection Name**: `messages`

```javascript
db.messages.createIndex({ conversationId: 1, createdAt: -1 });
db.messages.createIndex({ senderId: 1, createdAt: -1 });
db.messages.createIndex({ receiverId: 1, status: 1 });
db.messages.createIndex({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30 days TTL
```

---

### 2.6 Ratings Collection

**Collection Name**: `ratings`

```javascript
db.ratings.createIndex({ bookingId: 1 }, { unique: true });
db.ratings.createIndex({ ratedTo: 1 }, { sparse: true });
db.ratings.createIndex({ ratedBy: 1 }, { sparse: true });
db.ratings.createIndex({ createdAt: -1 });
db.ratings.createIndex({ overallRating: -1 });
```

---

### 2.7 Emergency Records Collection

**Collection Name**: `emergencyRecords`

```javascript
db.emergencyRecords.createIndex({ userId: 1, createdAt: -1 });
db.emergencyRecords.createIndex({ rideId: 1 });
db.emergencyRecords.createIndex({ status: 1 });
db.emergencyRecords.createIndex({ createdAt: -1 });
```

---

## 3. Indexing Strategy

### 3.1 Index Selection Criteria

- **Foreign Keys**: Always index for joins
- **Search Fields**: Index frequently queried fields
- **Range Queries**: Index fields used in range queries
- **Sorting**: Index fields used for sorting
- **Geographic**: 2dsphere index for location queries

### 3.2 Compound Indexes

```javascript
// Examples of effective compound indexes
db.rides.createIndex({ driverId: 1, status: 1 });
db.bookings.createIndex({ riderId: 1, createdAt: -1 });
db.users.createIndex({ role: 1, status: 1, createdAt: -1 });
```

---

## 4. Redis Schema (Caching)

### 4.1 Key Naming Convention

```
user:{userId}:profile       -> User profile data
user:{userId}:tokens        -> Active tokens
ride:{rideId}:details       -> Ride details
ride:search:{userId}        -> Search results
driver:{driverId}:location  -> Current location
session:{sessionId}         -> Session data
```

### 4.2 Data Structure Examples

```javascript
// User Profile
SET user:123:profile JSON.stringify({
  firstName: "John",
  lastName: "Doe",
  rating: 4.5,
  totalRides: 25
})
TTL: 3600 seconds

// Active Rides
SET ride:456:active JSON.stringify({
  driverId: "123",
  status: "started",
  currentLocation: { lat: 28.6139, lng: 77.2090 }
})
TTL: 86400 seconds

// Leaderboards
ZADD driver_ratings 4.8 "driver_123" 4.6 "driver_456"
```

---

## 5. Data Relationships

```
Users
  ├── 1 ---> N Rides (as driver)
  ├── 1 ---> N Bookings (as rider)
  ├── 1 ---> N Ratings (given/received)
  ├── 1 ---> N Messages
  └── 1 ---> 1 Wallet

Rides
  ├── 1 ---> N Bookings
  ├── 1 ---> N Ratings
  └── 1 ---> N Locations (tracking)

Bookings
  ├── 1 ---> 1 Payment
  ├── 1 ---> N Messages
  └── 1 ---> N Ratings
```

---

## 3. Collections for Phase 4 Modules

### 3.1 Parcels Collection (Parcel Pooling Module)

**Collection Name**: `parcels`

```javascript
db.createCollection("parcels", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "senderId",
        "parcelType",
        "weight",
        "sourceLocation",
        "destinationLocation",
        "scheduledTime",
        "status",
        "createdAt",
      ],
      properties: {
        _id: { bsonType: "objectId" },
        senderId: { bsonType: "objectId" },
        recipientId: { bsonType: "objectId" },
        rideId: {
          bsonType: "objectId",
          description: "Associated ride if matched",
        },
        parcelType: {
          enum: [
            "document",
            "clothing",
            "electronics",
            "fragile",
            "perishable",
            "other",
          ],
        },
        description: { bsonType: "string" },
        weight: { bsonType: "double", description: "Weight in kg" },
        dimensions: {
          bsonType: "object",
          properties: {
            length: { bsonType: "double" },
            width: { bsonType: "double" },
            height: { bsonType: "double" },
            unit: { enum: ["cm", "inch"] },
          },
        },
        sourceLocation: {
          bsonType: "object",
          properties: {
            address: { bsonType: "string" },
            coordinates: {
              bsonType: "object",
              properties: {
                type: { enum: ["Point"] },
                coordinates: [{ bsonType: "double" }, { bsonType: "double" }],
              },
            },
          },
        },
        destinationLocation: {
          bsonType: "object",
          properties: {
            address: { bsonType: "string" },
            coordinates: {
              /* same as sourceLocation */
            },
          },
        },
        scheduledTime: { bsonType: "date" },
        pickupTime: { bsonType: "date" },
        deliveryTime: { bsonType: "date" },
        actualDeliveryTime: { bsonType: "date" },
        status: {
          enum: [
            "posted",
            "matched",
            "picked_up",
            "in_transit",
            "delivered",
            "cancelled",
            "lost",
            "damaged",
          ],
        },
        carrier: {
          bsonType: "object",
          properties: {
            riderId: { bsonType: "objectId" },
            driverId: { bsonType: "objectId" },
            verificationProof: [
              { bsonType: "string", description: "Photo URLs" },
            ],
          },
        },
        priceOffered: { bsonType: "double" },
        insurance: {
          bsonType: "object",
          properties: {
            isInsured: { bsonType: "bool" },
            declaredValue: { bsonType: "double" },
            insuranceCost: { bsonType: "double" },
            coverageType: { enum: ["basic", "standard", "premium"] },
            claimStatus: { enum: ["none", "filed", "approved", "rejected"] },
          },
        },
        tracking: {
          bsonType: "array",
          items: {
            bsonType: "object",
            properties: {
              status: { bsonType: "string" },
              timestamp: { bsonType: "date" },
              location: {
                /* geolocation */
              },
              photoProof: { bsonType: "string" },
            },
          },
        },
        ratings: {
          bsonType: "object",
          properties: {
            senderRating: { bsonType: "double", minimum: 0, maximum: 5 },
            carrierRating: { bsonType: "double", minimum: 0, maximum: 5 },
            senderReview: { bsonType: "string" },
            carrierReview: { bsonType: "string" },
          },
        },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
      },
    },
  },
});

// Indexes
db.parcels.createIndex({ senderId: 1, status: 1 });
db.parcels.createIndex({ driverId: 1, status: 1 });
db.parcels.createIndex({ "sourceLocation.coordinates": "2dsphere" });
db.parcels.createIndex({ "destinationLocation.coordinates": "2dsphere" });
db.parcels.createIndex({ scheduledTime: 1, status: 1 });
db.parcels.createIndex({ createdAt: -1 });
db.parcels.createIndex({ rideId: 1 });
```

---

### 3.2 Trips Collection (Trip Pooling Module)

**Collection Name**: `trips`

```javascript
db.createCollection("trips", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: [
        "creatorId",
        "tripTitle",
        "startDate",
        "endDate",
        "destinationLocation",
        "status",
        "createdAt",
      ],
      properties: {
        _id: { bsonType: "objectId" },
        creatorId: { bsonType: "objectId" },
        tripTitle: { bsonType: "string" },
        description: { bsonType: "string" },
        tripType: {
          enum: ["vacation", "weekend", "business", "adventure", "pilgrimage"],
        },
        startDate: { bsonType: "date" },
        endDate: { bsonType: "date" },
        destinationLocation: {
          bsonType: "object",
          properties: {
            city: { bsonType: "string" },
            country: { bsonType: "string" },
            coordinates: {},
          },
        },
        intermediateStops: [
          {
            location: { bsonType: "string" },
            date: { bsonType: "date" },
            duration: { bsonType: "int", description: "Duration in hours" },
          },
        ],
        estimatedBudget: { bsonType: "double" },
        budgetCurrency: { default: "INR" },
        budgetBreakdown: {
          bsonType: "object",
          properties: {
            accommodation: { bsonType: "double" },
            food: { bsonType: "double" },
            activities: { bsonType: "double" },
            transport: { bsonType: "double" },
            other: { bsonType: "double" },
          },
        },
        maxMembers: { bsonType: "int" },
        accommodationPreferences: {
          bsonType: "object",
          properties: {
            type: { enum: ["hotel", "hostel", "airbnb", "resort"] },
            roomType: { enum: ["single", "shared", "suite"] },
            budget: { bsonType: "double" },
          },
        },
        travelStyle: { enum: ["luxury", "budget", "adventure", "comfort"] },
        interests: [
          {
            bsonType: "string",
            examples: ["hiking", "culture", "food", "adventure"],
          },
        ],
        status: {
          enum: ["planning", "confirmed", "ongoing", "completed", "cancelled"],
        },
        visibility: { enum: ["public", "private", "friends_only"] },
        itinerary: [
          {
            day: { bsonType: "int" },
            date: { bsonType: "date" },
            activities: [{ bsonType: "string" }],
            accommodation: { bsonType: "string" },
            meals: { bsonType: "string" },
            notes: { bsonType: "string" },
          },
        ],
        ratings: {
          bsonType: "object",
          properties: {
            overall: { bsonType: "double", minimum: 0, maximum: 5 },
            organizationRating: { bsonType: "double", minimum: 0, maximum: 5 },
            companionRating: { bsonType: "double", minimum: 0, maximum: 5 },
          },
        },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
        deletedAt: { bsonType: "date" },
      },
    },
  },
});

// Indexes
db.trips.createIndex({ creatorId: 1, status: 1 });
db.trips.createIndex({ startDate: 1, endDate: 1 });
db.trips.createIndex({ "destinationLocation.city": 1 });
db.trips.createIndex({ tripType: 1, visibility: 1 });
db.trips.createIndex({ createdAt: -1 });
db.trips.createIndex({ status: 1 });
```

---

### 3.3 Trip Groups Collection (Trip Pooling Module)

**Collection Name**: `trip_groups`

```javascript
db.createCollection("trip_groups", {
  validator: {
    $jsonSchema: {
      bsonType: "object",
      required: ["tripId", "members", "createdAt"],
      properties: {
        _id: { bsonType: "objectId" },
        tripId: { bsonType: "objectId" },
        creatorId: { bsonType: "objectId" },
        members: [
          {
            bsonType: "object",
            properties: {
              userId: { bsonType: "objectId" },
              joinedAt: { bsonType: "date" },
              role: { enum: ["creator", "organizer", "member"] },
              status: { enum: ["active", "left", "removed"] },
            },
          },
        ],
        expenses: [
          {
            expenseId: { bsonType: "objectId" },
            description: { bsonType: "string" },
            amount: { bsonType: "double" },
            paidBy: { bsonType: "objectId" },
            splitWith: [{ bsonType: "objectId" }],
            date: { bsonType: "date" },
            category: {
              enum: ["accommodation", "food", "transport", "activity", "other"],
            },
            status: { enum: ["pending", "settled"] },
          },
        ],
        settlements: [
          {
            from: { bsonType: "objectId" },
            to: { bsonType: "objectId" },
            amount: { bsonType: "double" },
            status: { enum: ["pending", "completed"] },
            settledAt: { bsonType: "date" },
          },
        ],
        sharedActivities: [
          {
            activityId: { bsonType: "objectId" },
            activity: { bsonType: "string" },
            proposedBy: { bsonType: "objectId" },
            date: { bsonType: "date" },
            cost: { bsonType: "double" },
            votes: [{ bsonType: "objectId" }],
            status: { enum: ["proposed", "confirmed", "completed"] },
          },
        ],
        sharedAccommodations: [
          {
            name: { bsonType: "string" },
            address: { bsonType: "string" },
            checkIn: { bsonType: "date" },
            checkOut: { bsonType: "date" },
            cost: { bsonType: "double" },
            bookingId: { bsonType: "string" },
            allocatedRooms: [{ bsonType: "string" }],
          },
        ],
        groupChat: {
          bsonType: "object",
          properties: {
            conversationId: { bsonType: "objectId" },
            messageCount: { bsonType: "int" },
            lastMessageAt: { bsonType: "date" },
          },
        },
        createdAt: { bsonType: "date" },
        updatedAt: { bsonType: "date" },
      },
    },
  },
});

// Indexes
db.trip_groups.createIndex({ tripId: 1 });
db.trip_groups.createIndex({ "members.userId": 1 });
db.trip_groups.createIndex({ creatorId: 1, createdAt: -1 });
db.trip_groups.createIndex({ "settlements.from": 1, "settlements.status": 1 });
db.trip_groups.createIndex({ createdAt: -1 });
```

---

## 6. Data Integrity & Validation

### 6.1 Constraints

- Primary Key: `_id` (auto-generated ObjectId)
- Unique: phone, email (sparse), orderId
- Foreign Keys: Manual validation in application code
- Not Null: required fields defined in schema

### 6.2 Referential Integrity

```javascript
// On user deletion
- Delete all user's rides (cascade)
- Soft-delete all bookings (set deletedAt)
- Anonymize all ratings (replace userId with null)
- Archive messages (don't delete)
```

---

## 7. Backup & Recovery Strategy

### 7.1 Backup Schedule

- **Full Backup**: Daily at 02:00 UTC
- **Incremental**: Every 6 hours
- **Retention**: 30 days for daily, 1 year for monthly

### 7.2 Recovery Time Objective (RTO)

- **Critical Data**: < 1 hour
- **Non-critical**: < 4 hours

---
