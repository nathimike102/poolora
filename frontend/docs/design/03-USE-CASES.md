# Use Cases Document

## Smart Scheduled Car Pooling Platform

---

## 1. Overview

This document outlines detailed use cases for the car pooling platform, covering all user roles: Riders, Drivers, and Administrators.

---

## 2. Actor Definitions

### 2.1 Primary Actors

- **Rider**: User looking for a ride
- **Driver**: User offering rides in their vehicle
- **Admin**: Platform administrator managing the system

### 2.2 Secondary Actors

- **Payment Gateway**: Stripe Test Mode (Razorpay for production)
- **Map Service**: Mapbox Free Tier (Google Maps for production)
- **Notification Service**: Firebase FCM, Firebase Phone Auth (Twilio for production), Mailgun
- **AI/ML Service**: Intelligent matching and fraud detection system

---

## 3. Rider Use Cases

### UC-R01: Register as Rider

**Primary Actor**: Rider  
**Goal**: Create a new account on the platform  
**Preconditions**: User has a valid phone number  
**Postconditions**: User account is created and verified

**Main Success Scenario**:

1. User opens the mobile app
2. User selects "Sign Up"
3. User enters phone number
4. System sends OTP via SMS
5. User enters OTP
6. System verifies OTP
7. User enters profile information (name, email)
8. User uploads profile picture (optional)
9. System creates account
10. User is logged in automatically

**Extensions**:

- 4a. Invalid phone number: System shows error message
- 6a. Incorrect OTP: System allows 3 retry attempts
- 6b. OTP expired: User can request new OTP

**Business Rules**:

- Phone number must be unique
- OTP is valid for 5 minutes
- Maximum 3 OTP requests per hour per phone number

---

### UC-R02: Search for Rides

**Primary Actor**: Rider  
**Goal**: Find available rides matching travel requirements  
**Preconditions**: User is logged in  
**Postconditions**: List of matching rides is displayed

**Main Success Scenario**:

1. User navigates to "Search Rides" screen
2. User enters origin location
3. User enters destination location
4. User selects preferred date and time
5. User applies filters (optional):
   - Price range
   - Number of seats needed
   - Women-only rides
   - Driver rating
6. System queries available rides
7. AI service ranks rides by relevance
8. System displays matching rides with:
   - Driver information
   - Departure time
   - Price per seat
   - Available seats
   - Driver rating
   - Vehicle details
   - Route preview

**Extensions**:

- 6a. No rides found: System suggests alternative times or nearby locations
- 6b. Partial match: System shows rides with different times/routes

**Business Rules**:

- Search results within 50km radius of origin
- Time window: ±3 hours from selected time
- Maximum 20 results per search

---

### UC-R03: Request a Ride

**Primary Actor**: Rider  
**Goal**: Send booking request to a driver  
**Preconditions**: User has found a suitable ride  
**Postconditions**: Booking request is sent to driver

**Main Success Scenario**:

1. User selects a ride from search results
2. System displays detailed ride information
3. User reviews route, timing, and price
4. User selects number of seats (1-4)
5. User adds pickup location (can differ from search origin)
6. User adds message to driver (optional)
7. User confirms request
8. System creates pending booking
9. System sends notification to driver
10. System displays "Waiting for driver approval" status

**Extensions**:

- 3a. Not enough seats available: System shows available count
- 5a. Pickup location too far from route: System shows warning
- 7a. Ride already full: System shows error and updates availability

**Business Rules**:

- User can request maximum seats available
- Pickup location must be within 2km of ride route
- User can have maximum 3 pending requests simultaneously

---

### UC-R04: Make Payment for Ride

**Primary Actor**: Rider  
**Goal**: Complete payment for accepted ride request  
**Preconditions**: Driver has accepted the ride request  
**Postconditions**: Payment is processed and booking is confirmed

**Main Success Scenario**:

1. System notifies user of ride acceptance
2. User navigates to booking details
3. System displays payment breakdown:
   - Base fare
   - Platform fee
   - Total amount
4. User selects payment method:
   - Credit/Debit card
   - UPI
   - Wallet
   - Net banking
5. System initiates Stripe payment (Razorpay for production)
6. User completes payment on Stripe gateway (Razorpay for production)
7. Stripe sends payment confirmation (Razorpay for production)
8. System verifies payment
9. System updates booking status to "Confirmed"
10. System sends confirmation to user and driver
11. System generates receipt

**Extensions**:

- 6a. Payment fails: User can retry payment
- 6b. Payment timeout: System cancels booking after 15 minutes
- 8a. Payment verification fails: System initiates refund

**Business Rules**:

- Payment must be completed within 15 minutes of acceptance
- Failed payment cancels the booking
- Refund processed within 5-7 business days

---

### UC-R05: Track Active Ride

**Primary Actor**: Rider  
**Goal**: Monitor real-time location of driver during ride  
**Preconditions**: Ride is active (started)  
**Postconditions**: User can see driver's live location

**Main Success Scenario**:

1. User opens active ride details
2. System displays map view with:
   - Driver's current location (updated every 10 seconds)
   - Rider's current location
   - Planned route
   - ETA to pickup
   - Distance to pickup
3. User can see driver profile and vehicle details
4. User can contact driver via:
   - In-app chat
   - Phone call
5. User receives notifications for:
   - Driver approaching (5 mins away)
   - Driver arrived at pickup
   - Ride started
6. System alerts user if driver deviates from route

**Extensions**:

- 6a. Route deviation: System sends alert and asks driver for reason
- 2a. No network: System shows last known location

**Business Rules**:

- Location updates every 10 seconds during active ride
- Route deviation alert if >500m off planned route
- Automatic check-in prompts every 30 minutes for safety

---

### UC-R06: Rate and Review Driver

**Primary Actor**: Rider  
**Goal**: Provide feedback about ride experience  
**Preconditions**: Ride is completed  
**Postconditions**: Rating and review are submitted

**Main Success Scenario**:

1. Ride ends
2. System prompts user to rate the ride
3. User provides star rating (1-5) for:
   - Overall experience
   - Driver behavior
   - Vehicle cleanliness
   - Punctuality
4. User writes text review (optional)
5. User can report issues:
   - Safety concerns
   - Route problems
   - Payment issues
6. User submits feedback
7. System updates driver's rating
8. System sends thank you message
9. System stores review for admin moderation

**Extensions**:

- 5a. Safety issue reported: System immediately alerts admin
- 3a. User skips rating: System sends reminder after 24 hours

**Business Rules**:

- Rating can be submitted within 7 days of ride completion
- Reviews are public after admin approval
- Safety reports are private and prioritized

---

### UC-R07: Use SOS Emergency Feature

**Primary Actor**: Rider  
**Goal**: Alert emergency contacts and authorities in case of danger  
**Preconditions**: User is in an active ride  
**Postconditions**: Emergency alerts are sent

**Main Success Scenario**:

1. User presses SOS button in app
2. System asks for confirmation (3-second hold)
3. User confirms by holding button
4. System immediately:
   - Captures current GPS location
   - Starts continuous location tracking (every 5 seconds)
   - Records ride data (driver info, route, time)
5. System sends emergency alerts to:
   - Pre-configured emergency contacts (SMS + notification)
   - Platform admin team
   - Local authorities (if configured)
6. Alert includes:
   - User's name and photo
   - Current location (live link)
   - Driver details
   - Vehicle information
   - Ride route
7. System enables automatic call recording (if permitted)
8. System keeps tracking until emergency is resolved
9. Admin contacts user and driver separately
10. System logs full incident details

**Extensions**:

- 3a. Accidental trigger: User can cancel within 10 seconds
- 5a. No network: System queues alerts and sends when connected
- 9a. User doesn't respond: Admin escalates to authorities

**Business Rules**:

- SOS button is always visible during active ride
- Emergency contacts must be configured beforehand
- Incident data is preserved for 30 days minimum
- False SOS triggers are tracked (>3 false triggers = warning)

---

### UC-R08: Share Live Trip with Contacts

**Primary Actor**: Rider  
**Goal**: Share live ride tracking with trusted contacts  
**Preconditions**: Ride is active or upcoming  
**Postconditions**: Selected contacts receive tracking link

**Main Success Scenario**:

1. User opens ride details
2. User selects "Share Trip"
3. User selects sharing method:
   - SMS
   - WhatsApp
   - Email
   - In-app contact list
4. User selects recipient contacts
5. System generates secure tracking link (valid for ride duration)
6. System sends link to selected contacts
7. Recipients can view:
   - Live driver location
   - Rider's current location (if sharing enabled)
   - Planned route
   - ETA
   - Driver and vehicle details
8. Link auto-expires when ride completes

**Extensions**:

- 5a. Recipient views link: System logs access
- 7a. Ride ends: Link shows "Ride Completed"

**Business Rules**:

- Tracking link is unique and secure (random token)
- Link expires 1 hour after ride completion
- Maximum 5 contacts per ride
- No login required to view shared ride

---

### UC-R09: Cancel Ride Request/Booking

**Primary Actor**: Rider  
**Goal**: Cancel a pending request or confirmed booking  
**Preconditions**: User has an active request or booking  
**Postconditions**: Request/booking is cancelled

**Main Success Scenario**:

1. User navigates to active bookings
2. User selects booking to cancel
3. System displays cancellation policy:
   - Free cancellation (if >24 hours before ride)
   - 50% refund (12-24 hours before)
   - 25% refund (6-12 hours before)
   - No refund (<6 hours before)
4. User selects cancellation reason:
   - Change of plans
   - Found another ride
   - Driver concerns
   - Other
5. User confirms cancellation
6. System processes cancellation:
   - Updates booking status
   - Initiates refund (if applicable)
   - Frees up seat in ride
   - Notifies driver
7. System sends cancellation confirmation

**Extensions**:

- 6a. Refund initiated: Expected in 5-7 business days
- 4a. Driver-related issue: Admin reviews for full refund

**Business Rules**:

- Refund amount based on time before departure
- Multiple cancellations affect user reputation
- Driver can dispute cancellation reason
- Platform fee is non-refundable

---

### UC-R10: Manage Emergency Contacts

**Primary Actor**: Rider  
**Goal**: Add/edit emergency contacts for safety features  
**Preconditions**: User is logged in  
**Postconditions**: Emergency contacts are saved

**Main Success Scenario**:

1. User navigates to Settings → Safety
2. User selects "Emergency Contacts"
3. User adds new contact:
   - Name
   - Relationship
   - Phone number
   - Email (optional)
4. User sets contact priority (Primary/Secondary)
5. System validates phone number
6. System sends verification SMS to contact
7. Contact confirms via SMS
8. System saves verified contact
9. User can add up to 3 emergency contacts

**Extensions**:

- 6a. Invalid number: System shows error
- 7a. Contact doesn't verify: Marked as unverified (still usable)

**Business Rules**:

- Minimum 1 emergency contact recommended
- Maximum 3 emergency contacts
- Verification improves contact reliability
- User controls which contacts get SOS alerts

---

## 4. Driver Use Cases

### UC-D01: Register as Driver

**Primary Actor**: Driver  
**Goal**: Create driver account and get verified  
**Preconditions**: User has valid documents  
**Postconditions**: Driver account created and pending verification

**Main Success Scenario**:

1. User selects "Sign Up as Driver"
2. User completes basic registration (phone OTP)
3. User enters personal information
4. User uploads required documents:
   - Driver's license (front & back)
   - Vehicle registration
   - Vehicle insurance
   - Government ID (Aadhaar/PAN)
   - Profile photo
5. User enters vehicle details:
   - Make and model
   - Year
   - Color
   - License plate number
   - Number of seats
6. System validates document format
7. System submits for admin review
8. Admin reviews documents (24-48 hours)
9. Admin approves/rejects application
10. System notifies user of verification status
11. Approved drivers can start posting rides

**Extensions**:

- 6a. Invalid document: System requests re-upload
- 9a. Rejection: System provides reasons and re-application option
- 4a. Multiple vehicles: Driver can add up to 3 vehicles

**Business Rules**:

- License must be valid for >6 months
- Vehicle <15 years old
- Comprehensive insurance required
- Background check completed for safety certification

---

### UC-D02: Create a Ride

**Primary Actor**: Driver  
**Goal**: Post a scheduled ride for riders to book  
**Preconditions**: Driver is verified and logged in  
**Postconditions**: Ride is published and searchable

**Main Success Scenario**:

1. Driver navigates to "Create Ride"
2. Driver enters ride details:
   - Origin location (auto-detect or manual)
   - Destination location
   - Departure date and time
   - Return trip (optional - creates 2 rides)
3. Driver selects vehicle (if multiple registered)
4. Driver sets number of available seats (1-7)
5. Driver sets price per seat
6. System calculates suggested price based on:
   - Distance
   - Fuel costs
   - Time of day
   - Demand
7. Driver can adjust price (±30% of suggested)
8. Driver adds ride preferences:
   - Women-only (for female drivers)
   - Non-smoking
   - Baggage allowed
   - Music preference
   - AC/Non-AC
9. Driver can add waypoints/stops
10. System validates route and shows preview
11. Driver confirms and publishes ride
12. System makes ride searchable
13. System sends confirmation to driver

**Extensions**:

- 6a. Surge pricing active: System shows +20-50% pricing
- 10a. Route too long (>500km): System shows warning
- 11a. Driver has <3.5 rating: Ride requires admin approval

**Business Rules**:

- Ride must be created at least 2 hours in advance
- Maximum 300km per ride (for safety)
- Price between ₹2-₹15 per km per person
- Driver can have maximum 5 active future rides
- Ride auto-cancels if no bookings 1 hour before departure

---

### UC-D03: Manage Ride Requests

**Primary Actor**: Driver  
**Goal**: Review and respond to rider booking requests  
**Preconditions**: Driver has published ride with requests  
**Postconditions**: Requests are accepted or rejected

**Main Success Scenario**:

1. System notifies driver of new request
2. Driver opens ride requests
3. For each request, driver sees:
   - Rider profile and rating
   - Number of seats requested
   - Pickup location
   - Additional message from rider
   - Rider verification status
4. Driver reviews rider profile:
   - Previous rides
   - Ratings and reviews
   - Verification badges
5. Driver can:
   - Accept request
   - Reject request (with optional reason)
   - Counter-propose different pickup point
6. If accepting:
   - System updates available seats
   - Notifies rider to complete payment
   - Adds rider to passenger list
7. If rejecting:
   - System notifies rider
   - Seat remains available
8. System re-ranks ride in search results

**Extensions**:

- 5a. Accept reaches seat limit: Other pending requests auto-rejected
- 6a. Rider doesn't pay within 15 mins: Booking auto-cancelled
- 5b. Multiple simultaneous requests: First-come-first-served

**Business Rules**:

- Driver must respond within 6 hours
- After 6 hours, request auto-expires
- Driver can set auto-accept criteria in settings
- Rejection rate affects driver ranking

---

### UC-D04: Start and Complete Ride

**Primary Actor**: Driver  
**Goal**: Conduct the ride from start to completion  
**Preconditions**: Ride has confirmed bookings  
**Postconditions**: Ride is completed and payment is settled

**Main Success Scenario**:

1. Day of ride: Driver receives reminder notification (2 hours before)
2. 30 minutes before: Driver marks "Ready to Start"
3. System notifies all passengers
4. Driver arrives at first pickup point
5. Driver marks passenger as "Picked Up"
6. System updates ETA for remaining passengers
7. Driver picks up all passengers sequentially
8. Driver starts ride (all passengers picked up)
9. System begins:
   - Real-time location tracking
   - Route monitoring
   - Periodic safety check-ins
10. Driver follows optimized route
11. Driver drops passengers at destinations
12. Driver marks each drop-off complete
13. After last drop-off, driver ends ride
14. System calculates final distance/time
15. System releases payment to driver (minus platform fee)
16. Driver can view ride summary and earnings

**Extensions**:

- 7a. Passenger no-show: Driver waits 10 mins, then reports
- 7b. Passenger cancels late: Driver receives cancellation fee
- 9a. Route deviation: System alerts passengers (if >500m off route)
- 10a. Emergency SOS: System assists and logs incident
- 14a. Route significantly different: System recalculates fare

**Business Rules**:

- Wait time for pickup: 10 minutes maximum
- No-show: 100% cancellation fee to driver
- Route deviation >1km: Requires driver explanation
- Platform commission: 15-20% of ride fare
- Payment settlement: T+2 days to driver's account

---

### UC-D05: Navigate with Real-time Tracking

**Primary Actor**: Driver  
**Goal**: Navigate route while sharing location with passengers  
**Preconditions**: Ride is active  
**Postconditions**: Driver completes route with navigation assistance

**Main Success Scenario**:

1. Driver starts ride
2. System activates integrated navigation
3. Driver sees:
   - Turn-by-turn directions
   - Traffic conditions (real-time)
   - Optimized pickup sequence
   - ETA to each stop
   - Alternative routes (if traffic)
4. System continuously:
   - Tracks GPS location
   - Updates passenger ETAs
   - Monitors route adherence
   - Suggests route changes for traffic
5. Driver receives alerts for:
   - Upcoming turn
   - Pickup point approaching
   - Traffic delays
   - Route deviation
6. Passengers can see driver location live
7. System logs complete route data
8. Driver completes navigation at final destination

**Extensions**:

- 4a. Heavy traffic: System suggests alternate route
- 5a. Driver deviates: System asks for confirmation
- 6a. GPS signal lost: System shows last known location

**Business Rules**:

- Location updates every 10 seconds
- Route deviation tolerance: 500m
- Alternative routes suggested if saves >10 minutes
- Navigation data stored for dispute resolution

---

### UC-D06: Communicate with Passengers

**Primary Actor**: Driver  
**Goal**: Coordinate with passengers via chat or calls  
**Preconditions**: Ride has confirmed bookings  
**Postconditions**: Communication is logged

**Main Success Scenario**:

1. Driver opens ride details
2. Driver selects passenger to contact
3. Driver chooses communication method:
   a. **In-app Chat**:
   - Send text messages
   - Share location pin
   - Send preset messages ("On my way", "Delayed 5 mins")
   - Share route updates
     b. **Voice Call**:
   - System initiates masked call (privacy)
   - Call duration logged
   - Call recording (if enabled for safety)
4. Passenger receives message/call notification
5. Conversation is logged in system
6. Driver can broadcast message to all passengers
7. System filters inappropriate content

**Extensions**:

- 3a. Passenger doesn't respond: Driver can report concern
- 7a. Inappropriate message: System flags for review
- 3b. Emergency: Unmasked direct call enabled

**Business Rules**:

- Chat history maintained for 30 days
- Phone numbers are masked for privacy
- Abusive language triggers automatic alert
- Messages reviewed for safety compliance

---

### UC-D07: Handle Passenger No-show

**Primary Actor**: Driver  
**Goal**: Report and handle passenger who doesn't show up  
**Preconditions**: Driver arrived at pickup, passenger not present  
**Postconditions**: No-show is documented and handled

**Main Success Scenario**:

1. Driver arrives at pickup location
2. Driver marks "Arrived" in app
3. System notifies passenger of arrival
4. Driver waits for passenger
5. Timer starts automatically (10 minutes)
6. Driver attempts to contact passenger:
   - In-app message
   - Phone call
7. Passenger doesn't arrive within 10 minutes
8. Driver reports "Passenger No-show"
9. System prompts driver to:
   - Upload photo of pickup location (proof)
   - Add notes (optional)
10. Driver confirms no-show report
11. System:
    - Marks passenger as no-show
    - Charges passenger full cancellation fee
    - Credits driver for time lost
    - Updates passenger's reliability score
12. Driver proceeds with remaining passengers

**Extensions**:

- 7a. Passenger arrives within 10 mins: Ride continues normally
- 7b. Passenger explains delay: Driver can extend wait (max +5 mins)
- 9a. Second no-show by same passenger: Account flagged

**Business Rules**:

- Standard wait time: 10 minutes
- No-show fee: 100% of booking amount
- Payment to driver: 80% of fare (platform keeps 20%)
- 3+ no-shows in 30 days: Temporary account suspension

---

### UC-D08: Modify or Cancel Published Ride

**Primary Actor**: Driver  
**Goal**: Change ride details or cancel the ride  
**Preconditions**: Driver has published ride  
**Postconditions**: Ride is updated or cancelled

**Main Success Scenario**:

1. Driver opens active rides
2. Driver selects ride to modify
3. **If modifying**:
   a. Driver can change:
   - Departure time (±2 hours)
   - Available seats (if increasing only)
   - Price (±20% if no bookings, fixed if bookings exist)
     b. System validates changes
     c. System notifies all confirmed passengers
     d. Passengers can accept or cancel
4. **If cancelling**:
   a. System shows booking count and consequences
   b. Driver selects cancellation reason:
   - Vehicle issue
   - Personal emergency
   - Route not feasible
   - Other
     c. Driver confirms cancellation
     d. System processes:
   - Full refund to all passengers
   - Penalty to driver (if <24 hours notice)
   - Notification to all passengers
     e. System updates driver's cancellation rate

**Extensions**:

- 3a. Major time change: Passengers auto-notified, can cancel free
- 4d. Frequent cancellations: Driver account reviewed/suspended
- 4d. Valid emergency: Penalty waived (requires proof)

**Business Rules**:

- Modifications allowed until 4 hours before departure
- Cancellations:
  - > 24 hours: No penalty
  - 12-24 hours: Driver rating impact
  - <12 hours: ₹500 penalty + rating impact
- Cancellation rate >20% triggers account review
- 3+ cancellations in month: Temporary suspension

---

### UC-D09: View Earnings and Analytics

**Primary Actor**: Driver  
**Goal**: Track earnings and ride statistics  
**Preconditions**: Driver is logged in  
**Postconditions**: Earnings dashboard displayed

**Main Success Scenario**:

1. Driver navigates to "Earnings" section
2. System displays comprehensive dashboard:
   a. **Financial Summary**:
   - Today's earnings
   - This week's earnings
   - This month's earnings
   - Total lifetime earnings
   - Pending settlements
   - Next payout date
     b. **Ride Statistics**:
   - Total rides completed
   - Total distance covered
   - Average rating
   - Acceptance rate
   - Cancellation rate
   - On-time percentage
     c. **Performance Metrics**:
   - Trending up/down indicators
   - Comparison with previous period
   - Leaderboard position (optional)
     d. **Transaction History**:
   - Completed rides with earnings
   - Platform fees deducted
   - Refunds processed
   - Bonus/incentives earned
3. Driver can filter data by:
   - Date range
   - Ride type
   - Route
4. Driver can download:
   - Earnings report (PDF/Excel)
   - Tax statement
   - Ride history
5. Driver sees upcoming scheduled rides and potential earnings

**Extensions**:

- 2d. Bonus available: System highlights achievement criteria
- 4a. Tax season: System generates annual tax summary

**Business Rules**:

- Payouts processed every Friday
- Minimum payout threshold: ₹500
- Platform fee: 15-20% based on driver tier
- Bonuses for high-rated drivers (>4.7)
- TDS deducted for earnings >₹2.5L annually

---

### UC-D10: Achieve Verified Driver Status

**Primary Actor**: Driver  
**Goal**: Get enhanced verification for safety and trust  
**Preconditions**: Driver has completed >10 rides with >4.5 rating  
**Postconditions**: Driver receives verified badge

**Main Success Scenario**:

1. System notifies driver of eligibility
2. Driver applies for verified status
3. System requires additional verification:
   - Police background check consent
   - Advanced driver training certificate (optional)
   - Vehicle inspection certificate
   - Reference from 3 previous passengers
4. Driver submits documents
5. System initiates:
   - Background verification (via third party)
   - Document validation
   - Reference checks
6. Process takes 5-7 business days
7. Upon approval:
   - Driver receives "Verified" badge
   - Profile gets priority in searches
   - Access to premium features
   - Higher earnings potential
8. System announces achievement

**Extensions**:

- 6a. Verification fails: Driver notified with reasons
- 7a. Annual re-verification required

**Business Rules**:

- Eligibility: >10 rides, >4.5 rating, zero safety incidents
- Background check valid for 1 year
- Verified drivers can charge 10-15% premium
- Loss of verification if rating drops <4.0

---

## 5. Admin Use Cases

### UC-A01: Review and Approve Driver Applications

**Primary Actor**: Admin  
**Goal**: Verify driver documents and approve/reject applications  
**Preconditions**: Admin is logged into dashboard  
**Postconditions**: Driver application status updated

**Main Success Scenario**:

1. Admin navigates to "Pending Driver Applications"
2. System displays list of applications with:
   - Submission date
   - Applicant name
   - Document status
   - Risk indicators
3. Admin selects application to review
4. Admin verifies documents:
   - Driver's license (validity, authenticity)
   - Vehicle registration (matches details)
   - Insurance (active and comprehensive)
   - Government ID (matches applicant)
   - Background check results (if available)
5. Admin checks for red flags:
   - Expired documents
   - Mismatched information
   - Poor quality images
   - Criminal record
6. Admin makes decision:
   a. **Approve**:
   - System activates driver account
   - Sends welcome email with guidelines
   - Driver can start posting rides
     b. **Reject**:
   - System marks application as rejected
   - Admin provides rejection reasons
   - Option to reapply with correct documents
     c. **Request clarification**:
   - Admin flags specific documents
   - Driver notified to re-upload
7. System logs admin decision with timestamp

**Extensions**:

- 4a. Document verification API: Auto-validate where possible
- 5a. Serious concern: Escalate to senior admin
- 6b. Appeal process: Rejected drivers can appeal

**Business Rules**:

- Applications reviewed within 48 hours
- License must have >6 months validity
- Vehicle age <15 years
- Zero tolerance for fake documents
- Appeals reviewed within 72 hours

---

### UC-A02: Monitor Platform Activity

**Primary Actor**: Admin  
**Goal**: Oversee platform operations and identify issues  
**Preconditions**: Admin is logged in  
**Postconditions**: Platform health status known

**Main Success Scenario**:

1. Admin opens main dashboard
2. System displays real-time metrics:
   a. **User Metrics**:
   - Active users (current hour)
   - New registrations (today/week)
   - Driver/rider ratio
   - Verified vs unverified users
     b. **Ride Metrics**:
   - Active rides (live)
   - Rides created (today)
   - Rides completed (today)
   - Cancellation rate
   - Average ride occupancy
     c. **Financial Metrics**:
   - Revenue (today/week/month)
   - Transaction volume
   - Pending settlements
   - Refund requests
     d. **System Health**:
   - API response times
   - Error rates
   - Server load
   - Database performance
     e. **Safety Metrics**:
   - Active SOS alerts
   - Pending safety reports
   - Blocked users
   - Fraud attempts detected
3. Admin can drill down into any metric
4. System highlights anomalies:
   - Unusual spike in cancellations
   - Sudden drop in bookings
   - High error rates
   - Multiple fraud attempts
5. Admin can set custom alerts
6. System generates daily summary report

**Extensions**:

- 4a. Critical alert: Immediate notification to admin
- 2e. Active SOS: Red alert ticker on dashboard

**Business Rules**:

- Dashboard updates every 30 seconds
- Historical data retained for 2 years
- Anomaly detection uses ML models
- Critical alerts sent via SMS + Email

---

### UC-A03: Handle Safety Incidents and SOS Alerts

**Primary Actor**: Admin  
**Goal**: Respond to and resolve safety emergencies  
**Preconditions**: SOS alert has been triggered  
**Postconditions**: Incident is resolved and documented

**Main Success Scenario**:

1. System receives SOS alert
2. Admin dashboard shows:
   - High-priority red alert
   - Alert sound/visual notification
   - User details (photo, name, phone)
   - Driver details
   - Real-time location
   - Ride details
3. Admin immediately:
   a. Calls rider to assess situation
   b. Calls driver separately
   c. Monitors live location
4. Based on severity, admin:
   - **Low Severity** (false alarm):
     - Logs incident
     - Continues monitoring
   - **Medium Severity** (concern but no immediate danger):
     - Contacts emergency contacts
     - Continues active monitoring
     - Prepares intervention
   - **High Severity** (immediate danger):
     - Contacts local police
     - Alerts emergency contacts
     - Shares live location with authorities
     - Dispatches support team (if available)
5. Admin documents:
   - Time of alert
   - Actions taken
   - Communications log
   - Resolution details
6. Follow-up actions:
   - Contact user after incident
   - Investigate driver (suspend if needed)
   - File incident report
   - Provide support resources
7. System flags accounts for review

**Extensions**:

- 3a. User unreachable: Escalate immediately to authorities
- 4a. Recurring false alarms: User warned/educated
- 7a. Driver at fault: Immediate suspension

**Business Rules**:

- SOS alerts are highest priority
- Response required within 5 minutes
- All calls recorded
- Incident data preserved indefinitely
- Driver suspended pending investigation
- User offered counseling/support

---

### UC-A04: Resolve Disputes

**Primary Actor**: Admin  
**Goal**: Mediate and resolve conflicts between drivers and riders  
**Preconditions**: Dispute has been raised  
**Postconditions**: Dispute is resolved with decision logged

**Main Success Scenario**:

1. Dispute is submitted by driver or rider
2. Admin sees dispute details:
   - Parties involved
   - Ride details
   - Dispute category:
     - Payment issue
     - Cancellation disagreement
     - Behavior complaint
     - Route/time deviation
     - Service quality
   - Evidence provided:
     - Screenshots
     - Messages
     - GPS logs
     - Ratings
3. Admin reviews all evidence:
   - Chat history
   - Location data
   - Payment records
   - Previous complaints
   - User history
4. Admin contacts both parties separately
5. Admin analyzes case:
   - Who is at fault
   - Severity of issue
   - Previous behavior patterns
6. Admin makes decision:
   - **In favor of rider**:
     - Issue refund (full/partial)
     - Issue warning to driver
     - Compensate rider
   - **In favor of driver**:
     - No refund
     - Issue warning to rider
     - Compensate driver
   - **Both at fault**:
     - Partial refunds
     - Warnings to both
     - Mediated settlement
7. Admin documents decision with justification
8. System executes decision (refunds, warnings)
9. Both parties notified of resolution
10. Case closed and archived

**Extensions**:

- 6a. Serious violation: Account suspension
- 9a. Party disagrees: Escalation to senior admin
- 5a. Pattern of abuse: Account termination

**Business Rules**:

- Disputes resolved within 48-72 hours
- Decisions are final unless escalated
- Repeated offenders face stricter penalties
- Evidence older than 7 days may not be considered
- Refund processed within 5 business days

---

### UC-A05: Manage User Accounts

**Primary Actor**: Admin  
**Goal**: Control user accounts and enforce policies  
**Preconditions**: Admin has appropriate permissions  
**Postconditions**: User account status updated

**Main Success Scenario**:

1. Admin searches for user account
2. System displays user profile:
   - Personal information
   - Account status (active/suspended/blocked)
   - Verification status
   - Ride history
   - Ratings and reviews
   - Violations and warnings
   - Payment history
3. Admin can perform actions:
   a. **Suspend Account**:
   - Temporary suspension (specify duration)
   - Reason required
   - User notified
   - Cannot post/book rides during suspension
     b. **Block Account**:
   - Permanent ban
   - Serious violations only
   - Detailed justification required
   - Senior admin approval needed
     c. **Reset Password**:
   - User requests via support
   - Verify identity
   - Send reset link
     d. **Edit Profile**:
   - Correct errors
   - Update contact info
   - Merge duplicate accounts
     e. **Reverify Driver**:
   - Re-check documents
   - Trigger new verification
4. Admin adds internal notes
5. System logs all admin actions
6. User notified of changes (if applicable)

**Extensions**:

- 3b. Block requires senior approval: Escalation workflow
- 3a. User appeals suspension: Review process triggered

**Business Rules**:

- All actions require justification
- Suspensions: 7/15/30 days or indefinite
- Blocked users cannot create new accounts (device/phone flagged)
- Admin actions audited monthly
- Users can appeal within 30 days

---

### UC-A06: Generate Reports and Analytics

**Primary Actor**: Admin  
**Goal**: Create insights and reports for business decisions  
**Preconditions**: Admin has reporting access  
**Postconditions**: Report is generated and available

**Main Success Scenario**:

1. Admin navigates to Reports section
2. Admin selects report type:
   a. **User Reports**:
   - User growth over time
   - User demographics
   - Active vs inactive users
   - User retention rates
     b. **Ride Reports**:
   - Rides per day/week/month
   - Popular routes
   - Peak hours analysis
   - Average ride distance
   - Occupancy rates
     c. **Financial Reports**:
   - Revenue breakdown
   - Commission earned
   - Refunds issued
   - Payout summary
   - Payment method distribution
     d. **Performance Reports**:
   - Average ratings
   - Completion rates
   - Cancellation analysis
   - Top drivers/riders
     e. **Safety Reports**:
   - SOS incidents count
   - Safety complaints
   - Resolution times
   - Incident trends
3. Admin sets parameters:
   - Date range
   - Filters (city, user type, etc.)
   - Grouping (daily/weekly/monthly)
4. System generates report with:
   - Tables
   - Charts/graphs
   - Key insights
   - Trends
5. Admin can:
   - Export (PDF/Excel/CSV)
   - Schedule automatic reports
   - Share with stakeholders
   - Set up custom dashboards
6. System saves report configuration for reuse

**Extensions**:

- 2a. Custom report: Admin builds query
- 5b. Scheduled reports: Email sent automatically

**Business Rules**:

- Reports can access data up to 2 years old
- Real-time reports for current day
- Scheduled reports sent weekly/monthly
- Sensitive data requires additional authorization

---

### UC-A07: Configure Platform Settings

**Primary Actor**: Admin  
**Goal**: Manage system-wide configurations  
**Preconditions**: Admin has superuser access  
**Postconditions**: Settings are updated and applied

**Main Success Scenario**:

1. Admin opens Settings panel
2. Admin can configure:
   a. **Platform Fee Settings**:
   - Commission percentage (15-20%)
   - Tiered pricing based on driver level
   - Promotional fee waivers
     b. **Cancellation Policy**:
   - Refund percentages by time
   - No-show penalties
   - Driver cancellation penalties
     c. **Safety Settings**:
   - SOS button behavior
   - Check-in frequency
   - Route deviation threshold (meters)
   - Auto-alert triggers
     d. **Matching Algorithm**:
   - Matching score weights
   - Maximum search radius
   - Time window flexibility
     e. **Payment Settings**:
   - Payment gateway credentials
   - Auto-payout frequency
   - Minimum payout amount
     f. **Notification Settings**:
   - Email templates
   - SMS templates
   - Push notification frequency
     g. **Business Rules**:
   - Maximum ride distance
   - Advance booking time
   - Maximum active rides per user
   - Price limits (min/max per km)
3. Admin updates values
4. System validates settings
5. Admin confirms changes
6. System applies settings immediately or schedules
7. All users notified if changes affect them
8. System logs configuration change

**Extensions**:

- 4a. Invalid configuration: System shows error
- 6a. Critical change: Requires senior admin approval

**Business Rules**:

- Changes logged in audit trail
- Critical settings require dual approval
- Changes can be reverted within 24 hours
- Users notified of policy changes 7 days in advance

---

## 6. AI/ML System Use Cases

### UC-AI01: Intelligent Ride Matching

**Primary Actor**: AI Matching Service  
**Goal**: Find best ride matches for riders  
**Preconditions**: Rider has submitted search query  
**Postconditions**: Ranked list of matched rides returned

**Main Success Scenario**:

1. System receives ride search request
2. AI service retrieves available rides within parameters
3. For each ride-rider pair, calculate matching score:
   - **Distance Compatibility** (40%):
     - Calculate route distance from rider
     - Score: 1.0 if <500m, decreases to 0 if >5km
   - **Time Compatibility** (25%):
     - Compare departure time difference
     - Score: 1.0 if exact match, decreases by time delta
   - **User Ratings** (20%):
     - Average of driver and rider ratings
     - Normalized to 0-1 scale
   - **Historical Acceptance** (10%):
     - Driver's acceptance rate for similar requests
   - **Safety Preferences** (5%):
     - Match safety preferences (women-only, etc.)
4. Apply business rules filters:
   - Sufficient seats available
   - Within allowed time window
   - Price within rider budget
5. Sort rides by final matching score
6. Return top 20 matches
7. Log matching data for model improvement

**Extensions**:

- 3a. Low score for all rides: Suggest alternative times/routes
- 5a. No results: Broaden search criteria
- 7a. User booking pattern: Update model weights

**Business Rules**:

- Minimum matching score: 0.4
- Maximum results: 20 rides
- Scores updated every 5 minutes
- Model retrained weekly with new data

---

### UC-AI02: Fraud Detection

**Primary Actor**: Fraud Detection Service  
**Goal**: Identify and prevent fraudulent activities  
**Preconditions**: Transaction or user activity occurs  
**Postconditions**: Fraud score calculated and action taken

**Main Success Scenario**:

1. System monitors user activities continuously
2. AI model analyzes patterns:
   - Multiple cancellations in short time
   - Unusual payment behavior
   - Velocity of account creation (same device)
   - Location anomalies (GPS spoofing)
   - Review manipulation patterns
   - Payment card testing
3. Model calculates fraud probability (0-100%)
4. Based on score, system takes action:
   - **Low Risk (0-30%)**:
     - Allow transaction
     - Log for monitoring
   - **Medium Risk (31-70%)**:
     - Additional verification required
     - Manual review flagged
     - Transaction delayed
   - **High Risk (71-100%)**:
     - Block transaction
     - Suspend account temporarily
     - Alert admin immediately
5. System logs all fraud checks
6. False positives reviewed to improve model
7. Confirmed fraud cases used for retraining

**Extensions**:

- 4b. User contests flag: Manual admin review
- 3a. New fraud pattern detected: Alert data science team

**Business Rules**:

- All high-risk flags require admin review within 2 hours
- Users can appeal fraud suspension
- Model precision target: >90%
- Model recall target: >85%
- Retraining frequency: Bi-weekly

---

### UC-AI03: Demand Prediction and Surge Pricing

**Primary Actor**: Demand Prediction Service  
**Goal**: Forecast demand and adjust pricing  
**Preconditions**: Historical ride data available  
**Postconditions**: Demand forecast and pricing adjustments made

**Main Success Scenario**:

1. System continuously analyzes data:
   - Historical ride patterns
   - Day of week
   - Time of day
   - Weather conditions
   - Local events (concerts, holidays)
   - Public transport schedules
2. ML model predicts demand for next 6 hours:
   - By route
   - By time window
   - By geographic area
3. Model identifies high-demand situations:
   - Demand > Supply by 30%+
4. System calculates surge multiplier:
   - 1.2x (Low surge): 30-50% demand excess
   - 1.5x (Medium surge): 50-75% demand excess
   - 2.0x (High surge): 75%+ demand excess
5. System applies surge pricing:
   - Notify drivers of high-demand routes
   - Display surge pricing to riders
   - Incentivize drivers to post rides
6. System monitors effectiveness:
   - New ride creation rate
   - Booking completion rate
   - User complaints
7. Adjust surge levels in real-time
8. Log all predictions and outcomes

**Extensions**:

- 3a. Supply exceeds demand: Promotional discounts
- 6c. High complaint rate: Reduce surge multiplier

**Business Rules**:

- Maximum surge: 2x base price
- Surge duration: Minimum 30 minutes
- Users notified before booking at surge price
- Drivers receive 90% of surge amount
- Surge warnings 15 minutes in advance

---

## 7. Cross-Cutting Use Cases

### UC-X01: Receive Push Notifications

**Primary Actor**: Any User  
**Goal**: Receive timely updates about rides and activities  
**Preconditions**: User has granted notification permissions  
**Postconditions**: Notification is delivered and logged

**Types of Notifications**:

**For Riders**:

- Ride request accepted/rejected
- Payment confirmation
- Driver assigned
- Driver approaching (5 mins away)
- Driver arrived
- Ride started
- Ride completed
- Rating reminder
- Ride suggestions for saved routes

**For Drivers**:

- New ride request
- Payment received
- Booking confirmed
- Ride reminder (2 hours before)
- Passenger running late
- New message from passenger
- High-demand route alert
- Earnings milestone

**For All**:

- Safety alerts
- Platform updates
- Special offers/promotions
- Account security alerts

---

### UC-X02: Access Help and Support

**Primary Actor**: Any User  
**Goal**: Get assistance with platform issues  
**Preconditions**: User is logged in  
**Postconditions**: Support request is logged and handled

**Support Channels**:

1. **In-app FAQ**: Self-service knowledge base
2. **Chatbot**: AI-powered instant responses
3. **Submit Ticket**: For complex issues
4. **Phone Support**: For urgent matters (safety, payment)
5. **Email Support**: For general inquiries

**Support Categories**:

- Account issues
- Payment problems
- Ride disputes
- Technical bugs
- Safety concerns
- Feature requests
- General feedback

---

## 8. Use Case Diagram

```
                    Car Pooling System Use Case Diagram

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│  RIDER                    SYSTEM                    DRIVER      │
│    │                                                   │         │
│    ├──► Register                                      │         │
│    ├──► Search Rides                    Post Ride ◄──┤         │
│    ├──► Request Ride                    View Requests ◄┤       │
│    ├──► Make Payment                    Manage Booking ◄┤      │
│    ├──► Track Ride      ◄───►  Real-time Tracking ◄───┤       │
│    ├──► Chat                  ◄─►  In-app Chat  ◄─────┤       │
│    ├──► Rate Driver                    View Ratings ◄──┤       │
│    ├──► Use SOS ──────►  Safety Alerts ◄────── Report ┤       │
│    ├──► Share Trip                     View Earnings ◄─┤       │
│    └──► Cancel Booking                 Cancel Ride ◄───┘       │
│                                                                 │
│                             ▲                                   │
│                             │                                   │
│                          ADMIN                                  │
│                             │                                   │
│                    ┌────────┼────────┐                          │
│                    │        │        │                          │
│             Review Drivers  │    Generate                       │
│             Handle SOS      │    Reports                        │
│             Resolve Disputes│                                   │
│             Manage Users    │                                   │
│             Configure System│                                   │
│                             │                                   │
└─────────────────────────────────────────────────────────────────┘

External Systems:
- Payment Gateway (Stripe Test Mode / Razorpay for production)
- Maps API (Google Maps)
- Notification Service (Firebase, Twilio, SendGrid)
- AI/ML Service (Matching, Fraud Detection, Demand Prediction)
```

---

## 9. Use Case Priority Matrix

### Critical (Must Have - MVP)

- UC-R01: Register as Rider
- UC-R02: Search for Rides
- UC-R03: Request a Ride
- UC-R04: Make Payment
- UC-D01: Register as Driver
- UC-D02: Create a Ride
- UC-D03: Manage Ride Requests
- UC-D04: Start and Complete Ride
- UC-A01: Review Driver Applications

### High Priority (Should Have - Phase 1)

- UC-R05: Track Active Ride
- UC-R06: Rate and Review
- UC-R07: Use SOS
- UC-R09: Cancel Booking
- UC-D06: Communicate with Passengers
- UC-D07: Handle No-show
- UC-D08: Modify/Cancel Ride
- UC-A02: Monitor Platform
- UC-A03: Handle Safety Incidents
- UC-A04: Resolve Disputes
- UC-AI01: Intelligent Matching

### Medium Priority (Could Have - Phase 2)

- UC-R08: Share Live Trip
- UC-R10: Manage Emergency Contacts
- UC-D05: Navigate with Tracking
- UC-D09: View Earnings
- UC-D10: Verified Status
- UC-A05: Manage User Accounts
- UC-A06: Generate Reports
- UC-AI02: Fraud Detection
- UC-AI03: Demand Prediction

### Low Priority (Nice to Have - Phase 3)

- UC-A07: Configure Platform Settings
- Advanced analytics
- Predictive features
- Gamification elements

---

## 19. Phase 4 Use Cases - Parcel Pooling Module

### UC-P01: Post Parcel for Shipping

**Primary Actor**: Parcel Sender  
**Goal**: List a parcel for shipping with travelers on same route  
**Preconditions**: User is logged in and verified  
**Postconditions**: Parcel is posted and available for matching

**Main Success Scenario**:

1. User navigates to "Ship Parcel"
2. User enters parcel details (type, weight, dimensions, description)
3. User sets source and destination locations
4. User selects preferred delivery date/time window
5. User sets offered price for shipping
6. User selects insurance option (basic/standard/premium)
7. System calculates insurance cost
8. User reviews total cost
9. System posts parcel and initiates matching algorithm
10. System notifies user of potential matches

**Business Rules**:

- Maximum parcel weight: 25kg
- Insurance required for items >₹5,000 value
- Delivery time window: minimum 24 hours

---

### UC-P02: Search for Parcels to Carry

**Primary Actor**: Rider/Driver  
**Goal**: Find parcels to carry on planned route for additional income  
**Preconditions**: User has active rides scheduled  
**Postconditions**: List of matching parcels displayed

**Main Success Scenario**:

1. User navigates to "Earn by Carrying Parcels"
2. System shows upcoming user rides
3. User selects a ride
4. System searches for parcels on same route
5. System displays parcel details:
   - Sender info and rating
   - Parcel description and weight
   - Pickup/delivery locations
   - Offered price
   - Insurance details
6. User can accept or decline parcels

---

### UC-P03: Confirm Parcel Pickup with Proof

**Primary Actor**: Rider/Driver  
**Goal**: Confirm pickup of parcel with photo evidence  
**Preconditions**: User has accepted parcel delivery  
**Postconditions**: Pickup confirmed with photographic proof

**Main Success Scenario**:

1. User arrives at sender location
2. System prompts photo verification
3. User takes photo of parcel
4. User takes photo with sender
5. System verifies photos
6. Sender confirms handover
7. System records pickup with timestamp and location

---

### UC-P04: Track Parcel in Real-Time

**Primary Actor**: Parcel Sender or Recipient  
**Goal**: Monitor parcel location during transit  
**Preconditions**: Parcel is in transit  
**Postconditions**: Real-time location visible on map

**Main Success Scenario**:

1. User opens tracking view
2. System displays live GPS location
3. System shows driver/rider info
4. System estimates delivery time
5. System allows messaging with carrier
6. User receives location updates every 5 minutes

---

### UC-P05: Claim Parcel Insurance

**Primary Actor**: Sender or Recipient  
**Goal**: File insurance claim for damaged/lost parcel  
**Preconditions**: Parcel insured and damaged/lost  
**Postconditions**: Claim filed and under review

**Main Success Scenario**:

1. User reports parcel issue (damaged/lost)
2. System generates claim form
3. User uploads damage photos
4. User provides damage description
5. User uploads photo with parcel
6. System submits to insurance provider
7. Insurance company reviews claim
8. User notified of claim status

---

## 20. Phase 4 Use Cases - Trip Pooling Module

### UC-T01: Create Trip Plan

**Primary Actor**: Trip Organizer  
**Goal**: Create and share detailed trip plan  
**Preconditions**: User is logged in  
**Postconditions**: Trip posted and searchable

**Main Success Scenario**:

1. User navigates to "Plan a Trip"
2. User enters trip title and description
3. User selects trip type (vacation/weekend/business)
4. User sets travel dates
5. User selects destinations and stops
6. User sets estimated budget
7. User defines trip interests (hiking, culture, food, etc.)
8. User creates day-by-day itinerary
9. User sets max group size
10. User sets trip visibility (public/private)
11. System posts trip and enables search discovery

**Business Rules**:

- Minimum group size: 2 members
- Maximum group size: 8 members
- Trip duration: minimum 1 day, maximum 90 days

---

### UC-T02: Search for Compatible Trip Partners

**Primary Actor**: Traveler  
**Goal**: Find trips matching travel plans and interests  
**Preconditions**: User is looking for travel companions  
**Postconditions**: List of compatible trips displayed

**Main Success Scenario**:

1. User navigates to "Find Travel Partners"
2. User enters destination or travel dates
3. User filters by interests, budget range, travel style
4. System searches matching trips
5. System ranks by compatibility score
6. System displays:
   - Trip organizer profile and rating
   - Itinerary preview
   - Budget breakdown
   - Other members' profiles
   - Compatibility percentage
7. User can view details or join request

---

### UC-T03: Manage Shared Trip Expenses

**Primary Actor**: Trip Member  
**Goal**: Track and split expenses with trip group  
**Preconditions**: User is trip member  
**Postconditions**: Expense recorded and auto-calculated splits

**Main Success Scenario**:

1. Member enters expense (e.g., hotel ₹3,000 for 2 nights)
2. Member selects who should split cost
3. Member marks who paid (can be different from who entered)
4. System auto-calculates individual shares
5. System shows settlement summary:
   - Who owes whom
   - Total amounts
   - Payment status
6. Member can mark expense settled after payment

**Example**:

```
Expense: Hotel ₹3,000
Paid by: Alice
Split among: Alice, Bob, Carol (3 people)
Per person: ₹1,000
Settlement: Bob owes Alice ₹1,000, Carol owes Alice ₹1,000
```

---

### UC-T04: Vote on Shared Activities

**Primary Actor**: Trip Member  
**Goal**: Collectively decide activities and attractions  
**Preconditions**: User is trip member, trip ongoing  
**Postconditions**: Activity confirmed with majority vote

**Main Success Scenario**:

1. Member proposes activity (e.g., "Taj Mahal visit")
2. Member adds activity details:
   - Date and time
   - Estimated cost
   - Duration
   - Notes
3. System notifies all members
4. Members vote (yes/no/maybe)
5. System tracks votes
6. If majority yes: Activity marked as confirmed
7. Cost auto-added to group expenses
8. Activity added to shared calendar

---

### UC-T05: Calculate and Settle Trip Expenses

**Primary Actor**: Trip Organizer or Finance Member  
**Goal**: Generate settlement report and payment instructions  
**Preconditions**: Trip completed or nearing end  
**Postconditions**: Settlement report generated with UPI/Bank details

**Main Success Scenario**:

1. User generates settlement report
2. System calculates:
   - Total group expenses
   - Per-person share
   - Who paid what
   - Outstanding balances
3. System displays settlement matrix:
   ```
   Person A → Person B: ₹500
   Person C → Person B: ₹750
   Person A → Person C: ₹300
   ```
4. System provides direct payment links (UPI/Bank)
5. Members can mark payments as settled
6. System notifies all members of their obligations

---

## 21. Parcel & Trip Pooling Service Level Agreements

### Parcel Service SLAs

- **Carrier acceptance**: Within 2 hours of posting
- **Pickup confirmation**: Within 1 hour of scheduled time
- **Delivery confirmation**: Within agreed time window
- **Insurance claim response**: Within 5 business days

### Trip Service SLAs

- **Trip member acceptance**: Within 24-48 hours of request
- **Itinerary updates**: Real-time
- **Settlement calculation**: Within 2 hours of trip completion
- **Dispute resolution**: Within 7 days

---
