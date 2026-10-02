# Feature Gap Analysis

What the documents in `frontend/docs` promise, compared with what the app and backend do today (last updated 30 September 2026). Sections 1 to 1.3 are a history written while Poolora targeted India, so they still mention Razorpay, rupees and India time; section 1.4 records the move to Zimbabwe, and sections 2 onward describe the system as it is now. Each gap says what the feature should do and where it would go. Use-case IDs (UC-…) refer to `design/03-USE-CASES.md`.

---

## 1. Fixed alongside this analysis

These blocked the core ride flow and are now in the code:

| Area | Before | Now |
|---|---|---|
| Start ride (UC-D04, API spec §3.7) | No endpoint. Rides stayed `scheduled` forever, so "Complete ride" always failed. | `POST /rides/:id/start` (needs one confirmed rider), a **Start ride** button, and a "Your driver is on the way" push to riders. |
| Live tracking (UC-R05, UC-D05) | The rider screen listened for positions, but the driver app never sent any. | While a ride is in progress, the driver's phone shares its GPS position every 5 s with each confirmed rider. |
| Completing a ride | Completing a ride left its bookings `confirmed`, so riders could never rate and drivers never earned. | Completing a ride settles every confirmed booking: earnings, platform fee, coins, and rating unlocked. |
| Maps cost | Google Maps key needed for tiles, search and routing. | Free OpenStreetMap stack: MapLibre + OpenFreeMap tiles in the app; Photon, Nominatim and OSRM on the backend (`MAPS_PROVIDER=osm`). Google stays available with `MAPS_PROVIDER=google`. |
| Road route on the map | Straight dashed line between pickup and drop. | The actual driving route from the stored polyline. |
| Testing a trip | Needed two phones and two accounts. | Ride simulator (Settings → Testing), described in section 5. |

### 1.1 Fixed in the second pass (23 September 2026)

| Area | Before | Now |
|---|---|---|
| Card payments skipped the driver (bug) | The `payment.captured` webhook set the booking to `confirmed` itself. Razorpay captures automatically, so card and UPI bookings were confirmed without the driver, and `availableSeats` never went down, which allowed overbooking. | The webhook only records the capture. The driver's Accept confirms the booking and reserves seats atomically. |
| A failed card attempt killed the booking (bug) | Any `payment.failed` set the booking to `payment_failed`, even when a retry on the same order then succeeded, and could overwrite an authorized payment as failed. | Failures are recorded for fraud checks. The booking stays pending, and a successful payment is never overwritten. |
| Webhooks on Docker Compose (bug) | `payment.captured` ran in a MongoDB transaction, which needs a replica set; the Compose database is a standalone server. | No transaction is needed any more. |
| Payment timeout (UC-R04) | Unpaid requests stayed pending forever. | Cancelled after 15 minutes by the booking sweeper (`backend/src/jobs/BookingSweeper.ts`, every minute, Redis lock across instances). |
| Request expiry (UC-D03) | Unanswered requests stayed pending forever. | Expire after 6 hours, or once the ride has left, with a full refund and a push. |
| Auto-reject when full (UC-D03 5a) | Other requests stayed open after the last seat went. | Requests that no longer fit are rejected and refunded as soon as the driver accepts. |
| Auto-cancel empty rides (UC-D02) | Not done. | Rides with no bookings are cancelled 1 hour before departure, and the driver gets a push. A ride posted inside that hour gets a full hour first. |
| Tiered cancellation refunds (UC-R09) | Every cancellation refunded in full. | 100% / 50% / 25% / 0% by hours before departure for a rider cancelling a confirmed seat. The rest goes to the driver less the platform fee (UC-D04 7b). The app shows the exact refund before the rider confirms (`GET /bookings/:id/cancellation-quote`). |
| Pickup near the route (UC-R03) | Pickup had to be within 2 km of the ride's *start*. | Measured against the stored route polyline, so riders can book part-way along the route. |
| Frontend linting | `eslint-plugin-react-hooks` was missing and there was no `lint` script. | Installed; `npm run lint` passes and runs in CI. |
| API specification | Described endpoints that do not exist. | Rewritten from the route files (`technical/07-API-SPECIFICATIONS.md`). |
| Search along the route (UC-R03) | Search found rides only by their *start*, so riders on the route but far from its start never saw them. | Rides store their route as an indexed GeoJSON line; search matches the rider's pickup and drop anywhere along it, in the right direction, and the app books from the rider's own points. |
| Kafka (bug) | The API tried Kafka once at startup and gave up; on a fresh cluster every consumer failed because the topics did not exist; without Kafka every booking, ride and payment push was dropped; the Kubernetes Kafka could not start at all. | Background reconnect, topics created before subscribing, events handled in-process when Kafka is down, and a working three-broker KRaft StatefulSet. |
| Account blocks never enforced (bug) | Fraud detection set `isBlocked`, and users carry `isSuspended`, but nothing checked them: a user blocked for fraud could keep booking and paying. | Blocked accounts are refused on every request and socket; suspended ones can read but not post or book; suspensions lift themselves when they end. |
| Web admin (UC-A01 to UC-A07) | Only the app's admin screens: verifications, incidents, metrics. | `admin-web/` with a live dashboard, SOS handling, driver applications, disputes, user management, reports, settings and an audit log (section 2.4). |
| Partial refunds on card payments (bug) | A partial refund marked the Razorpay payment `refunded`, so any later refund on the rest was skipped silently. | Payments track the amount refunded and stay `captured` until fully refunded; a refund reports whether it went through. |

### 1.2 Closed in the third pass (24 September 2026)

| Area | Before | Now |
|---|---|---|
| Socket gateway (bug) | Code outside the socket server got an empty gateway, so the HTTP location fallback, the simulator and SOS alerts to admins sent nothing. | The running gateway is shared. |
| Per-rider pickup and drop (UC-D04) | One Start and one Complete for the whole ride. | Arrived, Picked up and Dropped off per rider; dropping a rider settles their booking. |
| No-shows (UC-D07) | Missing. | After "Arrived", a 10-minute wait, then "Report no-show" cancels the booking and pays the driver, less the platform fee. |
| Changing a ride (UC-D08) | Cancel only. | Time (within 2 hours either way), more seats, and the price (within 20%, only before anyone books), until 4 hours before departure. Booked riders are told, and a new time lets them cancel for a full refund. |
| Route deviation (UC-R05) | Measured from the pickup point, with a 10 km threshold. | Measured against the route, 500 m by default (an admin setting); rider, driver and admins are alerted. |
| Approach pushes and check-ins (UC-R05) | Only "started" was a push; no check-ins outside an SOS. | "5 minutes away" and "arrived" are pushes, sent once each. "Are you OK?" every 30 minutes in a ride; two missed prompts raise an SOS. |
| Trip sharing (UC-R08) | Plain text. | A public link with the car's position and ETA that expires an hour after the trip. |
| Receipts and email | No receipts; no email. | Receipt screen and emailed receipts. Email goes out over SMTP (`SMTP_HOST`) for receipts, KYC decisions, account actions, disputes and statements. |
| Disputes in the app | Endpoint only. | "Report a problem" on any past trip. |
| No results (UC-R02 6a) | Empty list. | Nearby and nearby-time alternatives, and "Tell me when a ride appears" (ride alerts). |
| Booking note, biased suggestions | Missing. | A note to the driver on the booking; place search prefers places near the user. |
| Posting a ride (UC-D02) | Any price; only "in the future" checked. | A suggested price from distance, vehicle, commute hours and surge (UC-AI03), with a ±30% band and ₹2–₹15 a km; at least 2 hours ahead; at most 300 km; up to 3 stops; an optional return trip. |
| Navigation, broadcast, statements, badge (UC-D05, D06, D09, D10) | Missing. | "Open route in Maps" with the stops; "Message all riders"; monthly statements shared as CSV or emailed; the Verified Driver badge with progress on the driver's profile. |
| Fraud checks (bug, UC-AI02) | A critical score blocked the account permanently, without the two-admin rule, and flags had no reasons or review. | Critical scores suspend the account until an admin reviews it; flags are stored with their reasons; the web admin's Fraud flags page clears false positives or confirms them. |
| Admin sign-in | No password reset. | "Forgot password?" on the web admin. |
| Emergency contacts (UC-R10) | The API accepted 5 (bug); no verification. | At most 3; one primary; the user chooses who gets the SOS text; contacts confirm by a link in a text message (unconfirmed contacts still get alerts). |
| Ratings (UC-R06) | A single score, any time, no moderation. | Overall plus behaviour, cleanliness and punctuality; within 7 days; a reminder after a day; private problem reports with an instant safety alert; reviews public only after an admin approves them (web admin Reviews page). |
| Help and support (UC-X02) | A contact link. | An in-app FAQ, an urgent safety and payment line, and support requests answered in a thread from the web admin. |
| Parcel payments (bug) | Payments were never recorded, cancelling refunded nothing, drivers were never credited, and Razorpay was required. | Payments recorded by the webhook or taken from the wallet; accepted only once paid; refunded when cancelled or declined before pickup; the driver's share added to earnings. |
| Parcel pooling (Phase 4) | Placeholder screens. | Send a parcel, choose a driver on the route, pay, track, and share the delivery code; drivers accept, pick up and hand over with the code from the ride screen. |
| Trip pooling (Phase 4) | Nothing. | UC-T01 to UC-T05: plan a trip, find partners by compatibility, join by request or invite code, split expenses, vote on activities, and settle up with UPI links. |

### 1.3 Closed on 25 September 2026

| Area | Before | Now |
|---|---|---|
| Scheduled report emails (UC-A06) | Reports could only be viewed or downloaded as CSV. | The web admin's Reports page schedules emails: any reports, daily (yesterday), weekly (Mondays, the last seven days) or monthly (the 1st, last month), at 07:00 India time, to up to 10 addresses, with the full reports attached. Schedules can be paused, edited, sent now and deleted, and each change is in the audit log. A failed run shows its reason on the page. `backend/src/jobs/ReportScheduler.ts` checks every five minutes; each run is claimed atomically, so several backend instances never send it twice, and runs missed during downtime are skipped rather than sent late. Needs SMTP. |
| Excel and PDF export (UC-A06) | CSV only. | Every report downloads, or is attached, as Excel (a summary sheet, a sheet per period and a sheet per table) or PDF, as well as CSV. Dates in file names and exports are India-time days. |

---

### 1.4 Built for the Zimbabwe launch (25–29 September 2026)

| Area | Now |
|---|---|
| Appeals, merges, alerts, calls, claims (snapshot `3e36134`) | Account appeals within 30 days; duplicate-account merges approved by a second admin; custom admin alert rules by dashboard, email and SMS; masked driver–rider calls through Twilio, optionally recorded; parcel photo proof and damage or loss claims; automatic document checks with an optional background-check vendor; the in-app support assistant; two-admin approval for critical settings; organiser ratings and a calendar feed for trips |
| Market | Zimbabwe first, with each country an entry in a market registry (`MARKET`, `EXPO_PUBLIC_MARKET`): Zimbabwe time, `+263` numbers, US dollars, maps limited to Zimbabwe, 999 for emergencies |
| Payments | Paynow replaced Razorpay: EcoCash, OneMoney, InnBucks and card, in US dollars or ZiG; hash-verified results, polling and reconciliation; refunds to the wallet; wallet withdrawals to mobile money paid by an admin |
| Prices | US$0.02–US$0.20 a km, US$1 minimum seat; rides up to 650 km for the intercity corridors |
| Trips | Members add a mobile money number; EcoCash send-money links replace UPI links |
| Data | `npm run migrate:paynow` moves an old database onto the Paynow fields |

### 1.5 Fixed in the review of 29 September 2026

Found by reading the documents against the code and by running the app on an Android emulator. Each has a test.

| Area | Before | Now |
|---|---|---|
| Posting a ride (bug) | `ride.created` carried the pickup as a Mongoose subdocument, and the event code walked it forever: every `POST /rides` saved the ride and then failed with 500 (return rides were never created; retries made duplicates). Hidden because every test mocked `EventBridge`. Since 22 September | Documents are turned into plain data first, with a cycle guard |
| Paying twice quickly (bug) | Two taps on Pay could send Paynow the same reference; the second payment then had no record and was never applied or credited | Every attempt has its own reference |
| Payment as the request closes (bug) | A payment landing while the sweeper cancelled the unpaid request was recorded on a cancelled booking and never refunded | Refunded to the wallet at once (keyed per booking, so never twice) |
| Rate limits (bug) | All limits were per IP: 100 requests a minute for everyone behind a carrier NAT address, 3 sign-in codes an hour per IP, 10 token refreshes per 15 minutes per IP (enough to log out a NAT's users), and Paynow's callbacks counted too | Per user (120 a minute) and per phone number (3 codes an hour, UC-R01), with high per-IP ceilings; signed callbacks exempt |
| Children could sign up (bug) | The API accepted any date of birth and the app's picker allowed 13-year-olds, though the Terms and privacy policy say 18 | Refused under 18 in the API and the app |
| Sign-up codes | The 5-minute code window included the profile form; a taken email used up the code | The profile form gets its own 10 minutes; a clash is refused before the code is used |
| Closing an account (UC-A05, data protection) | No way to close an account or erase personal data, though the privacy policy promised it and Google Play requires it | Settings → Close account (`DELETE /users/me`), refused while trips, money or disputes are open |
| Seeded rides | Placeholder polylines from the Mumbai demo data decoded to impossible positions, and the route backfill failed on every start | Real polylines; unreadable polylines fall back to the straight route |
| Ride simulator | US$80 seats and a US$10,000 bot wallet (rupee values); an Indian plate and car; the rider was never marked picked up, so "Driver is 4 km away" showed during the trip | US$1 seats, Zimbabwe plate, and arrived / picked up marked as a driver would |
| API tester | Drop-offs in the Indian Ocean (Harare latitude with Bengaluru longitude), and enum values the API rejects | Harare coordinates and valid values |
| Driver KYC screen | Example plate `AP05AB1234` (the plate check flags it); "registration certificate (RC)" | `AEA 1234`; "vehicle registration book" |
| Phone display | Profile, driver profile and settings showed `+263775550101` | `+263 77 555 0101`, as on the sign-in screens |

### 1.6 Closed on 30 September 2026

| Item | Before | Now |
|---|---|---|
| Rider cancellation refunds (UC-R09) | Nothing back inside 6 hours of departure, so most same-day commute cancellations lost the whole fare, while taxi apps and kombis charge riders nothing to cancel | 100% from 24 hours, 50% from 2 hours, nothing after; free within 30 minutes of the driver accepting while the ride is an hour or more away. Both windows are admin settings. The booking screen, website and terms no longer promise a full refund on every cancellation |
| Public holidays in demand prediction (UC-AI03) | The backend never sent `is_holiday`, and the analytics call sent the server's clock hour with Sunday as day 0 | Zimbabwe's holidays, moving ones included (Easter weekend, Heroes' and Defence Forces Days, Sunday holidays kept on the Monday), are in the market registry and sent with every forecast, in Harare time. No peak-hour uplift on a holiday |
| Vehicle classes (UC-D02) | Riders could pick Bike, Auto and Cab, but drivers could only register a hatchback, sedan, SUV or "mini", so bike and auto searches were always empty | Drivers register a hatchback, sedan, SUV, bakkie, minivan, auto (tuk-tuk) or motorbike; riders pick Car, SUV, Minivan, Auto or Bike. Seats are capped per vehicle (one on a motorbike, three in a tuk-tuk, seven in a minivan) |
| Support assistant (UC-X02) | Built, but no route or screen reached it | `GET/POST /support/assistant` and Help → Ask the assistant, shown when `ANTHROPIC_API_KEY` is set; defaults to `claude-opus-5-5` |

### 1.7 The safety layer, checked against the PRD (30 September 2026)

The PRD's "Safe for her" list, UC-R05 to UC-R10 and UC-A03 were read against the code and the running flows. Each item has a test against a real MongoDB (`SafetyService.test.ts`, 26 tests; `WomenOnly.test.ts`, 7; `Ratings.test.ts`).

| Area | Before | Now |
|---|---|---|
| SOS without GPS (bug) | No GPS fix, or no location permission, meant "the alert was not sent" | The alert always goes: the phone's fix (4 s at most), its last known position, the car's last position, or the pickup point, in that order. The admin sees which |
| SOS on the wrong ride (bug) | The SOS screen used the rider's first confirmed booking, which could be tomorrow's, so the team saw the wrong driver | The ride on screen is passed in; otherwise the ride under way, else the one leaving within 3 hours. Never a later one |
| Time to raise (UC-R07) | A 3-second hold, then a 10-second countdown: 13 seconds before anyone knew. The flowchart said 5 and 3 | Raised at the end of the 3-second hold. The 10 seconds now only delay the texts to emergency contacts, so an accidental press can be cancelled without frightening anyone. The team is told at once |
| Admins told late or not at all (bug) | Contacts were texted one after another (up to 10 s each) before the admin event went out; admins were paged only if someone had made an alert rule, which then muted itself for an hour | Every admin gets a push and an SMS the moment an SOS is raised, and again every 5 minutes while nobody has taken it (UC-A03's 5-minute target). The dashboard sounds an alarm; only new or worse SOS light the banner (a closed one no longer did) |
| "I'm safe" (UC-A03) | Closed the incident at once, so a person made to tap it lost the safety team | Recorded and passed on to the team and the contacts; the SOS stays open until an admin has called |
| Missed-check-in escalation (bug) | Ran only when someone opened the dashboard; any position update reset it, so it never fired while the app was open; escalating marked the SOS "acknowledged", hiding it from the "nobody has it" alert | A background job every 15 s. A phone silent for three intervals is "out of contact", risk high, team paged. Escalation never pretends an admin took it |
| Leaving the SOS screen (bug) | The screen forgot the SOS: coming back showed the idle button, and pressing again failed with 409 | The open SOS is loaded every time; pressing again re-raises it |
| No connection (UC-R07 5a) | "Could not reach Poolora" | Retries every 5 s, and offers to call the emergency line and to text the contacts from the phone's own messaging app, which needs no data |
| Positions to the admin map (bug) | Positions sent over REST (the app's path) were published on a stream nobody consumed; the map caught up only on its 20-second poll | Live, on the safety stream |
| SOS from missed check-ins | Texted the contacts at once, for what is often a phone in a bag | The team is paged at once; the rider gets 5 minutes to answer before contacts are texted, and a late "I'm OK" stands it down |
| Who can read an SOS | The other person on the ride could read it, including the tracking link | Only the person who raised it and admins |
| Tracking page for contacts | First name and a map pin | Also the trip, the other person's first name and the car with its plate (what the police ask for), whether the team has it, "says they are safe", "phone out of contact". Still no phone numbers |
| Deleting evidence (bug) | The cleanup script deleted real incidents 30 days after they were raised; UC-A03 says keep them | Real incidents are kept. False alarms are deleted after 90 days (enough for the false-alarm count) |
| Drivers | No SOS button on the driver's ride screen | Drivers have one |
| Duplicates | Two presses at once could make two incidents and text contacts twice | One open SOS per person per booking, enforced by a unique index |
| Women-only rides (bug, PRD) | Nothing could set a gender, so no real woman ever saw a women-only ride; any driver, including a man, could post one; anyone could book one by its id | An identity check (ID photo and a selfie, reviewed by an admin in the web admin's Identity checks). Only verified women see, filter, book and post women-only rides; booking by id is refused. Riders see "Verified woman driver". Gender is locked once confirmed |
| Separate safety rating (PRD) | None | "Did you feel safe?" (Yes / Mostly / No) on every rating: confidential, averaged apart from the public rating, shown to admins, counted in ride ranking once a driver has three. "No" alerts admins like a safety report, now also by push |
| Fake call (PRD) | None | Safety > Fake call: pick who "calls" and when; a full-screen incoming call that vibrates, then a call in progress |
| Emergency numbers | 999 hard-coded in six screens; police and ambulance only in the help text | From the market registry everywhere; police, ambulance and fire one tap away on the SOS screen |
| Suspending the other party (UC-A03) | Only from the user's page | One click on the incident, with a warning not to tip them off while the person may still be with them |
| Pickup code (approved 30 September) | Anyone could tap "Picked up"; a rider could get into the wrong car | Each booking has a 4-digit code only the rider sees; the driver enters it at pickup and the rider gets in when their app confirms it. The rider can confirm in their own app instead; five wrong codes lock it, warn the rider and tell admins. The simulated rider's code is 0000, written in its booking note |
| Location with the screen off (approved 30 September) | Positions were sent only while the SOS screen was open | A background task sends the position every 5 seconds until the SOS closes, with an "SOS active" notification. On Android it runs as a foreground service, which needs only the "while using the app" permission, not background location |
| SOS audio (approved 30 September) | None | Off by default; switched on in Safety. During an SOS the phone records one-minute parts and uploads each as it ends. Stored with the incident (`sos/<id>/`), so closing an account never deletes evidence; played by admins through 15-minute links; deleted with a false alarm after 90 days |
| Identity photos (decided 30 September) | Kept until the account closed | Deleted as soon as an admin decides; only the decision is kept |
| Gender rule (decided 30 September) | Undecided | The ID proves who someone is; the admin confirms the gender they live as. A trans woman is a woman for women-only rides |
| Ride alerts for women-only rides | Never sent, even to verified women | Sent to verified women whose saved route it matches |
| Offline, outside a ride | Only "call 999" | Emergency contacts are kept on the phone, so "Text my contacts from my phone" works with no data; cleared on sign-out |
| The car during a rider's SOS (bug) | The car's position was kept 60 seconds in memory and never reached the SOS: with the rider's phone taken, staff saw nothing even though the car was still reporting | Every phone on the ride is shown live on the incident's map, and the family's link shows where the car is |
| The car with Maps open (bug) | The driver's app sent the car's position only while on screen; "Open route in Maps" or a locked phone stopped it mid-ride | A background task sends it every 5 s, with a "Ride in progress" notification |
| Trip trail (decided 30 September) | No route stored for any ride, so a safety report made after the trip had nothing to look at | One point every 15 s per phone, kept 30 days; kept for good once an SOS, safety report or dispute is attached |
| Riders' phones (decided 30 September) | Never traced; a driver robbed by riders had no trace of them | Traced from pickup to drop |
| Phone switched off (decided 30 September) | "Out of contact" only | Every position carries the battery level: near 0% it probably ran out; with charge left it was switched off or taken, and the alert says so. The low-battery screen tells the person what still works |
| "What's happening?" (decided 30 September) | Staff found out by calling | One optional tap after the alert: the driver, a passenger, someone outside, medical, accident. Naming someone raises the risk and marks them on the incident; medical or accident tells staff the other person may help |
| Car trackers (decided 1 October) | When every phone was off, only last positions were left | Drivers can link the GPS tracker in their car (UC-D11). Trackers report to Poolora's Traccar gateway (forwarder only, `infra/traccar`), which reads almost every tracker protocol and accepts forwarding from tracking companies (Wialon, Traccar, GPSWox). During rides the car's own trail joins the trip trail; its panic button raises an SOS; a cut tracker alerts the team. Optional, with a "Tracked car" badge. Outside rides only the time of the last report is kept. Poolora never cuts an engine |
| Identifying everyone (UC-A03) | Names, phones and the plate | The car in full with photos and the driver's documents, every other rider, ID-check status, licence number, mobile money numbers (registered to a name), and the chat and calls between them |

Decisions made on purpose:

- **No automatic warning for false alarms.** UC-R07 says more than three is a warning. They are counted and shown to the admin, who decides; an automatic penalty would teach people not to press SOS.
- **No automatic suspension on every SOS.** UC-A03 says "driver suspended pending investigation". Automatic suspension would punish drivers for accidental presses and, worse, tell a dangerous driver about the SOS while the rider is still in the car. The admin does it in one click when it is safe.
- **A declared gender alone is never enough.** It would let any man into a women-only ride; an admin checks the selfie against the ID, then confirms the gender the person lives as.

### 1.8 Phase 2 begins (1–2 October 2026)

Every use case up to Phase 4 is built, so work moved to the future phases in the project plan (§3.2). They are designed in `12-NEXT-PHASES.md`, with use cases UC-R11, UC-X03, UC-C01 to UC-C03, UC-X04 and UC-R12 in `design/03-USE-CASES.md` §13. Loyalty and rewards, one of them, was already built (coins and tiers in the wallet).

| Area | Now |
|---|---|
| Carbon footprint tracking (UC-R11) | Each completed booking stores the rider's leg along the route (`distanceKm`) and the CO₂ it saved against going alone in an average car (`co2SavedKg`); both are added to the rider's and the driver's stats. Profile → Your impact shows all time, this month, six months of bars and "How we count"; the receipt and its email show the trip's saving; the web admin's dashboard shows the platform total. Emission factors per vehicle class are in `config.carbon`. `npm run backfill:carbon` measures bookings completed before. 13 tests (`Carbon.test.ts`) |
| Multi-language, step 1 (UC-X03) | i18next with English as the fallback; Settings → Language and `User.language`; each market lists its languages. The SOS screen is in the catalogue, and an SOS text sent in another language carries the English beneath it. Shona and Ndebele are empty and hidden until native speakers have reviewed them (12-NEXT-PHASES §2 has the translators' steps). Needs a native rebuild for `expo-localization` |

---

## 2. Still open

| Item | Docs | Why it is open |
|---|---|---|
| Platform fee on refunds | UC-R09 calls it non-refundable | An admin setting (keep the platform fee on cancellation) now exists; its default is a business decision |
| Ride-hailing regulations | UC-D02, UC-R09 | Cabinet gave e-hailing platforms a five-month transition from 8 September 2026 while regulations are written. Check the fare, refund and commission rules against them when published |
| Payout automation | UC-D09 | Admins pay withdrawals by hand from a business mobile money account; Paynow has no payout API |
| Legal | Security spec 6.0 | POTRAZ data controller licence, a Data Protection Officer, a lawyer's review of the policy and terms (see SETUP-TODO.md) |
| Safe routes and safe pickup points | PRD | Needs data on lighting and busy places that does not exist for Zimbabwe yet; OpenStreetMap has too little |
| New app build and store declarations | UC-R07 | Background SOS location and SOS audio add native modules: rebuild the app (`npx expo run:android`, or EAS). Google Play then asks for the foreground-service declarations (location and microphone, with a short video of the SOS), and Apple for the background-location and microphone reasons. Have the lawyer confirm recording during an SOS before launch |
| Tracker gateway and partners | UC-D11 | Run the gateway (`infra/traccar/README.md`) and set `TRACKER_GATEWAY_KEY`, `_HOST`, `_PORT`. Local providers (eTrack, YoTracker, EzyTrack, Cartrack, Guard-Alert Pinpoint, Kukhutech) publish no API: forwarding a consenting driver's car needs an agreement with each. Low-cost GT06 trackers (about US$15 with a panic button) work without one |
| Emission factors | UC-R11 | Round figures for typical petrol cars of each class (`config.carbon`). Check them against a published source before quoting a platform total in marketing |
| Multi-language (UC-X03) | 12-NEXT-PHASES §2 | The other screens still need moving into the catalogue, then the backend's pushes and texts. Shona and Ndebele need paid native-speaker translators and a second reviewer before they are switched on |
| Corporate partnerships, video calling, public transport | 12-NEXT-PHASES §3–5 | Designed. Corporate needs the business decisions listed there; SOS video needs a provider and the lawyer's view on recording; public transport needs the list of ranks and termini |
| Legal wording | Privacy policy | Updated for the ID photo and selfie, SOS audio and location with the screen off; still part of the lawyer's review |

## 3. Documentation cleanup

The documents disagree with each other and with the code in several places:

1. ~~**Vendors.**~~ Every document names Paynow for payments (September 2026; Razorpay before) and OpenStreetMap (Google optional) for maps. Email is plain SMTP (`SMTP_*` in `backend/.env.example`), so any provider works.
2. ~~**API specification is out of date.**~~ Rewritten from the code in September 2026, and checked again on 29 September: all 234 routes are documented (236 with the support assistant's two, added 30 September; the safety pass of the same day added ten more: SOS current, cancel and audio upload, the rider's in-car confirmation, the identity check and its four admin routes) and none that is documented is missing.
3. ~~**Contradictions in the use cases.**~~ UC-D02 now refuses rides over 650 km, and parcel pooling is Phase 4 everywhere.
4. ~~**Numbering.**~~ `08-TECHNICAL-REQUIREMENTS.md` runs 1–15 (the second "Quality Metrics" was the database configuration), and `03-USE-CASES.md` runs 1–12.
5. ~~**Naming.**~~ The documents say Poolora.
6. ~~**Admin.**~~ The web dashboard the documents describe now exists (`admin-web/`), alongside the app's admin screens.
7. ~~**Tracking interval.**~~ 5 seconds everywhere, as in the app.
8. **Aspirational design.** `02-SYSTEM-ARCHITECTURE.md`, `05-SYSTEM-DESIGN.md`, `06-DATABASE-SCHEMAS.md` and `08-TECHNICAL-REQUIREMENTS.md` still describe a larger target design (PostgreSQL, RabbitMQ, Redux, a web dashboard) that was never built. Each now opens with a status note pointing here and to the API specification. Rewrite them only if they are needed as a reference for new work.

Code hygiene: ~~frontend linting could not run~~ fixed; `npm run lint` passes and CI runs it.

---

## 4. Suggested order

Everything in the earlier plan is done, including parcel photo proof and masked calls. What remains (section 2) is mostly launch paperwork and business decisions. In order:

1. The legal steps in SETUP-TODO.md (POTRAZ licence, DPO, lawyer's review), since they gate launch.
2. Review fares and refunds against the e-hailing regulations once they are published.

---

## 5. Free maps and the ride simulator

### Maps without a key

- **App:** MapLibre draws OpenFreeMap vector tiles (liberty style for light mode, dark style for dark mode). No key, sign-up or usage limit. `MAP_STYLE_LIGHT` and `MAP_STYLE_DARK` in `frontend/.env` switch to another style. A native rebuild is needed once (`npx expo run:android`) because the map library changed.
- **Backend:** with `MAPS_PROVIDER=osm`, or no Google key, place suggestions come from Photon, addresses from Nominatim (with Photon as a fallback), and routes and distances from OSRM. Results are cached in Redis.
- **Production:** the public Nominatim and OSRM servers are meant for light use (Nominatim allows 1 request per second). For real traffic, self-host them (both have Docker images) or use a hosted OSM provider, and set `PHOTON_URL`, `NOMINATIM_URL` and `OSRM_URL`.

### Simulating a ride

Available when the backend runs with `NODE_ENV` other than `production`, or with `ENABLE_RIDE_SIMULATION=true`. The **Testing** section then appears in Settings.

**As a rider:** Settings → Testing → *Simulate a ride as rider*. A bot driver ("Sim Driver") posts a ride from your location, your seat is confirmed, and the live ride screen opens. The car drives about 2 km to you and waits at the pickup ("Driver has arrived"). It then starts the ride, follows the real road route to a drop about 4 km away, and completes the ride so you can rate it. The whole run takes about 2–3 minutes.

**As a driver** (needs an approved driver account with a vehicle): Settings → Testing → *Simulate a ride as driver*. A ride is created from your location, and a bot rider ("Sim Rider") requests a seat, paid from its wallet.
1. Accept the request under Requests.
2. On the ride screen, tap **Start ride**.
3. Tap **Simulate the drive** to move the car along the route instead of using your GPS. Without it, your real GPS is shared.
4. Tap **Complete ride** at the end.

For an existing ride, *Get a test rider request* on its details screen adds the bot rider to that ride.

Simulation state is kept in memory, so it works with a single backend instance only. The API is `/dev/simulate` (`as-rider`, `as-driver`, `rides/:id/drive`, `rides/:id/stop`).
