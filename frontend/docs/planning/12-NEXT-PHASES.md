# Next Phases: Design

Every use case in `design/03-USE-CASES.md` up to Phase 4 is built (see `11-FEATURE-GAP-ANALYSIS.md`). What the project plan still lists as future work is in §3.2 of `01-PROJECT-PLAN.md`:

| Feature | Plan phase | State on 1 October 2026 |
|---|---|---|
| Loyalty and rewards | Phase 2 | **Built.** Coins on every completed ride, five tiers by rides completed, tier bonuses, conversion to wallet money, 12-month expiry (`RewardService`, `WalletService`, Wallet screen) |
| Carbon footprint tracking | Phase 2 | **Built** (UC-R11) |
| Multi-language support | Phase 2 | Designed here (UC-X03); framework and SOS screen built, translations needed |
| Corporate partnerships | Phase 3 | Designed here (UC-C01 to UC-C03) |
| Video calling | Phase 3 | Designed here (UC-X04) |
| Public transport schedules | Phase 3 | Designed here (UC-R12) |

Order: the two Phase 2 features first, since they serve every user. Corporate partnerships are next, because they bring regular commuters, which is what fills seats. Video calling and public transport follow; both depend on things outside the code (data costs, data that does not exist yet).

The use cases are written into `design/03-USE-CASES.md` §13.

---

## 1. Carbon footprint tracking (UC-R11)

### What the user sees

- **Profile → Your impact**: CO₂ saved, kilometres shared and trips shared, all time and this month, with the last six months as bars. One line says how it is worked out, and a "How we count" sheet gives the method in full.
- **The receipt** of a completed trip shows what that trip saved.
- **Drivers** see what their passengers saved by riding with them. The driver was going anyway, so the saving belongs to the shared seats, and both sides see it.
- **Admins** see the platform total on the dashboard, for reports and the public site.

### How it is counted

A shared seat saves the trip the rider would otherwise have made alone. For each completed booking:

```
leg (km)            = distance along the ride's route from the rider's pickup to their drop
on board            = the driver + every seat confirmed or completed on the ride
the rider's share   = leg × car's kg CO₂/km × seats booked ÷ on board
had they gone alone = leg × average car's kg CO₂/km           (one car per booking, however many seats)
saved               = had they gone alone − the rider's share  (never below zero)
```

Choices, made to stay on the conservative side so the number can be defended:

- **One car per booking**, not per seat: a family booking two seats would have shared a car anyway.
- **The baseline is a private car**, which is what car pooling replaces for most of our riders. Someone who would otherwise have taken a kombi saves less, and the "How we count" sheet says so plainly instead of hiding it.
- **The driver's detour is not counted.** Pickups are within 2 km of the route, so it is small, but it means the figure is an estimate, and the app calls it one.
- **Factors are settings.** Defaults are round figures for a typical petrol car of each size, of the order published in the UK government's greenhouse-gas conversion factors (average car 0.17 kg/km; small 0.14; medium 0.17; large car, SUV, bakkie and minivan 0.21; motorbike 0.11; tuk-tuk 0.09). Zimbabwe's fleet is older than the UK's, so these understate rather than overstate. They are in `config.carbon` and can be changed per market; check them before quoting a total publicly.

### Where it lives

- `Booking.distanceKm` and `Booking.co2SavedKg`, set by `completeBooking` (every way a booking completes goes through it). Bookings completed before this get them from `npm run backfill:carbon`.
- `User.stats.co2SavedKg` and `User.stats.kmShared`, incremented for both rider and driver on completion, so the profile reads them without a query.
- `CarbonService` holds the formula, so the receipt, the backfill and the tests use one copy.
- `GET /users/me/impact`: totals, this month, the last six months, and the factors used.
- `GET /admin/overview` gains the platform total.

---

## 2. Multi-language support (UC-X03)

### Languages

Zimbabwe has sixteen official languages. English is the language of business and of every document Poolora has; **Shona** and **Ndebele** are the most widely spoken. The first release offers English, Shona and Ndebele. Every later market adds its own through the market registry (`languages` on each market), so nothing assumes Zimbabwe.

### How it works

- **i18next** with `react-i18next` in the app, and `expo-localization` to pick the phone's language on first start. One JSON catalogue per language under `frontend/src/i18n/locales/`, keyed by screen.
- **Settings → Language** lets the user change it at any time. The choice is saved on the phone and on the account (`User.language`), so the backend writes pushes, texts and emails to that person in their language.
- **English is the fallback** for any key a catalogue lacks, so a partly translated language never shows a blank or a key.
- Numbers, money and dates keep using the market's formats (`utils/region.ts`); only words change.
- The backend gets a small catalogue of its own for the messages it sends (pushes, SOS texts, receipts), chosen by the recipient's language, not the sender's.

### The safety rule

A wrong word on the SOS screen or in an SOS text could cost someone help. So:

- **Translations are written or checked by native speakers before a language is switched on.** Each catalogue has a `reviewed` flag; Settings shows only reviewed languages, unless the build sets `EXPO_PUBLIC_SHOW_UNREVIEWED_LANGUAGES=true` for the translators.
- **SOS texts to emergency contacts carry the English line as well**, so a contact who reads only English still understands.
- The emergency numbers are digits and never translated.

### Rollout

1. The framework, the language setting and the fallback, with the catalogue extracted from the sign-in, home, booking, ride and safety screens first, since every user passes through them.
2. Shona and Ndebele drafted, then reviewed by native speakers (paid reviewers, not machine translation alone), safety screens first.
3. The remaining screens, then the backend's messages, then the public site.

### Where it stands (2 October 2026)

Steps 1 and 3 are done in English. The whole app reads its words from the catalogue (about 1,700 phrases): every rider, driver, trip, parcel, wallet, help and safety screen, the tab bar, error messages and the background-tracking notifications. The four in-app admin screens stay in English, like the server's messages to staff. Built with it: i18next with English as the fallback, the phone's language on first start, Settings → Language (shown once a second language is reviewed), `User.language` saved through `PATCH /users/me`, and `languages` in each market of the registry. An SOS text sent in another language has the English beneath it. A test fails if the code asks for a key the English catalogue lacks.

Moving the text also fixed leftovers from the India version: the emergency-contact and parcel screens asked for a "10-digit" number (they now show the market's own format), and the trip planner suggested Goa and the Dudhsagar Falls.

The server writes in each person's language too (`backend/src/i18n`): pushes, in-app notifications and texts name a phrase, and each is written in the recipient's language when sent, English where a phrase is missing. Texts to emergency contacts and the contact-confirmation text are in the language of the person who raised the SOS or added the contact, with the English beneath. Live alerts (the car's approach, leaving the route) and Poolora's own payment instructions carry a key the app translates; Paynow's own instructions stay as Paynow sends them. Messages to the safety team and admins stay in English, and so do messages that carry an admin's own words (dispute decisions, support replies, appeal and claim decisions). Translators fill `backend/src/i18n/locales/sn.json` and `nd.json` the same way as the app's. The Shona and Ndebele catalogues are empty and marked unreviewed, so the app shows English until translators fill them.

### For translators

- The source is `frontend/src/i18n/locales/en.json`. Translate into `sn.json` or `nd.json` with the same keys; leave out any key not yet done and English shows in its place.
- Keep `{{number}}`, `{{seconds}}` and the other placeholders exactly as they are.
- Run a build with `EXPO_PUBLIC_SHOW_UNREVIEWED_LANGUAGES=true` to see the language in Settings.
- When a second native speaker has checked the whole file, set `reviewed: true` for it in `frontend/src/i18n/languages.ts`. That switches it on for everyone.

---

## 3. Corporate partnerships (UC-C01 to UC-C03)

Commuting is where pooling works best: the same route at the same time every day. An employer can make it work faster than any campaign: it tells staff, it can pay part of the fare, and colleagues trust each other.

### Design

- **Organisation**: a company, its email domains, its admins, a billing contact and a policy (who may ride, what the company pays).
- **Joining**: staff add their work email; a link proves it (the same pattern as emergency-contact confirmation). Joining shows a "Works at …" badge only to colleagues, never to the public.
- **Colleagues only**: a driver can post a ride open only to their organisation's members. Search shows them only to members.
- **Company-paid rides**: the policy sets a share of the fare (0–100%) and a monthly cap per person, for rides to or from the workplace on weekdays. The rider pays the rest. The company's share is billed monthly with a statement (the report and email machinery from UC-A06 already does this), and paid by bank transfer; Paynow has no business-billing API.
- **Company dashboard**: a role in `admin-web/` limited to its own organisation: members, rides, spend, CO₂ saved (UC-R11 feeds a company sustainability report, which is often why a company signs up).
- **Privacy**: the company sees who rode, when and what it cost; never routes, positions, ratings or safety reports.

Decided on 2 October 2026: Poolora takes 10% on the part of a fare the company pays (riders' own part keeps the normal fee); companies pay no fee to start; the monthly bill is paid by bank transfer within 30 days, and the company's contribution pauses if it is not. A cancelled trip costs the company nothing, and Poolora pays drivers in full when a trip completes and collects from the company afterwards.

Built in slices:

1. **Companies and joining** (done): the web admin's Companies page sets a company up with its email domains and billing contact; staff confirm a work email from Profile → Work by a link valid for 24 hours; one work email per account; public email services cannot be a company domain.
2. Colleagues-only rides and the "Works at" badge.
3. Company-paid fares: share, monthly cap, weekdays and sites.
4. Monthly billing.
5. The company's own dashboard.

---

## 4. Video calling (UC-X04)

### The constraint

Mobile data is expensive in Zimbabwe, and masked voice calls between rider and driver already exist (`CallService`, Twilio). A video call between rider and driver adds little the voice call does not, and costs the rider data.

### Where video earns its place

1. **During an SOS**, the safety team can ask the person to switch on their camera. Staff see what is happening when the person cannot speak freely, and a recording joins the incident evidence, as the SOS audio already does. This is the strongest case, and it fits Poolora's safety-first position.
2. **Identity checks** (UC-R01, women-only rides): a short live video call with an admin, as an option for people whose selfie was unclear, instead of sending them away.
3. **Rider and driver**, opt-in, before the pickup only, to recognise each other at a busy rank. Lowest priority.

### Design

- A hosted WebRTC service (LiveKit Cloud, Daily or Agora), chosen on price per minute and on media servers near southern Africa. The backend issues short-lived room tokens; no phone numbers are shared, as with masked calls.
- Low resolution by default (240p) and an audio-only button, to keep data use down; the app shows the data a minute costs.
- Recording only for SOS calls, stored as the SOS audio is (`sos/<id>/`), with the same retention.

Needs: the provider account, a lawyer's view on recording video during an SOS (with the audio question already on the list), and the store declarations for camera use.

---

## 5. Public transport (UC-R12)

### The constraint

The plan says "integration with public transport schedules". Zimbabwe's kombis and ZUPCO buses publish no schedules or feeds, and most kombis run when full, not to a timetable. There is nothing to integrate with yet.

### What can be built

- **Ranks and termini as places**: a list per market of kombi ranks and bus termini (in Harare: Copacabana, Market Square, Fourth Street, Charge Office, Mbare Musika; intercity: Mbare Musika and Roadport), kept in the market registry. They appear first in place search and as suggested pickups and drops, so a rider can pool the first or last few kilometres to a rank.
- **"Connect to a bus"**: for intercity routes, a rider can book a seat to a terminus with a time to be there, and the driver sees "catching a bus at 06:00", so they know not to be late.
- **Demand prediction** (UC-AI03) lists public transport schedules as an input. That stays out until data exists.
- **GTFS import** for later markets that publish a feed: the design is a per-market GTFS URL, a nightly import of stops and departures, and "leave by" times in search. Not built until a market with a feed is on the roadmap.
