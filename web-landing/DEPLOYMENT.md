# Deployment Guide

Sanchari is a static **Vite + React** single-page app with a single **Vercel
serverless function** (`api/contact.ts`) that relays form submissions over SMTP.
There is no database.

---

## Where to change values

You should rarely need to search the codebase. Everything configurable lives in
three places:

| What | Where |
| --- | --- |
| Company name, address, phone, emails, social links, copyright | `src/config/company.ts` |
| SEO title/description/keywords, domain, theme color, Open Graph image, Google Analytics ID | `src/config/site.ts` |
| SMTP credentials and mail routing (secrets) | Environment variables (see below) — **never** in code |

Marketing copy, stats, features, navigation and team data live in the other
files under `src/config/`.

### Social media links

Social links are **optional**. In `src/config/company.ts`, each entry in
`social` (`linkedin`, `x`, `instagram`, `facebook`, `youtube`, `github`) is an
empty string by default. An empty value renders **nothing** — the site never
shows a placeholder, `#`, or broken social icon. To add an account later, set
its URL in the config; the icon appears automatically with no UI changes:

```ts
social: {
  linkedin: "https://www.linkedin.com/company/sanchari",
  x: "",            // still empty -> icon hidden
  instagram: "",
  facebook: "",
  youtube: "",
  github: "",
}
```

---

## Local Development

Requires Node.js 18+.

```bash
# Install dependencies
npm install

# Start the dev server (UI only)
npm run dev

# Type-check
npm run typecheck

# Production build (runs tsc then vite build, output in dist/)
npm run build

# Preview the production build locally
npm run preview
```

> **Testing the contact form locally:** `npm run dev` serves the UI but does not
> run the serverless function, so form submissions will fail with an error
> state. To exercise the real `/api/contact` endpoint locally, install the
> Vercel CLI and run it with a local `.env`:
>
> ```bash
> npm i -g vercel
> cp .env.example .env   # then fill in your SMTP values
> vercel dev
> ```

---

## Environment Variables

Configure these in **Vercel → Project → Settings → Environment Variables**
(and in a local `.env` when using `vercel dev`). They are read only on the
server by `api/contact.ts`.

| Variable | Required | Description |
| --- | --- | --- |
| `SMTP_HOST` | yes | SMTP server host, e.g. `smtp.zoho.in`, `smtp.gmail.com`, `email-smtp.ap-south-1.amazonaws.com`. |
| `SMTP_PORT` | yes | `587` for STARTTLS (recommended) or `465` for implicit TLS. |
| `SMTP_SECURE` | no | `true` only for port `465`; otherwise `false` (default). |
| `SMTP_USER` | yes | SMTP username (often the full email address or an SES/API key). |
| `SMTP_PASS` | yes | SMTP password or app-specific password. |
| `CONTACT_FROM_EMAIL` | yes | "From" address for the **waitlist** form (`contact@sanchari.me`). |
| `CONTACT_TO_EMAIL` | yes | Recipient for waitlist submissions (`contact@sanchari.me`). |
| `INVESTORS_FROM_EMAIL` | yes | "From" address for the **investor** form (`investors@sanchari.me`). |
| `INVESTORS_TO_EMAIL` | yes | Recipient for investor submissions (`investors@sanchari.me`). |
| `SUPPORT_EMAIL` | no | Public support address; reserved for a future support form. The address shown on the site comes from `src/config/company.ts`. |

The waitlist form routes through the `CONTACT_*` addresses and the investor
deck form through the `INVESTORS_*` addresses. SMTP credentials authenticate the
transport; the from/to addresses are independent of `SMTP_USER`.

A template is provided in [`.env.example`](./.env.example).

```env
SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
CONTACT_FROM_EMAIL=contact@sanchari.me
CONTACT_TO_EMAIL=contact@sanchari.me
INVESTORS_FROM_EMAIL=investors@sanchari.me
INVESTORS_TO_EMAIL=investors@sanchari.me
SUPPORT_EMAIL=support@sanchari.me
```

---

## Vercel Deployment

### 1. Import the GitHub repository
1. Push this repository to GitHub.
2. In Vercel, **Add New → Project** and import the repo.
3. Vercel auto-detects the **Vite** framework. Leave the defaults:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - The `api/` directory is automatically deployed as serverless functions.

### 2. Configure environment variables
Add every variable from the table above under **Settings → Environment
Variables**, for the **Production** (and optionally Preview/Development)
environments.

### 3. Production deployment
Trigger the first deploy (it starts automatically on import, or push to the
default branch). Each push to the production branch redeploys.

### 4. Updating SMTP credentials
Edit the values under **Settings → Environment Variables**, then **redeploy**
(Deployments → ⋯ → Redeploy) so the function picks up the new values.

### 5. Adding a custom domain
1. **Settings → Domains → Add** and enter your domain (e.g. `sanchari.me`).
2. Update DNS at your registrar as instructed by Vercel.
3. Update `domain` and `url` in `src/config/site.ts` so canonical/OG tags match,
   then push to rebuild.

### 6. Rebuilding after configuration changes
- Changes to `src/config/*` (SEO, company info) require a **redeploy** (push or
  "Redeploy") because meta tags are injected at build time.
- Changes to environment variables require a **redeploy** to take effect.

---

## Future Backend

The app is structured so a real backend can be added without touching the UI:

- **Forms** call `submitContact()` in [`src/services/contact.ts`](./src/services/contact.ts),
  the single integration point. To switch from the bundled serverless mailer to
  an external API, change `ENDPOINT` (and, if needed, the payload types) there —
  the form components stay unchanged.
- **Serverless API** lives in `api/`. Add more endpoints (e.g. `api/newsletter.ts`,
  `api/track.ts`) as additional files; Vercel deploys each automatically.
- **Persistence:** when a database is introduced, write to it inside the
  relevant `api/*` function (the client already speaks JSON over `fetch`). No
  client changes are required.
- **Auth / app APIs:** a future product API can live under the same `/api`
  namespace or a separate service; the client's `fetch`-based service layer
  makes swapping the base URL trivial.
