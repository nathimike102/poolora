# Siham App

The Siham mobile app for riders, drivers and admins. It is a React Native 0.86 app on Expo 57, written in TypeScript. Riders search and book scheduled rides, pay from the wallet or through Paynow (EcoCash, OneMoney, InnBucks or card), follow the car live, chat, and raise an SOS. Drivers publish rides, accept requests, and start and finish trips. Admins review driver verifications, SOS incidents and platform metrics.

The backend is in [`../backend`](../backend). Every key and environment variable is listed in [`../docs/SECRETS.md`](../docs/SECRETS.md).

## Running it

```bash
npm install
cp .env.example .env        # set REACT_NATIVE_API_BASE_URL, e.g. http://<your LAN IP>:5002
npx expo run:android        # native build; needed once, and after native library changes
npx expo start              # then reload from the dev client
```

Android builds need `google-services.json` from Firebase in this folder. The map uses MapLibre with OpenFreeMap tiles and needs no key. Set `MAP_STYLE_LIGHT` or `MAP_STYLE_DARK` to use other styles.

To try a whole trip on one phone, open **Settings → Testing** while the backend runs outside production. The ride simulator plays the other side of the trip (see [the gap analysis](docs/planning/11-FEATURE-GAP-ANALYSIS.md#5-free-maps-and-the-ride-simulator)).

## Scripts

| Script | Purpose |
|---|---|
| `npx expo start` | Dev server |
| `npm run android` / `npm run ios` | Native build and install |
| `npm run lint` | ESLint, including React hook dependency checks |
| `npm run typecheck` | TypeScript |
| `npm test` | Jest (jest-expo) |

CI runs lint, typecheck and tests on every push and pull request.

Builds for stores go through EAS (`eas.json` has `development`, `preview` and `production` profiles). See the root README.

## Layout

```
src/
├── screens/        rider/, driver/, admin/, shared/ (chat, SOS, settings), parcel/ and trip/ (not connected yet)
├── components/     Shared UI, including LiveMap
├── services/       One module per backend area (rides, bookings, payments, safety, simulation…)
├── api/            Axios client with token refresh, and every endpoint path
├── context/        AppContext: session, role, theme
├── navigation/     Stacks and tabs
├── theme/          Colours (light and dark), type, spacing
├── utils/          Logging, errors, polyline decoding, storage
└── types/          API types
```

## Documentation

The design documents in `docs/` were written before the app was built. Each opens with a status note, and where a document and the code disagree, the code is right.

| Document | Use it for |
|---|---|
| [planning/11-FEATURE-GAP-ANALYSIS.md](docs/planning/11-FEATURE-GAP-ANALYSIS.md) | **Start here.** What is built, what is missing, what to build next, and where the documents and code differ |
| [technical/07-API-SPECIFICATIONS.md](docs/technical/07-API-SPECIFICATIONS.md) | The API as built: every endpoint, booking and refund rules, socket events |
| [design/03-USE-CASES.md](docs/design/03-USE-CASES.md) | The intended behaviour, as use cases UC-R, UC-D, UC-A and others |
| [planning/01-PROJECT-PLAN.md](docs/planning/01-PROJECT-PLAN.md) | Scope and phases |
| [design/02-SYSTEM-ARCHITECTURE.md](docs/design/02-SYSTEM-ARCHITECTURE.md), [05-SYSTEM-DESIGN.md](docs/design/05-SYSTEM-DESIGN.md), [06-DATABASE-SCHEMAS.md](docs/design/06-DATABASE-SCHEMAS.md) | The original target design, which is larger than what was built |
| [visuals/04-FLOWCHARTS.md](docs/visuals/04-FLOWCHARTS.md) | Flow diagrams |
| [technical/08-TECHNICAL-REQUIREMENTS.md](docs/technical/08-TECHNICAL-REQUIREMENTS.md), [09-SECURITY-SPECIFICATIONS.md](docs/technical/09-SECURITY-SPECIFICATIONS.md) | Requirements and security design |
| [testing/10-TESTING-STRATEGY.md](docs/testing/10-TESTING-STRATEGY.md) | Testing approach |
