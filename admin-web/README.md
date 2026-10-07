# Siham Admin

The web dashboard for Siham's operations team, built to the admin use cases UC-A01 to UC-A07 in `frontend/docs/design/03-USE-CASES.md`. It is a Vite and React single-page app that talks to the backend's `/admin` API. The mobile app's admin screens remain for use on the go.

## What it does

| Page | Use case | What an admin can do |
|---|---|---|
| Dashboard | UC-A02 | Live figures for users, rides, money, safety and system health, refreshed every 30 seconds. A red banner for any open SOS (pushed over Socket.IO). Anomalies such as a spike in cancellations, bookings well below normal, a high error rate, blocks waiting for approval, fraud flags waiting over 2 hours, and overdue applications |
| SOS incidents | UC-A03 | Every incident, open ones first. The incident page has a live map of the trail, one-tap calling for rider, driver and emergency contacts, the ride, and the timeline. Admins take the incident, log calls and actions, record a police call, and resolve it or mark it a false alarm |
| Driver applications | UC-A01 | The queue, oldest first, with document status, risk indicators and a flag when a review is past 48 hours. The review page opens each document; approving is disabled until every item on the use case's checklist is ticked. Admins approve, reject with a reason, or ask for specific documents again |
| Disputes | UC-A04 | The case file: both parties with ratings, warnings and earlier disputes; the booking and payments; the chat between them; ratings; any SOS on the ride. The decision refunds the rider (up to what is still refundable), pays the driver's wallet, warns and suspends either party, and tells both |
| Users | UC-A05 | Search by name, phone or email. The account page shows history, ratings, payments, disputes, SOS and admin actions. Admins suspend for 7, 15 or 30 days or until lifted, reinstate, and add internal notes. A permanent block needs a second admin to approve it |
| Reports | UC-A06 | Users, rides, money, performance and safety over any range up to two years, by day, week or month: headline figures, a chart with its data table, breakdowns (popular routes, peak hours, payment methods, top drivers, disputes by category), and CSV download |
| Fraud flags | UC-AI02 | Accounts the automatic check flagged on failed payments, oldest first, with what it found and a flag after 2 hours. Critical ones are suspended until reviewed. Admins clear a false positive, which lifts that suspension and tells the user, or confirm it; a permanent block still goes through Users and a second admin. Reviewed flags are kept as labels for retraining |
| Reviews | UC-R06 | Written reviews waiting for approval, and ratings that reported a problem, with safety reports first. Publishing puts a review on the profile; rejecting keeps it hidden while the stars still count. Reported problems are never public. A safety report shows as a critical alert on the dashboard until it is handled |
| Support requests | UC-X02 | Requests from the app's Help centre, safety and payment first. The page shows the user, the trip and the thread. A reply reaches the user in the app, by push and by email, and they can answer in the same thread |
| Settings | UC-A07 | Commission, refund tiers, payment and response time limits, empty-ride cancellation, SOS check-in intervals, match-score weights, search defaults and ride limits. Every change needs a reason, applies to all servers within a minute, and can be reverted within 24 hours |
| Audit log | UC-A05 step 5 | Every admin action, who took it and why. Entries cannot be edited |

Every action that changes something asks for a reason, is written to the audit log, and, where it affects a user, sends them a notification.

## Running it

```bash
cp .env.example .env    # VITE_API_URL and the Firebase web app config
npm install             # from the repository root, or here
npm run dev             # http://localhost:5174
```

- **Backend:** add the admin's origin to `CORS_ORIGIN` in `backend/.env` (for example `http://localhost:5174`).
- **Sign-in:** Firebase email and password, or Google. "Forgot password?" sends Firebase's reset email to the address typed in. In the Firebase console, add a **Web app** to the same project as the mobile app, copy its config into `.env`, enable the Email/Password and Google providers, and add the admin's domain under Authentication > Settings > Authorized domains.
- **Admin accounts:** an account becomes an admin by having the `admin` capability. There is no self-service way to get it; set it in the database:

  ```js
  db.users.updateOne({ email: 'someone@siham.app', emailVerifiedAt: { $exists: true } }, { $addToSet: { capabilities: 'admin' } })
  ```

  The person signs in once on this site first, with Google or with their email and password. If they are told to verify the address, they choose "Forgot password?" and set the password from the email, which proves it. Keep `emailVerifiedAt` in the filter: anyone can type any address into their profile in the app, and without the filter the capability could go to their account instead. If nothing matches, they have not signed in here with a verified address yet.

## Scripts

| Script | Purpose |
|---|---|
| `npm run dev` | Dev server on port 5174 |
| `npm run build` | Typecheck and build to `dist/` |
| `npm run typecheck` | TypeScript |
| `npm test` | Vitest |

CI runs typecheck, tests and build on every push and pull request.

## Deploying

`dist/` is a static site. `vercel.json` sends every path to `index.html` (client-side routing) and sets headers so the admin cannot be framed or indexed. Set the `VITE_*` variables in the hosting provider; they are compiled into the build. Serve it on its own hostname and add that hostname to the backend's `CORS_ORIGIN`.

Sessions are kept in `sessionStorage`, so they end when the tab closes. Access tokens refresh automatically.

## Layout

```
src/
├── pages/        One file per section: Dashboard, Sos, Applications, Disputes, Users, Reports, Settings, Audit, SignIn
├── components/   Layout (sidebar, SOS banner, theme), LineChart, MapView, dialogs, badges, tiles
├── lib/          api (fetch with token refresh), auth (Firebase), socket (live SOS), format, useApi
└── styles.css    Light and dark tokens; follows the system theme unless the admin picks one
```

## Not built yet

The use cases describe some things this dashboard does not do:
- **Reports:** scheduled and emailed reports, PDF and Excel export (CSV only).
- **Alerts:** SMS and email alerts to admins; custom alert rules. Anomaly detection is rule-based, not a model.
- **Senior-admin approval:** approval for critical settings. Any second admin approves a block, but settings changes take effect at once and rely on the 24-hour revert.
- **Account tools:** merging duplicate accounts, and an appeals workflow.
- **Driver checks:** background checks and automatic document validation.
- **SOS:** recording calls made during an SOS; the call log is written by hand.
