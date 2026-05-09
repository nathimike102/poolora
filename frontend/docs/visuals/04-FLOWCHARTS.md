# Flowcharts & Process Diagrams

## Smart Scheduled Car Pooling Platform - Flowcharts

---

## 1. User Registration Flow

```
START
  │
  ▼
┌──────────────────────────┐
│ User Opens App           │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ User Clicks "Register"   │
└────────┬─────────────────┘
         │
         ▼
┌───────────────────────────────────┐
│ User Selects Role                 │
│ (Driver / Rider)                  │
└────────┬────────────┬─────────────┘
         │            │
    Ride: Driver      Rider
         │            │
         ▼            │
    ┌─────────────────┘
    │
    ▼
┌──────────────────────────┐
│ Enter Phone Number       │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Send OTP via SMS         │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Enter OTP                │
└────────┬──────┬──────────┘
         │      │
      Valid  Invalid
         │      │
         │      ▼
         │   ┌──────────────────────────┐
         │   │ Show Error, Retry        │
         │   │ Max 3 attempts           │
         │   └──┬───────────────────────┘
         │      │
         │      ▼
         │   ┌──────────────────────────┐
         │   │ Attempts > 3?            │
         │   └──┬─────────────────┬─────┘
         │      │                 │
         │     YES               NO
         │      │                 │
         │      ▼                 │
         │   ┌──────────────────┐ │
         │   │ Suspend Account  │ │
         │   │ for 24 hours     │ │
         │   └────┬─────────────┘ │
         │        │               │
         │        ▼               │
         │    ┌────────┐          │
         │    │ END(X) │          │
         │    └────────┘          │
         │                        │
         ▼                        │
    Valid OTP          ┌──────────┘
       │               │
       └───────────────┘
               │
               ▼
┌──────────────────────────────────┐
│ Enter Personal Details           │
│ - Name                           │
│ - Email                          │
│ - Date of Birth                  │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Is User = Driver?                │
└────────┬─────────────┬───────────┘
         │             │
        YES            NO
         │             │
         ▼             │
┌──────────────────────────┐
│ Upload Documents:        │
│ - Driving License        │
│ - Vehicle Registration   │
│ - Insurance              │
│ - Vehicle Photos         │
└────────┬──────┬──────────┘
         │      │
      Upload  Cancel
       │      │
       ▼      ▼
    Valid   ┌──────────────┐
       │    │ Go Back      │
       └──┬─┘              │
          │                │
          └────────────────┘
                  │
                  ▼
         ┌────────────────────┐
         │ Create Account     │
         │ Log User In        │
         └────┬───────────────┘
              │
              ▼
         ┌────────────────────┐
         │ Show Success Msg   │
         │ Start Profile Setup│
         └────┬───────────────┘
              │
              ▼
          ┌────────┐
          │ END(✓) │
          └────────┘
```

---

## 2. Ride Creation Flow

```
START
  │
  ▼
┌──────────────────────────────┐
│ Driver Clicks Create Ride     │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Driver Verified?             │
└────────┬─────────┬───────────┘
         │         │
        YES        NO
         │         │
         │         ▼
         │     ┌──────────────────┐
         │     │ Show Error       │
         │     │ Complete KYC     │
         │     └────┬─────────────┘
         │          │
         │          ▼
         │       ┌────────┐
         │       │ END(X) │
         │       └────────┘
         │
         ▼
┌──────────────────────────────┐
│ Enter Ride Details:          │
│ - Pickup Location            │
│ - Dropoff Location           │
│ - Date & Time                │
│ - Seats Available            │
│ - Price per Seat             │
│ - Vehicle Type               │
│ - Special Notes              │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Validate with Google Maps        │
│ - Address Validation             │
│ - Route Calculation              │
│ - Distance & Duration            │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Valid Address?                   │
└────────┬─────────────┬───────────┘
         │             │
        YES            NO
         │             │
         │             ▼
         │         ┌──────────────┐
         │         │ Show Suggestions
         │         │ for Similar  │
         │         │ Locations    │
         │         └──┬───────────┘
         │            │
         │            ▼
         │         ┌──────────────┐
         │         │ User Selects │
         │         │ Correct Addr │
         │         └──┬───────────┘
         │            │
         └────────────┘
                  │
                  ▼
┌──────────────────────────────────┐
│ ML Predictions:                  │
│ - Demand Level                   │
│ - Suggested Price                │
│ - Best Times to Post             │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Show Ride Summary & Predictions  │
│ Allow Driver to Accept/Modify    │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Driver Confirms Details          │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Recurring Ride?                  │
└────────┬─────────────┬───────────┘
         │             │
        YES            NO
         │             │
         ▼             │
    ┌───────────────┐  │
    │ Set Recurrence│  │
    │ Days & Times  │  │
    └────┬──────────┘  │
         │             │
         └──────┬──────┘
                │
                ▼
┌──────────────────────────────────┐
│ Save Ride(s) to MongoDB          │
│ Update Search Indexes            │
│ Add to Redis Cache               │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Send Notifications to Matching   │
│ Riders (within 5km, +/- 2hrs)    │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Show Confirmation to Driver      │
│ - Ride ID                        │
│ - Booking Link                   │
│ - Summary                        │
└────────┬─────────────────────────┘
         │
         ▼
      ┌────────┐
      │ END(✓) │
      └────────┘
```

---

## 3. Ride Search & Booking Flow

```
START
  │
  ▼
┌──────────────────────────────┐
│ Rider Clicks Find Rides      │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Enter Search Criteria:        │
│ - Pickup Location             │
│ - Dropoff Location            │
│ - Date & Time                 │
│ - Passengers                  │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Validate Locations            │
└────────┬──────────────┬───────┘
         │              │
      Valid          Invalid
         │              │
         │              ▼
         │         ┌──────────────┐
         │         │ Show Nearby  │
         │         │ Suggestions  │
         │         └──┬───────────┘
         │            │
         └────────────┘
                  │
                  ▼
┌──────────────────────────────────┐
│ Query MongoDB:                   │
│ - Available Rides               │
│ - Matching Criteria             │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Rides Found?                     │
└────────┬─────────────┬───────────┘
         │             │
        YES            NO
         │             │
         │             ▼
         │         ┌──────────────┐
         │         │ Show Options │
         │         │ - Different  │
         │         │   Times      │
         │         │ - Similar    │
         │         │   Routes     │
         │         │ - Nearby     │
         │         │   Locations  │
         │         └──┬───────────┘
         │            │
         │            ▼
         │         ┌──────────────┐
         │         │ User Adjusts │
         │         │ Search       │
         │         └──┬───────────┘
         │            │
         └────────────┘
              │
              ▼
┌──────────────────────────────────┐
│ ML Ranking Algorithm:            │
│ - Distance from Route            │
│ - Time Compatibility             │
│ - Driver Rating                  │
│ - Acceptance Rate                │
│ Generate Match Score (0-100)     │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Apply User Filters:              │
│ - Women-Only                     │
│ - AC/Non-AC                      │
│ - Vehicle Type                   │
│ - Price Range                    │
│ - Driver Rating (Min)            │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Sort by Match Score              │
│ Display Results:                 │
│ - Driver Info                    │
│ - Vehicle Info                   │
│ - Price & ETA                    │
│ - Route on Map                   │
│ - Driver Rating                  │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Rider Selects Ride               │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Show Detailed Ride Info:         │
│ - Full Route Map                 │
│ - Driver Reviews                 │
│ - Estimated Fare                 │
│ - Cancellation Policy            │
│ - Driver Contact                 │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Rider Clicks "Request Ride"      │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Show Booking Confirmation        │
│ - Review All Details             │
│ - Accept Terms                   │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Initiate Payment                 │
│ Create Razorpay Order            │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Show Payment Gateway             │
│ Rider Selects Payment Method:    │
│ - Card                           │
│ - UPI                            │
│ - NetBanking                     │
│ - Wallet                         │
└────────┬──────┬──────────────────┘
         │      │
      Payment  Cancel
         │      │
         ▼      ▼
    Processing Back
         │      │
         ┌──────┘
         │
         ▼
┌──────────────────────────────────┐
│ Razorpay Processes Payment       │
└────────┬──────┬──────────────────┘
         │      │
      SUCCESS  FAILURE
         │      │
         │      ▼
         │   ┌──────────────┐
         │   │ Show Error   │
         │   │ Retry or Use │
         │   │ Different    │
         │   │ Method       │
         │   └──┬───────────┘
         │      │
         │      └────────────┐
         │                   │
         ▼                   │
┌──────────────────────────────┐
│ Verify Payment Response      │
│ Create Booking in MongoDB    │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Update Ride Availability         │
│ Notify Driver of Booking         │
│ Send Receipt to Rider            │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Show Booking Confirmation        │
│ - Booking ID                     │
│ - Driver Details                 │
│ - Receipt                        │
│ - Tracking Option                │
└────────┬─────────────────────────┘
         │
         ▼
      ┌────────┐
      │ END(✓) │
      └────────┘
```

---

## 4. Payment Processing Flow

```
START (After Booking)
  │
  ▼
┌──────────────────────────────┐
│ Create Razorpay Order        │
│ - Order ID                   │
│ - Amount (Pre-authorized)    │
│ - User Info                  │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Send to Payment Gateway      │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Razorpay Shows UI            │
│ User Completes Payment       │
└────────┬──────┬──────────────┘
         │      │
      SUCCESS  FAILED
         │      │
         │      ▼
         │   ┌──────────────┐
         │   │ Decrypted    │
         │   │ Charge Card/ │
         │   │ Account      │
         │   └──┬───────────┘
         │      │
         │      ▼
         │   ┌──────────────┐
         │   │ Payment Failed
         │   │ Notify User  │
         │   └──┬───────────┘
         │      │
         │      ▼
         │   ┌──────────────┐
         │   │ Retry Option │
         │   └──┬───────────┘
         │      │
         │      └────────────┐
         │                   │
         ▼                   │
    Payment Received      Back to
         │                Payment
         │                 │
         └─────┬───────────┘
               │
               ▼
┌──────────────────────────────┐
│ Razorpay Sends Webhook       │
│ - Status: SUCCESS            │
│ - Payment ID                 │
│ - Signature                  │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ System Verifies Signature    │
│ Valid?                       │
└────────┬─────────┬───────────┘
         │         │
        YES        NO
         │         │
         │         ▼
         │     ┌──────────────┐
         │     │ Log Suspicious
         │     │ Activity     │
         │     │ Alert Admin  │
         │     └──┬───────────┘
         │        │
         │        ▼
         │     ┌──────────────┐
         │     │ Refund User  │
         │     │ Suspense     │
         │     │ Account      │
         │     └──┬───────────┘
         │        │
         │        ▼
         │     END(X)
         │
         ▼
┌──────────────────────────────┐
│ Create Booking Record        │
│ Status: CONFIRMED            │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Send Confirmation Email      │
│ Send Confirmation SMS        │
│ Send In-App Notification     │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Notify Driver of Booking     │
│ Share Passenger Details      │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Add Payment to Wallet        │
│ (to be settled to driver)    │
└────────┬─────────────────────┘
         │
         ▼
      ┌────────┐
      │ END(✓) │
      └────────┘
```

---

## 5. Emergency SOS Flow

```
START
  │
  ▼
┌──────────────────────────┐
│ User in Ride              │
│ Feels Unsafe              │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ User Presses SOS Button  │
│ (5-second hold)          │
└────────┬─────────────────┘
         │
         ▼
┌──────────────────────────┐
│ Show Confirmation        │
│ Countdown: 3 seconds     │
└────────┬──────┬──────────┘
         │      │
      Confirm Cancel
         │      │
         │      ▼
         │   ┌────────────┐
         │   │ SOS Aborted│
         │   └────────────┘
         │
         ▼
┌──────────────────────────────┐
│ SOS TRIGGERED               │
│ Immediate Actions:          │
│ 1. Record GPS Location      │
│ 2. Start Audio Recording    │
│ 3. Take Ride Screenshot     │
│ 4. Log Timestamp            │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Send Notifications to:       │
│ - All Emergency Contacts    │
│ - App Admin/Support Team    │
│ - Police (if configured)    │
└────────┬─────────────────────┘
         │
         ├──────────────┬─────────────┬───────────┐
         │              │             │           │
         ▼              ▼             ▼           ▼
    Emergency      Admin          Police       Contact
    Contact        Alert          Alert        Notified
         │              │             │           │
         └──────┬───────┴─────┬───────┴───────────┘
                │             │
                ▼             ▼
         ┌─────────────┐ ┌──────────────┐
         │ Notification│ │ Real-time    │
         │ with Location│ │ Dashboard    │
         │ Link        │ │ Alert        │
         └─────────────┘ └──────────────┘
                │             │
                ▼             ▼
         ┌────────────────────────────────┐
         │ User Options:                  │
         │ 1. Call Emergency Contact      │
         │ 2. Text Support Team           │
         │ 3. Keep App Open (Help Active) │
         │ 4. Call Police Directly        │
         └────────┬───────────────────────┘
                  │
         ┌────────┴──────────┬──────────────┐
         │                   │              │
         ▼                   ▼              ▼
    Call Made           Chat Open       Police Called
         │                  │              │
         │                  ▼              │
         │          ┌──────────────┐      │
         │          │ Real-time    │      │
         │          │ Support Chat │      │
         │          │ with Admin   │      │
         │          └──────────────┘      │
         │                  │              │
         ▼                  ▼              ▼
    ┌──────────────────────────────────────┐
    │ Admin Monitors SOS in Dashboard:     │
    │ - Live Location                      │
    │ - Ride Details                       │
    │ - Other Party Info                   │
    │ - Can Call Driver/Rider              │
    │ - Can Dispatch Help                  │
    │ - Can Share with Police              │
    └────────┬─────────────────────────────┘
             │
             ▼
    ┌──────────────────────────────────────┐
    │ Resolution:                          │
    │ - Help Arrives                       │
    │ - User Confirms Safety               │
    │ - False Alarm Dismissed              │
    │ - Situation Resolved                 │
    └────────┬─────────────────────────────┘
             │
             ▼
    ┌──────────────────────────────────────┐
    │ SOS Incident Logged:                 │
    │ - Full Details                       │
    │ - All Records                        │
    │ - Audio/Video (if available)         │
    │ - Timeline                           │
    │ - Admin Notes                        │
    └────────┬─────────────────────────────┘
             │
             ▼
           END
```

---

## 6. Ride Completion & Rating Flow

```
START (Driver Reaches Dropoff)
  │
  ▼
┌──────────────────────────────┐
│ Driver Confirms Arrival      │
│ Passenger Gets Notification  │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Passenger Exits Vehicle      │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────┐
│ Driver Marks Ride Complete   │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Calculate Final Fare:            │
│ - Base Fare                      │
│ - Distance (km)                  │
│ - Time (mins)                    │
│ - Surge (if applicable)          │
│ - Tolls/Extras                   │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Compare with Pre-authorized      │
│ Amount                           │
└────────┬──────────┬──────────────┘
         │          │
    Actual≤  Actual>
    Pre-auth Pre-auth
         │          │
         ▼          ▼
    Auto-charge  Request
    Difference   Additional
    Refunded     Payment
         │          │
         │          ▼
         │      ┌──────────────┐
         │      │ Show Rider   │
         │      │ Additional   │
         │      │ Amount       │
         │      └──┬───────────┘
         │         │
         │         ▼
         │      ┌──────────────┐
         │      │ Rider Pays   │
         │      │ or           │
         │      │ Disputes     │
         │      └──┬───────────┘
         │         │
         └────┬────┘
              │
              ▼
┌──────────────────────────────────┐
│ Payment Processed               │
│ Receipt Generated               │
│ Sent to Both Parties            │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Show In-App Rating Prompt:       │
│ - Star Rating (1-5)              │
│ - Optional Review                │
│ - Categories:                    │
│   * Cleanliness                  │
│   * Driving                      │
│   * Politeness                   │
│   * Communication                │
│ - Safety Rating (separate)       │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ User Rates (or Skip for Later)   │
└────────┬──────┬──────────────────┘
         │      │
      Rate   Skip
         │      │
         ▼      │
    ┌───────────┘
    │
    ▼
┌──────────────────────────────────┐
│ Validate Review:                 │
│ - Check for Profanity            │
│ - Check Authenticity             │
│ - Flag Suspicious Patterns       │
│ - Fraud Detection                │
└────────┬──────┬──────────────────┘
         │      │
      Valid   Suspicious
         │      │
         │      ▼
         │   ┌──────────────┐
         │   │ Admin Review │
         │   │ (Can Filter) │
         │   └──┬───────────┘
         │      │
         └──────┘
              │
              ▼
┌──────────────────────────────────┐
│ Publish Review                   │
│ Update User Ratings:             │
│ - New Average Rating             │
│ - Rating Count                   │
│ - Safety Score                   │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Notify Rated User                │
│ of New Rating                    │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Ride Status: COMPLETED           │
│ Add to User History              │
│ Update Stats                     │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Credit Driver:                   │
│ - Base Commission (80-90%)        │
│ - Settled to Bank/Wallet         │
│ - After 24 hour hold             │
└────────┬─────────────────────────┘
         │
         ▼
      ┌────────┐
      │ END(✓) │
      └────────┘
```

---

## 7. Real-Time Location Tracking Flow

```
START (Ride Confirmed)
  │
  ▼
┌──────────────────────────────────────┐
│ 30 Min Before Pickup:                │
│ System Starts Driver Location Track  │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Every 5 Seconds:                     │
│ - Get Driver GPS Location            │
│ - Save to Database                   │
│ - Update Redis Cache                 │
│ - Send to Rider (WebSocket)          │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Rider Sees:                          │
│ - Driver Icon on Map                 │
│ - Distance to Pickup (km)            │
│ - ETA (mins)                         │
│ - Driver Current Speed               │
│ - Direction of Travel                │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Driver Milestones:                   │
│                                      │
│ Check: Is Distance < 5km?            │
└────────┬──────┬──────────────────────┘
         │      │
        YES     NO
         │      │
         ▼      │
    ┌─────────────────────────────────┐
    │ Notify: "Driver is 5km away"    │
    │ Suggested Pickup Time in 15min  │
    └──┬──────────────────────────────┘
       │
       ▼ (Continue tracking every 5 sec)

┌──────────────────────────────────────┐
│ Check: Is Distance < 1km?            │
└────────┬──────┬──────────────────────┘
         │      │
        YES     NO
         │      │
         ▼      │
    ┌─────────────────────────────────┐
    │ Notify: "Driver is 1km away"    │
    │ ETA in 5 minutes                │
    │ Be Ready at Pickup Point        │
    └──┬──────────────────────────────┘
       │
       ▼ (Continue tracking)

┌──────────────────────────────────────┐
│ Check: Speed ~= 0 AND Distance < 500m?
└────────┬──────┬──────────────────────┘
         │      │
        YES     NO
         │      │
         ▼      │
    ┌──────────────────────────────────┐
    │ Notify: "Driver Has Arrived!"   │
    │ Driver is waiting at pickup     │
    │ Please come down                │
    └──┬───────────────────────────────┘
       │
       ▼

┌──────────────────────────────────────┐
│ Driver Waiting at Pickup:            │
│ - Maximum wait: 10 minutes           │
│ - After 10 min: Charge waiting fees  │
│ - After 15 min: Can cancel           │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Rider Gets in Vehicle                │
│ Driver Confirms Passenger Seated     │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Driver Starts Route to Dropoff       │
│ Continue Real-time Tracking:         │
│ - Updated location every 5 sec       │
│ - Route shown on map                 │
│ - Real-time ETAssistant at destination
│ - Monitor for route deviations       │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Check: Significant Route Deviation?  │
└────────┬──────┬──────────────────────┘
         │      │
        YES     NO
         │      │
         ▼      │
    ┌─────────────────────────────────┐
    │ Alert Rider:                    │
    │ "Driver took detour"            │
    │ ETA Extended by X mins          │
    │ Reason: Traffic/Construction    │
    └─────────────────────────────────┘
         │
         ├────────────┬─────────────────┐
         │            │                 │
      Informed       Accept          Alert SOS
         │            │                 │
         │            │                 ▼
         │            │            ┌──────────┐
         │            │            │ SOS Flow │
         │            │            └──────────┘
         │            │
         └────────────┘
              │
              ▼
┌──────────────────────────────────────┐
│ Driver Approaches Dropoff:           │
│ Check: Distance < 500m from dest?    │
└────────┬──────┬──────────────────────┘
         │      │
        YES     NO
         │      │
         ▼      │
    ┌─────────────────────────────────┐
    │ Notify: "Arriving Soon"         │
    │ Final ETA: 3-5 minutes          │
    └─────────────────────────────────┘
              │
              └────────────────┐
                               │
                ... continue tracking...
                               │
                               ▼
┌──────────────────────────────────────┐
│ Driver Reaches Dropoff Location      │
│ Speed ~= 0                           │
└────────┬─────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────┐
│ Stop Real-time Tracking              │
│ Save Final Location Data             │
│ Mark Ride Complete                   │
│ Proceed to Payment & Rating Flow     │
└────────┬─────────────────────────────┘
         │
         ▼
      ┌────────┐
      │ END(✓) │
      └────────┘
```

---

## 8. Fraud Detection Flow

```
START (User Initiates Transaction)
  │
  ▼
┌──────────────────────────────┐
│ Transaction Logged           │
│ - Type (Booking/Payment)     │
│ - User ID                    │
│ - Amount                     │
│ - Location/IP                │
│ - Timestamp                  │
└────────┬─────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ ML Fraud Detection Model:        │
│ Analyze Machine Learning Model   │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Check Fraud Indicators:          │
│ 1. Multiple Failed Bookings      │
│ 2. Unusual Payment Patterns      │
│ 3. Location/IP Anomalies        │
│ 4. Low-Rated Account Activity   │
│ 5. High Refund Requests         │
│ 6. Velocity Checks              │
│ 7. Device Fingerprinting        │
│ 8. Network Analysis             │
└────────┬─────────────────────────┘
         │
         ▼
┌──────────────────────────────────┐
│ Calculate Fraud Score            │
│ (0-100)                          │
└────────┬──┬──┬──────────────────┘
         │  │  │
    LOW  │  │  HIGH
  (0-30) │  │  (70-100)
         │  │
    MEDIUM   │
    (30-70)  │
         │   │
         ▼   ▼   ▼
    ┌────┬──┬──┬────┐
    │    │  │  │    │
    ▼    ▼  ▼  ▼    ▼

┌──────────────────────────┐
│ Score 0-30               │
│ ALLOW TRANSACTION        │
│ - Normal Monitoring      │
│ - Log for Analytics      │
└──────────────────────────┘
              │
              ▼
          PROCEED

┌──────────────────────────────────┐
│ Score 30-70                      │
│ FLAG FOR REVIEW                  │
│ - Transaction Continues          │
│ - Marked "Under Review"          │
│ - Admin Notification             │
│ - Monitor Outcome                │
│ - Learn for Model                │
└──────────────────────────────────┘
              │
              ▼
          PROCEED
         (Monitored)

┌──────────────────────────────────┐
│ Score 70-100                     │
│ BLOCK TRANSACTION                │
│ - Deny Transaction               │
│ - Alert Admin                    │
│ - Alert Security Team            │
│ - Log Detailed Info              │
│ - Save for Investigation         │
└──────────────────────────────────┘
              │
              ▼
         BLOCKED

    ┌──────────┘
    │
    ▼
┌──────────────────────────────────┐
│ Admin Review Dashboard:          │
│ - See Flagged Transaction        │
│ - Review Evidence                │
│ - Check User History             │
│ - Make Decision:                 │
│   * Approve (Whitelist)          │
│   * Reject (Investigate)         │
│   * Contact User                 │
└────────┬─────────────────────────┘
         │
         ├─────────┬──────────────┐
         │         │              │
      Approve   Reject          Contact
         │         │              │
         ▼         ▼              ▼
    Whitelist  Investigate   Verify User
    Account    Account       (2FA/OTP)
         │         │              │
         │         │              ▼
         │         │          User
         │         │          Confirms
         │         │              │
         │         │              ▼
         │         │          ┌──────────┐
         │         │          │ ALLOW    │
         │         │          │ or       │
         │         │          │ BLOCK    │
         │         │          └──────────┘
         │         │
         ▼         ▼
    ┌──────────────────────┐
    │ Log All Actions      │
    │ Update ML Model      │
    │ Notify User          │
    │ Close Investigation  │
    └────────┬─────────────┘
             │
             ▼
          ┌────────┐
          │ END    │
          └────────┘
```

---

