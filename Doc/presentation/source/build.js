// Builds the Poolora decks from the app's screens, the 3D animations and facts.json.
//   node build.js academic   -> ../Poolora-Project-Presentation.pptx (final-year project review)
//   node build.js pitch      -> ../Poolora-Launch-Pitch.pptx (Zimbabwe launch, for partners)
// Run `npm run all` for the whole pipeline: facts, screens, 3D renders, decks, PDFs.
const fs = require('fs');
const path = require('path');
const pptxgen = require('pptxgenjs');
const JSZip = require('jszip');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');
const md = require('react-icons/md');
const fa = require('react-icons/fa');
const si = require('react-icons/si');

const VARIANT = process.argv[2] || 'academic';
if (!['academic', 'pitch'].includes(VARIANT)) throw new Error('Variant: academic or pitch');
const ACADEMIC = VARIANT === 'academic';
const ROOT = path.resolve(__dirname, '../../..');
const DOC = path.resolve(__dirname, '..');
const OUT = path.join(DOC, ACADEMIC ? 'Poolora-Project-Presentation.pptx' : 'Poolora-Launch-Pitch.pptx');
const FRAMES = path.join(DOC, 'screens/frames');
const CLEAN = path.join(DOC, 'screens/clean');
const MEDIA = path.join(DOC, 'media');
const MARK = path.join(ROOT, 'branding/poolora-icon.png');
const LOCKUP = path.join(ROOT, 'branding/poolora-lockup.png');
const F = require('./facts.json');

// ── design tokens (from the Poolora logo) ──────────────────────────────
const C = {
  navy: '1B1446', deep: '0E0A2C', teal: '0B7A75', tealDark: '08605C', tealLight: '3FC1B5', mint: 'E3F2F0',
  pink: 'D9468F', pinkLight: 'FBE3EF', ink: '1F2330', muted: '5B6475', line: 'D5DBE3', white: 'FFFFFF',
  soft: 'F5F7FA', lilac: 'B9B4D9', amber: 'E8A33D',
};
const HEAD = 'Arial';
const BODY = 'Calibri';
const W = 13.333;
const H = 7.5;

// ── facts, formatted ───────────────────────────────────────────────────
/** US$1, US$26.50, and US$0.045 for per-km rates in tenths of a cent */
const usd = (n) => `US$${Number.isInteger(n) ? n : Math.abs(n * 100 - Math.round(n * 100)) < 1e-9 ? n.toFixed(2) : n.toFixed(3)}`;
const pct = (r) => `${Math.round(r * 100)}%`;
const ex = (km, type) => F.pricing.examples.find((e) => e.distanceKm === km && e.vehicleType === type);
const commute = ex(15, 'sedan');
const hreByo = ex(439, 'sedan');
const hreByoVan = ex(439, 'minivan');
const hreMutare = ex(263, 'sedan');
const tiers = F.cancellation.tiers;
const fee = F.pricing.platformFeeRate;
const tests = F.tests || {};
const totalTests = Object.values(tests).reduce((n, t) => n + t.tests, 0);
const loc = F.linesOfCode;
const totalLoc = Object.values(loc).reduce((a, b) => a + b, 0);
const rules = F.pricing.rules;
const fuelPerLitre = 2.06;
const litresPer100 = 7;
const fuelCost = (km) => (km * litresPer100 * fuelPerLitre) / 100;

// Research, September 2026 (sources on the last slides)
const MARKET = {
  zupco: 0.5, zupcoRange: 'US$0.50 up to 20 km', kombi: 'US$0.50–1', taxiApp5km: 'US$2–4 for 5 km',
  busHreByo: 15, coachHreByo: 35, busHreMutare: 10, petrol: fuelPerLitre, indriveCommission: 0.12,
};

// ── helpers ────────────────────────────────────────────────────────────
async function icon(Comp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: '#' + color, size: String(size) }));
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + png.toString('base64');
}

const sizes = {};
async function frameSize(name) {
  if (!sizes[name]) {
    const m = await sharp(path.join(FRAMES, `${name}.png`)).metadata();
    sizes[name] = { w: m.width, h: m.height };
  }
  return sizes[name];
}
function nodesOf(name) {
  const p = path.join(CLEAN, `${name}.json`);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')).nodes : [];
}

(async () => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = ACADEMIC ? 'Poolora: Smart Ride-Sharing and Pooling Platform' : 'Poolora: carpooling for Zimbabwe';
  pres.author = 'Nkosinathi Michael Sibanda';
  pres.company = 'Poolora';

  const I = {};
  const need = {
    car: [md.MdDirectionsCar, C.teal], carW: [md.MdDirectionsCar, C.white], money: [md.MdAttachMoney, C.teal], leaf: [md.MdEco, C.teal],
    shield: [md.MdShield, C.teal], shieldW: [md.MdShield, C.white], search: [md.MdSearch, C.teal], route: [md.MdAltRoute, C.teal],
    people: [md.MdGroups, C.teal], parcel: [md.MdInventory2, C.teal], trip: [md.MdLuggage, C.teal], admin: [md.MdAdminPanelSettings, C.teal],
    phone: [md.MdPhoneAndroid, C.white], web: [md.MdDashboard, C.white], server: [md.MdDns, C.white], brain: [md.MdPsychology, C.white],
    db: [md.MdStorage, C.white], bolt: [md.MdBolt, C.white], map: [md.MdMap, C.white], pay: [md.MdPayments, C.white], lock: [md.MdLock, C.white],
    sos: [md.MdSos, C.white], share: [md.MdShareLocation, C.white], alarm: [md.MdNotificationsActive, C.white], contacts: [md.MdContactPhone, C.white],
    check: [md.MdCheckCircle, C.teal], checkW: [md.MdCheckCircle, C.white], todo: [md.MdRadioButtonUnchecked, C.pink], bug: [md.MdBugReport, C.teal],
    cloud: [md.MdCloud, C.teal], star: [md.MdStar, C.teal], wallet: [md.MdAccountBalanceWallet, C.teal], chat: [md.MdSmartToy, C.white],
    react: [fa.FaReact, C.teal], node: [fa.FaNodeJs, C.teal], python: [fa.FaPython, C.teal], docker: [fa.FaDocker, C.teal],
    mongo: [si.SiMongodb, C.teal], redis: [si.SiRedis, C.teal], kafka: [si.SiApachekafka, C.teal], k8s: [si.SiKubernetes, C.teal],
    firebase: [si.SiFirebase, C.teal], ts: [si.SiTypescript, C.teal], socket: [si.SiSocketdotio, C.teal], osm: [si.SiOpenstreetmap, C.teal],
    vite: [si.SiVite, C.teal], jest: [si.SiJest, C.teal], fastapi: [si.SiFastapi, C.teal], anthropic: [si.SiAnthropic || md.MdSmartToy, C.teal],
    idea: [md.MdLightbulb, C.teal], flag: [md.MdFlag, C.teal], school: [md.MdSchool, C.white], clock: [md.MdSchedule, C.teal],
    post: [md.MdAddRoad, C.white], searchW: [md.MdSearch, C.white], payW: [md.MdPayments, C.white], liveW: [md.MdNearMe, C.white], starW: [md.MdStar, C.white],
    holiday: [md.MdEvent, C.white], phoneT: [md.MdPhoneAndroid, C.teal], globe: [md.MdPublic, C.white], cash: [md.MdSavings, C.white],
  };
  for (const [k, [comp, col]] of Object.entries(need)) I[k] = await icon(comp, col);

  // Every slide keeps a list of objects to animate, and a transition
  const deck = [];
  let counter = 0;
  const uid = (p) => `${p} ${++counter}`;
  function slide({ dark = false, transition = 'fade', notes } = {}) {
    const s = pres.addSlide();
    s.background = { color: dark ? C.navy : C.soft };
    s._meta = { anims: [], transition, dark };
    deck.push(s);
    if (notes) s.addNotes(notes);
    return s;
  }
  /** Queue an entrance for an object; `after` is ms from the slide starting */
  const animate = (s, name, effect = 'rise', after = 0, dur = 500) => s._meta.anims.push({ name, effect, after, dur });

  const title = (s, text, { color, sub } = {}) => {
    s.addText(text, { x: 0.6, y: 0.38, w: W - 1.2, h: 0.75, fontFace: HEAD, fontSize: 30, bold: true, color: color || (s._meta.dark ? C.white : C.navy), margin: 0, objectName: uid('Title') });
    if (sub) s.addText(sub, { x: 0.6, y: 1.1, w: W - 1.6, h: 0.5, fontFace: BODY, fontSize: 16, color: s._meta.dark ? C.lilac : C.muted, margin: 0, objectName: uid('Subtitle') });
  };
  const footer = (s) => {
    s.addImage({ path: MARK, x: W - 0.9, y: 6.95, w: 0.34, h: 0.34, objectName: uid('Mark') });
    s.addText(`${deck.length}`, { x: 0.6, y: 6.98, w: 0.6, h: 0.3, fontFace: BODY, fontSize: 11, color: s._meta.dark ? C.lilac : C.muted, margin: 0 });
    s.addText(ACADEMIC ? 'Poolora · Final year project · 2026' : 'Poolora · Zimbabwe launch · 2026', { x: 1.1, y: 6.98, w: 6, h: 0.3, fontFace: BODY, fontSize: 11, color: s._meta.dark ? C.lilac : C.muted, margin: 0 });
  };
  const card = (s, x, y, w, h, { fill = C.white, name, line = C.line } = {}) => {
    const n = name || uid('Card');
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: line, width: 0.75 },
      shadow: { type: 'outer', color: '000000', opacity: 0.08, blur: 6, offset: 2, angle: 90 }, objectName: n,
    });
    return n;
  };
  const text = (s, t, x, y, w, h, o = {}) => {
    const n = o.objectName || uid('Text');
    s.addText(t, { x, y, w, h, fontFace: BODY, fontSize: 14, color: s._meta.dark ? C.white : C.ink, margin: 0, valign: 'top', ...o, objectName: n });
    return n;
  };
  const bullets = (s, items, x, y, w, h, o = {}) =>
    text(s, items.map((t, i) => ({ text: t, options: { bullet: { indent: 16 }, breakLine: i < items.length - 1 } })), x, y, w, h, { fontSize: 15, paraSpaceAfter: 7, ...o });
  const iconCircle = (s, key, x, y, d, fill) => {
    const n = uid('Icon');
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill }, objectName: n });
    s.addImage({ data: I[key], x: x + d * 0.22, y: y + d * 0.22, w: d * 0.56, h: d * 0.56, objectName: n + ' glyph' });
    return n;
  };
  /** A group of objects that should appear together: the card and what sits on it */
  const together = (s, names, effect, after) => names.forEach((n) => animate(s, n, effect, after));

  /** A phone showing one app screen; returns its box for callouts */
  async function phone(s, screen, x, y, h, { name, effect = 'zoom', after = 0 } = {}) {
    const { w: fw, h: fh } = await frameSize(screen);
    const w = (h * fw) / fh;
    const n = name || uid('Phone');
    s.addImage({ path: path.join(FRAMES, `${screen}.png`), x, y, w, h, objectName: n });
    if (effect) animate(s, n, effect, after, 600);
    return { x, y, w, h, fw, fh, screen, name: n };
  }
  /** Points at a UI element on a phone (found by its label in the capture) with a short label */
  function callout(s, box, match, label, { side = 'right', dy = 0, after = 900, width = 2.4 } = {}) {
    const nodes = nodesOf(box.screen);
    const node = nodes.find((nd) => nd.label === match) || nodes.find((nd) => nd.label.includes(match));
    if (!node) throw new Error(`No "${match}" on ${box.screen}`);
    const [x1, y1, x2, y2] = node.bounds;
    const px = box.x + ((78 + (side === 'right' ? x2 - 8 : x1 + 8)) / box.fw) * box.w;
    const py = box.y + ((78 + (y1 + y2) / 2) / box.fh) * box.h;
    const lx = side === 'right' ? box.x + box.w + 0.25 : box.x - 0.25 - width;
    const ly = py - 0.24 + dy;
    const dot = uid('Callout dot');
    s.addShape(pres.shapes.OVAL, { x: px - 0.08, y: py - 0.08, w: 0.16, h: 0.16, fill: { color: C.pink }, line: { color: C.white, width: 1.5 }, objectName: dot });
    const ln = uid('Callout line');
    const endX = side === 'right' ? lx : lx + width;
    s.addShape(pres.shapes.LINE, { x: Math.min(px, endX), y: Math.min(py, ly + 0.24), w: Math.abs(endX - px) || 0.01, h: Math.abs(ly + 0.24 - py) || 0.001, line: { color: C.pink, width: 1.25 }, flipV: ly + 0.24 < py, objectName: ln });
    const lb = uid('Callout label');
    const lines = Math.ceil((label.length * 0.085) / width);
    s.addText(label, { x: lx, y: ly - (lines - 1) * 0.1, w: width, h: 0.22 + 0.2 * lines, fontFace: BODY, fontSize: 12, color: C.ink, fill: { color: C.white }, line: { color: C.pink, width: 1 }, margin: 5, valign: 'middle', objectName: lb, rectRadius: 0.08, shape: pres.shapes.ROUNDED_RECTANGLE });
    animate(s, dot, 'zoom', after, 300);
    animate(s, ln, 'fade', after + 150, 300);
    animate(s, lb, 'fade', after + 250, 400);
  }
  /** Animated 3D clip (GIF), in a rounded panel */
  function clip(s, file, x, y, w, name) {
    const n = name || uid('Clip');
    s.addImage({ path: path.join(MEDIA, file), x, y, w, h: (w * 9) / 16, objectName: n, rounding: false });
    return n;
  }

  // ════════════════════════════════════════════════════════════════════
  // 1 Title
  {
    const s = slide({ dark: true, transition: 'fade', notes: ACADEMIC
      ? 'Introduce yourself and the project. Poolora lets people travelling the same way share a car, send a parcel with someone already going, or plan a group trip. It is being launched first in Zimbabwe, starting with Harare.'
      : 'Poolora is a carpooling app for Zimbabwe: drivers already making a trip sell their empty seats, riders book and pay by EcoCash or card. Built and tested; launching in Harare.' });
    s.background = { color: C.deep };
    clip(s, 'hero.gif', 5.55, 0.9, 7.6, 'Hero clip');
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 0.7, w: 3.7, h: 1.18, rectRadius: 0.15, fill: { color: C.white }, line: { color: C.white }, objectName: 'Logo panel' });
    s.addImage({ path: LOCKUP, x: 0.72, y: 0.78, w: 3.45, h: 1.08, objectName: 'Logo' });
    text(s, 'Poolora', 0.6, 2.35, 5, 1, { fontFace: HEAD, fontSize: 54, bold: true, color: C.white, objectName: 'Name' });
    text(s, ACADEMIC ? 'Smart ride-sharing, parcel and trip pooling' : 'Share the ride. Split the cost. Travel safer.', 0.6, 3.35, 5.2, 0.9, { fontSize: 22, color: 'CFE9E6', objectName: 'Tagline' });
    text(s, ACADEMIC ? 'Launching first in Zimbabwe · Harare' : 'Carpooling for Zimbabwe, starting in Harare', 0.6, 4.25, 5.2, 0.4, { fontSize: 16, color: C.lilac, objectName: 'Market line' });
    if (ACADEMIC) {
      text(s, [
        { text: 'B.Tech Computer Science and Engineering · Final Year Project', options: { breakLine: true } },
        { text: 'Presented by: ', options: { bold: true } }, { text: 'Nkosinathi Michael Sibanda', options: { breakLine: true } },
        { text: 'Project guide: ', options: { bold: true } }, { text: '________________', options: { breakLine: true } },
        { text: 'Department of Computer Science and Engineering · 2026' },
      ], 0.6, 5.05, 5.4, 1.5, { fontSize: 14, color: C.white, paraSpaceAfter: 4, objectName: 'Credits' });
    } else {
      text(s, [
        { text: 'N. M. Sibanda, founder', options: { bold: true, breakLine: true } },
        { text: 'nathimike102@icloud.com' },
      ], 0.6, 5.2, 5.4, 0.8, { fontSize: 15, color: C.white, paraSpaceAfter: 4, objectName: 'Credits' });
    }
    animate(s, 'Hero clip', 'fade', 0, 900);
    ['Logo panel', 'Logo'].forEach((n) => animate(s, n, 'fade', 200));
    animate(s, 'Name', 'rise', 400);
    animate(s, 'Tagline', 'rise', 600);
    animate(s, 'Market line', 'rise', 750);
    animate(s, 'Credits', 'fade', 950);
  }

  // 2 Problem
  {
    const s = slide({ notes: 'Harare commuters have cheap but crowded buses and kombis, or taxi apps that cost several times more. Fuel is over two dollars a litre, and most private cars on commute routes carry only the driver. Figures are from September 2026; sources are at the end.' });
    title(s, 'Getting around Harare today', { sub: 'Cheap options are crowded or unsafe; safe options are expensive; private cars run half empty.' });
    const items = [
      ['people', 'Crowded public transport', `ZUPCO charges ${MARKET.zupcoRange} but cannot meet demand, so private kombis and unlicensed "mushikashika" fill the gap.`],
      ['money', 'Taxi apps cost more', `inDrive, Vaya and others charge about ${MARKET.taxiApp5km}, several times a kombi fare, and drivers are raising prices.`],
      ['car', 'Empty seats', `Petrol is about US$${MARKET.petrol.toFixed(2)} a litre, yet most cars on commute routes carry one person. The seats beside them go unused.`],
      ['shield', 'Safety and trust', 'Informal lifts have no verified drivers, no record of the trip and no quick way to get help.'],
    ];
    items.forEach(([k, h, b], i) => {
      const x = 0.6 + (i % 2) * 6.15;
      const y = 1.95 + Math.floor(i / 2) * 2.35;
      const c = card(s, x, y, 5.9, 2.08);
      const ic = iconCircle(s, k, x + 0.3, y + 0.35, 0.85, C.mint);
      const t1 = text(s, h, x + 1.35, y + 0.32, 4.3, 0.45, { fontFace: HEAD, fontSize: 18, bold: true, color: C.navy });
      const t2 = text(s, b, x + 1.35, y + 0.82, 4.3, 1.15, { fontSize: 14, color: C.muted });
      together(s, [c, ic, ic + ' glyph', t1, t2], 'rise', 150 * i);
    });
    footer(s);
  }

  if (ACADEMIC) {
    // 3 Objectives
    const s = slide({ notes: 'These are the goals the project set out to meet; each is covered by a later slide.' });
    title(s, 'Objectives');
    const obj = [
      'Let drivers publish scheduled rides and riders book seats anywhere along the route, in the right direction',
      'Take payment safely by EcoCash, OneMoney, InnBucks, card or wallet, with fair, automatic refunds',
      'Keep riders safe: verified drivers, live tracking, SOS, trip sharing and check-ins',
      'Suggest fair seat prices from distance, vehicle, commute hours, holidays and demand',
      'Give administrators one dashboard for verification, disputes, SOS, payouts and reports',
      'Extend pooling to parcels and to group trips with shared expenses',
      'Build for one market first (Zimbabwe) so that a new country is configuration, not a rewrite',
    ];
    obj.forEach((o, i) => {
      const y = 1.45 + i * 0.73;
      const b = uid('Obj num');
      s.addShape(pres.shapes.OVAL, { x: 0.8, y, w: 0.52, h: 0.52, fill: { color: i === obj.length - 1 ? C.pink : C.teal }, line: { color: C.white }, objectName: b });
      const n = text(s, String(i + 1), 0.8, y, 0.52, 0.52, { align: 'center', valign: 'middle', bold: true, fontSize: 16, color: C.white });
      const t = text(s, o, 1.55, y + 0.05, 10.8, 0.5, { fontSize: 17, valign: 'middle' });
      together(s, [b, n, t], 'rise', 110 * i);
    });
    footer(s);
  }

  if (ACADEMIC) {
    // 4 Existing vs proposed
    const s = slide({ notes: 'How Poolora differs from what Harare commuters use now. Taxi apps are on-demand and mostly cash; kombis are cheap but informal. Poolora is scheduled seat booking with upfront mobile-money payment and safety features.' });
    title(s, 'Existing options vs Poolora');
    const rows = [
      ['', 'Kombi / ZUPCO', 'Taxi apps (inDrive, Vaya)', 'Poolora'],
      ['Price, 15 km', `${MARKET.kombi} (ZUPCO ${usd(MARKET.zupco)})`, `${MARKET.taxiApp5km}`, `${usd(commute.suggested)} a seat (car)`],
      ['Booking', 'Queue at the rank', 'On demand, fare negotiated', 'Scheduled seat, paid upfront'],
      ['Matching', 'Fixed routes', 'Pickup near the driver', 'Anywhere along the driver\'s route, right direction'],
      ['Payment', 'Cash', 'Mostly cash', 'EcoCash, OneMoney, InnBucks, card, wallet'],
      ['Cancelling', '—', 'Free; frequent cancellers blocked', `${pct(tiers[0].refundRate)} back from ${tiers[0].minHours} h, free for ${F.cancellation.freeCancelMins} min after acceptance`],
      ['Safety', 'None', 'Ratings', 'Verified drivers, SOS, live share, check-ins'],
      ['Also', '—', 'Some deliveries', 'Parcels with delivery codes, group trips'],
    ];
    const tableRows = rows.map((r, i) => r.map((cell, j) => ({
      text: cell,
      options: {
        bold: i === 0 || j === 0, color: i === 0 ? C.white : j === 3 ? C.tealDark : C.ink,
        fill: { color: i === 0 ? (j === 3 ? C.teal : C.navy) : j === 3 ? 'EAF6F4' : i % 2 ? C.white : 'F0F2F6' },
        fontFace: BODY, fontSize: 13, valign: 'middle', margin: 6,
      },
    })));
    s.addTable(tableRows, { x: 0.6, y: 1.35, w: W - 1.2, colW: [1.9, 2.9, 3.25, 4.08], rowH: 0.62, border: { type: 'solid', color: C.line, pt: 0.5 }, objectName: 'Compare table' });
    animate(s, 'Compare table', 'fade', 0, 700);
    footer(s);
  }

  // 5 Solution
  {
    const s = slide({ dark: true, notes: 'The animation shows the idea: three solo trips become one shared car. Poolora pools three things: seats in cars already making a trip, parcel space, and group trips.' });
    s.background = { color: C.deep };
    title(s, 'One platform, three kinds of pooling', { sub: 'Drivers who are making the trip anyway sell their empty seats and boot space.' });
    clip(s, 'pool.gif', 0.6, 1.8, 7.2, 'Pool clip');
    animate(s, 'Pool clip', 'fade', 0, 800);
    const pillars = [
      ['carW', 'Ride pooling', `Book a seat in a car, SUV, minivan, auto or on a bike going your way. ${usd(commute.suggested)} for a 15 km commute.`],
      ['cash', 'Parcel pooling', 'Send a parcel with a driver already on the route; the recipient hands over a delivery code.'],
      ['globe', 'Trip pooling', 'Plan a group trip, find partners, vote on activities and split costs to the cent.'],
    ];
    pillars.forEach(([k, h, b], i) => {
      const y = 1.85 + i * 1.5;
      const ic = iconCircle(s, k, 8.2, y + 0.1, 0.8, i === 1 ? C.pink : C.teal);
      const t1 = text(s, h, 9.2, y, 3.6, 0.45, { fontFace: HEAD, fontSize: 19, bold: true, color: C.white });
      const t2 = text(s, b, 9.2, y + 0.45, 3.6, 0.95, { fontSize: 13.5, color: C.lilac });
      together(s, [ic, ic + ' glyph', t1, t2], 'rise', 500 + 200 * i);
    });
    footer(s);
  }

  // 6 How it works
  {
    const s = slide({ notes: 'The whole ride in five steps. Payment is taken when the rider books; the driver accepts, and the driver is paid when the rider is dropped off.' });
    title(s, 'How a shared ride works', { sub: 'From posting a ride to rating it, in five steps.' });
    const steps = [
      ['post', 'Driver posts', `Route, time (at least ${F.rides.minAdvanceHours} h ahead), up to ${F.rides.maxStops} stops, seats and a price within the suggested range`],
      ['searchW', 'Rider searches', 'Matched anywhere along the route, ranked by distance, time, rating and reliability'],
      ['payW', 'Books and pays', `EcoCash, OneMoney, InnBucks, card or wallet. Unpaid requests close after ${F.cancellation.paymentTimeoutMins} min`],
      ['liveW', 'Rides live', 'Driver arrives, picks up, drops off; live map, SOS and check-ins throughout'],
      ['starW', 'Rates and settles', `Both rate each other; the driver's share (fare less ${pct(fee)}) goes to their wallet`],
    ];
    steps.forEach(([k, h, b], i) => {
      const x = 0.6 + i * 2.5;
      const ic = iconCircle(s, k, x + 0.72, 1.95, 0.95, i % 2 ? C.pink : C.teal);
      let arrow;
      if (i < steps.length - 1) {
        arrow = uid('Arrow');
        s.addShape(pres.shapes.RIGHT_ARROW, { x: x + 1.95, y: 2.25, w: 0.45, h: 0.35, fill: { color: C.line }, line: { color: C.line }, objectName: arrow });
      }
      const c = card(s, x, 3.2, 2.3, 2.9);
      const t0 = text(s, `${i + 1}`, x + 0.2, 3.35, 0.5, 0.4, { fontFace: HEAD, fontSize: 20, bold: true, color: i % 2 ? C.pink : C.teal });
      const t1 = text(s, h, x + 0.2, 3.8, 1.95, 0.45, { fontFace: HEAD, fontSize: 16, bold: true, color: C.navy });
      const t2 = text(s, b, x + 0.2, 4.3, 1.95, 1.7, { fontSize: 12.5, color: C.muted });
      together(s, [ic, ic + ' glyph', c, t0, t1, t2], 'rise', 250 * i);
      if (arrow) animate(s, arrow, 'fade', 250 * i + 200);
    });
    footer(s);
  }

  // 7–10 App tour (Morph moves the phones between these slides)
  const tour = async (heading, sub, screens, notes, extra) => {
    const s = slide({ transition: 'morph', notes });
    title(s, heading, { sub });
    // Two phones: callouts to the right of each. Three: callouts in the gaps between them.
    const two = screens.length === 2;
    const hgt = two ? 5.35 : 4.95;
    const gap = two ? 2.75 : 2.05;
    const boxes = [];
    const widths = [];
    for (const sc of screens) {
      const { w, h } = await frameSize(sc);
      widths.push((hgt * w) / h);
    }
    const total = widths.reduce((a, b) => a + b, 0) + gap * (screens.length - 1);
    let x = two ? 0.9 : (W - total) / 2;
    for (const [i, sc] of screens.entries()) {
      boxes.push(await phone(s, sc, x, two ? 1.55 : 1.7, hgt, { name: `!!Phone ${i + 1}`, after: 150 * i }));
      x += widths[i] + gap;
    }
    if (extra) extra(s, boxes);
    footer(s);
    return s;
  };

  await tour('Find a ride', 'Search from where you are; results show every kind of vehicle going your way.', ['home', 'results'],
    'The rider home screen on a Harare map, with the five vehicle classes. Searching Borrowdale lists every ride passing that way: car, minivan, auto and bike, with price, time and seats left.',
    (s, [a, b]) => {
      callout(s, a, 'Where are you going?', 'Search any place in Zimbabwe (OpenStreetMap)', { side: 'right', dy: -0.9, width: 2.3 });
      callout(s, a, 'Minivan', 'Car, SUV and bakkie, minivan, auto (tuk-tuk), bike', { side: 'right', dy: 0.5, width: 2.3, after: 1300 });
      callout(s, b, 'All 4', 'Filter by vehicle; sort by time, price or rating', { side: 'right', dy: -0.3, width: 2.6, after: 1700 });
      callout(s, b, 'US$1', `Seat prices in US dollars; ${usd(commute.suggested)} for about 11 km`, { side: 'right', dy: 0.35, width: 2.6, after: 2100 });
    });
  await tour('Book and pay', 'See the driver and the route, choose seats, pay by mobile money or card through Paynow.', ['ride_detail', 'booking', 'payment'],
    'Ride details show the driver, rating, vehicle and route. Booking takes a message for the driver and the payment method. Payment goes through Paynow: EcoCash and OneMoney push a PIN prompt to the phone, InnBucks gives a code, cards open Paynow\'s secure page.',
    (s, [a, b, c]) => {
      callout(s, c, 'EcoCash', 'EcoCash, OneMoney, InnBucks or card, in US$ or ZiG', { side: 'left', dy: 0.4, width: 1.7, after: 1100 });
      callout(s, a, 'Tendai Moyo', 'Verified driver, rating and trips', { side: 'right', dy: -0.2, width: 1.7, after: 1500 });
    }, );
  await tour('On the road', 'Follow the car live; the rider sees each step and can raise an SOS at any time.', ['live_2', 'live_4', 'safety'],
    'A simulated ride in Harare: the app shows the car approaching, then "Driver has arrived". The SOS screen alerts the safety team and emergency contacts; 999 is one tap away.',
    (s, [a, b, c]) => {
      callout(s, a, 'Driver is', 'Live distance and time to pickup', { side: 'right', width: 1.7, after: 1100 });
      callout(s, c, 'Emergency contacts', 'Contacts get a live-location link', { side: 'left', width: 1.7, after: 1500 });
    });
  await tour('Drive and earn', 'Post a ride in a minute; Poolora suggests a fair price and shows what the trip earns.', ['driver_home', 'create_ride', 'earnings'],
    `Drivers see today's earnings and upcoming rides. Posting Harare to Bulawayo suggests ${usd(hreByo.suggested)} a seat off-peak (US$29 in commute hours) from the route distance and vehicle; the driver can choose within 30%.`,
    (s, [a, b, c]) => {
      callout(s, b, 'Suggested', 'Suggested price and the allowed range', { side: 'left', width: 1.7, after: 1100 });
      callout(s, c, 'US$6.46', 'Earnings by day, week and month', { side: 'left', width: 1.7, after: 1500 });
    });

  // 11 Beyond rides
  await tour('More than rides', 'Parcels travel with drivers already on the route; groups plan trips together; one wallet for everything.', ['parcel', 'trips', 'wallet'],
    'Parcels are priced like a motorbike courier in town (about US$5.50 for 10 km) and near Zimpost between cities (about US$16 for 5 kg Harare to Bulawayo), with photo proof and a delivery code. Group trips match partners by interests, dates and budget. The wallet takes refunds and earnings and withdraws to mobile money.',
    (s, [a, b, c]) => {
      callout(s, a, 'What is it?', 'Photo proof at pickup and delivery; delivery code', { side: 'right', width: 1.7, after: 1100 });
      callout(s, c, 'Withdraw to mobile money', `Withdraw ${usd(F.withdrawals.min)}–${usd(F.withdrawals.max)} to mobile money`, { side: 'left', width: 1.7, after: 1500 });
    });

  // 12 Architecture
  if (ACADEMIC) {
    const s = slide({ notes: 'Two clients talk to one backend over HTTPS and WebSockets. The backend owns the business rules, calls the ML service over HTTP, and uses MongoDB, Redis and Kafka. Paynow, OpenStreetMap services, Firebase, Twilio and Claude are the external services.' });
    title(s, 'System architecture');
    const box = (x, y, w, h, k, head, sub, fill) => {
      const n = uid('Arch');
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.1, fill: { color: fill }, line: { color: fill }, objectName: n });
      s.addImage({ data: I[k], x: x + 0.2, y: y + (h - 0.55) / 2, w: 0.55, h: 0.55, objectName: n + ' glyph' });
      const t = text(s, [{ text: head, options: { bold: true, fontSize: 15, breakLine: true } }, { text: sub, options: { fontSize: 11.5 } }], x + 0.9, y + 0.12, w - 1.0, h - 0.2, { color: C.white, valign: 'middle' });
      return [n, n + ' glyph', t];
    };
    const line = (x1, y1, x2, y2) => {
      const n = uid('Link');
      s.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1) || 0.001, h: Math.abs(y2 - y1) || 0.001, line: { color: C.lilac, width: 1.5, dashType: 'dash' }, objectName: n });
      return n;
    };
    const groups = [
      box(0.6, 1.5, 3.2, 1.1, 'phone', 'Mobile app', 'React Native + Expo · riders and drivers', C.teal),
      box(0.6, 3.1, 3.2, 1.1, 'web', 'Admin web', 'React + Vite · operations', C.teal),
      box(0.6, 4.7, 3.2, 1.1, 'globe', 'Website', 'Vite on Vercel · terms, privacy', C.tealDark),
      box(4.9, 2.2, 3.5, 1.4, 'server', 'Backend API', `Node.js · Express · TypeScript · ${F.api.routes} routes`, C.navy),
      box(4.9, 4.0, 3.5, 1.1, 'bolt', 'Real-time gateway', 'Socket.IO · live GPS, chat, SOS', C.navy),
      box(9.5, 1.3, 3.2, 1.0, 'brain', 'ML service', 'Python · FastAPI', C.pink),
      box(9.5, 2.55, 3.2, 1.0, 'db', 'MongoDB', `${F.models} collections · geo indexes`, '3B3196'),
      box(9.5, 3.8, 3.2, 1.0, 'bolt', 'Redis + Kafka', 'Cache, limits, locks, events', '3B3196'),
      box(9.5, 5.05, 3.2, 1.3, 'pay', 'External services', 'Paynow · OSRM, Photon, Nominatim · Firebase · Twilio · S3 · Claude', '5B6475'),
    ];
    const links = [line(3.8, 2.05, 4.9, 2.7), line(3.8, 3.65, 4.9, 3.0), line(3.8, 3.65, 4.9, 4.5), line(8.4, 2.9, 9.5, 1.8), line(8.4, 2.9, 9.5, 3.05), line(8.4, 3.1, 9.5, 4.3), line(8.4, 3.3, 9.5, 5.6)];
    groups.forEach((g, i) => together(s, g, 'rise', i * 120));
    links.forEach((l) => animate(s, l, 'fade', 1200));
    footer(s);
  }

  // 13 Tech stack
  if (ACADEMIC) {
    const s = slide({ notes: 'TypeScript across the app, API and admin; Python for the ML service. Everything runs locally with Docker Compose and deploys to Kubernetes.' });
    title(s, 'Technology stack');
    const stack = [
      ['react', 'React Native + Expo', 'Android and iOS app'], ['ts', 'TypeScript', 'App, API, admin, website'], ['node', 'Node.js + Express 5', `REST API, ${F.api.routes} routes`],
      ['socket', 'Socket.IO', 'Live location, chat, SOS'], ['mongo', 'MongoDB + Mongoose', 'Documents with 2dsphere indexes'], ['redis', 'Redis', 'Cache, rate limits, job locks'],
      ['kafka', 'Kafka', 'Events (in-process fallback)'], ['fastapi', 'Python FastAPI', 'Demand, fraud, route order'], ['firebase', 'Firebase', 'Google sign-in, push'],
      ['osm', 'OpenStreetMap', 'MapLibre tiles, OSRM routes, Photon'], ['payW', 'Paynow', 'EcoCash, OneMoney, InnBucks, card'], ['anthropic', 'Claude', 'In-app support assistant'],
      ['vite', 'Vite + React', 'Admin dashboard, website'], ['docker', 'Docker + Kubernetes', 'Containers, autoscaling'], ['jest', 'Jest + Vitest', `${totalTests} automated tests`],
    ];
    stack.forEach(([k, h, b], i) => {
      const x = 0.6 + (i % 5) * 2.45;
      const y = 1.45 + Math.floor(i / 5) * 1.75;
      const c = card(s, x, y, 2.25, 1.55);
      const img = uid('Stack icon');
      s.addImage({ data: k === 'payW' ? I.money : I[k], x: x + 0.2, y: y + 0.22, w: 0.5, h: 0.5, objectName: img });
      const t = text(s, [{ text: h, options: { bold: true, fontSize: 13.5, color: C.navy, breakLine: true } }, { text: b, options: { fontSize: 11.5, color: C.muted } }], x + 0.2, y + 0.8, 1.95, 0.7);
      together(s, [c, img, t], 'rise', 60 * i);
    });
    footer(s);
  }

  // 14 Matching algorithm
  if (ACADEMIC) {
    const s = slide({ notes: 'Matching is along the route, not just near the start. The route line is indexed; the rider must be picked up before the drop along the line; results are scored.' });
    title(s, 'Algorithm: matching riders along a route');
    bullets(s, [
      'When a ride is posted, its road route from OSRM is stored as a GeoJSON LineString with a 2dsphere index',
      `Search runs $geoNear on the route near the rider's pickup (within ${2} km of the line by default)`,
      'Each candidate is projected onto the route: the pickup must come before the drop along the line (right direction)',
      'Candidates are ranked by a weighted score; the fare is the seat price, shown before booking',
    ], 0.6, 1.4, 6.2, 3.6, { fontSize: 16 });
    const wts = F.matchingWeights;
    const labels = { proximity: 'Pickup distance', time: 'Departure time', rating: 'Driver rating', acceptance: 'Acceptance rate', safety: 'Low cancellations' };
    const c = card(s, 7.2, 1.4, 5.5, 4.9);
    animate(s, c, 'fade', 0);
    text(s, 'Match score weights', 7.5, 1.6, 5, 0.4, { fontFace: HEAD, fontSize: 17, bold: true, color: C.navy, objectName: 'Weights head' });
    animate(s, 'Weights head', 'fade', 100);
    Object.entries(wts).forEach(([k, v], i) => {
      const y = 2.25 + i * 0.78;
      const t = text(s, labels[k] || k, 7.5, y, 2.1, 0.4, { fontSize: 13.5, color: C.ink, valign: 'middle' });
      const bar = uid('Weight bar');
      s.addShape(pres.shapes.RECTANGLE, { x: 9.6, y: y + 0.06, w: Math.max(0.12, v * 6.2), h: 0.3, fill: { color: i === 0 ? C.pink : C.teal }, line: { color: i === 0 ? C.pink : C.teal }, objectName: bar });
      const val = text(s, pct(v), 9.7 + v * 6.2, y, 0.8, 0.4, { fontSize: 13, bold: true, color: C.navy, valign: 'middle' });
      together(s, [t, val], 'fade', 300 + 120 * i);
      animate(s, bar, 'wipe', 300 + 120 * i, 600);
    });
    footer(s);
  }

  // 15 Pricing
  {
    const s = slide({ notes: `Seat prices come from the route distance and a per-kilometre rate for the vehicle, about a car's running cost shared between riders, plus ${Math.round((rules.peakUplift - 1) * 100)}% in commute hours and a surge only when the demand forecast is high. A 15 km commute costs about a dollar, like a kombi; Harare to Bulawayo sits between the ordinary bus and the luxury coach.` });
    title(s, 'Fair prices, set against what people pay now', { sub: `price = distance × rate(vehicle) × commute hours (+${Math.round((rules.peakUplift - 1) * 100)}%, not on public holidays) × surge (+${Math.round((rules.surgeFloor - 1) * 100)}–${Math.round((rules.surgeCap - 1) * 100)}%) · drivers choose within ±${pct(rules.adjustBand)}` });
    const barChart = (x, y, w, heading, rows, max, after) => {
      const c = card(s, x, y, w, 4.55);
      animate(s, c, 'fade', after);
      const h = text(s, heading, x + 0.3, y + 0.2, w - 0.6, 0.4, { fontFace: HEAD, fontSize: 16, bold: true, color: C.navy });
      animate(s, h, 'fade', after);
      rows.forEach(([label, value, shown, highlight], i) => {
        const yy = y + 0.85 + i * 0.88;
        const t = text(s, label, x + 0.3, yy, 2.45, 0.6, { fontSize: 12.5, color: C.ink, valign: 'middle' });
        const bw = ((w - 3.9) * value) / max;
        const bar = uid('Price bar');
        s.addShape(pres.shapes.RECTANGLE, { x: x + 2.85, y: yy + 0.13, w: Math.max(0.08, bw), h: 0.34, fill: { color: highlight ? C.teal : 'C9CFDA' }, line: { color: highlight ? C.teal : 'C9CFDA' }, objectName: bar });
        const v = text(s, shown, x + 2.95 + bw, yy, 1.1, 0.6, { fontSize: 13, bold: true, color: highlight ? C.tealDark : C.muted, valign: 'middle' });
        animate(s, t, 'fade', after + 200 + i * 150);
        animate(s, bar, 'wipe', after + 200 + i * 150, 600);
        animate(s, v, 'fade', after + 500 + i * 150);
      });
    };
    barChart(0.6, 1.95, 6.0, 'Commuting in Harare', [
      ['ZUPCO bus, up to 20 km', MARKET.zupco, usd(MARKET.zupco)],
      ['Kombi', 1, 'US$0.50–1'],
      [`Poolora seat, 15 km (car)`, commute.suggested, usd(commute.suggested), true],
      ['Taxi app, 5 km', 3, 'US$2–4'],
    ], 4, 0);
    barChart(6.75, 1.95, 6.0, 'Harare to Bulawayo (439 km)', [
      ['Ordinary bus', MARKET.busHreByo, usd(MARKET.busHreByo)],
      ['Poolora seat, car', hreByo.suggested, usd(hreByo.suggested), true],
      ['Poolora seat, minivan', hreByoVan.suggested, usd(hreByoVan.suggested), true],
      ['CityLink luxury coach', MARKET.coachHreByo, usd(MARKET.coachHreByo)],
    ], 38, 600);
    const r = F.pricing.ratePerKm;
    text(s, `Rates a seat per km: bike ${usd(r.bike)} · auto ${usd(r.auto)} · hatchback ${usd(r.hatchback)} · sedan ${usd(r.sedan)} · minivan ${usd(r.minivan)} · bakkie ${usd(r.pickup)} · SUV ${usd(r.suv)}. Never below ${usd(rules.minimumSeatPrice)} or outside ${usd(rules.minPerKm)}–${usd(rules.maxPerKm)} a km. Off-peak examples from the pricing code; market fares September 2026.`,
      0.6, 6.55, W - 1.2, 0.4, { fontSize: 11, color: C.muted, objectName: 'Rates note' });
    animate(s, 'Rates note', 'fade', 1500);
    footer(s);
  }

  // Pitch: how the money works
  if (!ACADEMIC) {
    const s = slide({ notes: 'Riders pay the seat price with no booking fee. Poolora keeps 15% of completed fares; the rest goes to the driver. On a full intercity trip the fares cover the driver\'s fuel, which is what makes drivers post rides.' });
    title(s, 'How the money works', { sub: `Riders pay the seat price, no booking fee. Poolora keeps ${pct(fee)} of completed fares; drivers keep the rest.` });
    const trip = (x, heading, km, seat, riders) => {
      const fares = seat * riders;
      const fees = fares * fee;
      const rows = [
        [`${riders} seats × ${usd(seat)}`, usd(fares)],
        [`Poolora (${pct(fee)})`, `−${usd(Math.round(fees * 100) / 100)}`],
        ['Driver keeps', usd(Math.round((fares - fees) * 100) / 100)],
        [`Fuel, ${km} km at ${litresPer100} L/100 km`, usd(Math.round(fuelCost(km) * 100) / 100)],
      ];
      const c = card(s, x, 1.95, 5.9, 3.9);
      const h = text(s, heading, x + 0.35, 2.15, 5.2, 0.45, { fontFace: HEAD, fontSize: 18, bold: true, color: C.navy });
      together(s, [c, h], 'rise', x > 5 ? 400 : 0);
      rows.forEach(([a, b], i) => {
        const y = 2.8 + i * 0.7;
        const t1 = text(s, a, x + 0.35, y, 3.6, 0.5, { fontSize: 15, color: i === 2 ? C.tealDark : C.ink, bold: i === 2, valign: 'middle' });
        const t2 = text(s, b, x + 3.9, y, 1.7, 0.5, { fontSize: 17, bold: true, align: 'right', color: i === 2 ? C.tealDark : i === 3 ? C.pink : C.navy, valign: 'middle' });
        together(s, [t1, t2], 'fade', (x > 5 ? 600 : 200) + i * 150);
      });
    };
    trip(0.6, 'A daily commute, 15 km', 15, commute.suggested, 3);
    trip(6.83, 'Harare to Bulawayo, 439 km', 439, hreByo.suggested, 3);
    text(s, `Fuel at US$${fuelPerLitre.toFixed(2)} a litre (ZERA, September 2026). For comparison, inDrive is reported to take about ${pct(MARKET.indriveCommission)}; Kenya caps e-hailing commission at 18%.`, 0.6, 6.15, W - 1.2, 0.5, { fontSize: 12, color: C.muted, objectName: 'Money note' });
    animate(s, 'Money note', 'fade', 1500);
    footer(s);
  }

  // 16 Refunds (and, in the pitch, safety alongside)
  {
    const s = slide({ notes: `Refunds follow simple rules: before the driver accepts, everything comes back; ${F.cancellation.freeCancelMins} minutes after acceptance it is still free if the ride is an hour or more away; then ${pct(tiers[0].refundRate)} from ${tiers[0].minHours} hours, ${pct(tiers[1].refundRate)} from ${tiers[1].minHours} hours, nothing after. Driver cancellations and changed times always refund in full. Paynow cannot refund, so money comes back to the wallet and can be withdrawn to mobile money.` });
    title(s, 'Cancellations and refunds', { sub: 'Clear rules shown before the rider confirms; refunds land in the wallet at once.' });
    // A timeline towards departure
    const x0 = 0.9;
    const x1 = W - 0.9;
    const segs = [
      [`${tiers[0].minHours} h or more before`, pct(tiers[0].refundRate), C.teal, 0.36],
      [`${tiers[1].minHours}–${tiers[0].minHours} h before`, pct(tiers[1].refundRate), C.amber, 0.44],
      [`Under ${tiers[1].minHours} h`, pct(tiers[2].refundRate), C.pink, 0.2],
    ];
    let x = x0;
    segs.forEach(([label, value, col, frac], i) => {
      const w = (x1 - x0) * frac;
      const bar = uid('Tier');
      s.addShape(pres.shapes.RECTANGLE, { x, y: 2.1, w, h: 0.75, fill: { color: col }, line: { color: C.white, width: 2 }, objectName: bar });
      const v = text(s, `${value} back`, x, 2.1, w, 0.75, { fontFace: HEAD, fontSize: 18, bold: true, color: C.white, align: 'center', valign: 'middle' });
      const l = text(s, label, x, 2.95, w, 0.4, { fontSize: 13, color: C.muted, align: 'center' });
      animate(s, bar, 'wipe', 200 * i, 500);
      together(s, [v, l], 'fade', 200 * i + 250);
      x += w;
    });
    text(s, 'Departure →', x1 - 1.5, 1.7, 1.5, 0.35, { fontSize: 12, color: C.muted, align: 'right', objectName: 'Timeline end' });
    animate(s, 'Timeline end', 'fade', 700);
    const rulesList = [
      ['check', `Free for ${F.cancellation.freeCancelMins} minutes after the driver accepts, while the ride is ${F.cancellation.freeCancelLeadMins / 60} hour or more away`],
      ['check', 'Everything back before the driver accepts, if the driver cancels, or if the driver moves the time'],
      ['check', `No-show: the driver waits ${F.cancellation.noShowWaitMins} minutes at the pickup; then the fare goes to the driver, less the fee`],
      ['check', 'Refunds go to the Poolora wallet at once and can be withdrawn to EcoCash, OneMoney or InnBucks'],
    ];
    rulesList.forEach(([k, t], i) => {
      const y = 3.75 + i * 0.66;
      const img = uid('Rule icon');
      s.addImage({ data: I[k], x: 0.9, y: y + 0.05, w: 0.36, h: 0.36, objectName: img });
      const tt = text(s, t, 1.45, y, ACADEMIC ? 11 : 6.3, 0.5, { fontSize: 15, valign: 'middle' });
      together(s, [img, tt], 'rise', 900 + i * 150);
    });
    if (!ACADEMIC) {
      const c = card(s, 8.05, 3.65, 4.7, 2.85, { fill: C.navy, line: C.navy });
      const h = text(s, 'Safety built in', 8.35, 3.85, 4.2, 0.4, { fontFace: HEAD, fontSize: 17, bold: true, color: C.white });
      const b = bullets(s, ['Verified drivers: licence, registration book, insurance', 'SOS to our safety desk and your contacts', 'Live trip link, route-deviation alerts, check-ins', 'Adults only (18+), masked phone numbers'], 8.35, 4.35, 4.2, 2.1, { fontSize: 13, color: C.white });
      together(s, [c, h, b], 'rise', 1400);
    }
    footer(s);
  }

  // 17 Safety (academic)
  if (ACADEMIC) {
    const s = slide({ dark: true, notes: 'Safety features, most of which are already exercised by tests and the simulator: SOS, live link, route deviation, check-ins, verified contacts, verified drivers, and the account protections added in the review.' });
    title(s, 'Safety by design');
    const feats = [
      ['sos', 'One-tap SOS', 'Alerts the admin safety desk and texts emergency contacts a live-location link; 999 one tap away'],
      ['share', 'Live trip link', 'A public link with the car\'s position, for anyone the rider chooses'],
      ['map', 'Route deviation', `Alert when the car is more than ${500} m off the planned route`],
      ['alarm', 'Check-ins', '"Are you OK?" during the ride; two missed prompts raise an SOS'],
      ['contacts', 'Emergency contacts', 'Confirmed by SMS; the user picks who is alerted'],
      ['lock', 'Verified people', 'Licence, registration book and insurance checked; adults only; permanent blocks need two admins'],
    ];
    feats.forEach(([k, h, b], i) => {
      const x = 0.6 + (i % 3) * 4.1;
      const y = 1.5 + Math.floor(i / 3) * 2.6;
      const c = card(s, x, y, 3.85, 2.35, { fill: '251D62', line: '3A3182' });
      const ic = iconCircle(s, k, x + 0.3, y + 0.3, 0.75, i === 0 ? C.pink : C.teal);
      const t1 = text(s, h, x + 1.25, y + 0.38, 2.45, 0.5, { fontFace: HEAD, fontSize: 17, bold: true, color: C.white });
      const t2 = text(s, b, x + 0.3, y + 1.2, 3.3, 1.05, { fontSize: 13, color: C.lilac });
      together(s, [c, ic, ic + ' glyph', t1, t2], 'rise', 120 * i);
    });
    footer(s);
  }

  // 18 Built for Zimbabwe
  {
    const s = slide({ dark: true, notes: 'Everything country-specific lives in one market registry: time zone, phone format, currency, emergency numbers, map bounds and now the public holidays. Zimbabwe is the first entry; another country is a new entry plus its payment provider.' });
    s.background = { color: C.deep };
    title(s, 'Built for Zimbabwe first', { sub: 'Everything country-specific lives in one market registry; a new country is an entry, not a rewrite.' });
    clip(s, 'map.gif', 0.4, 1.75, 7.4, 'Map clip');
    animate(s, 'Map clip', 'fade', 0, 900);
    const hols = F.market.holidays.filter((h) => !h.name.includes('observed')).length;
    const facts = [
      ['pay', 'US dollars, ZiG when enabled; EcoCash, OneMoney, InnBucks and cards through Paynow'],
      ['phone', `${F.market.dialCode} numbers (Econet, NetOne, Telecel), shown as +263 77 123 4567`],
      ['holiday', `${hols} public holidays, Easter and Heroes' Day included, feed the demand forecast`],
      ['clock', 'Harare time (CAT) everywhere, 24-hour clock'],
      ['sos', `Emergency ${F.market.emergency.general}, police ${F.market.emergency.police}, ambulance ${F.market.emergency.ambulance}`],
      ['car', 'Car, SUV and bakkie, minivan, auto (tuk-tuk), bike; Zimbabwe number plates'],
    ];
    facts.forEach(([k, t], i) => {
      const y = 1.8 + i * 0.78;
      const img = uid('Zw icon');
      s.addImage({ data: I[k === 'clock' ? 'alarm' : k === 'car' ? 'carW' : k], x: 8.1, y: y + 0.06, w: 0.42, h: 0.42, objectName: img });
      const tt = text(s, t, 8.7, y, 4.2, 0.7, { fontSize: 13.5, color: C.white, valign: 'middle' });
      together(s, [img, tt], 'rise', 500 + 130 * i);
    });
    footer(s);
  }

  // 19 Admin
  {
    const s = slide({ notes: 'The web dashboard is how the team runs the service: live figures, SOS incidents, driver applications, disputes, payouts, and settings such as the refund tiers, each change logged and critical ones needing a second admin.' });
    title(s, ACADEMIC ? 'Admin dashboard (web)' : 'Running the service', { sub: 'Live figures, SOS desk, driver checks, disputes, payouts and settings; every change is logged.' });
    const { w: fw, h: fh } = await frameSize('admin_dashboard');
    const w1 = 7.6;
    s.addImage({ path: path.join(FRAMES, 'admin_dashboard.png'), x: 0.45, y: 1.6, w: w1, h: (w1 * fh) / fw, objectName: 'Admin 1' });
    const { w: fw2, h: fh2 } = await frameSize('admin_settings');
    const w2 = 5.2;
    s.addImage({ path: path.join(FRAMES, 'admin_settings.png'), x: 7.75, y: 3.35, w: w2, h: (w2 * fh2) / fw2, objectName: 'Admin 2' });
    animate(s, 'Admin 1', 'zoom', 0, 600);
    animate(s, 'Admin 2', 'rise', 500, 600);
    const t = text(s, 'Settings such as fees and refund tiers need a second admin\'s approval and can be reverted for 24 hours.', 8.2, 1.7, 4.6, 1.2, { fontSize: 14, color: C.muted });
    animate(s, t, 'fade', 900);
    footer(s);
  }

  // 20 Database
  if (ACADEMIC) {
    const s = slide({ notes: 'MongoDB document store. Places are GeoJSON with 2dsphere indexes; the ride stores its route line for along-the-route search.' });
    title(s, 'Database design', { sub: `MongoDB, ${F.models} collections. Places are GeoJSON points and lines with 2dsphere indexes.` });
    const groups = [
      ['Core', ['User (profile, KYC, vehicles, contacts)', 'Ride (route line, stops, vehicle)', 'Booking (pickup, drop, fare, refunds)', 'Rating, Message']],
      ['Money', ['Payment, GatewayCharge (Paynow)', 'Wallet, WalletTransaction', 'CoinLedger, WithdrawalRequest']],
      ['Safety', ['EmergencyRecord, EmergencyToken', 'TripShare, Dispute, Appeal', 'SupportTicket']],
      ['Admin', ['AdminAuditLog, AdminNote', 'PlatformSettings (two-admin changes)', 'AlertRule, ReportSchedule']],
      ['Pooling', ['ParcelPooling (codes, photos, claims)', 'Trip (members, votes, expenses)', 'RideAlert, SavedRoute']],
    ];
    groups.forEach(([h, items], i) => {
      const x = 0.6 + i * 2.48;
      const c = card(s, x, 1.95, 2.3, 4.3);
      const hh = text(s, h, x + 0.2, 2.1, 1.9, 0.45, { fontFace: HEAD, fontSize: 17, bold: true, color: i % 2 ? C.pink : C.teal });
      const b = bullets(s, items, x + 0.2, 2.65, 1.95, 3.5, { fontSize: 12.5, paraSpaceAfter: 9 });
      together(s, [c, hh, b], 'rise', 130 * i);
    });
    footer(s);
  }

  // 21 Testing
  if (ACADEMIC) {
    const s = slide({ notes: 'Numbers are read from the test runs when the deck is built. The emulator testing on 29 and 30 September found defects that unit tests missed, including one that made posting any ride fail.' });
    title(s, 'Testing and results');
    const stats = [
      [String(tests.backend?.tests ?? '—'), 'backend tests', `${tests.backend?.suites ?? '—'} suites, all passing`],
      [String(tests.app?.tests ?? '—'), 'mobile app tests', `${tests.app?.suites ?? '—'} suites, all passing`],
      [String(tests.admin?.tests ?? '—'), 'admin web tests', 'Vitest'],
      [`${Math.round(totalLoc / 1000)}k`, 'lines of code', 'TypeScript and Python'],
    ];
    stats.forEach(([n, l, sub], i) => {
      const x = 0.6 + i * 3.08;
      const c = card(s, x, 1.4, 2.85, 1.7);
      const t1 = text(s, n, x + 0.25, 1.5, 2.4, 0.8, { fontFace: HEAD, fontSize: 38, bold: true, color: i === 3 ? C.pink : C.teal });
      const t2 = text(s, [{ text: l, options: { bold: true, breakLine: true } }, { text: sub, options: { color: C.muted, fontSize: 12 } }], x + 0.25, 2.3, 2.4, 0.75, { fontSize: 14 });
      together(s, [c, t1, t2], 'zoom', 120 * i);
    });
    bullets(s, [
      'Jest unit and integration tests on a real in-memory MongoDB; money flows tested end to end',
      'Vitest for the admin web; TypeScript, ESLint and tests in CI',
      'Ride simulator: a bot driver or rider for a full trip on one phone',
      'Android emulator runs: sign-in, booking, Paynow screens, live ride, account closure',
    ], 0.6, 3.45, 6.3, 2.9, { fontSize: 14.5 });
    const c = card(s, 7.2, 3.35, 5.55, 3.1, { fill: C.pinkLight, line: 'F2C4DA' });
    const h = text(s, 'Found by running the app, then fixed with a test', 7.45, 3.5, 5.1, 0.4, { fontFace: HEAD, fontSize: 14.5, bold: true, color: C.navy });
    const b = bullets(s, ['Posting any ride crashed (a recursive event payload)', 'Rate limits per IP would lock out users behind carrier NAT', 'A payment landing as a request expired was never refunded', 'Under-18 sign-ups; no way to close an account', 'Same-day cancellations lost the whole fare'], 7.45, 3.95, 5.1, 2.4, { fontSize: 13 });
    together(s, [c, h, b], 'rise', 700);
    footer(s);
  }

  // 22 Deployment
  if (ACADEMIC) {
    const s = slide({ notes: 'Containers for every service; Kubernetes manifests with autoscaling, backups and monitoring; the two web apps are static sites on Vercel.' });
    title(s, 'Deployment');
    const cols = [
      ['docker', 'Containers', ['Each service ships as an image', 'Docker Compose runs the whole stack locally']],
      ['k8s', 'Kubernetes', ['Backend and ML deployments with a horizontal pod autoscaler', 'MongoDB, Redis and Kafka as StatefulSets', 'Ingress with TLS, network policies, disruption budgets']],
      ['cloud', 'Operations', ['Scheduled database backups', 'Health checks and Prometheus metrics', 'Admin web and website as static sites on Vercel', 'KYC files in S3, Cape Town region']],
    ];
    cols.forEach(([k, h, items], i) => {
      const x = 0.6 + i * 4.1;
      const c = card(s, x, 1.5, 3.85, 4.7);
      const img = uid('Deploy icon');
      s.addImage({ data: I[k], x: x + 0.3, y: 1.8, w: 0.7, h: 0.7, objectName: img });
      const hh = text(s, h, x + 1.2, 1.9, 2.5, 0.5, { fontFace: HEAD, fontSize: 19, bold: true, color: C.navy });
      const b = bullets(s, items, x + 0.3, 2.85, 3.3, 3.2, { fontSize: 14 });
      together(s, [c, img, hh, b], 'rise', 180 * i);
    });
    footer(s);
  }

  // 23 Challenges
  if (ACADEMIC) {
    const s = slide({ notes: 'The hardest parts, and what they taught.' });
    title(s, 'Challenges and what I learned');
    const ch = [
      ['Moving the whole product to a new country', 'Currency, phones, time, maps, payments and law all changed; a single market registry made the next country cheap.'],
      ['Payments without refunds', 'Paynow has no refund API, so every refund goes to an in-app wallet that can be withdrawn to mobile money, with idempotent keys.'],
      ['Tests that mock too much', 'Every suite mocked the event bus, so a crash when posting rides slipped through; now key modules keep one real test.'],
      ['Fair rules need real prices', 'Refund tiers and fares were rechecked against kombis, ZUPCO, inDrive and intercity buses before launch.'],
    ];
    ch.forEach(([h, b], i) => {
      const x = 0.6 + (i % 2) * 6.15;
      const y = 1.5 + Math.floor(i / 2) * 2.5;
      const c = card(s, x, y, 5.9, 2.25);
      const t1 = text(s, h, x + 0.35, y + 0.3, 5.2, 0.5, { fontFace: HEAD, fontSize: 17, bold: true, color: C.navy });
      const t2 = text(s, b, x + 0.35, y + 0.9, 5.2, 1.2, { fontSize: 14, color: C.muted });
      together(s, [c, t1, t2], 'rise', 150 * i);
    });
    footer(s);
  }

  // 24 Status and next steps
  {
    const s = slide({ notes: 'What is done and what is left before real users. The legal and payment items are paperwork, not code. The e-hailing regulations are being written during a five-month transition from 8 September 2026.' });
    title(s, ACADEMIC ? 'Status and future scope' : 'Where we are', { sub: 'The product is built and tested; launch depends on licences, live payments and the new e-hailing rules.' });
    const done = ['Rider and driver app, admin web, website', 'Paynow payments (test mode), wallet and withdrawals', 'Live tracking, SOS, check-ins, trip sharing', 'Parcels and group trips', 'In-app support assistant (Claude)', 'Account closure, 18+, per-user rate limits'];
    const next = ['POTRAZ data controller licence and a Data Protection Officer', 'Lawyer\'s review of the terms and privacy policy', 'Paynow live mode and a business mobile money account', 'A Zimbabwe support number (today +91)', 'Align with the e-hailing regulations (transition ends about February 2027)', 'Next markets through the market registry'];
    const col = (x, heading, items, key, colr, after) => {
      const c = card(s, x, 1.85, 5.9, 4.6);
      const h = text(s, heading, x + 0.35, 2.05, 5.2, 0.45, { fontFace: HEAD, fontSize: 18, bold: true, color: colr });
      together(s, [c, h], 'rise', after);
      items.forEach((t, i) => {
        const y = 2.65 + i * 0.6;
        const img = uid('Status icon');
        s.addImage({ data: I[key], x: x + 0.35, y: y + 0.06, w: 0.32, h: 0.32, objectName: img });
        const tt = text(s, t, x + 0.85, y, 4.9, 0.5, { fontSize: 14, valign: 'middle' });
        together(s, [img, tt], 'fade', after + 200 + i * 110);
      });
    };
    col(0.6, 'Done', done, 'check', C.teal, 0);
    col(6.83, 'Before launch', next, 'todo', C.pink, 700);
    footer(s);
  }

  // 25 Conclusion / pitch close
  {
    const s = slide({ dark: true, notes: ACADEMIC ? 'Summarise: a working pooling platform, localised for Zimbabwe, with safety, payments and operations in place. Then take questions.' : 'Close with the ask and contact details.' });
    s.background = { color: C.deep };
    clip(s, 'hero.gif', 6.1, 1.2, 6.9, 'Close clip');
    animate(s, 'Close clip', 'fade', 0, 800);
    if (ACADEMIC) {
      title(s, 'Conclusion');
      const b = bullets(s, [
        'Poolora pools seats, parcel space and group trips in one app',
        'Built for Zimbabwe: US dollars and mobile money, Harare time, local holidays and vehicles',
        'Safety, payments, refunds and operations are in place and tested',
        'Launch needs licences and live payments, not more code',
      ], 0.6, 1.6, 5.3, 3.6, { fontSize: 17, color: C.white });
      animate(s, b, 'rise', 300);
      text(s, 'Thank you · Questions?', 0.6, 5.5, 5.3, 0.7, { fontFace: HEAD, fontSize: 30, bold: true, color: C.tealLight, objectName: 'Thanks' });
      animate(s, 'Thanks', 'zoom', 900);
    } else {
      title(s, 'Let\'s move Harare together');
      const b = bullets(s, [
        'Partners: fleet owners, employers and campuses with commute routes',
        'Payments and mobile money: live Paynow and payout accounts',
        'Advisers on POTRAZ and the e-hailing regulations',
      ], 0.6, 1.6, 5.3, 2.6, { fontSize: 17, color: C.white });
      animate(s, b, 'rise', 300);
      text(s, [{ text: 'N. M. Sibanda, founder', options: { bold: true, breakLine: true } }, { text: 'nathimike102@icloud.com', options: { breakLine: true } }, { text: '+91 90322 32881' }], 0.6, 4.6, 5.3, 1.3, { fontSize: 17, color: C.white, objectName: 'Contact' });
      animate(s, 'Contact', 'fade', 800);
    }
    footer(s);
  }

  // Sources
  {
    const s = slide({ notes: 'Where the market figures came from. Prices change often; these were checked in September 2026.' });
    title(s, 'Sources', { sub: 'Market figures checked in September 2026. Poolora figures are read from the code when the deck is built.' });
    const src = [
      'Zimpricecheck, "Urban ZUPCO, intercity bus fare and transport costs", 29 Sept 2026 · zimpricecheck.com',
      'CityLink Luxury Coaches, routes and fares · citylinkcoaches.co.zw',
      'ZERA fuel prices via GlobalPetrolPrices, 17 Sept 2026 · globalpetrolprices.com/Zimbabwe',
      'NewsDay, "Adjust to our ride fares or walk, inDrive drivers tell Zimboz" · newsday.co.zw',
      'Equity Axis, "Zimbabwe gives inDrive, Tap & Go and Bolt five months…", Sept 2026 · equityaxis.net',
      'Things to Do in Zimbabwe, "Taxis & rideshare in Zimbabwe (2026)" · thingstodoinzimbabwe.com',
      'NewZimbabwe, "Kombis now demanding fares in US dollars" · newzimbabwe.com',
      'inDrive help, "How to cancel a ride" · indrive.com; BlaBlaCar carpool cancellation policy · blablacar.com',
      'Zimbabwe outline: Natural Earth via johan/world.geo.json (public domain)',
    ];
    const b = bullets(s, src, 0.6, 1.75, W - 1.2, 4.9, { fontSize: 14 });
    animate(s, b, 'fade', 0);
    footer(s);
  }

  // ── write, then add animations and transitions ───────────────────────
  const buf = await pres.write({ outputType: 'nodebuffer' });
  const zip = await JSZip.loadAsync(buf);
  for (let i = 0; i < deck.length; i++) {
    const file = `ppt/slides/slide${i + 1}.xml`;
    let xml = await zip.file(file).async('string');
    xml = addMotion(xml, deck[i]._meta);
    zip.file(file, xml);
  }
  await dedupeMedia(zip);
  const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
  fs.writeFileSync(OUT, out);
  console.log(`${path.basename(OUT)}: ${deck.length} slides, ${(out.length / 1e6).toFixed(1)} MB`);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});

/** pptxgenjs stores an image once per use; keep one copy of each and point every slide at it */
async function dedupeMedia(zip) {
  const crypto = require('crypto');
  const first = {};
  const moved = {};
  for (const name of Object.keys(zip.files).filter((n) => n.startsWith('ppt/media/') && !zip.files[n].dir).sort()) {
    const hash = crypto.createHash('sha1').update(await zip.file(name).async('nodebuffer')).digest('hex');
    if (first[hash]) {
      moved[path.basename(name)] = path.basename(first[hash]);
      zip.remove(name);
    } else first[hash] = name;
  }
  for (const rels of Object.keys(zip.files).filter((n) => /^ppt\/(slides|slideLayouts|notesSlides)\/_rels\//.test(n) && !zip.files[n].dir)) {
    let xml = await zip.file(rels).async('string');
    xml = xml.replace(/Target="\.\.\/media\/([^"]+)"/g, (m, f) => (moved[f] ? `Target="../media/${moved[f]}"` : m));
    zip.file(rels, xml);
  }
}

// ── animation XML ─────────────────────────────────────────────────────
function addMotion(xml, meta) {
  const ids = {};
  const kinds = {};
  for (const m of xml.matchAll(/<p:(sp|pic|graphicFrame)>\s*<p:nv\w+Pr>\s*<p:cNvPr id="(\d+)" name="([^"]*)"/g)) {
    ids[decode(m[3])] = m[2];
    kinds[decode(m[3])] = m[1];
  }
  let ctn = 2;
  const pars = [];
  const builds = [];
  const anims = [...meta.anims].sort((a, b) => a.after - b.after);
  anims.forEach((a, i) => {
    const spid = ids[a.name];
    if (!spid) return;
    pars.push(effect(a, spid, i === 0 ? 'afterEffect' : 'withEffect', () => ++ctn));
    if (kinds[a.name] === 'sp') builds.push(`<p:bldP spid="${spid}" grpId="0" animBg="1"/>`);
  });
  const timing = pars.length
    ? `<p:timing><p:tnLst><p:par><p:cTn id="1" dur="indefinite" restart="never" nodeType="tmRoot"><p:childTnLst><p:seq concurrent="1" nextAc="seek"><p:cTn id="2" dur="indefinite" nodeType="mainSeq"><p:childTnLst><p:par><p:cTn id="${++ctn}" fill="hold"><p:stCondLst><p:cond delay="indefinite"/><p:cond evt="onBegin" delay="0"><p:tn val="2"/></p:cond></p:stCondLst><p:childTnLst><p:par><p:cTn id="${++ctn}" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst><p:childTnLst>${pars.join('')}</p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn></p:par></p:childTnLst></p:cTn><p:prevCondLst><p:cond evt="onPrev" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:prevCondLst><p:nextCondLst><p:cond evt="onNext" delay="0"><p:tgtEl><p:sldTgt/></p:tgtEl></p:cond></p:nextCondLst></p:seq></p:childTnLst></p:cTn></p:par></p:tnLst>${builds.length ? `<p:bldLst>${[...new Set(builds)].join('')}</p:bldLst>` : ''}</p:timing>`
    : '';
  const fade = '<p:transition spd="med"><p:fade/></p:transition>';
  const transition = meta.transition === 'morph'
    ? `<mc:AlternateContent xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"><mc:Choice xmlns:p159="http://schemas.microsoft.com/office/powerpoint/2015/09/main" Requires="p159"><p:transition spd="slow"><p159:morph option="byObject"/></p:transition></mc:Choice><mc:Fallback>${fade}</mc:Fallback></mc:AlternateContent>`
    : fade;
  return xml.replace('</p:sld>', `${transition}${timing}</p:sld>`);
}

function effect(a, spid, nodeType, next) {
  const tgt = `<p:tgtEl><p:spTgt spid="${spid}"/></p:tgtEl>`;
  const show = () => `<p:set><p:cBhvr><p:cTn id="${next()}" dur="1" fill="hold"><p:stCondLst><p:cond delay="0"/></p:stCondLst></p:cTn>${tgt}<p:attrNameLst><p:attrName>style.visibility</p:attrName></p:attrNameLst></p:cBhvr><p:to><p:strVal val="visible"/></p:to></p:set>`;
  const fadeIn = () => `<p:animEffect transition="in" filter="fade"><p:cBhvr><p:cTn id="${next()}" dur="${a.dur}"/>${tgt}</p:cBhvr></p:animEffect>`;
  const prop = (attr, from, to) => `<p:anim calcmode="lin" valueType="num"><p:cBhvr additive="base"><p:cTn id="${next()}" dur="${a.dur}" fill="hold"/>${tgt}<p:attrNameLst><p:attrName>${attr}</p:attrName></p:attrNameLst></p:cBhvr><p:tavLst><p:tav tm="0"><p:val><p:strVal val="${from}"/></p:val></p:tav><p:tav tm="100000"><p:val><p:strVal val="${to}"/></p:val></p:tav></p:tavLst></p:anim>`;
  let preset;
  let body;
  const id = next();
  if (a.effect === 'zoom') {
    preset = 'presetID="53" presetClass="entr" presetSubtype="16"';
    body = show() + prop('ppt_w', '0', '#ppt_w') + prop('ppt_h', '0', '#ppt_h') + fadeIn();
  } else if (a.effect === 'rise') {
    preset = 'presetID="42" presetClass="entr" presetSubtype="0"';
    body = show() + fadeIn() + prop('ppt_x', '#ppt_x', '#ppt_x') + prop('ppt_y', '#ppt_y+.1', '#ppt_y');
  } else if (a.effect === 'wipe') {
    preset = 'presetID="22" presetClass="entr" presetSubtype="8"';
    body = show() + `<p:animEffect transition="in" filter="wipe(left)"><p:cBhvr><p:cTn id="${next()}" dur="${a.dur}"/>${tgt}</p:cBhvr></p:animEffect>`;
  } else {
    preset = 'presetID="10" presetClass="entr" presetSubtype="0"';
    body = show() + fadeIn();
  }
  return `<p:par><p:cTn id="${id}" ${preset} fill="hold" grpId="0" nodeType="${nodeType}"><p:stCondLst><p:cond delay="${a.after}"/></p:stCondLst><p:childTnLst>${body}</p:childTnLst></p:cTn></p:par>`;
}

function decode(s) {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}
