# Use Cases Document

> **Status (September 2026):** this is the original design. Where it differs from the code, the code is right. See [07-API-SPECIFICATIONS](../technical/07-API-SPECIFICATIONS.md) for the API as built and [11-FEATURE-GAP-ANALYSIS](../planning/11-FEATURE-GAP-ANALYSIS.md) for what is built, what is missing, and where the documents and code differ. The product today: a React Native (Expo) app using the Context API; Node.js and Express; MongoDB and Redis, with Kafka optional; Paynow payments (EcoCash, OneMoney, InnBucks and card, in US dollars or ZiG); Zimbabwe as the first market, with each country an entry in a market registry; Firebase sign-in and push; OpenStreetMap maps with Google optional; and admin tools both inside the mobile app and as a web dashboard (`admin-web/`).


## Poolora

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

- **Payment Gateway**: Paynow (EcoCash, OneMoney, InnBucks, Visa/Mastercard; test mode in development)
- **Map Service**: OpenStreetMap (MapLibre tiles; Photon, Nominatim and OSRM), with Google Maps optional
- **Notification Service**: Firebase Cloud Messaging and Phone Auth, Twilio SMS for SOS alerts; no email provider yet
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
   - Women-only rides (only for women whose identity check has passed; see Women-only rides below)
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
   - EcoCash or OneMoney (a PIN prompt on the phone)
   - InnBucks (a code to enter in the InnBucks app)
   - Visa/Mastercard (Paynow's card page)
   - Wallet
5. System starts the payment with Paynow, in US dollars or ZiG
6. User approves it on their phone, in InnBucks, or on Paynow's card page
7. Paynow reports the result to the system, verified by its hash, and the app also asks Paynow while it waits
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
- Refunds go to the Poolora wallet at once (Paynow has no refund API); the user can withdraw them to mobile money
- As built: the rider pays when requesting, and the driver can accept only once the payment is in (see the API specification, section 5)

---

### UC-R05: Track Active Ride

**Primary Actor**: Rider  
**Goal**: Monitor real-time location of driver during ride  
**Preconditions**: Ride is active (started)  
**Postconditions**: User can see driver's live location

**Main Success Scenario**:

1. User opens active ride details
2. System displays map view with:
   - Driver's current location (updated every 5 seconds)
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

- Location updates every 5 seconds during active ride, from the driver's phone in the background (the car stays on the map when the driver opens Maps or locks the phone)
- Each rider's phone is traced from pickup to drop (every 15 s). The trip trail (one point every 15 s per phone, with the battery level) is kept 30 days, or with any SOS, safety report or dispute (decided 30 September 2026)
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
4. User answers "Did you feel safe?" (Yes / Mostly / No) and writes a text review (optional). The safety answer is confidential: only the safety team sees it, never the person rated
5. User can report issues:
   - Safety concerns
   - Route problems
   - Payment issues
6. User submits feedback
7. System updates driver's rating
8. System sends thank you message
9. System stores review for admin moderation

**Extensions**:

- 5a. Safety issue reported, or "No" to "Did you feel safe?": System immediately alerts admins (push and dashboard) and puts it first in the review queue
- 3a. User skips rating: System sends reminder after 24 hours

**Business Rules**:

- Rating can be submitted within 7 days of ride completion
- Reviews are public after admin approval
- Safety reports are private and prioritized
- The "Did you feel safe?" answers are averaged apart from the public rating, shown only to admins, and count towards ride ranking once a driver has three (UC-AI01)

---

### UC-R07: Use SOS Emergency Feature

**Primary Actor**: Rider or driver
**Goal**: Get help fast when in danger during a ride
**Preconditions**: A confirmed booking that is under way or leaves within 3 hours
**Postconditions**: The safety team is handling the SOS, and the person's emergency contacts know where they are

**Main Success Scenario**:

1. User presses and holds the SOS button (on the ride screen, in chat, or under Safety)
2. After a 3-second hold the SOS is raised at once. There is no second countdown: 13 seconds before anyone hears is too long
3. System immediately:
   - Records the position: the phone's GPS fix, or if it has none within 4 seconds its last known position, or else the car's last reported position or the pickup point. A missing fix never stops the alert
   - Pages the safety team (every admin) by push and SMS, and shows the SOS on the live dashboard with an alarm sound
   - Records the ride: booking, driver, vehicle, route
4. The screen shows "Texting your emergency contacts in 10 s" with a Cancel button
5. After 10 seconds the contacts the user chose (UC-R10) get a text with a live tracking link; those with Poolora accounts also get a push
6. The tracking link shows the person's first name, the latest position, the trip, the other person's first name and the car with its plate: what a relative would give the police. Never phone numbers
7. The phone sends its position every 5 seconds while the SOS is open, also with the screen off or the app closed (an "SOS active" notification shows it). If the user has switched on "Record audio during an SOS" (off by default), the phone records in one-minute parts and uploads each as it ends, for the safety team only. The screen shows when an admin takes it ("Tendai from the safety team is on it and will call you") and when it is closed
8. Admin calls the user and the other party separately (UC-A03) and closes the SOS with a note

**Extensions**:

- 3a. Accidental trigger: Cancel within the 10-second window closes it as a false alarm. The contacts are never texted; the safety team is told it was cancelled
- 3b. The rider did not answer two in-ride check-ins (UC-R05): the safety team is paged at once, and the rider has 5 minutes to answer before the contacts are texted, because a phone in a bag misses prompts too. Answering "I'm OK" in that time stands it down
- 5a. No network: the app keeps retrying every 5 seconds, and offers to call the emergency line and to text the contacts from the phone's own messaging app, which works without data
- 7a. User taps "I'm safe": recorded, and passed on to the safety team and to the contacts who were texted. The SOS stays open until an admin has called to confirm, so a person made to tap it is still called
- 7b. User reports danger, or raises it again: risk goes to high and the team is paged again; contacts told "safe" are told it is live again
- 7c. The phone stops sending its position for three intervals: marked out of contact, risk high, the team paged, with what the battery says: near 0% it probably ran out; with charge left it was switched off, taken or lost signal. The other phones on the ride (the car, other riders) are still traced, and the family's link also shows where the car is
- 7d. "What's happening?" (optional, after the alert): the driver, a passenger, someone outside, medical, accident. Naming someone on the ride raises the risk; in a medical emergency or an accident staff may ask the other person to help
- 8a. Nobody takes the SOS within 5 minutes: every admin is paged again, every 5 minutes, until someone does
- 8b. User leaves the SOS screen: the SOS stays open, and opening the screen again shows it

**Business Rules**:

- SOS button is always visible during an active ride, for riders and for drivers
- One open SOS per person per booking; pressing again re-raises it instead of failing
- Only the person who raised it, and admins, can see it. The other person on the ride cannot: they may be the reason for it
- Emergency contacts are recommended, not required: without them the safety team is still paged
- A real incident is kept indefinitely (UC-A03). A false alarm is deleted after 90 days
- False alarms are counted and shown to the admin handling the next SOS. They never delay a response and never trigger an automatic warning: deterring someone from pressing SOS is the worst outcome. Warning a user who repeatedly misuses it is an admin decision (UC-A03 4a)
- The 10-second window, the 5-minute paging interval and the silence intervals are admin settings (UC-A07)

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
   - 50% refund (2-24 hours before)
   - No refund (<2 hours before)
   - Free cancellation within 30 minutes of the driver accepting, if the ride is still 1 hour or more away
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

- 6a. Refund: credited to the Poolora wallet at once
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

### UC-R11: Women-only Rides and the Identity Check

**Primary Actor**: Rider or driver who is a woman
**Goal**: Travel only with women
**Preconditions**: Signed in
**Postconditions**: She can post, find and book women-only rides

**Main Success Scenario**:

1. User opens Profile > Identity check
2. User chooses her gender, takes or chooses a photo of her national ID, passport or driving licence, and takes a selfie in the app
3. The photos are uploaded privately (the same store as driver documents)
4. An admin checks the selfie is the person on the ID and the ID looks genuine, then confirms the gender she lives as (web admin, Identity checks). The ID proves identity, not gender: a trans woman is a woman here
5. The ID photo and selfie are deleted as soon as the admin decides; only the decision is kept
6. User is told the result. Once verified, the gender cannot be changed from the app
7. A verified woman sees women-only rides in search, can filter to them, and can book them; a verified woman driver can post them. Riders see "Verified woman driver" on the ride

**Extensions**:

- 4a. Not approved: the user is told what to fix and can send it again
- 4b. The sex printed on the ID differs from the gender she lives as: the admin confirms the gender she lives as. If the selfie does not fit what she told us, or anything looks wrong, the admin does not approve and says why
- 7a. Anyone else (a man, or a woman not yet verified) never sees women-only rides, and is refused if they try to book one by its link; a woman is told how to verify

**Business Rules**:

- A declared gender alone is never enough: the rides exist to keep out men who would claim to be women
- Only an admin can change a verified gender (through support)
- Documents accepted: national ID, passport or driving licence
- Photos are kept only until the decision (decided 30 September 2026)

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
   - National ID (national registration card)
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
   - Women-only (only for women drivers whose identity check has passed)
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
- 10a. Route longer than 650 km: System refuses the ride and explains the limit
- 11a. Driver has <3.5 rating: Ride requires admin approval

**Business Rules**:

- Ride must be created at least 2 hours in advance
- Maximum 650 km per ride, so the intercity corridors (Harare to Bulawayo, Mutare or Beitbridge) fit
- Price between US$0.02 and US$0.20 per km per person, with a US$1 minimum seat price
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
5. Driver marks passenger as "Picked Up" by entering the rider's 4-digit pickup code, which only the rider sees in their app. The rider gets in only when their app says the code is confirmed, so nobody gets into the wrong car. If the code cannot be exchanged, the rider confirms in their own app instead; after 5 wrong codes only the rider can, the rider is warned to check the car, and admins are told
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

- Location updates every 5 seconds
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
  - <12 hours: US$5 penalty + rating impact
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

- Payouts: the driver withdraws earnings from the wallet to EcoCash, OneMoney or InnBucks (US$2 to US$1,000 at a time); an admin sends each withdrawal
- Minimum withdrawal: US$2
- Platform fee: 15-20% based on driver tier
- Bonuses for high-rated drivers (>4.7)
- Monthly and annual earnings statements for the driver's own ZIMRA tax returns

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

### UC-D11: Link a Car Tracker

**Primary Actor**: Driver
**Goal**: Keep the car traceable during rides even if every phone in it is off
**Preconditions**: A registered vehicle, and a GPS tracker in it
**Postconditions**: The car shows a "Tracked car" badge; its tracker feeds rides and SOS

**Main Success Scenario**:

1. Driver opens Profile > Car tracker and enters the tracker's device id (usually its 15-digit IMEI)
2. Driver points the tracker at Poolora's tracker gateway (an SMS command shown in the app), or asks their tracking company to forward the car there
3. The gateway (Traccar, forwarder only, storing nothing) decodes each report and posts it to Poolora
4. Once it reports, the car's rides show "Tracked car" (a report within the last day)
5. During a ride in progress, the tracker's positions join the trip trail as the car's own trail, apart from the driver's phone; during an SOS on the ride the safety team sees them live

**Extensions**:

- 5a. The tracker's panic button is pressed during a ride: an SOS is raised as the driver's (their contacts are texted after the 10-second window), on the booking of a rider in the car, marked "raised by the car's panic button": anyone in the car may have pressed it
- 5b. The tracker loses power or is removed during a ride: the safety team is told; during an open SOS it goes on the incident and they are paged by SMS too
- 2a. The tracker is already linked to another car: refused; support resolves it

**Business Rules**:

- Optional; a badge, not a requirement (decided 1 October 2026)
- Outside rides and open SOS, Poolora keeps only when the tracker last reported, never where the car was
- Poolora never cuts a car's engine (decided 1 October 2026)
- One tracker, one car

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
   - Both people, whoever raised it: photo, name, phone, ID-check status, the driver's licence number, and the mobile money numbers each has used (registered to a name at the network)
   - The car in full: make, model, colour, year, plate, its photos, and a link to the driver's documents
   - Every other rider on the ride (a witness, or the danger)
   - Real-time location of every phone on the ride, each with its battery level: the person's SOS trail in red, the car and the others in their own colours
   - What the person said is happening, if they said
   - Ride details, and the messages and calls between them
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

- SOS alerts are highest priority. Every admin is paged by push and SMS when one is raised, whether or not anyone has the dashboard open
- Response required within 5 minutes: an SOS nobody has taken pages every admin again every 5 minutes (an admin setting)
- All calls recorded (masked rider–driver calls, when recording is on; admins log their own calls on the incident)
- Incident data preserved indefinitely; false alarms are deleted after 90 days
- The other party can be suspended pending investigation from the incident page. It is not automatic: the suspended person is told at once, so the admin waits until the person who raised the SOS is safe
- A user who says they are safe is still called before the SOS is closed
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
- Payment Gateway (Paynow, in test mode in development)
- Maps (OpenStreetMap: MapLibre, Photon, Nominatim, OSRM; Google optional)
- Notification Service (Firebase, Twilio)
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

## 10. Phase 4 Use Cases - Parcel Pooling Module

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
- Insurance required for items worth more than US$50
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

## 11. Phase 4 Use Cases - Trip Pooling Module

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

1. Member enters expense (e.g., lodge US$30 for 2 nights)
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
Expense: Lodge US$30
Paid by: Alice
Split among: Alice, Bob, Carol (3 people)
Per person: US$10
Settlement: Bob owes Alice US$10, Carol owes Alice US$10
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
**Postconditions**: Settlement report generated with mobile money details

**Main Success Scenario**:

1. User generates settlement report
2. System calculates:
   - Total group expenses
   - Per-person share
   - Who paid what
   - Outstanding balances
3. System displays settlement matrix:
   ```
   Person A → Person B: US$5
   Person C → Person B: US$7.50
   Person A → Person C: US$3
   ```
4. System provides a one-tap EcoCash send-money link (`*151*1*1*number*amount#`) for members who added an EcoCash number
5. Members can mark payments as settled
6. System notifies all members of their obligations

---

## 12. Parcel & Trip Pooling Service Level Agreements

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

## 13. Phase 2 and 3 Use Cases

Designed on 1 October 2026 from the future phases in `planning/01-PROJECT-PLAN.md` §3.2. The reasoning behind each is in [12-NEXT-PHASES](../planning/12-NEXT-PHASES.md). Loyalty and rewards, also listed there, is already built (coins and tiers in the wallet).

### UC-R11: See My Carbon Savings

**Primary Actor**: Rider or Driver
**Goal**: Know how much CO₂ sharing rides has saved
**Preconditions**: At least one completed booking
**Postconditions**: None (read only)

**Main Success Scenario**:

1. When a booking completes, the system measures the rider's leg along the ride's route and works out the CO₂ saved against the rider going alone in an average car
2. The saving is stored on the booking and added to the totals of the rider and the driver
3. User opens Profile > Your impact
4. System shows CO₂ saved, kilometres shared and trips shared, all time and this month, and the last six months
5. User taps "How we count" and sees the method and its assumptions
6. The trip's receipt shows what that trip saved

**Extensions**:

- 1a. The ride has no usable route: the straight-line distance between pickup and drop is used
- 1b. The car emits more per passenger than an average car alone (a large car with one rider): the saving is zero, never negative
- 4a. No completed trips yet: the screen explains what will be counted

**Business Rules**:

- One car per booking is the baseline, however many seats it holds
- The figure is an estimate and is always called one
- Emission factors are platform settings, per vehicle class and per market
- The driver sees the savings of the seats they shared; the platform total is shown to admins

### UC-X03: Use the App in My Language

**Primary Actor**: Any user
**Goal**: Read the app, its pushes and its messages in their own language
**Preconditions**: The language is offered in the user's market and its translation has been reviewed
**Postconditions**: The app, and what the backend sends this user, use that language

**Main Success Scenario**:

1. On first start, the app uses the phone's language if the market offers it, otherwise English
2. User opens Settings > Language and picks a language (English, Shona or Ndebele in Zimbabwe)
3. The app changes at once, without signing out
4. The choice is saved on the phone and on the account
5. Pushes, texts and emails to the user are written in that language

**Extensions**:

- 3a. A phrase has no translation yet: it is shown in English
- 5a. An SOS text to an emergency contact: written in the language of the person who raised it, with the English beneath it

**Business Rules**:

- A language is offered only once native speakers have reviewed it, safety screens first
- Emergency numbers, money and dates follow the market, not the language
- Each market lists its languages in the market registry

### UC-C01: Set Up a Company Programme

**Primary Actor**: Admin, with the company's representative
**Goal**: Let a company's staff pool rides to work, optionally paid in part by the company
**Preconditions**: A signed agreement with the company
**Postconditions**: The organisation exists with its email domains, policy and company admins

**Main Success Scenario**:

1. Admin creates the organisation: name, email domains, billing contact
2. Admin sets the policy: who may join (any address on the domains), the share of the fare the company pays (0–100%), the monthly cap per person, and the days and places it applies to
3. Admin invites the company's own admins, who get a company dashboard limited to their organisation
4. The company tells its staff

**Business Rules**:

- The company sees who rode, when and what it cost; never routes, positions, ratings or safety reports
- Changes to the policy apply from the next booking

### UC-C02: Join My Company's Programme

**Primary Actor**: Rider or Driver
**Goal**: Ride with colleagues and get the company's contribution
**Preconditions**: The user's company has a programme
**Postconditions**: The user is a member of the organisation

**Main Success Scenario**:

1. User opens Profile > Work and enters their work email
2. System sends a link to that address
3. User opens the link; system adds them to the organisation
4. Colleagues see a "Works at …" badge on the user's rides; the public does not
5. A driver can now post a ride for colleagues only; members see such rides in search
6. On an eligible booking, the fare shows the company's share and what the rider pays

**Extensions**:

- 3a. The link expires (24 hours): the user asks for a new one
- 6a. The monthly cap is reached: the rider pays the full fare and is told why

**Business Rules**:

- Leaving the company (removed by a company admin, or the email bounces at the yearly recheck) ends membership; past rides keep their contribution

### UC-C03: Bill a Company

**Primary Actor**: System
**Goal**: Charge the company its share each month
**Preconditions**: Company-paid bookings completed in the month
**Postconditions**: A statement is sent and recorded as owed

**Main Success Scenario**:

1. On the 1st, the system totals the company's share of last month's completed bookings
2. It emails the billing contact a statement (PDF and Excel, as the scheduled reports are), with members, trips, amounts and CO₂ saved
3. Admin records the bank transfer when it arrives

**Extensions**:

- 3a. Not paid in 30 days: the company's contribution stops until it is paid; staff are told and pay full fares

### UC-X04: Video Call During an SOS

**Primary Actor**: Safety team member
**Goal**: See what is happening when the person in danger cannot speak freely
**Preconditions**: An open SOS
**Postconditions**: The call, if recorded, is stored with the incident

**Main Success Scenario**:

1. From the incident, the safety team member asks for video
2. The person's phone shows "The safety team is asking to see. Turn on the camera?"
3. The person accepts; video goes to the team at low resolution, with an audio-only button
4. The call is recorded and stored with the incident, as SOS audio is

**Extensions**:

- 3a. The person declines or does not answer: nothing changes; the SOS continues as before
- 3b. The connection is too weak for video: it falls back to audio

**Business Rules**:

- Only the safety team can start an SOS video call; it is never automatic
- Recordings are kept and deleted on the SOS audio's rules
- Later uses (an identity check by video, rider and driver before pickup) follow the same pattern and are opt-in

### UC-R12: Pool to a Rank or Terminus

**Primary Actor**: Rider
**Goal**: Share the first or last part of a journey made by kombi or bus
**Preconditions**: The market lists its ranks and termini
**Postconditions**: A booking to or from a rank, with the bus time if given

**Main Success Scenario**:

1. Rider searches for a place; ranks and termini are suggested first
2. Rider books a ride to a terminus and optionally adds "catching a bus at …"
3. The driver sees the bus time on the request and on the ride screen

**Business Rules**:

- No timetable is shown where no reliable feed exists (none in Zimbabwe today)
- A market that publishes a GTFS feed can add departures later

---
