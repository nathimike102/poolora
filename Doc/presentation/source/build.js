// Poolora final-year project deck. Run: node build.js <out.pptx>
const pptxgen = require('pptxgenjs');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');
const md = require('react-icons/md');
const fa = require('react-icons/fa');
const si = require('react-icons/si');
const path = require('path');

const OUT = process.argv[2] || 'Poolora-Project-Presentation.pptx';
const MARK = '/home/ghost/Desktop/Projects/Poolora/branding/poolora-icon.png';
const LOCKUP = '/home/ghost/Desktop/Projects/Poolora/branding/poolora-lockup.png';

// Palette from the Poolora logo
const C = {
  navy: '1B1446', // wordmark
  teal: '0B7A75', // brand primary
  tealDark: '08605C',
  mint: 'E3F2F0',
  pink: 'D9468F', // accent from the car glow
  ink: '1F2330',
  muted: '5B6475',
  line: 'D5DBE3',
  white: 'FFFFFF',
  soft: 'F4F7F8',
};
const HEAD = 'Arial';
const BODY = 'Calibri';

async function icon(Comp, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: '#' + color, size: String(size) }));
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return 'image/png;base64,' + png.toString('base64');
}

(async () => {
  const pres = new pptxgen();
  pres.layout = 'LAYOUT_WIDE'; // 13.33 x 7.5
  pres.title = 'Poolora: Smart Ride-Sharing and Pooling Platform';
  pres.author = 'Nkosinathi Michael Sibanda';
  const W = 13.33;

  const I = {};
  const need = {
    car: [md.MdDirectionsCar, C.teal], carW: [md.MdDirectionsCar, C.white],
    money: [md.MdCurrencyRupee, C.teal], leaf: [md.MdEco, C.teal], shield: [md.MdShield, C.teal], shieldW: [md.MdShield, C.white],
    search: [md.MdSearch, C.teal], route: [md.MdAltRoute, C.teal], people: [md.MdGroups, C.teal], parcel: [md.MdInventory2, C.teal],
    trip: [md.MdLuggage, C.teal], admin: [md.MdAdminPanelSettings, C.teal], phone: [md.MdPhoneAndroid, C.white], web: [md.MdDashboard, C.white],
    server: [md.MdDns, C.white], brain: [md.MdPsychology, C.white], db: [md.MdStorage, C.white], bolt: [md.MdBolt, C.white],
    map: [md.MdMap, C.white], pay: [md.MdPayment, C.white], lock: [md.MdLock, C.white], sos: [md.MdSos, C.white],
    share: [md.MdShareLocation, C.white], alarm: [md.MdNotificationsActive, C.white], contacts: [md.MdContactPhone, C.white], check: [md.MdCheckCircle, C.teal],
    bug: [md.MdBugReport, C.teal], cloud: [md.MdCloud, C.teal], star: [md.MdStar, C.teal], wallet: [md.MdAccountBalanceWallet, C.teal],
    react: [fa.FaReact, C.teal], node: [fa.FaNodeJs, C.teal], python: [fa.FaPython, C.teal], docker: [fa.FaDocker, C.teal],
    mongo: [si.SiMongodb, C.teal], redis: [si.SiRedis, C.teal], kafka: [si.SiApachekafka, C.teal], k8s: [si.SiKubernetes, C.teal],
    firebase: [si.SiFirebase, C.teal], ts: [si.SiTypescript, C.teal], socket: [si.SiSocketdotio, C.teal], osm: [si.SiOpenstreetmap, C.teal],
    razor: [si.SiRazorpay, C.teal], vite: [si.SiVite, C.teal], jest: [si.SiJest, C.teal], fastapi: [si.SiFastapi, C.teal],
    idea: [md.MdLightbulb, C.teal], flag: [md.MdFlag, C.teal], school: [md.MdSchool, C.white],
  };
  for (const [k, [comp, col]] of Object.entries(need)) I[k] = await icon(comp, col);

  // ── helpers ────────────────────────────────────────────────────────────
  const title = (s, text, opts = {}) =>
    s.addText(text, { x: 0.6, y: 0.4, w: W - 1.2, h: 0.8, fontFace: HEAD, fontSize: 32, bold: true, color: opts.color || C.navy, margin: 0, isTextBox: true });
  const sub = (s, text, y = 1.2) =>
    s.addText(text, { x: 0.6, y, w: W - 1.2, h: 0.45, fontFace: BODY, fontSize: 16, color: C.muted, margin: 0, isTextBox: true });
  const footer = (s, n) => {
    s.addImage({ path: MARK, x: W - 0.95, y: 6.9, w: 0.38, h: 0.38 });
    s.addText(String(n), { x: 0.6, y: 6.95, w: 1, h: 0.3, fontFace: BODY, fontSize: 11, color: C.muted, margin: 0, isTextBox: true });
  };
  const circle = (s, key, x, y, d, fill) => {
    s.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill } });
    s.addImage({ data: I[key], x: x + d * 0.22, y: y + d * 0.22, w: d * 0.56, h: d * 0.56 });
  };
  const card = (s, x, y, w, h, fill = C.white) =>
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: C.line, width: 0.75 },
      shadow: { type: 'outer', color: '000000', opacity: 0.08, blur: 6, offset: 2, angle: 90 },
    });
  const text = (s, t, x, y, w, h, o = {}) =>
    s.addText(t, { x, y, w, h, fontFace: BODY, fontSize: 14, color: C.ink, margin: 0, valign: 'top', isTextBox: true, ...o });
  const bullets = (s, items, x, y, w, h, size = 15, color = C.ink) =>
    s.addText(items.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < items.length - 1 } })),
      { x, y, w, h, fontFace: BODY, fontSize: size, color, paraSpaceAfter: 8, valign: 'top', margin: 0, isTextBox: true });

  let n = 0;

  // 1 ── Title ────────────────────────────────────────────────────────────
  {
    const s = pres.addSlide(); n++;
    s.background = { color: C.navy };
    s.addShape(pres.shapes.OVAL, { x: 8.6, y: -1.6, w: 6.4, h: 6.4, fill: { color: C.teal, transparency: 70 }, line: { color: C.teal, transparency: 70 } });
    s.addShape(pres.shapes.OVAL, { x: 10.4, y: 3.9, w: 4.2, h: 4.2, fill: { color: C.pink, transparency: 82 }, line: { color: C.pink, transparency: 82 } });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y: 0.6, w: 4.2, h: 1.32, rectRadius: 0.15, fill: { color: C.white }, line: { color: C.white } });
    s.addImage({ path: LOCKUP, x: 0.75, y: 0.7, w: 3.9, h: 1.22 });
    text(s, 'Poolora', 0.6, 2.45, 8, 1.0, { fontFace: HEAD, fontSize: 54, bold: true, color: C.white });
    text(s, 'A smart ride-sharing, parcel and trip-pooling platform', 0.6, 3.45, 11, 0.6, { fontSize: 24, color: 'CFE9E6' });
    text(s, 'B.Tech Computer Science and Engineering · Final Year Project', 0.6, 4.25, 8.5, 0.4, { fontSize: 16, color: 'B9B4D9' });
    text(s, [
      { text: 'Presented by: ', options: { bold: true } }, { text: 'Nkosinathi Michael Sibanda', options: { breakLine: true } },
      { text: 'Project guide: ', options: { bold: true } }, { text: '________________', options: { breakLine: true } },
      { text: 'Department of Computer Science and Engineering · 2026' },
    ], 0.6, 5.2, 8, 1.3, { fontSize: 15, color: C.white, paraSpaceAfter: 4 });
    s.addNotes('Introduce yourself and the project. Poolora connects people travelling the same way so they can share a car, send a parcel with someone already going, or plan a group trip together.');
  }

  // 2 ── Problem ──────────────────────────────────────────────────────────
  {
    const s = pres.addSlide(); n++;
    title(s, 'The problem');
    sub(s, 'City commuting in India is expensive, crowded and often unsafe for people travelling alone.');
    const items = [
      ['car', 'Empty seats', 'Most private cars on commute routes carry only the driver, while the same trip is made by many people separately.'],
      ['money', 'High daily cost', 'Cabs and fuel are costly for daily commuters; drivers get nothing back for seats they are not using.'],
      ['shield', 'Safety worries', 'Sharing a car with a stranger needs verified people, live tracking and a fast way to get help.'],
      ['leaf', 'Traffic and pollution', 'More cars for the same number of people means more congestion and emissions.'],
    ];
    items.forEach(([k, h, b], i) => {
      const x = 0.6 + (i % 2) * 6.15, y = 2.0 + Math.floor(i / 2) * 2.35;
      card(s, x, y, 5.9, 2.05);
      s.addShape(pres.shapes.OVAL, { x: x + 0.3, y: y + 0.35, w: 0.9, h: 0.9, fill: { color: C.mint }, line: { color: C.mint } });
      s.addImage({ data: I[k], x: x + 0.5, y: y + 0.55, w: 0.5, h: 0.5 });
      text(s, h, x + 1.45, y + 0.3, 4.2, 0.45, { fontFace: HEAD, fontSize: 19, bold: true, color: C.navy });
      text(s, b, x + 1.45, y + 0.8, 4.2, 1.15, { fontSize: 14, color: C.muted });
    });
    footer(s, n);
    s.addNotes('Explain the motivation: seats go unused, commuting costs are high, and safety is the main reason people avoid sharing rides with strangers.');
  }

  // 3 ── Objectives ───────────────────────────────────────────────────────
  {
    const s = pres.addSlide(); n++;
    title(s, 'Objectives');
    const objs = [
      'Let drivers publish rides and riders find seats anywhere along the route, not just at the start',
      'Take payment safely (card, UPI or wallet) with fair, automatic refunds',
      'Keep riders safe: verified drivers, live tracking, SOS, trip sharing and check-ins',
      'Suggest fair prices from distance, vehicle and demand',
      'Give administrators one dashboard for verification, disputes, SOS and reports',
      'Extend pooling to parcels and to group trips with shared expenses',
    ];
    objs.forEach((o, i) => {
      const y = 1.55 + i * 0.85;
      s.addShape(pres.shapes.OVAL, { x: 0.6, y, w: 0.6, h: 0.6, fill: { color: i === 0 ? C.pink : C.teal }, line: { color: i === 0 ? C.pink : C.teal } });
      text(s, String(i + 1), 0.6, y, 0.6, 0.6, { align: 'center', valign: 'middle', bold: true, fontSize: 18, color: C.white, fontFace: HEAD });
      text(s, o, 1.45, y + 0.08, 7.2, 0.6, { fontSize: 17, valign: 'middle' });
    });
    card(s, 9.1, 1.55, 3.6, 4.85, C.mint);
    s.addImage({ path: MARK, x: 9.9, y: 1.95, w: 2.0, h: 2.0 });
    text(s, 'One app for riders and drivers, one web dashboard for admins', 9.35, 4.2, 3.1, 1.8, { fontSize: 17, bold: true, color: C.tealDark, align: 'center', fontFace: HEAD });
    footer(s, n);
  }

  // 4 ── Existing vs proposed ─────────────────────────────────────────────
  {
    const s = pres.addSlide(); n++;
    title(s, 'Existing systems vs Poolora');
    const rows = [
      ['Feature', 'Typical cab / carpool apps', 'Poolora'],
      ['Finding a ride', 'Match near the start point only', 'Match anywhere along the driving route, in the right direction'],
      ['Pricing', 'Fixed fare or free-form price', 'Suggested price with a fair range (₹2–₹15 per km)'],
      ['Refunds', 'Manual or all-or-nothing', 'Automatic tiers: 100% / 50% / 25% / 0%'],
      ['Safety', 'SOS button', 'SOS, live link, route-deviation alerts, "Are you OK?" check-ins'],
      ['Beyond rides', 'Rides only', 'Parcels with delivery codes, group trips with expense splitting'],
      ['Administration', 'Internal tools', 'Web dashboard with audit log and two-admin blocks'],
    ];
    s.addTable(rows.map((r, i) => r.map((c, j) => ({
      text: c,
      options: {
        bold: i === 0 || j === 0, color: i === 0 ? C.white : j === 2 ? C.tealDark : C.ink,
        fill: { color: i === 0 ? C.navy : i % 2 ? C.white : C.soft }, fontFace: BODY, fontSize: 14, valign: 'middle',
        margin: [4, 8, 4, 8],
      },
    }))), { x: 0.6, y: 1.5, w: W - 1.2, colW: [2.4, 4.4, 5.33], rowH: 0.62, border: { type: 'solid', color: C.line, pt: 0.75 } });
    footer(s, n);
  }

  // 5 ── Architecture ─────────────────────────────────────────────────────
  {
    const s = pres.addSlide(); n++;
    title(s, 'System architecture');
    const box = (key, label, sublabel, x, y, w, fill) => {
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: 1.05, rectRadius: 0.12, fill: { color: fill }, line: { color: fill } });
      s.addImage({ data: I[key], x: x + 0.2, y: y + 0.27, w: 0.5, h: 0.5 });
      text(s, label, x + 0.85, y + 0.14, w - 0.95, 0.42, { fontFace: HEAD, fontSize: 15, bold: true, color: C.white });
      text(s, sublabel, x + 0.85, y + 0.55, w - 0.95, 0.42, { fontSize: 12, color: 'E6F2F1' });
    };
    const arrow = (x1, y1, x2, y2) => s.addShape(pres.shapes.LINE, { x: x1, y: y1, w: x2 - x1, h: y2 - y1, line: { color: C.muted, width: 1.5, endArrowType: 'triangle' } });
    // clients
    box('phone', 'Mobile app', 'React Native · riders & drivers', 0.6, 1.5, 3.6, C.navy);
    box('web', 'Admin dashboard', 'React + Vite web app', 0.6, 3.0, 3.6, C.navy);
    // backend
    box('server', 'Backend API', 'Node.js · Express · TypeScript', 5.0, 1.5, 3.4, C.teal);
    box('bolt', 'Real-time gateway', 'Socket.IO · live GPS, chat, SOS', 5.0, 3.0, 3.4, C.teal);
    box('brain', 'ML service', 'Python · FastAPI', 5.0, 4.5, 3.4, C.teal);
    // data
    box('db', 'MongoDB', 'Users, rides, bookings, geo index', 9.2, 1.5, 3.5, C.pink);
    box('bolt', 'Redis + Kafka', 'Cache, locks, events', 9.2, 3.0, 3.5, C.pink);
    // external
    box('map', 'External services', 'Firebase · Razorpay · OpenStreetMap', 9.2, 4.5, 3.5, '6B6490');
    arrow(4.2, 2.0, 5.0, 2.0); arrow(4.2, 3.5, 5.0, 2.2); arrow(4.2, 2.3, 5.0, 3.4);
    arrow(8.4, 2.0, 9.2, 2.0); arrow(8.4, 2.2, 9.2, 3.4); arrow(8.4, 2.4, 9.2, 4.9);
    s.addShape(pres.shapes.LINE, { x: 4.75, y: 2.2, w: 0, h: 2.85, line: { color: C.muted, width: 1.5 } });
    s.addShape(pres.shapes.LINE, { x: 4.75, y: 2.2, w: 0.25, h: 0, line: { color: C.muted, width: 1.5 } });
    arrow(4.75, 5.05, 5.0, 5.05);
    text(s, 'Clients talk to the API over HTTPS (REST, JSON) and to the gateway over WebSockets. The API owns all business rules and calls the ML service over HTTP.',
      0.6, 5.85, 12.1, 0.7, { fontSize: 14, color: C.muted });
    footer(s, n);
    s.addNotes('Walk left to right: two clients, one backend with a real-time gateway, a Python ML service, and data stores. External services handle sign-in, payments and maps.');
  }

  // 6 ── Tech stack ───────────────────────────────────────────────────────
  {
    const s = pres.addSlide(); n++;
    title(s, 'Technology stack');
    const stack = [
      ['react', 'React Native + Expo', 'Mobile app (Android / iOS)'],
      ['ts', 'TypeScript', 'One language across app, API, admin'],
      ['node', 'Node.js + Express 5', 'REST API, 183 endpoints'],
      ['socket', 'Socket.IO', 'Live location, chat, SOS'],
      ['mongo', 'MongoDB + Mongoose', 'Data with 2dsphere geo indexes'],
      ['redis', 'Redis', 'Cache, rate limits, job locks'],
      ['kafka', 'Apache Kafka', 'Event streaming (in-process fallback)'],
      ['fastapi', 'Python FastAPI', 'Demand, fraud, route optimisation'],
      ['firebase', 'Firebase', 'Phone OTP / Google sign-in, push'],
      ['razor', 'Razorpay', 'Card and UPI payments, refunds'],
      ['osm', 'OpenStreetMap', 'MapLibre tiles, OSRM routes, Photon search'],
      ['docker', 'Docker + Kubernetes', 'Containers, autoscaling'],
    ];
    stack.forEach(([k, h, b], i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const x = 0.6 + col * 3.07, y = 1.45 + row * 1.72;
      card(s, x, y, 2.87, 1.52);
      s.addImage({ data: I[k], x: x + 0.22, y: y + 0.25, w: 0.55, h: 0.55 });
      text(s, h, x + 0.92, y + 0.22, 1.85, 0.62, { fontFace: HEAD, fontSize: 13.5, bold: true, color: C.navy, valign: 'middle' });
      text(s, b, x + 0.22, y + 0.92, 2.5, 0.52, { fontSize: 12, color: C.muted });
    });
    footer(s, n);
  }

  // 7 ── Modules ──────────────────────────────────────────────────────────
  {
    const s = pres.addSlide(); n++;
    title(s, 'Modules');
    const mods = [
      ['search', 'Rider', 'Search along the route, book seats, pay, track the car live, rate the trip, receipts'],
      ['car', 'Driver', 'Verification (KYC), publish rides with stops and return trips, accept requests, pick up and drop each rider, earnings'],
      ['shield', 'Safety', 'SOS, trip-share link, route-deviation alerts, check-ins, verified emergency contacts'],
      ['wallet', 'Payments', 'Razorpay card/UPI, in-app wallet and coins, tiered refunds, driver settlement'],
      ['admin', 'Administration', 'Driver applications, SOS desk, disputes, users, fraud flags, reviews, reports, settings'],
      ['parcel', 'Parcels', 'Send a parcel with a driver on the route; delivery confirmed with a code'],
      ['trip', 'Group trips', 'Plan a trip, find partners, vote on activities, split and settle expenses'],
      ['star', 'Support', 'Ratings with moderation, in-app help centre and support requests'],
    ];
    mods.forEach(([k, h, b], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 0.6 + col * 6.15, y = 1.4 + row * 1.33;
      s.addShape(pres.shapes.OVAL, { x, y: y + 0.1, w: 0.8, h: 0.8, fill: { color: C.mint }, line: { color: C.mint } });
      s.addImage({ data: I[k], x: x + 0.18, y: y + 0.28, w: 0.44, h: 0.44 });
      text(s, h, x + 1.0, y + 0.05, 4.9, 0.38, { fontFace: HEAD, fontSize: 17, bold: true, color: C.navy });
      text(s, b, x + 1.0, y + 0.45, 4.95, 0.8, { fontSize: 13, color: C.muted });
    });
    footer(s, n);
  }

  // 8 ── Ride flow ────────────────────────────────────────────────────────
  {
    const s = pres.addSlide(); n++;
    title(s, 'How a shared ride works');
    const steps = [
      ['Publish', 'Driver posts route, time, seats and price'],
      ['Search', 'Rider finds rides passing their pickup and drop'],
      ['Book & pay', 'Seat request paid by card, UPI or wallet'],
      ['Accept', 'Driver accepts; seats reserved atomically'],
      ['Ride', 'Live GPS every 5 s, per-rider pickup and drop'],
      ['Settle & rate', 'Earnings settled, receipt, ratings within 7 days'],
    ];
    const y = 2.4, stepW = 1.95, gap = 0.08;
    steps.forEach(([h, b], i) => {
      const x = 0.6 + i * (stepW + gap);
      s.addShape(pres.shapes.CHEVRON, { x, y, w: stepW, h: 0.95, fill: { color: i % 2 ? C.teal : C.tealDark }, line: { color: C.white } });
      text(s, h, x + 0.3, y, stepW - 0.55, 0.95, { fontFace: HEAD, fontSize: 13, bold: true, color: C.white, valign: 'middle', align: 'center' });
      text(s, b, x + 0.05, y + 1.2, stepW - 0.15, 1.3, { fontSize: 13, color: C.ink, align: 'center' });
    });
    card(s, 0.6, 4.75, 12.1, 1.75, C.mint);
    text(s, 'Automatic rules (background jobs, every minute)', 0.9, 4.95, 11.5, 0.4, { fontFace: HEAD, fontSize: 16, bold: true, color: C.tealDark });
    bullets(s, [
      'Unpaid requests cancelled after 15 minutes; unanswered requests expire after 6 hours with a full refund',
      'Rides nobody booked are cancelled 1 hour before departure; a Redis lock keeps one server doing the sweep',
    ], 0.9, 5.4, 11.5, 1.0, 14);
    footer(s, n);
  }

  // ── App walkthrough: real screens, clickable in Slide Show ─────────────
  // Screens come from Doc/presentation/screens/clean (see ui.py, prep_screens.py).
  // Each link is [label on the phone, target screen, what it does]; the
  // label's position on the phone becomes a click target.
  {
    const fs = require('fs');
    const SHOTS = path.join(__dirname, '..', 'screens', 'clean');
    const SCREENS = [
      ['01-welcome', 'Rider', 'Sign in', 'Google, phone OTP or email through Firebase. The backend swaps the Firebase token for its own session.',
        [['Continue with Google', '02-rider-home', 'Signs in and opens the home screen']]],
      ['02-rider-home', 'Rider', 'Home', 'Live map of where you are, a search box, favourite places and quick links. Everything starts here.',
        [['Where are you going?', '03-search', 'Search for a ride'], ['Safety', '08-safety', 'Safety and SOS'],
          ['Services', '05-services', 'All services'], ['My Rides', '09-myrides', 'Your bookings'], ['Profile', '10-profile', 'Your profile']]],
      ['03-search', 'Rider', 'Search', 'Pickup, drop, seats and time. Place suggestions come from OpenStreetMap, nearest first.',
        [['Kakinada Beach', '04-results', 'Search rides to a favourite place'], ['Go back', '02-rider-home', 'Back to home']]],
      ['04-results', 'Rider', 'Results', 'Rides whose route passes your pickup and then your drop. When none match, it suggests other times and offers a ride alert.',
        [['Tell me when a ride appears', null, 'Creates a ride alert'], ['Go back', '03-search', 'Back to search']]],
      ['14-active-ride', 'Rider', 'Live ride', 'The car moves on the map every 5 seconds over Socket.IO, with the driver, ETA, trip sharing and SOS.',
        [['Share trip', null, 'Sends a public live-location link']]],
      ['15-rate-trip', 'Rider', 'Rate the trip', 'Overall and category stars, a review that admins approve before it goes public, and a private problem report.',
        []],
      ['05-services', 'Rider', 'All services', 'Rides, scheduling, saved routes, safety, messages, parcels and group trips.',
        [['Parcels', '06-parcel', 'Send a parcel'], ['Trips', '07-trips', 'Plan a group trip'], ['Safety', '08-safety', 'Safety and SOS'],
          ['Ride', '02-rider-home', 'Home'], ['My Rides', '09-myrides', 'Your bookings'], ['Profile', '10-profile', 'Your profile']]],
      ['06-parcel', 'Rider', 'Send a parcel', 'Pickup, drop, time, type and weight, who hands it over and who receives it. Next, pick a driver on the route.',
        [['Go back', '05-services', 'Back to services']]],
      ['07-trips', 'Rider', 'Group trips', 'Plan a trip, open one with an invite code, or find travel partners ranked by compatibility.',
        [['Go back', '05-services', 'Back to services']]],
      ['08-safety', 'Rider', 'Safety and SOS', 'Hold SOS for 3 seconds to alert the safety desk and your contacts. Call 112 and share your location.',
        [['Manage', '12-contacts', 'Emergency contacts'], ['Go back', '05-services', 'Back']]],
      ['09-myrides', 'Rider', 'My rides', 'Upcoming bookings and history, with receipts, "Report a problem" and "Rate" on past trips.',
        [['Ride', '02-rider-home', 'Home'], ['Services', '05-services', 'All services'], ['Profile', '10-profile', 'Your profile']]],
      ['10-profile', 'Rider', 'Profile', 'Account, help, wallet, rides, safety, trusted contacts, messages and saved routes.',
        [['Help', '11-help', 'Help centre'], ['Trusted contacts', '12-contacts', 'Emergency contacts'], ['Wallet and payments', '13-settings', 'Settings'],
          ['Ride', '02-rider-home', 'Home'], ['My Rides', '09-myrides', 'Your bookings']]],
      ['11-help', 'Rider', 'Help centre', 'Searchable answers, an urgent line for safety and payment problems, and support requests with replies.',
        [['Go back', '10-profile', 'Back to profile']]],
      ['12-contacts', 'Rider', 'Emergency contacts', 'Up to three people who get a text with your live location during an SOS; each confirms by a link.',
        [['Go back', '10-profile', 'Back to profile']]],
      ['13-settings', 'Rider', 'Settings', 'Profile, switch to driver, wallet, emergency contacts, and the ride simulator used for testing.',
        [['Switch to Driver', '16-driver-home', 'Driver mode'], ['Go back', '10-profile', 'Back to profile']]],
      ['16-driver-home', 'Driver', 'Driver home', 'Offer a ride, see requests and upcoming rides, earnings, verification and safety.',
        [['Offer', '17-create-ride', 'Offer a ride'], ['Earnings', '18-earnings', 'Earnings'], ['Create Ride', '17-create-ride', 'Offer a ride']]],
      ['17-create-ride', 'Driver', 'Offer a ride', 'Route with up to three stops, time, seats, a suggested fair price, vehicle, rules and an optional return trip.',
        [['Go back', '16-driver-home', 'Back']]],
      ['18-earnings', 'Driver', 'Earnings', 'Earnings by day, week and month, recent trips, and monthly statements to share or email.',
        [['Go back', '16-driver-home', 'Back']]],
    ].filter(([name]) => fs.existsSync(path.join(SHOTS, name + '.png')));

    if (SCREENS.length) {
      const hotspot = 'image/png;base64,' + (await sharp({ create: { width: 4, height: 4, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer()).toString('base64');
      const meta = Object.fromEntries(SCREENS.map(([name]) => [name, JSON.parse(fs.readFileSync(path.join(SHOTS, name + '.json'), 'utf8'))]));
      const mapSlide = n + 1;
      const slideOf = Object.fromEntries(SCREENS.map(([name], i) => [name, mapSlide + 1 + i]));
      const link = (target) => (slideOf[target] ? { slide: slideOf[target], tooltip: 'Open this screen' } : undefined);
      const find = (name, label) => meta[name].nodes.find((nd) => nd.label === label) || meta[name].nodes.find((nd) => nd.label.startsWith(label));

      // Screen map
      {
        const s = pres.addSlide(); n++;
        title(s, 'App walkthrough');
        sub(s, 'Real screens from the Android app. In Slide Show, click a screen, then tap the outlined buttons to move around the app.');
        const per = Math.min(9, SCREENS.length);
        const tw = 1.18, gap = (W - 1.2 - per * tw) / Math.max(1, per - 1);
        SCREENS.forEach(([name, group, label], i) => {
          const row = Math.floor(i / per), col = i % per;
          const m = meta[name];
          const th = Math.min(2.2, tw * m.height / m.width);
          const x = 0.6 + col * (tw + gap), y = 1.95 + row * 2.62;
          s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: x - 0.05, y: y - 0.05, w: tw + 0.1, h: th + 0.1, rectRadius: 0.08, fill: { color: C.navy }, line: { color: C.navy } });
          s.addImage({ path: path.join(SHOTS, name + '.png'), x, y, w: tw, h: th, hyperlink: link(name) });
          text(s, [{ text: label, options: { hyperlink: link(name), bold: true, color: C.navy } }], x - 0.1, y + th + 0.08, tw + 0.2, 0.3, { fontSize: 10.5, align: 'center' });
          text(s, group, x - 0.1, y + th + 0.34, tw + 0.2, 0.22, { fontSize: 9, align: 'center', color: group === 'Driver' ? C.pink : C.teal });
        });
        footer(s, n);
        s.addNotes('Start the demo from here in Slide Show mode. Click any screen to open it; on each screen, click the outlined buttons to follow the app the way a user would. Screen map (top right of each slide) brings you back.');
      }

      // One slide per screen
      SCREENS.forEach(([name, group, label, desc, links], i) => {
        const s = pres.addSlide(); n++;
        const m = meta[name];
        const ph = 6.5, pw = ph * m.width / m.height, px = 0.95, py = 0.5, scale = pw / m.width;
        // phone
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: px - 0.13, y: py - 0.13, w: pw + 0.26, h: ph + 0.26, rectRadius: 0.32, fill: { color: C.navy }, line: { color: C.navy },
          shadow: { type: 'outer', color: '000000', opacity: 0.25, blur: 10, offset: 4, angle: 90 } });
        s.addImage({ path: path.join(SHOTS, name + '.png'), x: px, y: py, w: pw, h: ph });
        // click targets
        const live = [];
        links.forEach(([lbl, target, what]) => {
          const nd = find(name, lbl);
          if (!nd) { console.warn(`  ${name}: no "${lbl}" on screen`); return; }
          live.push([lbl, target, what]);
          if (!slideOf[target]) return;
          const [x1, y1, x2, y2] = nd.bounds;
          const pad = 4;
          const hx = px + (x1 - pad) * scale, hy = py + (y1 - pad) * scale, hw = (x2 - x1 + 2 * pad) * scale, hh = (y2 - y1 + 2 * pad) * scale;
          s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: hx, y: hy, w: hw, h: hh, rectRadius: Math.min(0.08, hh / 2), fill: { color: C.pink, transparency: 88 }, line: { color: C.pink, width: 1.25, dashType: 'dash' } });
          s.addImage({ data: hotspot, x: hx, y: hy, w: hw, h: hh, hyperlink: link(target) });
        });
        // right panel
        const rx = px + pw + 0.9, rw = W - rx - 0.6;
        s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: rx, y: 0.55, w: 1.1, h: 0.36, rectRadius: 0.18, fill: { color: group === 'Driver' ? C.pink : C.teal }, line: { color: group === 'Driver' ? C.pink : C.teal } });
        text(s, group.toUpperCase(), rx, 0.55, 1.1, 0.36, { fontSize: 11, bold: true, color: C.white, align: 'center', valign: 'middle' });
        text(s, [{ text: 'Screen map', options: { hyperlink: { slide: mapSlide, tooltip: 'All screens' }, color: C.teal, bold: true } }], W - 2.6, 0.58, 2.0, 0.3, { fontSize: 12, align: 'right' });
        text(s, label, rx, 1.1, rw, 0.8, { fontFace: HEAD, fontSize: 32, bold: true, color: C.navy });
        text(s, desc, rx, 1.95, rw, 1.2, { fontSize: 16, color: C.muted });
        const clickable = live.filter(([, t]) => slideOf[t]);
        if (clickable.length) {
          text(s, 'Try it: click on the phone', rx, 3.3, rw, 0.4, { fontFace: HEAD, fontSize: 14, bold: true, color: C.tealDark });
          text(s, clickable.map(([lbl, t, what], k) => ({
            text: `${lbl}  →  ${what}`, options: { hyperlink: link(t), bullet: true, breakLine: k < clickable.length - 1, color: C.ink },
          })), rx, 3.75, rw, 2.4, { fontSize: 14, paraSpaceAfter: 6 });
        }
        const other = live.filter(([, t]) => !slideOf[t]);
        if (other.length) text(s, other.map(([lbl, , what]) => `${lbl}: ${what}`).join('   ·   '), rx, 6.2, rw, 0.4, { fontSize: 12, italic: true, color: C.muted });
        // previous / next
        const prev = SCREENS[i - 1], next = SCREENS[i + 1];
        const nav = [];
        if (prev) nav.push({ text: `‹ ${prev[2]}`, options: { hyperlink: link(prev[0]), color: C.teal } });
        if (prev && next) nav.push({ text: '     ' });
        if (next) nav.push({ text: `${next[2]} ›`, options: { hyperlink: link(next[0]), color: C.teal } });
        if (nav.length) text(s, nav, rx, 6.75, rw, 0.35, { fontSize: 12, bold: true });
        s.addImage({ path: MARK, x: W - 0.95, y: 6.9, w: 0.38, h: 0.38 });
      });
    }
  }

  // 9 ── Route matching ───────────────────────────────────────────────────
  {
    const s = pres.addSlide(); n++;
    title(s, 'Algorithm: matching riders along a route');
    bullets(s, [
      'When a ride is published, its driving route (from OSRM) is stored as a GeoJSON LineString with a 2dsphere index',
      'Search runs $geoNear on the route near the rider\'s pickup, and requires the route to pass within the radius of the drop',
      'Each candidate is projected onto the route: the pickup must come before the drop along the line (right direction)',
      'Candidates are ranked by a weighted match score: distance from the route, time difference, price and driver rating',
      'The fare is charged for the rider\'s own part of the route',
    ], 0.6, 1.5, 6.6, 4.9, 15);
    // diagram
    card(s, 7.6, 1.5, 5.1, 4.9, C.soft);
    const pts = [[8.1, 5.6], [9.2, 4.6], [10.4, 4.3], [11.2, 3.2], [12.2, 2.1]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i], [x2, y2] = pts[i + 1];
      s.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1), flipV: y2 < y1, line: { color: C.teal, width: 4 } });
    }
    const dot = (x, y, col, label, dx = 0.25) => {
      s.addShape(pres.shapes.OVAL, { x: x - 0.14, y: y - 0.14, w: 0.28, h: 0.28, fill: { color: col }, line: { color: C.white, width: 1.5 } });
      text(s, label, x + dx, y - 0.2, 1.9, 0.4, { fontSize: 12, bold: true, color: col });
    };
    dot(8.1, 5.6, C.navy, 'Driver start');
    dot(12.2, 2.1, C.navy, 'Driver end', -1.35);
    s.addShape(pres.shapes.OVAL, { x: 9.15, y: 3.55, w: 1.2, h: 1.2, fill: { color: C.pink, transparency: 85 }, line: { color: C.pink, dashType: 'dash' } });
    dot(9.75, 4.15, C.pink, 'Rider pickup', -1.85);
    s.addShape(pres.shapes.OVAL, { x: 10.6, y: 2.35, w: 1.2, h: 1.2, fill: { color: C.pink, transparency: 85 }, line: { color: C.pink, dashType: 'dash' } });
    dot(11.2, 2.95, C.pink, 'Rider drop', -1.7);
    text(s, 'Dashed circles: search radius around the rider\'s points', 7.85, 5.85, 4.7, 0.4, { fontSize: 11, color: C.muted, italic: true });
    footer(s, n);
  }

  // 10 ── Pricing & ML ────────────────────────────────────────────────────
  {
    const s = pres.addSlide(); n++;
    title(s, 'Pricing and the ML service');
    card(s, 0.6, 1.5, 6.0, 4.9);
    text(s, 'Suggested seat price', 0.9, 1.7, 5.4, 0.45, { fontFace: HEAD, fontSize: 18, bold: true, color: C.navy });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.9, y: 2.3, w: 5.4, h: 0.8, rectRadius: 0.1, fill: { color: C.mint }, line: { color: C.mint } });
    text(s, 'price = distance × rate(vehicle) × peak × surge', 0.9, 2.3, 5.4, 0.8, { fontFace: 'Courier New', fontSize: 12.5, bold: true, color: C.tealDark, align: 'center', valign: 'middle' });
    bullets(s, [
      'Rate per km: ₹2.5 bike up to ₹5 SUV',
      'Peak commute hours (7–10 am, 5–8 pm): +10%',
      'Surge from demand forecast: +20% to +50%',
      'Driver may choose within ±30%, never outside ₹2–₹15 per km',
    ], 0.9, 3.35, 5.4, 2.9, 14);
    const ml = [
      ['Demand forecast', 'Weighted model of hour, weekday, history, weather and holidays; gives demand level and surge'],
      ['Fraud scoring', 'Rules on cancellations, payment deviation, booking velocity and account age; high risk flagged, critical suspended for admin review'],
      ['Pickup order', 'Nearest-neighbour heuristic for the travelling-salesman problem, O(n²), to order riders\' pickups'],
    ];
    ml.forEach(([h, b], i) => {
      const y = 1.5 + i * 1.68;
      card(s, 6.9, y, 5.8, 1.5);
      s.addShape(pres.shapes.OVAL, { x: 7.1, y: y + 0.3, w: 0.8, h: 0.8, fill: { color: C.teal }, line: { color: C.teal } });
      s.addImage({ data: I.brain, x: 7.28, y: y + 0.48, w: 0.44, h: 0.44 });
      text(s, h, 8.1, y + 0.15, 4.4, 0.4, { fontFace: HEAD, fontSize: 15, bold: true, color: C.navy });
      text(s, b, 8.1, y + 0.55, 4.45, 0.9, { fontSize: 12.5, color: C.muted });
    });
    footer(s, n);
    s.addNotes('Be clear that the ML service uses weighted scoring and heuristics, not trained neural networks. That keeps it explainable and fast; training on real ride data is future work.');
  }

  // 11 ── Safety ──────────────────────────────────────────────────────────
  {
    const s = pres.addSlide(); n++;
    s.background = { color: C.navy };
    title(s, 'Safety by design', { color: C.white });
    const feats = [
      ['sos', 'SOS', 'Alerts the admin SOS desk instantly and texts emergency contacts a live-location link'],
      ['share', 'Trip sharing', 'A public link with the car\'s position and ETA; expires an hour after the trip'],
      ['route', 'Route deviation', 'Alert when the car is more than 500 m off the planned route'],
      ['alarm', 'Check-ins', '"Are you OK?" every 30 minutes; two missed prompts raise an SOS'],
      ['contacts', 'Emergency contacts', 'Up to 3, confirmed by an SMS link; the user picks who is alerted'],
      ['lock', 'Verified people', 'Driver licence, RC and insurance checked; blocks need two admins'],
    ];
    feats.forEach(([k, h, b], i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 0.6 + col * 4.1, y = 1.6 + row * 2.45;
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: 3.85, h: 2.2, rectRadius: 0.12, fill: { color: '2A2360' }, line: { color: '3A3278' } });
      s.addShape(pres.shapes.OVAL, { x: x + 0.3, y: y + 0.3, w: 0.8, h: 0.8, fill: { color: k === 'sos' ? C.pink : C.teal }, line: { color: k === 'sos' ? C.pink : C.teal } });
      s.addImage({ data: I[k === 'route' ? 'map' : k], x: x + 0.48, y: y + 0.48, w: 0.44, h: 0.44 });
      text(s, h, x + 1.3, y + 0.45, 2.4, 0.5, { fontFace: HEAD, fontSize: 17, bold: true, color: C.white });
      text(s, b, x + 0.3, y + 1.25, 3.3, 0.9, { fontSize: 13, color: 'D6D3EE' });
    });
    s.addImage({ path: MARK, x: W - 0.95, y: 6.9, w: 0.38, h: 0.38 });
    text(s, String(n), 0.6, 6.95, 1, 0.3, { fontSize: 11, color: 'B9B4D9' });
  }

  // 12 ── Payments ────────────────────────────────────────────────────────
  {
    const s = pres.addSlide(); n++;
    title(s, 'Payments and refunds');
    bullets(s, [
      'Razorpay order per booking; the signed webhook (HMAC) records the payment',
      'The driver\'s Accept confirms the seat, so money is never taken for a seat that does not exist',
      'Wallet payments are atomic: the balance only goes down if enough money is there',
      'Driver earnings = fare − 15% platform fee, settled when each rider is dropped',
      'Every refund is idempotent, so a retried request never refunds twice',
    ], 0.6, 1.5, 6.4, 4.9, 15);
    s.addChart(pres.charts.BAR, [{ name: 'Refund %', labels: ['24 h or more', '12–24 h', '6–12 h', 'Under 6 h'], values: [100, 50, 25, 0] }], {
      x: 7.3, y: 1.5, w: 5.4, h: 4.6, barDir: 'col', chartColors: [C.teal],
      showTitle: true, title: 'Rider cancellation refund, by time before departure', titleFontSize: 13, titleColor: C.navy, titleFontFace: BODY,
      showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0"%"', dataLabelColor: C.ink, dataLabelFontSize: 12,
      catAxisLabelColor: C.muted, catAxisLabelFontSize: 11, valAxisHidden: true, valAxisMaxVal: 115, valGridLine: { style: 'none' }, catGridLine: { style: 'none' },
      showLegend: false,
    });
    text(s, 'Tiers are admin-editable; a driver cancelling always refunds in full.', 7.3, 6.15, 5.4, 0.4, { fontSize: 11, italic: true, color: C.muted });
    footer(s, n);
  }

  // 13 ── Admin dashboard ─────────────────────────────────────────────────
  {
    const s = pres.addSlide(); n++;
    title(s, 'Admin dashboard (web)');
    sub(s, 'React + Vite single-page app; every change needs a written reason and is saved in an audit log.');
    const pages = [
      ['Dashboard', 'Live figures and anomaly alerts, refreshed every 30 s'],
      ['SOS desk', 'Live map, one-tap calls, timeline, police record'],
      ['Driver applications', 'Document checklist, approve, reject, ask again'],
      ['Disputes', 'Case file with chat and payments; refunds and warnings'],
      ['Users', 'Suspend 7/15/30 days; permanent block needs a second admin'],
      ['Fraud flags', 'Clear false positives or confirm, within 2 hours'],
      ['Reviews & support', 'Publish reviews, answer support requests'],
      ['Reports & settings', 'CSV reports; commission, refunds, limits; 24 h revert'],
    ];
    pages.forEach(([h, b], i) => {
      const col = i % 4, row = Math.floor(i / 4);
      const x = 0.6 + col * 3.07, y = 1.95 + row * 2.2;
      card(s, x, y, 2.87, 2.0);
      s.addImage({ data: I.check, x: x + 0.22, y: y + 0.25, w: 0.4, h: 0.4 });
      text(s, h, x + 0.75, y + 0.22, 2.0, 0.5, { fontFace: HEAD, fontSize: 14, bold: true, color: C.navy, valign: 'middle' });
      text(s, b, x + 0.22, y + 0.85, 2.5, 1.05, { fontSize: 12.5, color: C.muted });
    });
    footer(s, n);
  }

  // 14 ── Parcels & trips ─────────────────────────────────────────────────
  {
    const s = pres.addSlide(); n++;
    title(s, 'Beyond rides: parcels and group trips');
    const col = (x, key, h, items) => {
      card(s, x, 1.5, 5.9, 4.95);
      s.addShape(pres.shapes.OVAL, { x: x + 0.3, y: 1.75, w: 0.9, h: 0.9, fill: { color: C.mint }, line: { color: C.mint } });
      s.addImage({ data: I[key], x: x + 0.5, y: 1.95, w: 0.5, h: 0.5 });
      text(s, h, x + 1.4, 1.85, 4.3, 0.7, { fontFace: HEAD, fontSize: 20, bold: true, color: C.navy, valign: 'middle' });
      bullets(s, items, x + 0.35, 2.95, 5.3, 3.4, 14);
    };
    col(0.6, 'parcel', 'Parcel pooling', [
      'Choose a driver already travelling your route',
      'Price: ₹50 + ₹5/km + weight surcharge, shown before paying',
      'Pay by wallet or card; full refund until pickup',
      'The recipient gets a 6-digit code; the driver needs it to hand over',
      'Driver earns 70% of the parcel fee',
    ]);
    col(6.8, 'trip', 'Group trip pooling', [
      'Plan a trip: dates, stops, budget, interests, 2–8 people',
      'Find partners ranked by compatibility (interests 50%, dates 30%, budget 20%)',
      'Vote on activities; a majority "yes" adds the cost to expenses',
      'Split expenses to the paisa; fewest payments to settle up',
      'Pay back in one tap with UPI links',
    ]);
    footer(s, n);
  }

  // 15 ── Database ────────────────────────────────────────────────────────
  {
    const s = pres.addSlide(); n++;
    title(s, 'Database design');
    sub(s, 'MongoDB document store, 23 collections. Places are GeoJSON points with 2dsphere indexes.');
    const groups = [
      ['Core', ['User (profile, KYC, vehicles, contacts)', 'Ride (route line, stops)', 'Booking (pickup, drop, fare)', 'Rating, Message', 'Notification, OtpChallenge']],
      ['Money', ['Payment', 'Wallet', 'WalletTransaction', 'CoinLedger']],
      ['Safety & admin', ['EmergencyRecord, EmergencyToken', 'TripShare, Dispute', 'AdminAuditLog, AdminNote', 'SupportTicket', 'PlatformSettings']],
      ['Phase 4 & search', ['ParcelPooling', 'Trip (members, votes)', 'TripExpense', 'RideAlert']],
    ];
    groups.forEach(([h, items], i) => {
      const x = 0.6 + i * 3.07;
      card(s, x, 2.0, 2.87, 4.4, i === 0 ? C.mint : C.white);
      text(s, h, x + 0.25, 2.2, 2.4, 0.45, { fontFace: HEAD, fontSize: 16, bold: true, color: C.tealDark });
      bullets(s, items, x + 0.25, 2.8, 2.45, 3.5, 13);
    });
    footer(s, n);
  }

  // 16 ── Testing & results ───────────────────────────────────────────────
  {
    const s = pres.addSlide(); n++;
    title(s, 'Testing and results');
    const stats = [['297', 'backend tests passing'], ['100', 'mobile app tests'], ['183', 'API endpoints'], ['~51k', 'lines of TypeScript + Python']];
    stats.forEach(([v, l], i) => {
      const x = 0.6 + i * 3.07;
      text(s, v, x, 1.45, 2.87, 1.0, { fontFace: HEAD, fontSize: 48, bold: true, color: i === 0 ? C.pink : C.teal });
      text(s, l, x, 2.45, 2.87, 0.4, { fontSize: 14, color: C.muted });
    });
    s.addChart(pres.charts.BAR, [{ name: 'Lines of code', labels: ['Mobile app', 'Backend API', 'Admin web', 'ML service'], values: [26436, 21475, 3292, 622] }], {
      x: 0.6, y: 3.15, w: 6.3, h: 3.5, barDir: 'bar', chartColors: [C.teal],
      showTitle: true, title: 'Lines of code by component', titleFontSize: 13, titleColor: C.navy,
      showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '#,##0', dataLabelFontSize: 11, dataLabelColor: C.ink,
      catAxisLabelColor: C.muted, valAxisHidden: true, valAxisMaxVal: 32000, valGridLine: { style: 'none' }, showLegend: false,
    });
    card(s, 7.3, 3.15, 5.4, 3.5, C.soft);
    text(s, 'How it was tested', 7.55, 3.3, 5, 0.4, { fontFace: HEAD, fontSize: 16, bold: true, color: C.navy });
    bullets(s, [
      'Jest unit and integration tests on a real in-memory MongoDB',
      'Money flows tested end to end: payments, refunds, settlement',
      'Vitest for the admin web; TypeScript and ESLint in CI',
      'Ride simulator: a bot driver or rider for a full trip on one phone',
      'Manual testing on an Android phone (Samsung Galaxy A04s)',
    ], 7.55, 3.8, 5.0, 2.8, 13);
    footer(s, n);
  }

  // 17 ── Deployment ──────────────────────────────────────────────────────
  {
    const s = pres.addSlide(); n++;
    title(s, 'Deployment');
    const steps = [
      ['docker', 'Docker', 'Each service ships as a container image; Docker Compose runs the whole stack locally'],
      ['k8s', 'Kubernetes', 'Backend and ML deployments with a horizontal pod autoscaler; MongoDB, Kafka (3 brokers, KRaft) as StatefulSets'],
      ['cloud', 'Operations', 'Ingress with TLS, scheduled database backups, health checks and Prometheus metrics'],
    ];
    steps.forEach(([k, h, b], i) => {
      const y = 1.55 + i * 1.65;
      card(s, 0.6, y, 7.4, 1.45);
      s.addImage({ data: I[k], x: 0.9, y: y + 0.38, w: 0.7, h: 0.7 });
      text(s, h, 1.9, y + 0.2, 5.8, 0.4, { fontFace: HEAD, fontSize: 17, bold: true, color: C.navy });
      text(s, b, 1.9, y + 0.62, 5.9, 0.8, { fontSize: 13.5, color: C.muted });
    });
    card(s, 8.4, 1.55, 4.3, 4.75, C.mint);
    text(s, 'Designed to scale', 8.7, 1.8, 3.8, 0.45, { fontFace: HEAD, fontSize: 18, bold: true, color: C.tealDark });
    bullets(s, [
      'Stateless API servers behind a load balancer',
      'Socket.IO Redis adapter shares live events across servers',
      'Redis locks so only one server runs each background job',
      'Kafka events fall back to in-process handling if Kafka is down',
    ], 8.7, 2.4, 3.8, 3.8, 14);
    footer(s, n);
  }

  // 18 ── Challenges ──────────────────────────────────────────────────────
  {
    const s = pres.addSlide(); n++;
    title(s, 'Challenges and what I learned');
    const ch = [
      ['Overbooking', 'Card payments confirmed seats without the driver. Fixed by reserving seats atomically only on Accept.'],
      ['Search missed riders', 'Rides were matched only at their start. Fixed by indexing the whole route as a geo line.'],
      ['Money correctness', 'Partial refunds, retries and splits. Solved with idempotency keys and working in whole paise.'],
      ['Maps cost', 'Google Maps needed a paid key. Moved to a free OpenStreetMap stack with Google as an option.'],
      ['Real-time at scale', 'Live GPS across many servers. Solved with the Socket.IO Redis adapter.'],
      ['Automated decisions', 'The fraud check could block users alone. Now it suspends and an admin decides.'],
    ];
    ch.forEach(([h, b], i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const x = 0.6 + col * 6.15, y = 1.45 + row * 1.7;
      card(s, x, y, 5.9, 1.5);
      s.addImage({ data: I.bug, x: x + 0.25, y: y + 0.3, w: 0.5, h: 0.5 });
      text(s, h, x + 0.95, y + 0.2, 4.8, 0.4, { fontFace: HEAD, fontSize: 16, bold: true, color: C.navy });
      text(s, b, x + 0.95, y + 0.6, 4.8, 0.85, { fontSize: 13, color: C.muted });
    });
    footer(s, n);
  }

  // 19 ── Future scope ────────────────────────────────────────────────────
  {
    const s = pres.addSlide(); n++;
    title(s, 'Future scope');
    const fut = [
      ['Trained ML models', 'Learn demand, matching and fraud from real ride data'],
      ['Masked calls', 'Call riders and drivers through a proxy number'],
      ['Automatic document checks', 'OCR and government APIs for licence and RC'],
      ['Parcel photo proof and insurance', 'Photos at pickup and delivery; claims'],
      ['Scheduled reports', 'Emailed PDF and Excel reports for admins'],
      ['Electric vehicles', 'EV-only rides and carbon savings per trip'],
    ];
    fut.forEach(([h, b], i) => {
      const y = 1.5 + i * 0.83;
      s.addImage({ data: I.idea, x: 0.6, y: y + 0.08, w: 0.45, h: 0.45 });
      text(s, h, 1.3, y, 4.2, 0.6, { fontFace: HEAD, fontSize: 16, bold: true, color: C.navy, valign: 'middle' });
      text(s, b, 5.6, y, 7.1, 0.6, { fontSize: 15, color: C.muted, valign: 'middle' });
    });
    footer(s, n);
  }

  // 20 ── Conclusion ──────────────────────────────────────────────────────
  {
    const s = pres.addSlide(); n++;
    s.background = { color: C.navy };
    s.addShape(pres.shapes.OVAL, { x: 9.0, y: -1.2, w: 5.8, h: 5.8, fill: { color: C.teal, transparency: 70 }, line: { color: C.teal, transparency: 70 } });
    text(s, 'Conclusion', 0.6, 0.6, 8, 0.8, { fontFace: HEAD, fontSize: 36, bold: true, color: C.white });
    bullets(s, [
      'Poolora is a complete, working platform: mobile app, API, real-time gateway, ML service and admin dashboard',
      'Route-based matching finds riders anywhere along a trip',
      'Safety, fair pricing and correct money handling are built in, not added on',
      'Tested with over 400 automated tests and manual testing on a real phone',
    ], 0.6, 1.7, 8.3, 3.2, 17, C.white);
    s.addText('Thank you', { x: 0.6, y: 5.1, w: 6, h: 0.9, fontFace: HEAD, fontSize: 44, bold: true, color: C.white, margin: 0, isTextBox: true });
    s.addText('Questions?', { x: 0.6, y: 5.95, w: 6, h: 0.6, fontFace: BODY, fontSize: 22, color: 'CFE9E6', margin: 0, isTextBox: true });
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 8.9, y: 4.6, w: 3.8, h: 1.2, rectRadius: 0.15, fill: { color: C.white }, line: { color: C.white } });
    s.addImage({ path: LOCKUP, x: 9.05, y: 4.68, w: 3.5, h: 1.1 });
  }

  await pres.writeFile({ fileName: OUT });
  console.log('wrote', OUT);
})();
