# Sanchari — Landing Page

Marketing and waitlist site for **Sanchari**, a safety-first smart mobility
platform for India (ride pooling, parcel pooling, trip pooling, women safety,
and verification).

Built with **React + Vite + TypeScript + Tailwind CSS**, deployed on **Vercel**
with a single serverless function for contact/waitlist email delivery over SMTP.

## Tech stack

- React 18 + React Router 7
- Vite 6
- TypeScript (strict)
- Tailwind CSS v4
- Motion (animations)
- Vercel serverless function + Nodemailer (SMTP)

## Getting started

Requires Node.js 18+.

```bash
npm install        # install dependencies
npm run dev        # start the dev server
npm run typecheck  # type-check the project
npm run build      # production build (type-check + bundle) -> dist/
npm run preview    # preview the production build
```

> The contact forms POST to the `/api/contact` serverless function. `npm run dev`
> serves the UI only; use `vercel dev` with a local `.env` to exercise the email
> endpoint. See [DEPLOYMENT.md](./DEPLOYMENT.md).

## Configuration

All editable values are centralized:

- `src/config/company.ts` — company name, contact emails, phone, address, social links
- `src/config/site.ts` — SEO metadata, domain, theme color, analytics ID
- `src/config/` — features, stats, navigation content
- Environment variables — SMTP credentials and mail routing (see `.env.example`)

## Project structure

```
api/                     Vercel serverless functions (email)
src/
  app/
    components/          UI components (common, layout, icons, sections)
    pages/               Route pages (landing, investors, about, legal, features)
    routes.tsx           Router configuration
  config/                Centralized site/company/content config
  services/              Client-side data/email services
  theme/                 Design tokens (colors, spacing, typography, …)
  animations/            Shared motion presets
  styles/                Global styles and Tailwind theme
```

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for full instructions: environment
variables, Vercel setup, SMTP configuration, and custom domain.
