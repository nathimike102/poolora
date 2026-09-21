# Secrets and environment variables

Every key, password and credential file the project needs: where to get each
one, and which file or setting it goes into. Real values never go in git. The
`.env` files, `google-services.json` and service-account JSON files are
gitignored. Keep the originals in a password manager.

## Quick checklist: files to put back after a fresh clone

| File | Copy from | Used by |
|---|---|---|
| `backend/.env` | `backend/.env.example` | Backend API (local and Docker Compose) |
| `backend/secrets/firebase-service-account.json` | Firebase console (see below) | Backend: Firebase sign-in and push |
| `frontend/.env` | `frontend/.env.example` | Mobile app build |
| `frontend/google-services.json` | Firebase console, Android app | Android build (`app.config.js`) |
| `web-landing/.env` | `web-landing/.env.example` | Website contact form (`vercel dev`) |
| `k8s/secret.yaml` values | Replace every `CHANGE_ME` | Kubernetes production |

You can also pass the Firebase service account as `FIREBASE_SERVICE_ACCOUNT_JSON`
(raw or base64) instead of mounting the file.

## Generating the values you create yourself

These are not issued by any provider. Generate each one once and store it.

```bash
# JWT secrets: 64+ characters, different for access and refresh
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Database, Redis and Grafana passwords
openssl rand -base64 32

# Internal key shared by the backend and the ML service
openssl rand -hex 32

# MongoDB replica-set key file content (Kubernetes only)
openssl rand -base64 756 | tr -d '\n'
```

## Backend (`backend/.env`, `k8s/secret.yaml`, `k8s/configmap.yaml`)

| Variable | Required | How to get it |
|---|---|---|
| `NODE_ENV` | yes | `production`, `development` or `test` |
| `PORT` | no | Defaults to `5002` |
| `APP_BASE_URL` | yes | Public API origin. **Required in production, no default.** Used in the SOS tracking links sent by SMS, so it must be reachable from a phone |
| `MONGO_URI` | yes | Self-hosted: build it from `MONGO_USER` and `MONGO_PASS`. Atlas: cloud.mongodb.com, Database, Connect, Drivers |
| `MONGO_USER`, `MONGO_PASS` | Docker/K8s | Generate the password (above) |
| `MONGO_REPLICA_KEY` | K8s only | Generate (above) |
| `REDIS_HOST`, `REDIS_PORT` | no | Default `localhost:6379`. Docker: `redis` |
| `REDIS_PASSWORD` | prod | Generate (above) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | yes | Generate (above). The server refuses to start without them |
| `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY` | no | Default `15m` and `7d` |
| `AUTH_PROVIDER` | no | `hybrid` (recommended), `firebase` or `custom` |
| `FIREBASE_PROJECT_ID` | yes | Firebase console, Project settings, General |
| `FIREBASE_DATABASE_URL` | yes | Firebase console, Realtime Database. Region-specific, e.g. `https://<project-id>-default-rtdb.asia-southeast1.firebasedatabase.app` |
| `FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT_JSON` | yes | Firebase console, Project settings, Service accounts, **Generate new private key**. Save the downloaded JSON to the path, or paste it into the JSON variable |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | yes | dashboard.razorpay.com, Account & Settings, API Keys. `rzp_test_` keys for testing, `rzp_live_` after KYC approval |
| `RAZORPAY_WEBHOOK_SECRET` | yes | Razorpay dashboard, Webhooks, Add webhook. URL: `<APP_BASE_URL>/payments/webhook`. Events: `payment.authorized`, `payment.captured`. You choose the secret there; copy the same value here |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | yes | AWS console, IAM, create a user with access limited to the uploads bucket (`s3:PutObject`, `s3:GetObject`), then Security credentials, Create access key |
| `AWS_REGION` | no | Default `ap-south-1` (Mumbai) |
| `AWS_S3_BUCKET` | yes | Create a private bucket (block all public access) in S3 |
| `TWILIO_ENABLED` | yes for SMS | `true` to send SMS. SOS texts to emergency contacts need this |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | if SMS on | console.twilio.com, Account Info on the dashboard |
| `TWILIO_PHONE_NUMBER` | if SMS on | Twilio console, Phone Numbers, buy a number that can send SMS to India (DLT registration is required for Indian traffic) |
| `GOOGLE_MAPS_API_KEY` | yes | console.cloud.google.com, APIs & Services, Credentials, Create API key. Enable Places, Geocoding and Directions. Restrict it to those APIs and to the server's IP. **Use a different key from the app's** |
| `ML_SERVICE_API_KEY` | yes | Generate (above). Same value on the ML service |
| `ML_SERVICE_URL` | no | ML service address. Default `http://poolora-ml:8000` |
| `KAFKA_BROKERS`, `KAFKA_CLIENT_ID` | no | Your Kafka brokers, comma-separated |
| `ELASTICSEARCH_URL` | no | Default `http://localhost:9200` |
| `CORS_ORIGIN` | yes | Comma-separated list of allowed origins. Never `*` in production |
| `PLATFORM_FEE_RATE` | no | Business setting, default `0.15` |
| `COIN_TO_INR_RATE` | no | Business setting for wallet coins |
| `SENTRY_DSN` | no | sentry.io, create a Node.js project, Settings, Client Keys (DSN). Empty disables it |
| `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `SENTRY_TRACES_SAMPLE_RATE` | no | Labels and sampling for Sentry |
| `GRAFANA_ADMIN_PASSWORD` | Docker/K8s | Generate (above) |
| `DEV_AUTH_BYPASS` | never in prod | Local development only. Ignored unless `NODE_ENV=development` |
| `DNS_SERVERS` | no | Only if your resolver cannot look up `mongodb+srv` records |

### Kubernetes-only secrets

| Secret | How to create it |
|---|---|
| `poolora-secrets` | Fill in `k8s/secret.yaml`, or better, create it without committing values: `kubectl create secret generic poolora-secrets -n poolora --from-env-file=backend/.env` |
| `firebase-service-account` | `kubectl create secret generic firebase-service-account -n poolora --from-file=firebase-service-account.json` |
| `ghcr-pull` | Lets the cluster pull the private backend and ML images from ghcr.io. Create a GitHub personal access token (classic) with only the `read:packages` scope, then run `GHCR_USER=nathimike102 GHCR_TOKEN=<token> scripts/deploy-k8s.sh`, which creates it. Not needed if you make both packages public |
| `poolora-api-tls` | Issued by cert-manager from the ingress annotation, or `kubectl create secret tls poolora-api-tls --cert=... --key=...` |
| `BACKUP_S3_BUCKET`, `BACKUP_AWS_ACCESS_KEY_ID`, `BACKUP_AWS_SECRET_ACCESS_KEY`, `BACKUP_AWS_REGION` | A separate bucket and IAM user for the daily database backup job. Give that user write access to that bucket only |

## Mobile app (`frontend/.env`, `frontend/google-services.json`)

| Variable or file | Required | How to get it |
|---|---|---|
| `REACT_NATIVE_API_BASE_URL` | yes | Backend URL. `http://<your LAN IP>:5002` for a physical device in development |
| `REACT_NATIVE_API_TIMEOUT` | no | Milliseconds, default `30000` |
| `GOOGLE_MAPS_API_KEY` | yes | Google Cloud, a **separate** key with Maps SDK for Android and Maps SDK for iOS enabled. Restrict it to package `com.poolora.app` with your signing certificate SHA-1, and to the iOS bundle id |
| `EAS_PROJECT_ID` | for EAS builds | expo.dev, your project, Project ID. Or run `eas init` |
| `SENTRY_DSN` | no | sentry.io, a React Native project, Client Keys |
| `FIREBASE_DATABASE_URL` | yes | Firebase console, Realtime Database. Region-specific instance URL |
| `GOOGLE_WEB_CLIENT_ID` | for Google sign-in | Google Cloud, Credentials, OAuth client ID of type Web application (the one Firebase creates) |
| `FIREBASE_*` | usually no | Read from `google-services.json`. Only set these to override it |
| `DEBUG_API_CALLS`, `LOG_LEVEL`, `DEV_AUTH_BYPASS` | no | Development switches |
| `google-services.json` | yes (Android) | Firebase console, Project settings, Your apps, the Android app (`com.poolora.app`), **google-services.json**. Put it in `frontend/` |
| `GoogleService-Info.plist` | for iOS | The same place, for the iOS app. Not yet referenced in `app.config.js`; add it when you set up iOS |

Getting the SHA-1: `cd frontend/android && ./gradlew signingReport` for local
builds, or `eas credentials` for EAS-managed keys. Add it in Firebase and in the
Maps key restriction.

## Website (`web-landing/.env`, Vercel environment variables)

Set these in Vercel, under Project, Settings, Environment Variables. Use
`web-landing/.env` only with `vercel dev`.

| Variable | Required | How to get it |
|---|---|---|
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | yes | Your mail provider's SMTP settings (Zoho, Google Workspace, Amazon SES and so on). Port `587` with `SMTP_SECURE=false`, or `465` with `true` |
| `SMTP_USER`, `SMTP_PASS` | yes | The mailbox login, or an app-specific password or SES SMTP credentials |
| `CONTACT_FROM_EMAIL`, `CONTACT_TO_EMAIL` | yes | Waitlist form sender and recipient |
| `INVESTORS_FROM_EMAIL`, `INVESTORS_TO_EMAIL` | yes | Investor form sender and recipient |
| `SUPPORT_EMAIL` | no | Reserved for a future support form |
| `TURNSTILE_SECRET_KEY` | recommended | dash.cloudflare.com, Turnstile, Add widget for the site's Vercel hostname, **Secret key** |
| `VITE_TURNSTILE_SITE_KEY` | recommended | The same widget's **Site key**. Build-time and public. Without it the forms fall back to the honeypot and rate limit |

Analytics: set `analytics.googleAnalyticsId` in `web-landing/src/config/site.ts`.
It is public and only loads after a visitor accepts the consent banner.

## ML service

| Variable | Required | How to get it |
|---|---|---|
| `ML_SERVICE_API_KEY` | yes | The same value as the backend's `ML_SERVICE_API_KEY` |

## CI and deployment (GitHub, Settings, Secrets and variables, Actions)

| Secret | How to get it |
|---|---|
| `EC2_HOST` | Public hostname or IP of the deploy server |
| `EC2_USER` | SSH user on that server, e.g. `ubuntu` |
| `EC2_SSH_KEY` | The private key for a deploy-only key pair. Put its public key in the server's `~/.ssh/authorized_keys` |

Without `EC2_HOST`, the deploy job skips with a notice instead of failing.
| `GITHUB_TOKEN` | Provided automatically. Used to push images to ghcr.io |

## Sending mail without a custom domain

The project has no domain of its own: the site is served from a
`*.vercel.app` hostname. That has a consequence for the contact and waitlist
forms, because SPF, DKIM and DMARC are DNS records on a domain **you**
control, and nobody can add records to `vercel.app`.

So the `CONTACT_FROM_EMAIL` / `INVESTORS_FROM_EMAIL` envelope cannot be an
address at the site's own hostname. Pick one of:

1. **A provider-hosted sending domain.** Services such as Resend, Postmark or
   SendGrid let you send from a subdomain they own and authenticate. Fastest
   path, and deliverability is their problem rather than yours.
2. **Send through an existing mailbox.** Point the SMTP credentials at a
   Gmail/Zoho account and use that same address as the From. Fine for low
   volume; the From address is visibly a personal mailbox.
3. **Register a domain.** Then the SPF/DKIM/DMARC setup below applies, and the
   site can move off `*.vercel.app` at the same time.

If you take option 3, add these at the DNS host before sending mail:

- **SPF:** a TXT record on the apex that includes your mail provider, e.g. `v=spf1 include:zoho.in ~all`.
- **DKIM:** the TXT record your mail provider generates.
- **DMARC:** a TXT record on `_dmarc.<domain>`. Start with `v=DMARC1; p=none; rua=mailto:<your address>`, then move to `p=quarantine` once the reports come back clean.

## Key rotation history

### 2026-09-20 — Firebase project rebuilt after a key leak

Three Google API keys belonging to the old Firebase project `one-piece-ecc0b`
were committed to git and flagged by GitHub secret scanning:

| Key | Committed in |
| --- | --- |
| Firebase Android API key | `frontend/google-services.json`, `frontend/.env.example` |
| Google Maps API key | `frontend/.env.example` |
| Firebase iOS API key | `frontend/GoogleService-Info.plist` |

Actions taken:

- Git history was rewritten with `git-filter-repo` to redact all three keys from
  every commit. The working tree and all 57 commits are clean.
- The Firebase project was rebuilt from scratch as `poolora-e145e`. The old
  project and its keys are abandoned.
- `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` and `ML_SERVICE_API_KEY` were
  regenerated, even though they were never committed. Rotating the JWT secrets
  invalidates every existing access and refresh token.
- `FCM_SERVER_KEY` was removed entirely. It was unused, and the legacy FCM
  server-key API is retired; push goes through the service account.

A rewrite does not undo the exposure. Old commit SHAs stay reachable on GitHub
until GitHub garbage-collects them, so assume the old keys were scraped and
never re-enable them.

### Preventing a repeat

- `frontend/google-services.json` and `frontend/GoogleService-Info.plist` are
  gitignored. Never commit them, even though they ship inside the app binary.
- Restrict every client API key in Google Cloud, Credentials: the Android key to
  package `com.poolora.app` plus your signing SHA-1, the iOS key to the bundle
  id, and the Maps key to the Maps SDK it actually needs. An unrestricted client
  key is billable by anyone who finds it.
- Turn on Firebase App Check so a leaked client key cannot by itself drive
  traffic against Realtime Database or Auth.
