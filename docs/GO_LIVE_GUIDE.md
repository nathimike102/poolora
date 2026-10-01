# Go-live guide: domain, email and deployment

Do these in order. Each step says what to click or run, what you should see, and how to check it worked. Replace `<domain>` with your domain throughout, for example `poolora.co.zw`.

What runs where once you are done:

| Part | Address | Hosted on | Deploys from |
|---|---|---|---|
| Website (`web-landing/`) | `https://<domain>` (and `www.` redirecting to it) | Vercel project `poolora` (exists) | `main`; every other branch gets a preview |
| Web admin (`admin-web/`) | `https://admin.<domain>` | A second Vercel project (create it, step D4) | `main` |
| API (`backend/` + `ml-service/`) | `https://api.<domain>` | One Ubuntu server with Docker (step D5) | `main`, through the CI `deploy` job |
| Database | — | MongoDB Atlas (exists) | — |
| Mobile app | App stores | EAS builds | Manual |

---

## Part 1: Domain

### 1.1 Choose and register it

- **`.co.zw`** (best for a Zimbabwe launch): buy it from a registrar accredited by ZISPA, the `.zw` registry; their site lists accredited registrars. Expect to provide company or ID details.
- **`.com` / `.app`**: Cloudflare Registrar (at-cost pricing, needs a Cloudflare account), Namecheap or Porkbun.

Register it in the company's name if the company exists, and use `admin@<domain>` as the account contact once email works (Part 2). Until then, use your own address and change it afterwards.

**Check:** the registrar's dashboard lists the domain as active.

### 1.2 Point it at Cloudflare DNS

1. <https://dash.cloudflare.com> → **Add a site** → enter `<domain>` → **Free** plan.
2. Cloudflare shows two nameservers (e.g. `ada.ns.cloudflare.com`). At your registrar, replace the domain's nameservers with those two.
3. Wait. `.com` usually switches within an hour; `.co.zw` can take up to 48 hours.

**Check:** `dig NS <domain> +short` returns the two Cloudflare nameservers, and Cloudflare shows the site as **Active**.

---

## Part 2: Email

You need two things: **mailboxes** so people can write to you, and a **transactional sender** so the app and website can send mail. They use different DNS records and can coexist.

### 2.1 Mailboxes

Pick one:

| Option | Cost | Use when |
|---|---|---|
| **Zoho Mail** | Free tier for a few users on one domain (check current limits) | You want real inboxes for free |
| **Google Workspace** | Paid per user | You want Gmail and Google Drive |
| **Cloudflare Email Routing** | Free | You only want to *forward* role addresses to an inbox you already have |

Create these addresses. With Email Routing they are forwards; with Zoho or Workspace make one mailbox and add the rest as aliases:

| Address | Purpose |
|---|---|
| `hello@<domain>` | General enquiries; the site's main contact and investor address |
| `support@<domain>` | User support; shown in the app |
| `privacy@<domain>` | Data protection requests (Privacy Policy) |
| `security@<domain>` | Vulnerability reports (`/.well-known/security.txt`) |
| `admin@<domain>` | Owner of third-party accounts (Vercel, Atlas, Paynow, Twilio, AWS, PostHog) |
| `noreply@<domain>` | Sender for automated mail only; nobody reads it |

Follow the provider's domain setup. It gives you **MX** records and a **verification TXT** record; add them in Cloudflare → DNS → Records exactly as shown.

**Check:** send a message from another account to `hello@<domain>` and see it arrive.

### 2.2 Transactional sending (receipts, notices, website forms)

The backend and the website's contact form send over SMTP, so any of these works: **Resend** (simple), **Postmark** (best deliverability) or **SendGrid**.

1. Sign up with `admin@<domain>` → **Domains → Add domain** → `<domain>`.
2. The provider shows DKIM records (TXT or CNAME), often an SPF record, and sometimes an MX record on a subdomain such as `send.<domain>`. Add each one in Cloudflare exactly as shown, with **Proxy status: DNS only**.
3. Wait for the provider to show the domain as **Verified**.
4. Create SMTP credentials (or an API key used as the SMTP password). Note the host, port (587), username and password.

### 2.3 SPF, DKIM and DMARC

- **SPF**: one TXT record on the bare domain (`@`). If both your mailbox provider and your sender give you an SPF value for `@`, **merge them into one record**, e.g. `v=spf1 include:zohomail.com include:<sender's include> ~all`. Two SPF records on the same name break both.
- **DKIM**: the records from 2.1 and 2.2. Each provider signs with its own key; keep them all.
- **DMARC**: add a TXT record named `_dmarc` with:
  ```
  v=DMARC1; p=none; rua=mailto:admin@<domain>; fo=1
  ```
  `p=none` only collects reports. After 2–4 weeks of reports showing only your own providers passing, change it to `p=quarantine`, and later `p=reject`.

**Check:** `dig TXT <domain> +short` shows exactly one `v=spf1` record, and `dig TXT _dmarc.<domain> +short` shows the DMARC record.

### 2.4 Test deliverability

1. Go to <https://www.mail-tester.com> and copy the address it shows.
2. Send a test from the backend: set the SMTP values in `backend/.env` (step 2.5), then trigger a receipt email from a test booking, or send any message through your provider's dashboard.
3. Aim for **9/10 or better**. Fix anything it flags about SPF, DKIM or DMARC.
4. Also send to a Gmail and an Outlook address and confirm the mail lands in the inbox, not spam.

### 2.5 Switch the code over

Once `support@`, `hello@`, `privacy@` and `security@` receive mail:

1. `web-landing/src/config/company.ts`: set `const MAIL_DOMAIN = "<domain>";`.
2. `frontend/src/config/company.ts`: set `const MAIL_DOMAIN = '<domain>';` (it mirrors the website).
3. Run `cd web-landing && npm run build`. If it stops with "The JSON-LD block changed", paste the `sha256-…` value it prints into the `script-src` of `web-landing/vercel.json` in place of the old one, and build again.
4. Backend production environment: `MAIL_FROM=Poolora <noreply@<domain>>` and the `SMTP_*` values from 2.2.
5. Vercel → project `poolora` → Settings → Environment Variables (Production): `SMTP_HOST`, `SMTP_PORT=587`, `SMTP_SECURE=false`, `SMTP_USER`, `SMTP_PASS`, `CONTACT_FROM_EMAIL=noreply@<domain>`, `CONTACT_TO_EMAIL=hello@<domain>`, `INVESTORS_FROM_EMAIL=noreply@<domain>`, `INVESTORS_TO_EMAIL=hello@<domain>`. Redeploy.
6. Ship a new app build so it shows the new support address.

**Check:** the website footer and Privacy Policy show the new addresses; `https://<domain>/.well-known/security.txt` shows `Contact: mailto:security@<domain>`; submitting the waitlist form delivers an email to `hello@`.

---

## Part 3: Deployment

### D1. Separate production from development

Production must never share a database, keys or storage with development:

| Resource | Production | Development |
|---|---|---|
| MongoDB | Atlas cluster or database `poolora-prod` | A separate database (or local Docker) |
| S3 bucket | `poolora-uploads-prod` in `af-south-1` | `poolora-uploads-dev` |
| JWT secrets, `ML_SERVICE_API_KEY`, `TRACKER_GATEWAY_KEY` | Generated once for production (see `docs/SECRETS.md`) | Different values |
| Paynow | Live integration | Test integration |
| Firebase | Production project | A second Firebase project for development is ideal |
| Sentry, PostHog | Production projects | None, or separate projects |

**Check:** no production value appears in your laptop's `.env` files.

### D2. Website on the custom domain

1. Vercel → project **poolora** → Settings → **Domains** → add `<domain>`, then add `www.<domain>`.
2. Vercel shows the DNS records to create (an `A` record for the apex and a `CNAME` for `www`). Add them in Cloudflare with **Proxy status: DNS only** (grey cloud), so Vercel can issue the certificate.
3. On `www.<domain>`, choose **Redirect to `<domain>`** (308). One canonical host.
4. In code, change `SITE_ORIGIN` in `web-landing/src/config/company.ts` and `frontend/src/config/company.ts` to `https://<domain>` (the site's canonical URL, sitemap and `security.txt` follow it). Push to `main`.

**Check:** `curl -sI http://<domain>` → `308` to `https://<domain>/`; `curl -sI https://www.<domain>` → `308` to `https://<domain>/`; the browser shows a valid certificate; `curl -sI https://<domain> | grep -i strict-transport` shows HSTS.

### D3. Website environment variables

Vercel → **poolora** → Settings → Environment Variables, **Production** only: the email values from 2.5 step 5, plus `VITE_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` (Cloudflare → Turnstile → Add widget for `<domain>`). Redeploy (Deployments → … → Redeploy).

**Check:** submit the waitlist form on `https://<domain>`; the email arrives at `hello@`, and the Turnstile widget appears on the form.

### D4. Web admin on Vercel

1. Vercel → **Add New → Project** → import `nathimike102/poolora` → **Root Directory: `admin-web`**, Framework: Vite. Name it `poolora-admin`.
2. Environment Variables (Production): `VITE_API_URL=https://api.<domain>`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID` (Firebase console → Project settings → Your apps → Web app). Deploy.
3. Settings → Domains → add `admin.<domain>`; add the record Vercel shows in Cloudflare (DNS only).
4. Firebase console → Authentication → Settings → **Authorized domains** → add `admin.<domain>`.
5. Turn on admin MFA (see `docs/SECURITY_AUDIT.md`, owner action 1).

**Check:** `https://admin.<domain>` shows the sign-in page; signing in as an admin shows the Dashboard; **Analytics** loads; open an SOS incident and confirm the map draws (this checks the CSP).

### D5. API server

1. **Server.** AWS → EC2 in **af-south-1 (Cape Town)**; enable the region first under Account → AWS Regions. Choose Ubuntu 24.04, 8 GB RAM (`t3.large`; the stack includes Kafka and Elasticsearch), 40 GB disk. Security group: allow 22 from your IP only, and 80 and 443 from anywhere (plus the Traccar ports only if you run the tracker gateway). Attach an Elastic IP.
2. **DNS.** Cloudflare → `A` record `api` → the Elastic IP, DNS only.
3. **Install.**
   ```bash
   ssh ubuntu@<elastic-ip>
   sudo apt update && sudo apt install -y docker.io docker-compose-v2 nginx certbot python3-certbot-nginx git
   sudo usermod -aG docker ubuntu && exit   # log in again afterwards
   git clone https://github.com/nathimike102/poolora.git /home/ubuntu/Poolora
   ```
4. **Configuration.** Create `/home/ubuntu/Poolora/backend/.env` from `backend/.env.example` with the production values (`NODE_ENV=production`, `APP_BASE_URL=https://api.<domain>`, `MONGO_URI` for the production database, `CORS_ORIGIN=https://<domain>,https://admin.<domain>`, Paynow live keys, Twilio, AWS, JWT secrets, `ML_SERVICE_API_KEY`, `SENTRY_DSN`, `POSTHOG_API_KEY`). Put the Firebase service account at `backend/secrets/firebase-service-account.json`. Then `chmod 600 backend/.env`.
5. **nginx.** Create `/etc/nginx/sites-available/poolora-api`:
   ```nginx
   server {
     listen 80;
     server_name api.<domain>;
     client_max_body_size 10m;
     location / {
       proxy_pass http://127.0.0.1:5002;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;      # Socket.IO
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
       proxy_set_header X-Forwarded-Proto $scheme;
       proxy_read_timeout 75s;
     }
   }
   ```
   ```bash
   sudo ln -s /etc/nginx/sites-available/poolora-api /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d api.<domain> --redirect -m admin@<domain> --agree-tos
   ```
6. **Start.** `cd /home/ubuntu/Poolora/backend && docker compose up -d --build`. This is what the CI `deploy` job runs. The compose file also starts its own MongoDB, Kafka, Elasticsearch, Prometheus and Grafana; with `MONGO_URI` pointing at Atlas the local MongoDB holds nothing, but the API waits for it to be healthy, so leave it running. Set `GRAFANA_ADMIN_PASSWORD` in `.env` (see `docs/SECRETS.md`).
7. **Atlas access.** Atlas → Network Access → add the Elastic IP (not `0.0.0.0/0`).
8. **CI deploys.** GitHub → Settings → Secrets and variables → Actions → New repository secret: `EC2_HOST` (the Elastic IP), `EC2_USER` (`ubuntu`), `EC2_SSH_KEY` (a private key whose public half is in the server's `~/.ssh/authorized_keys`; make a dedicated key for CI). From the next push to `main`, the `deploy` job pulls and restarts the stack.

**Check:**
- `curl -s https://api.<domain>/health` returns a healthy status.
- `curl -sI http://api.<domain>/health` → `301` to HTTPS.
- `curl -sI https://api.<domain>/health | grep -i strict-transport` shows HSTS.
- Push a small change to `main`: the Actions run shows `deploy` doing the SSH step instead of "EC2_HOST is not set".
- `sudo certbot renew --dry-run` succeeds (certificates renew automatically).

### D6. Mobile app

1. `frontend/.env` for the production build: `REACT_NATIVE_API_BASE_URL=https://api.<domain>`, production Firebase values, `SENTRY_DSN`.
2. `eas build --profile production --platform android` (and iOS), then submit to the stores (`SETUP_TODO.md` lists the store declarations).

**Check:** the installed production build can sign in, search rides and open Settings → Help, which shows `support@<domain>`.

### D7. After launch

- Paynow: move the integration to live mode (`SETUP_TODO.md`).
- Watch Sentry and the web admin's Analytics page daily for the first two weeks.
- Move DMARC to `p=quarantine` once reports are clean (2.3).
