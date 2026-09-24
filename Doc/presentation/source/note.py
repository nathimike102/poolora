"""Poolora: a short note on how the system works and the tools it uses."""
import sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table,
                                TableStyle, Image, KeepTogether, ListFlowable, ListItem)

OUT = sys.argv[1]
F = '/usr/share/fonts/truetype/dejavu/'
pdfmetrics.registerFont(TTFont('DV', F + 'DejaVuSans.ttf'))
pdfmetrics.registerFont(TTFont('DVB', F + 'DejaVuSans-Bold.ttf'))
pdfmetrics.registerFont(TTFont('DVM', F + 'DejaVuSansMono.ttf'))
pdfmetrics.registerFontFamily('DV', normal='DV', bold='DVB', italic='DV', boldItalic='DVB')

NAVY = colors.HexColor('#1B1446')
TEAL = colors.HexColor('#0B7A75')
MINT = colors.HexColor('#E3F2F0')
MUTED = colors.HexColor('#5B6475')
LINE = colors.HexColor('#D5DBE3')

body = ParagraphStyle('body', fontName='DV', fontSize=9.6, leading=14, textColor=colors.HexColor('#1F2330'), spaceAfter=6)
small = ParagraphStyle('small', parent=body, fontSize=8.4, leading=11.5, spaceAfter=0)
smallb = ParagraphStyle('smallb', parent=small, fontName='DVB', textColor=NAVY)
h1 = ParagraphStyle('h1', fontName='DVB', fontSize=20, leading=25, textColor=NAVY, spaceAfter=4)
h2 = ParagraphStyle('h2', fontName='DVB', fontSize=13.5, leading=18, textColor=TEAL, spaceBefore=12, spaceAfter=6)
h3 = ParagraphStyle('h3', fontName='DVB', fontSize=10.5, leading=14, textColor=NAVY, spaceBefore=6, spaceAfter=3)
lead = ParagraphStyle('lead', parent=body, fontSize=10.5, leading=15, textColor=MUTED)
code = ParagraphStyle('code', parent=body, fontName='DVM', fontSize=8.6, leading=12, backColor=MINT, borderPadding=6, spaceBefore=4, spaceAfter=10)

P = lambda t, s=body: Paragraph(t, s)


def bullets(items, style=body):
    return ListFlowable([ListItem(P(i, style), leftIndent=12, value='circle') for i in items],
                        bulletType='bullet', start='•', leftIndent=12, bulletFontSize=8, bulletColor=TEAL)


def table(rows, widths, head=True):
    data = [[P(c, smallb if (head and r == 0) or j == 0 else small) for j, c in enumerate(row)] for r, row in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1 if head else 0)
    st = [('GRID', (0, 0), (-1, -1), 0.5, LINE), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
          ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5),
          ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]
    if head:
        st.append(('BACKGROUND', (0, 0), (-1, 0), MINT))
    t.setStyle(TableStyle(st))
    return t


def on_page(c, doc):
    c.saveState()
    c.setFont('DV', 8)
    c.setFillColor(MUTED)
    c.drawString(2 * cm, 1.2 * cm, 'Poolora · How the system works')
    c.drawRightString(A4[0] - 2 * cm, 1.2 * cm, str(doc.page))
    c.restoreState()


doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=1.8 * cm, bottomMargin=2 * cm,
                      title='Poolora: how the system works', author='Nkosinathi Michael Sibanda')
frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id='f')
doc.addPageTemplates([PageTemplate(id='p', frames=[frame], onPage=on_page)])
W = doc.width

s = []
s.append(Image('/home/ghost/Desktop/Projects/Poolora/branding/poolora-lockup.png', width=5.2 * cm, height=1.63 * cm, hAlign='LEFT'))
s.append(Spacer(1, 8))
s.append(P('How Poolora works', h1))
s.append(P('A short note on the system, the tools it uses and how each of them works. '
           'B.Tech CSE final year project · Nkosinathi Michael Sibanda · 2026', lead))

# 1
s.append(P('1. What Poolora is', h2))
s.append(P('Poolora connects people who are travelling the same way. A driver publishes a trip with free seats; riders anywhere '
           'along that route can book a seat and share the cost. The same idea is extended to <b>parcels</b> (send a package with a '
           'driver already going there) and <b>group trips</b> (plan a holiday together and split the expenses). '
           'There are three users: <b>riders</b> and <b>drivers</b> use the mobile app, and <b>administrators</b> use a web dashboard.'))

# 2
s.append(P('2. The parts of the system', h2))
s.append(table([
    ['Part', 'What it does', 'Built with'],
    ['Mobile app', 'Screens for riders and drivers: search, booking, payment, live map, chat, SOS, parcels, trips.', 'React Native, Expo, TypeScript'],
    ['Backend API', 'All business rules: matching, prices, bookings, refunds, safety. Exposes 183 REST endpoints.', 'Node.js, Express 5, TypeScript'],
    ['Real-time gateway', 'Pushes live events: the driver\'s GPS every 5 s, chat messages, SOS alerts to admins.', 'Socket.IO with a Redis adapter'],
    ['ML service', 'Demand forecast and surge, fraud scoring, and the order to pick up riders.', 'Python, FastAPI, NumPy'],
    ['Admin dashboard', 'Driver verification, SOS desk, disputes, users, fraud flags, reviews, reports, settings.', 'React, Vite'],
    ['Databases', 'MongoDB stores the data; Redis caches, rate-limits and locks; Kafka carries events.', 'MongoDB, Redis, Kafka'],
    ['Outside services', 'Sign-in and push notifications; card and UPI payments; maps, routes and place search.', 'Firebase, Razorpay, OpenStreetMap'],
], [3.1 * cm, 9.2 * cm, 4.7 * cm]))
s.append(Spacer(1, 6))
s.append(P('The app and the dashboard never talk to the database directly. Every action is an HTTPS request to the API, which checks '
           'who the user is, applies the rules, saves to MongoDB and, when needed, sends a live event through Socket.IO or a push '
           'notification through Firebase.'))

# 3
s.append(P('3. A ride from start to finish', h2))
steps = [
    '<b>Sign in.</b> The user signs in with a phone OTP or Google through Firebase. The app sends the Firebase token to the API, '
    'which checks it and returns its own short-lived JWT access token (plus a refresh token).',
    '<b>Driver publishes a ride.</b> The API asks OSRM for the driving route, stores it as a GeoJSON line, suggests a fair seat price '
    'and checks the rules (at least 2 hours ahead, at most 300 km, price within the allowed range).',
    '<b>Rider searches.</b> MongoDB finds rides whose route passes near the rider\'s pickup and then their drop, in that order. '
    'Results are ranked by a match score.',
    '<b>Rider books and pays.</b> The API creates a pending booking and a Razorpay order (or takes the money from the wallet). '
    'Razorpay tells the API about the payment through a signed webhook.',
    '<b>Driver accepts.</b> The seat is reserved in a single atomic database update, so two riders can never get the last seat.',
    '<b>The ride.</b> The driver\'s phone sends its GPS position every 5 seconds over Socket.IO; the rider sees the car move. '
    'The driver marks each rider arrived, picked up and dropped off. Safety checks run in the background.',
    '<b>Settle and rate.</b> When a rider is dropped, the fare is split into the driver\'s earnings and the 15% platform fee. '
    'The rider gets a receipt and can rate the trip within 7 days.',
]
s.append(ListFlowable([ListItem(P(t), leftIndent=16) for t in steps], bulletType='1', leftIndent=16, bulletFontName='DVB', bulletColor=TEAL))
s.append(P('<b>Background jobs.</b> Every minute a job cancels requests left unpaid for 15 minutes, expires requests the driver has '
           'not answered in 6 hours, cancels rides nobody booked 1 hour before departure, and sends rating reminders. A Redis lock '
           'makes sure only one server runs the job when several are running.'))

# 4
s.append(P('4. Key ideas and algorithms', h2))
s.append(P('Matching riders along a route', h3))
s.append(P('Each ride stores its route as a GeoJSON <i>LineString</i> with a MongoDB <i>2dsphere</i> index. A search runs '
           '<i>$geoNear</i> to find routes close to the rider\'s pickup, keeps those whose line also passes near the drop, then '
           'projects both points onto the line. If the pickup comes after the drop, the ride is going the wrong way and is dropped. '
           'This finds a rider who joins half-way, which a "near the start point" search would miss.'))
s.append(P('Suggested price', h3))
s.append(P('price = distance (km) × rate for the vehicle × 1.1 at commute hours × surge', code))
s.append(P('Rates run from ₹2.5 per km for a bike to ₹5 for an SUV. Surge (from +20% to +50%) comes from the demand forecast. The driver can '
           'move the price 30% either way, but never below ₹2 or above ₹15 per km per seat.'))
s.append(P('Refunds and money', h3))
s.append(P('A rider cancelling gets 100% back 24 hours or more before departure, 50% from 12 hours, 25% from 6 hours and nothing after '
           'that; if the driver cancels, the rider always gets everything back. Money is handled carefully: wallet payments only '
           'succeed if the balance is enough (checked in the same database update), every refund has an idempotency key so a retry '
           'never pays twice, and group-trip shares are worked out in whole paise so they always add up.'))
s.append(P('Settling group expenses', h3))
s.append(P('Each member\'s balance is what they paid minus their share. The person who owes most pays the person owed most, and so '
           'on; this greedy method settles everyone with few payments. Example: a ₹3,000 hotel paid by Alice and split three ways '
           'gives "Bob pays Alice ₹1,000, Carol pays Alice ₹1,000".'))
s.append(P('The ML service', h3))
s.append(bullets([
    '<b>Demand forecast:</b> a weighted formula of hour of day, weekday, past rides, weather and holidays. It returns a demand level '
    'and a surge multiplier. It is deterministic, so the same inputs always give the same answer.',
    '<b>Fraud scoring:</b> rules add risk points for many cancellations, unusual payment amounts, many bookings in an hour and new '
    'accounts. High risk flags the account; critical risk suspends it until an admin reviews it.',
    '<b>Pickup order:</b> the nearest-neighbour heuristic for the travelling-salesman problem (always visit the closest unvisited '
    'pickup next), which runs in O(n²).',
]))
s.append(P('Safety', h3))
s.append(bullets([
    '<b>SOS</b> alerts the admin desk at once and texts emergency contacts a link to the rider\'s live location.',
    '<b>Route deviation:</b> the car\'s position is compared with the planned route; more than 500 m off raises an alert.',
    '<b>Check-ins:</b> "Are you OK?" every 30 minutes during a ride; two missed prompts raise an SOS.',
    '<b>Trip sharing:</b> a public link with the car\'s position that stops working an hour after the trip.',
    '<b>Verification:</b> drivers upload licence, registration and insurance, and admins check them before the first ride.',
]))

# 5
s.append(P('5. Tools used and how they work', h2))
tools = [
    ['Tool', 'What it is and how it works', 'Used in Poolora for'],
    ['TypeScript', 'JavaScript with types. The compiler checks that values have the right shape before the code runs, then outputs plain JavaScript.', 'App, API and admin, so all three share one language'],
    ['React Native + Expo', 'Write the UI once in React; React Native draws real Android and iOS components. Expo adds ready-made modules (location, notifications) and the build tools.', 'The mobile app'],
    ['React + Vite', 'React builds the page from components that re-render when data changes. Vite is a fast dev server and bundler.', 'The admin dashboard'],
    ['Node.js + Express', 'Node runs JavaScript on the server with one event loop, so it handles many requests while waiting on the database. Express routes each URL to a handler through middleware (auth, validation).', 'The REST API'],
    ['Socket.IO', 'Keeps a WebSocket open between the phone and the server so either side can send a message at any time. Clients join "rooms" (a booking, the admin SOS desk) and the server sends to a room.', 'Live GPS, chat, SOS, alerts'],
    ['MongoDB + Mongoose', 'A document database: each record is a JSON-like document. Indexes make lookups fast; 2dsphere indexes answer questions about points and lines on the Earth. Mongoose adds schemas and validation.', 'All stored data, route search'],
    ['Redis', 'An in-memory key-value store, very fast. Keys can expire on their own. SET with NX gives a simple lock.', 'Cache, rate limits, job locks, Socket.IO across servers'],
    ['Apache Kafka', 'A log of events that services publish to and read from, so work happens after the request finishes. Poolora falls back to in-process handling when Kafka is down.', 'Booking, payment and safety events'],
    ['Python + FastAPI', 'FastAPI turns Python functions into HTTP endpoints and checks the input with Pydantic models.', 'The ML service'],
    ['Firebase', 'Google\'s service for sign-in (phone OTP, Google) and push notifications (FCM). The server verifies Firebase tokens with the Admin SDK.', 'Login and push'],
    ['Razorpay', 'Indian payment gateway. The server creates an order; the app opens Razorpay checkout; Razorpay calls a webhook signed with HMAC, which the server verifies.', 'Card and UPI payments, refunds'],
    ['OpenStreetMap stack', 'Free map data. MapLibre draws the map tiles; OSRM computes driving routes; Photon and Nominatim turn text into places.', 'Maps, routes, place search'],
    ['JWT', 'A signed token that carries the user id. The server checks the signature on each request instead of looking up a session.', 'API authentication'],
    ['Joi', 'Describes what a request body must look like and rejects anything else before it reaches the code.', 'Input validation on every endpoint'],
    ['Jest, Vitest', 'Test runners. Jest with an in-memory MongoDB lets tests use a real database that is thrown away afterwards.', '297 backend, 100 app and 9 admin tests'],
    ['Docker, Kubernetes', 'Docker packages each service with everything it needs. Kubernetes runs the containers, restarts failed ones and adds copies under load (autoscaler).', 'Local stack and deployment'],
    ['Git, GitHub Actions', 'Version control, and CI that runs type checks, lint and tests on every push.', 'Development workflow'],
]
s.append(table(tools, [3.1 * cm, 9.4 * cm, 4.5 * cm]))

# 6
s.append(P('6. How it was tested', h2))
s.append(bullets([
    'Automated tests for the rules that matter most: matching, booking, payments and refunds, settlement, safety, admin actions, '
    'parcels and trips. Most run against a real, temporary MongoDB.',
    'A ride simulator: a bot driver or bot rider lets one person run a complete trip on one phone.',
    'Manual testing on an Android phone (Samsung Galaxy A04s) with the backend running on a laptop.',
]))

# 7
s.append(KeepTogether([
    P('7. Running it locally', h2),
    P('npm install  (in backend, frontend and admin-web)<br/>'
      'backend:    npm run dev            → API on port 5002<br/>'
      'phone:      adb reverse tcp:5002 tcp:5002<br/>'
      'frontend:   npx expo run:android   → builds and installs the app<br/>'
      'admin-web:  npm run dev            → dashboard in the browser', code),
    P('MongoDB and Redis must be running (Docker Compose starts them). Secrets such as Firebase, Razorpay and SMTP keys go in '
      '<i>backend/.env</i>; see <i>backend/.env.example</i> and <i>docs/SECRETS.md</i>.'),
]))

doc.build(s)
print('wrote', OUT)
