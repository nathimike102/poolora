# Siham brand

Siham is safe, shared, fast movement with a modern African identity. The logo
is the founder's design (Canva: "Futuristic mobility app logo", page 4): three
people joined in a circle, each one's body flowing into the next.

## Logo system

| Version | File | Use it for |
| --- | --- | --- |
| App icon (symbol only, navy tile) | `siham-icon.png`, `siham-mark.png` | Phone home screen, app stores, favicons, notifications |
| Primary logo (symbol above SIHAM) | `siham-logo.png`, `siham-logo-dark.png` | Splash screen, documents, posters, profile images |
| Horizontal lockup (symbol beside SIHAM) | `siham-lockup.png`, `siham-lockup-dark.png` | Website header and footer, admin sidebar, decks, vehicles, ads |
| Symbol alone | `siham-symbol.png` (dark backgrounds), `siham-symbol-light.png` (light) | Loading states, small spaces where the name is already shown |
| Wordmark alone | `siham-wordmark.png` | Rare: only when the symbol is already close by |

Rules:

- The wordmark never goes inside the app icon.
- On light backgrounds the ivory figure turns navy (`-light` and the plain
  lockup files); everything else keeps its colours. Never put the original
  ivory figure on white: it disappears.
- Leave clear space around the logo of at least one head's diameter.
- Don't stretch, rotate, outline, add shadows to, or recolour the symbol
  beyond the two versions above.
- The smallest size for the symbol is 16px (favicon). Below 24px, use the
  icon tile, not the bare symbol.

## Colours

| Name | Hex | Role |
| --- | --- | --- |
| Teal | `#087F8C` | Primary: buttons, links, active states. White text on it passes WCAG AA (4.75:1). |
| Deep teal | `#056981` | Hover and pressed states; a logo figure |
| Bright teal | `#0AA2A8` | Logo figure; accents and highlights on navy. Fails contrast for white text (3.1:1), so never use it as a button colour on light backgrounds. |
| Aqua | `#35D0BA` | Small highlights on dark backgrounds (active indicators, charts) |
| Navy | `#0B2530` | Structure: splash screen, admin sidebar, dark sections, the wordmark on light backgrounds |
| Deep navy | `#061A22` | Dark-mode backgrounds, the website footer |
| Ivory | `#F5F1E7` | Wordmark on dark; warm section backgrounds |

Teal leads, navy gives structure and trust, and ivory adds warmth. Safety
colours (SOS red, women-only rose) stay as they are and are never replaced by
brand colours: urgent information must look urgent.

## Typography

- The SIHAM wordmark is artwork (traced from the Canva font), not live text.
  Always use the files or the logo components; never type "SIHAM" in a font
  to imitate it.
- Interface text: Plus Jakarta Sans in the app, Inter in the admin, and the
  system stack on the website.

## Where the brand is applied

- **Mobile app:** the icon, Android adaptive icon (navy background), white
  notification silhouette, navy splash with the primary logo, teal theme, and
  navy-tinted dark mode. In code: `frontend/src/components/SihamLogo.tsx`
  (`SihamLogo`, `SihamSymbol`, `SihamWordmark`) and `Brand` in
  `frontend/src/theme/index.ts`.
- **Website:** the lockup in the header (navy) and footer (ivory on deep navy),
  favicons, the link preview image, and `brand`/`navy`/`ivory`/`aqua` Tailwind
  colours (`web-landing/src/styles/theme.css`).
- **Admin:** the navy sidebar with the symbol and wordmark, teal accents, and
  navy-tinted dark mode (`admin-web/src/styles.css`,
  `admin-web/src/components/Brand.tsx`).

## Changing the artwork

The sources are vectors in `source/`: `siham-symbol.svg` and
`siham-wordmark.svg`. They were traced from the Canva export; the heads are
exact circles. After editing them:

```sh
pip install cairosvg pillow
python3 scripts/render_brand_master.py   # master PNGs + logo path code for all three apps
python3 scripts/generate_brand_assets.py # every icon, favicon, lockup and the link preview
```

Native Android and iOS projects pick up the new icons on the next
`npx expo prebuild`.

## Brand brief for designers and AI design tools

Use this as the starting prompt when designing new screens, pages or
marketing for Siham:

> Create on-brand designs for SIHAM, an African mobility platform that does
> both scheduled carpooling and on-demand rides, launching first in Zimbabwe
> and planned for worldwide markets. SIHAM stands for safety, community, speed
> and shared movement. It should feel proudly rooted in Africa while staying
> modern, global and technology-led.
>
> Logo: use the existing SIHAM symbol (three people joined in a circle, in
> bright teal #0AA2A8, deep teal #056981 and ivory #F5F1E7) and the SIHAM
> wordmark. The app icon is the symbol on navy, without the wordmark. On light
> backgrounds the ivory figure is navy #0B2530.
>
> Colours: teal #087F8C leads (buttons, links), navy #0B2530 gives structure
> and trust, ivory #F5F1E7 adds warmth, and bright teal and aqua #35D0BA are
> accents on dark backgrounds only. Keep text at WCAG AA contrast or better.
>
> Personality: trusted, energetic, human, inclusive, intelligent, safe and
> forward-looking. Visual language: flowing route lines, connected forms,
> circles of people, and directional movement. Keep any African influence
> contemporary and restrained. Avoid flags, maps of Africa, tribal clichés,
> literal cars, wheels, map pins, locks and generic shields, and anything that
> resembles Uber, Bolt, Rapido or Ola.
>
> Safety is the headline difference: SOS, women-only rides, verified drivers,
> trip sharing and check-ins should be easy to find. Urgent safety states use
> red and must stand out without making the interface feel alarming.
>
> Website: a confident hero showing people moving together safely through an
> African city, trust-led messaging, safety highlights, rider and driver
> sections, community stories and a clear waitlist or download call to
> action. Admin: a calm, efficient interface with a navy sidebar, teal status
> indicators, clear data cards and prominent safety alerts. Mobile app: large
> touch targets, simple navigation, clear live-journey information, trusted
> driver and rider details, and emergency access on every ride screen.
>
> Imagery: authentic, contemporary African urban settings and diverse people,
> showing connection, movement, confidence and everyday convenience. No
> generic Western stock imagery or staged scenes.
