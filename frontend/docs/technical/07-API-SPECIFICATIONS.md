# API Specifications

**Smart Scheduled Car Pooling Platform**

## Smart Scheduled Car Pooling Platform - REST API Documentation

---

## 1. API Overview

### 1.1 API Base URL

```
Development: https://api-dev.carpooling.local/api/v1
Staging:     https://api-staging.carpooling.local/api/v1
Production:  https://api.carpooling.com/api/v1
```

### 1.2 API Versioning

- Current Version: v1
- Deprecation Notice: 6 months advance notice
- Sunset: 12 months from deprecation

### 1.3 Response Format

**Success Response (2xx)**

```json
{
  "status": "success",
  "code": 200,
  "data": {
    // Response data
  },
  "timestamp": "2026-02-26T10:30:00Z",
  "requestId": "req_12345678"
}
```

**Error Response (4xx/5xx)**

```json
{
  "status": "error",
  "code": 400,
  "error": {
    "id": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format"
      }
    ]
  },
  "timestamp": "2026-02-26T10:30:00Z",
  "requestId": "req_12345678"
}
```

---

## 2. Authentication Endpoints

### 2.1 Register User

```
POST /auth/register

Request Body:
{
  "phone": "+919876543210",
  "firstName": "John",
  "lastName": "Doe",
  "email": "john@example.com",
  "password": "SecurePassword123!",
  "role": "rider"  // or "driver"
}

Response (201):
{
  "status": "success",
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "phone": "+919876543210",
    "message": "OTP sent to phone"
  }
}

Error Codes:
- 400: Invalid input
- 409: Phone already registered
- 500: Server error
```

### 2.2 Send OTP

```
POST /auth/send-otp

Request Body:
{
  "phone": "+919876543210"
}

Response (200):
{
  "status": "success",
  "data": {
    "otpId": "otp_123456",
    "expiresIn": 600  // seconds
  }
}

Validations:
- Phone format: E.164
- Rate limit: 3 OTPs per 24 hours
```

### 2.3 Verify OTP

```
POST /auth/verify-otp

Request Body:
{
  "phone": "+919876543210",
  "otp": "123456"
}

Response (200):
{
  "status": "success",
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "expiresIn": 86400  // seconds (24 hours)
  }
}

Error Codes:
- 400: Invalid OTP
- 429: Too many attempts
```

### 2.4 Login

```
POST /auth/login

Request Body:
{
  "phone": "+919876543210",
  "password": "SecurePassword123!"
}

Response (200):
{
  "status": "success",
  "data": {
    "accessToken": "eyJhbGc...",
    "refreshToken": "eyJhbGc...",
    "user": {
      "id": "507f1f77bcf86cd799439011",
      "phone": "+919876543210",
      "role": "rider",
      "status": "active",
      "rating": 4.5
    }
  }
}
```

### 2.5 Refresh Token

```
POST /auth/refresh

Headers:
{
  "Authorization": "Bearer {refreshToken}"
}

Response (200):
{
  "status": "success",
  "data": {
    "accessToken": "eyJhbGc...",
    "expiresIn": 86400
  }
}
```

### 2.6 Logout

```
POST /auth/logout

Headers:
{
  "Authorization": "Bearer {accessToken}"
}

Response (200):
{
  "status": "success",
  "data": {
    "message": "Logged out successfully"
  }
}
```

---

## 3. Ride Management Endpoints

### 3.1 Create Ride

```
POST /rides

Headers:
{
  "Authorization": "Bearer {accessToken}",
  "Content-Type": "application/json"
}

Request Body:
{
  "sourceLocation": {
    "address": "123 Main St, New Delhi",
    "coordinates": {
      "latitude": 28.6139,
      "longitude": 77.2090
    }
  },
  "destinationLocation": {
    "address": "456 Park Ave, New Delhi",
    "coordinates": {
      "latitude": 28.6333,
      "longitude": 77.2197
    }
  },
  "scheduledTime": "2026-02-27T09:00:00Z",
  "seatsAvailable": 3,
  "pricePerSeat": 250,
  "vehicle": {
    "type": "sedan",
    "registrationNumber": "DL01AB1234"
  },
  "preferences": {
    "womenOnly": false,
    "acEnabled": true
  },
  "recurring": {
    "isRecurring": true,
    "pattern": "weekdays",
    "daysOfWeek": ["MON", "TUE", "WED", "THU", "FRI"]
  }
}

Response (201):
{
  "status": "success",
  "data": {
    "rideId": "507f1f77bcf86cd799439011",
    "driverId": "507f1f77bcf86cd799439012",
    "status": "posted",
    "createdAt": "2026-02-26T10:30:00Z"
  }
}

Validations:
- Driver must be verified
- Seats: 1-8
- Price: >= 0
```

### 3.2 Search Rides

```
GET /rides/search

Query Parameters:
{
  "sourceLatitude": 28.6139,
  "sourceLongitude": 77.2090,
  "destinationLatitude": 28.6333,
  "destinationLongitude": 77.2197,
  "departureTime": "2026-02-27T09:00:00Z",
  "passengers": 1,
  "radius": 5,  // km
  "timeDeviation": 120,  // minutes
  "maxPrice": 500,
  "womenOnly": false,
  "page": 1,
  "limit": 20
}

Response (200):
{
  "status": "success",
  "data": [
    {
      "rideId": "507f1f77bcf86cd799439011",
      "driverId": "507f1f77bcf86cd799439012",
      "driver": {
        "name": "John Doe",
        "rating": 4.5,
        "profilePicture": "https://s3.amazonaws.com/...",
        "totalRides": 150
      },
      "sourceLocation": {...},
      "destinationLocation": {...},
      "scheduledTime": "2026-02-27T09:00:00Z",
      "seatsAvailable": 3,
      "pricePerSeat": 250,
      "estimatedDistance": 15.5,
      "estimatedDuration": 45,
      "matchScore": 92,  // ML-based score
      "preferences": {...}
    }
  ],
  "pagination": {
    "total": 45,
    "page": 1,
    "limit": 20,
    "pages": 3
  }
}

Pagination:
- Default limit: 20
- Max limit: 100
- Format: offset/limit
```

### 3.3 Get Ride Details

```
GET /rides/{rideId}

Response (200):
{
  "status": "success",
  "data": {
    "rideId": "507f1f77bcf86cd799439011",
    "driverId": "507f1f77bcf86cd799439012",
    "driver": {
      "name": "John Doe",
      "rating": 4.5,
      "reviews": [
        {
          "rating": 5,
          "comment": "Professional driver"
        }
      ]
    },
    "sourceLocation": {...},
    "destinationLocation": {...},
    "scheduledTime": "2026-02-27T09:00:00Z",
    "seatsAvailable": 3,
    "seatsBooked": 1,
    "totalSeats": 4,
    "pricePerSeat": 250,
    "status": "posted",
    "route": {...},
    "vehicle": {...},
    "preferences": {...}
  }
}
```

### 3.4 Request Ride

```
POST /rides/{rideId}/request

Request Body:
{
  "passengerCount": 1,
  "pickupAddress": "Main Gate",
  "dropoffAddress": "Office Gate",
  "notes": "Running a bit late"
}

Response (201):
{
  "status": "success",
  "data": {
    "bookingId": "507f1f77bcf86cd799439013",
    "rideId": "507f1f77bcf86cd799439011",
    "status": "pending",
    "fare": {
      "baseFare": 250,
      "distanceFare": 155,
      "total": 405
    }
  }
}

Preconditions:
- Rider must be verified
- Seats available > 0
- No duplicate booking by same user
```

### 3.5 Accept Ride Request

```
POST /rides/{rideId}/bookings/{bookingId}/accept

Response (200):
{
  "status": "success",
  "data": {
    "bookingId": "507f1f77bcf86cd799439013",
    "status": "confirmed",
    "rider": {
      "name": "Jane Doe",
      "phone": "+918765432101",
      "rating": 4.2
    }
  }
}

Authorization:
- Only ride driver can accept
```

### 3.6 Cancel Ride Request

```
POST /rides/{rideId}/bookings/{bookingId}/reject

Request Body:
{
  "reason": "User verification failed"
}

Response (200):
{
  "status": "success",
  "data": {
    "bookingId": "507f1f77bcf86cd799439013",
    "status": "rejected"
  }
}
```

### 3.7 Start Ride

```
POST /rides/{rideId}/start

Response (200):
{
  "status": "success",
  "data": {
    "rideId": "507f1f77bcf86cd799439011",
    "status": "started",
    "startTime": "2026-02-27T09:00:00Z"
  }
}
```

### 3.8 Complete Ride

```
POST /rides/{rideId}/complete

Request Body:
{
  "endLocation": {
    "latitude": 28.6400,
    "longitude": 77.2300
  },
  "actualDistance": 15.8,
  "actualDuration": 48
}

Response (200):
{
  "status": "success",
  "data": {
    "rideId": "507f1f77bcf86cd799439011",
    "status": "completed",
    "completedAt": "2026-02-27T09:48:00Z",
    "fare": {
      "baseFare": 250,
      "distanceFare": 158,
      "total": 408
    }
  }
}
```

---

## 4. Payment Endpoints

### 4.1 Create Payment Order

```
POST /payments/orders

Request Body:
{
  "bookingId": "507f1f77bcf86cd799439013",
  "amount": 425,
  "currency": "INR"
}

Response (201):
{
  "status": "success",
  "data": {
    "orderId": "order_1a2b3c4d5e6f",
    "amount": 425,
    "currency": "INR",
    "key": "rzp_live_xxxx"
  }
}
```

### 4.2 Verify Payment

```
POST /payments/verify

Request Body:
{
  "stripeOrderId": "order_1a2b3c4d5e6f",
  "stripePaymentId": "pay_1a2b3c4d5e6f",
  "stripeSignature": "signature..."
  // For production: razorpayOrderId, razorpayPaymentId, razorpaySignature
}

Response (200):
{
  "status": "success",
  "data": {
    "paymentId": "pay_1a2b3c4d5e6f",
    "status": "completed",
    "bookingId": "507f1f77bcf86cd799439013"
  }
}
```

### 4.3 Get Payment Details

```
GET /payments/{paymentId}

Response (200):
{
  "status": "success",
  "data": {
    "paymentId": "pay_1a2b3c4d5e6f",
    "amount": 425,
    "status": "completed",
    "method": "card",
    "createdAt": "2026-02-27T09:00:00Z"
  }
}
```

---

## 5. User Profile Endpoints

### 5.1 Get User Profile

```
GET /users/me

Headers:
{
  "Authorization": "Bearer {accessToken}"
}

Response (200):
{
  "status": "success",
  "data": {
    "userId": "507f1f77bcf86cd799439011",
    "phone": "+919876543210",
    "email": "john@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "rider",
    "rating": 4.5,
    "profilePicture": "https://s3.amazonaws.com/...",
    "totalRides": 25,
    "kycVerified": true,
    "createdAt": "2026-01-15T10:30:00Z"
  }
}
```

### 5.2 Update User Profile

```
PUT /users/me

Request Body:
{
  "firstName": "John",
  "lastName": "Doe",
  "email": "john.doe@example.com",
  "profilePicture": "<base64_encoded_image>"
}

Response (200):
{
  "status": "success",
  "data": {
    "message": "Profile updated successfully"
  }
}
```

---

## 6. Rating Endpoints

### 6.1 Create Rating

```
POST /ratings

Request Body:
{
  "bookingId": "507f1f77bcf86cd799439013",
  "ratedUserId": "507f1f77bcf86cd799439012",
  "rating": 5,
  "review": "Great ride, professional driver",
  "categories": {
    "cleanliness": 5,
    "driving": 4,
    "politeness": 5
  },
  "safetyRating": 5
}

Response (201):
{
  "status": "success",
  "data": {
    "ratingId": "507f1f77bcf86cd799439014",
    "bookingId": "507f1f77bcf86cd799439013",
    "createdAt": "2026-02-27T10:00:00Z"
  }
}

Validations:
- User must have completed the ride
- Only one rating per booking
```

---

## 7. Chat Endpoints

### 7.1 Send Message

```
POST /messages

Request Body:
{
  "conversationId": "507f1f77bcf86cd799439015",
  "message": "I'm running 5 minutes late"
}

Response (201):
{
  "status": "success",
  "data": {
    "messageId": "507f1f77bcf86cd799439016",
    "conversationId": "507f1f77bcf86cd799439015",
    "status": "sent",
    "createdAt": "2026-02-27T09:30:00Z"
  }
}

WebSocket: /ws/chat
```

---

## 8. Emergency Endpoints

### 8.1 Trigger SOS

```
POST /emergency/sos

Request Body:
{
  "rideId": "507f1f77bcf86cd799439011",
  "location": {
    "latitude": 28.6139,
    "longitude": 77.2090
  }
}

Response (201):
{
  "status": "success",
  "data": {
    "sosId": "507f1f77bcf86cd799439017",
    "status": "triggered",
    "contactsNotified": 2,
    "adminNotified": true
  }
}
```

---

## 9. Error Codes

| Code | Error ID            | Message                 | HTTP Status |
| ---- | ------------------- | ----------------------- | ----------- |
| 400  | VALIDATION_ERROR    | Input validation failed | 400         |
| 401  | UNAUTHORIZED        | Authentication required | 401         |
| 403  | FORBIDDEN           | Access denied           | 403         |
| 404  | NOT_FOUND           | Resource not found      | 404         |
| 409  | CONFLICT            | Resource already exists | 409         |
| 429  | RATE_LIMIT          | Too many requests       | 429         |
| 500  | INTERNAL_ERROR      | Internal server error   | 500         |
| 503  | SERVICE_UNAVAILABLE | Service temporary down  | 503         |

---

## 10. Rate Limiting

```
Headers Response:
{
  "X-RateLimit-Limit": 100,
  "X-RateLimit-Remaining": 99,
  "X-RateLimit-Reset": 1645849800
}

Limits:
- Public endpoints: 100/minute per IP
- Authenticated: 1000/minute per user
- Admin: 5000/minute per admin
```

---
