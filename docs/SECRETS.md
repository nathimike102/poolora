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
| `APP_BASE_URL` | yes | Public API origin, e.g. `https://api.sanchari.me`. Used in SOS tracking links sent by SMS |
| `MONGO_URI` | yes | Self-hosted: build it from `MONGO_USER` and `MONGO_PASS`. Atlas: cloud.mongodb.com, Database, Connect, Drivers |
| `MONGO_USER`, `MONGO_PASS` | Docker/K8s | Generate the password (above) |
| `MONGO_REPLICA_KEY` | K8s only | Generate (above) |
| `REDIS_HOST`, `REDIS_PORT` | no | Default `localhost:6379`. Docker: `redis` |
| `REDIS_PASSWORD` | prod | Generate (above) |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | yes | Generate (above). The server refuses to start without them |
| `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY` | no | Default `15m` and `7d` |
| `AUTH_PROVIDER` | no | `hybrid` (recommended), `firebase` or `custom` |
| `FIREBASE_PROJECT_ID` | yes | Firebase console, Project settings, General |
| `FIREBASE_SERVICE_ACCOUNT_PATH` or `FIREBASE_SERVICE_ACCOUNT_JSON` | yes | Firebase console, Project settings, Service accounts, **Generate new private key**. Save the downloaded JSON to the path, or paste it into the JSON variable |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | yes | dashboard.razorpay.com, Account & Settings, API Keys. `rzp_test_` keys for testing, `rzp_live_` after KYC approval |
| `RAZORPAY_WEBHOOK_SECRET` | yes | Razorpay dashboard, Webhooks, Add webhook. URL: `https://api.sanchari.me/payments/webhook`. Events: `payment.authorized`, `payment.captured`. You choose the secret there; copy the same value here |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | yes | AWS console, IAM, create a user with access limited to the uploads bucket (`s3:PutObject`, `s3:GetObject`), then Security credentials, Create access key |
| `AWS_REGION` | no | Default `ap-south-1` (Mumbai) |
| `AWS_S3_BUCKET` | yes | Create a private bucket (block all public access) in S3 |
| `TWILIO_ENABLED` | yes for SMS | `true` to send SMS. SOS texts to emergency contacts need this |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | if SMS on | console.twilio.com, Account Info on the dashboard |
| `TWILIO_PHONE_NUMBER` | if SMS on | Twilio console, Phone Numbers, buy a number that can send SMS to India (DLT registration is required for Indian traffic) |
| `GOOGLE_MAPS_API_KEY` | yes | console.cloud.google.com, APIs & Services, Credentials, Create API key. Enable Places, Geocoding and Directions. Restrict it to those APIs and to the server's IP. **Use a different key from the app's** |
| `ML_SERVICE_API_KEY` | yes | Generate (above). Same value on the ML service |
| `ML_SERVICE_URL` | no | ML service address. Default `http://sanchari-ml:8000` |
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
| `FCM_SERVER_KEY` | **not used** | Legacy key. The backend sends push through the service account instead. Safe to leave empty |

### Kubernetes-only secrets

| Secret | How to create it |
|---|---|
| `sanchari-secrets` | Fill in `k8s/secret.yaml`, or better, create it without committing values: `kubectl create secret generic sanchari-secrets -n sanchari --from-env-file=backend/.env` |
| `firebase-service-account` | `kubectl create secret generic firebase-service-account -n sanchari --from-file=firebase-service-account.json` |
| `sanchari-api-tls` | Issued by cert-manager from the ingress annotation, or `kubectl create secret tls sanchari-api-tls --cert=... --key=...` |
| `BACKUP_S3_BUCKET`, `BACKUP_AWS_ACCESS_KEY_ID`, `BACKUP_AWS_SECRET_ACCESS_KEY`, `BACKUP_AWS_REGION` | A separate bucket and IAM user for the daily database backup job. Give that user write access to that bucket only |

## Mobile app (`frontend/.env`, `frontend/google-services.json`)

| Variable or file | Required | How to get it |
|---|---|---|
| `REACT_NATIVE_API_BASE_URL` | yes | Backend URL. `http://<your LAN IP>:5002` for a physical device in development |
| `REACT_NATIVE_API_TIMEOUT` | no | Milliseconds, default `30000` |
| `GOOGLE_MAPS_API_KEY` | yes | Google Cloud, a **separate** key with Maps SDK for Android and Maps SDK for iOS enabled. Restrict it to package `com.sanchari.app` with your signing certificate SHA-1, and to the iOS bundle id |
| `EAS_PROJECT_ID` | for EAS builds | expo.dev, your project, Project ID. Or run `eas init` |
| `SENTRY_DSN` | no | sentry.io, a React Native project, Client Keys |
| `GOOGLE_WEB_CLIENT_ID` | for Google sign-in | Google Cloud, Credentials, OAuth client ID of type Web application (the one Firebase creates) |
| `FIREBASE_*` | usually no | Read from `google-services.json`. Only set these to override it |
| `DEBUG_API_CALLS`, `LOG_LEVEL`, `DEV_AUTH_BYPASS` | no | Development switches |
| `google-services.json` | yes (Android) | Firebase console, Project settings, Your apps, the Android app (`com.sanchari.app`), **google-services.json**. Put it in `frontend/` |
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
| `TURNSTILE_SECRET_KEY` | recommended | dash.cloudflare.com, Turnstile, Add widget for `sanchari.me`, **Secret key** |
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
| `GITHUB_TOKEN` | Provided automatically. Used to push images to ghcr.io |

## Email authentication for sanchari.me (DNS, not env)

Add these at your DNS host before sending mail from the domain:

- **SPF:** a TXT record on `sanchari.me` that includes your mail provider, e.g. `v=spf1 include:zoho.in ~all`.
- **DKIM:** the TXT record your mail provider generates.
- **DMARC:** a TXT record on `_dmarc.sanchari.me`. Start with `v=DMARC1; p=none; rua=mailto:contact@sanchari.me`, then move to `p=quarantine` once the reports come back clean.

## Keys that must be rotated

Google API keys were once committed in `frontend/.env.example` and are still in
git history. Delete those keys in Google Cloud and create new, restricted ones.
Removing them from the file does not remove them from history.
