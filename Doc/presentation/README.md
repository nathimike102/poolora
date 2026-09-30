# Presentation

Everything here is generated from the code and the running app, so it stays in step with the product.

| File | What it is |
|---|---|
| `Poolora-Project-Presentation.pptx` | Final-year project review deck (26 slides) |
| `Poolora-Launch-Pitch.pptx` | Zimbabwe launch deck for partners (17 slides) |
| `Poolora-System-Note.pdf` | Five pages on how the system works and the tools it uses |
| `Poolora-Run-On-Android.pdf` | Running the app on a phone or emulator over adb |
| `media/` | The 3D animations: `hero` (the app on a turning phone), `pool` (three solo trips become one shared car), `map` (Zimbabwe's intercity routes from Harare), as MP4, GIF and a still |
| `screens/clean`, `screens/frames` | App and admin captures, cropped, and in phone or browser frames |

The decks use entrance animations on every slide, Morph between the app-tour slides (PowerPoint 2019 or Microsoft 365; other apps fall back to a fade), and the 3D clips as animated GIFs, which play in PowerPoint, Keynote, Google Slides and LibreOffice without setup.

## Rebuilding

```bash
cd Doc/presentation/source
npm install            # pptxgenjs, three, playwright-core, sharp, react-icons
npm run all            # facts -> screens -> 3D renders -> decks -> PDFs
```

Or one step at a time:

- `npm run facts` reads the numbers the documents quote (fares, refund tiers, seat limits, holidays, route and model counts) from the backend code into `facts.json`. Set `TEST_JSON=backend=<jest.json>,app=<jest.json>,admin=<vitest.json>` to include test counts (`npx jest --json --outputFile=...`).
- `npm run screens` crops the captures in `screens/` and frames them (`prep_screens.py`).
- `npm run render3d` renders the three.js scenes in `render3d/scenes.js` with headless Chromium and encodes them with ffmpeg. `PREVIEW=<dir>` writes three stills per scene instead.
- `npm run decks` builds both decks (`node build.js academic|pitch`).
- `npm run pdfs` builds the two PDFs (reportlab).

Needs Node 18+, Python 3 with Pillow and reportlab, ffmpeg, and a Chromium (Playwright's cached build, or set `PLAYWRIGHT_CHROMIUM`).

## Capturing new screens

`ui.py` drives a phone or emulator over adb: `python3 ui.py snap NAME` saves `screens/NAME.png` with the labelled elements in `NAME.json`, which the decks use to point callouts at real buttons. Set `ANDROID_SERIAL` when more than one device is connected. The Run-on-Android guide covers signing in with dev codes, and putting an emulator in Harare (time and location). Admin captures come from the web admin in a desktop browser, saved as `screens/admin_*.png`.

Market figures on the problem and pricing slides were checked in September 2026; the sources are on the last slide of each deck. Update `MARKET` in `build.js` when they change.
