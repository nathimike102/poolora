"""Siham: how to run the app on any Android device over adb.

python3 runguide.py [out.pdf]   (default ../Siham-Run-On-Android.pdf)
"""
import os, sys
from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.units import cm
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, Table, TableStyle,
                                Image, KeepTogether, ListFlowable, ListItem, CondPageBreak)

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '..', 'Siham-Run-On-Android.pdf')
ROOT = os.path.abspath(os.path.join(HERE, '..', '..', '..'))
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
WARN_BG = colors.HexColor('#FFF4E5')
WARN = colors.HexColor('#8A4B00')

body = ParagraphStyle('body', fontName='DV', fontSize=9.6, leading=14, textColor=colors.HexColor('#1F2330'), spaceAfter=6)
small = ParagraphStyle('small', parent=body, fontSize=8.4, leading=11.5, spaceAfter=0)
smallb = ParagraphStyle('smallb', parent=small, fontName='DVB', textColor=NAVY)
h1 = ParagraphStyle('h1', fontName='DVB', fontSize=20, leading=25, textColor=NAVY, spaceAfter=4)
h2 = ParagraphStyle('h2', fontName='DVB', fontSize=13.5, leading=18, textColor=TEAL, spaceBefore=12, spaceAfter=6)
h3 = ParagraphStyle('h3', fontName='DVB', fontSize=10.5, leading=14, textColor=NAVY, spaceBefore=8, spaceAfter=6)
lead = ParagraphStyle('lead', parent=body, fontSize=10.5, leading=15, textColor=MUTED)
code = ParagraphStyle('code', parent=body, fontName='DVM', fontSize=8.5, leading=12, backColor=MINT, borderPadding=6,
                      spaceBefore=8, spaceAfter=14, textColor=colors.HexColor('#12312F'))
note = ParagraphStyle('note', parent=body, fontSize=9, leading=13, backColor=WARN_BG, borderPadding=6, textColor=WARN,
                      spaceBefore=4, spaceAfter=10)

P = lambda t, s=body: Paragraph(t, s)


def C(lines):
    """A block of shell commands; '#' lines are comments."""
    out = []
    for l in lines:
        l = l.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;').replace('  ', '&nbsp;&nbsp;')
        out.append(f'<font color="#5B6475">{l}</font>' if l.startswith('#') else l)
    return P('<br/>'.join(out), code)


def bullets(items):
    return ListFlowable([ListItem(P(i), leftIndent=12) for i in items], bulletType='bullet', start='•',
                        leftIndent=12, bulletFontSize=8, bulletColor=TEAL)


def steps(items):
    return ListFlowable([ListItem(P(i), leftIndent=16) for i in items], bulletType='1', leftIndent=16,
                        bulletFontName='DVB', bulletColor=TEAL)


def table(rows, widths):
    data = [[P(c, smallb if r == 0 or j == 0 else small) for j, c in enumerate(row)] for r, row in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([('GRID', (0, 0), (-1, -1), 0.5, LINE), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
                           ('BACKGROUND', (0, 0), (-1, 0), MINT),
                           ('LEFTPADDING', (0, 0), (-1, -1), 5), ('RIGHTPADDING', (0, 0), (-1, -1), 5),
                           ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 4)]))
    return t


def on_page(c, doc):
    c.saveState()
    c.setFont('DV', 8)
    c.setFillColor(MUTED)
    c.drawString(2 * cm, 1.2 * cm, 'Siham · Running the app on an Android device')
    c.drawRightString(A4[0] - 2 * cm, 1.2 * cm, str(doc.page))
    c.restoreState()


doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=2 * cm, rightMargin=2 * cm, topMargin=1.8 * cm, bottomMargin=2 * cm,
                      title='Siham: running the app on an Android device', author='Nkosinathi Michael Sibanda')
doc.addPageTemplates([PageTemplate(id='p', frames=[Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height)], onPage=on_page)])
W = doc.width

s = []
s.append(Image(os.path.join(ROOT, 'branding/siham-lockup.png'), width=5.2 * cm, height=1.58 * cm, hAlign='LEFT'))
s.append(Spacer(1, 8))
s.append(P('Running Siham on an Android device', h1))
s.append(P('Step-by-step: connect any Android phone or emulator with adb, start the backend, and install and run the app '
           'for manual testing.', lead))

s.append(P('The short version', h2))
s.append(P('Once everything is installed, these five commands run the app on a connected phone:'))
s.append(C([
    'adb devices                              # the phone must show "device"',
    'cd backend  && npm run dev               # API on http://localhost:5002',
    'adb reverse tcp:5002 tcp:5002            # phone localhost:5002 -> laptop API',
    'adb reverse tcp:8081 tcp:8081            # phone localhost:8081 -> Metro bundler',
    'cd frontend && npx expo run:android      # build, install and open the app',
]))
s.append(P('The rest of this guide explains each step, other ways to connect, and what to do when something goes wrong.'))

# 1
s.append(P('1. What you need', h2))
s.append(table([
    ['Item', 'Version', 'Check with'],
    ['Node.js and npm', '18 or newer (tested with 22)', 'node -v'],
    ['Java JDK', '17', 'java -version'],
    ['Android SDK with platform-tools (adb)', 'Installed by Android Studio, or the command-line tools', 'adb version'],
    ['Docker', 'Any recent version, for MongoDB and Redis', 'docker --version'],
    ['Android phone or emulator', 'Android 7.0 (API 24) or newer; the app targets API 36', 'Settings > About phone'],
    ['USB cable', 'One that carries data, not only charge', ''],
], [5.2 * cm, 7.0 * cm, 4.8 * cm]))
s.append(Spacer(1, 6))
s.append(P('Make sure the Android SDK is on your path so Gradle can find it, for example in <i>~/.bashrc</i> or <i>~/.zshrc</i>:'))
s.append(C(['export ANDROID_HOME=$HOME/Android/Sdk', 'export PATH=$PATH:$ANDROID_HOME/platform-tools']))

# 2
s.append(P('2. Prepare the phone (once per phone)', h2))
s.append(steps([
    'Open <b>Settings &gt; About phone</b> (on Samsung: <b>About phone &gt; Software information</b>) and tap <b>Build number</b> '
    'seven times until it says developer mode is on.',
    'Open <b>Settings &gt; Developer options</b> and turn on <b>USB debugging</b>.',
    'Connect the phone with the USB cable. If the phone asks what to use USB for, choose <b>File transfer</b>.',
    'A prompt appears on the phone: <b>Allow USB debugging?</b> Tick <b>Always allow from this computer</b> and tap <b>Allow</b>.',
]))
s.append(KeepTogether([P('Check that adb sees it:'), C(['adb devices -l',
            '# List of devices attached',
            '# RZ8W5021XNV   device usb:3-3 product:a04snnxx model:SM_A047F'])]))
s.append(table([
    ['adb shows', 'Meaning', 'Fix'],
    ['device', 'Connected and authorised', 'Nothing to do'],
    ['unauthorized', 'The phone has not accepted this computer', 'Unlock the phone and accept the prompt. If it never appears: Developer options > Revoke USB debugging authorisations, unplug, plug in again'],
    ['offline', 'adb lost the connection', 'adb kill-server, then adb start-server; replug the cable'],
    ['(nothing)', 'No data connection', 'Try another cable or port; set USB mode to File transfer; on Linux add a udev rule for the phone'],
], [2.6 * cm, 5.2 * cm, 9.2 * cm]))

s.append(P('Without a cable: wireless debugging (Android 11 and newer)', h3))
s.append(P('Put the laptop and phone on the same Wi-Fi. In <b>Developer options &gt; Wireless debugging</b>, turn it on and tap '
           '<b>Pair device with pairing code</b>. The phone shows an address, a port and a six-digit code.'))
s.append(C(['# pairing address and port from the pairing pop-up; type the code when asked',
            'adb pair 192.168.1.23:37115',
            '# address and port shown on the Wireless debugging screen',
            'adb connect 192.168.1.23:41637',
            'adb devices                   # shows 192.168.1.23:41637  device']))
s.append(P('Everything else in this guide, including <i>adb reverse</i>, works the same over Wi-Fi.'))

s.append(P('An emulator instead of a phone', h3))
s.append(P('In Android Studio, open <b>Device Manager</b>, create a virtual device with API 24 or newer, and start it. It appears in '
           '<i>adb devices</i> as <i>emulator-5554</i> and is used exactly like a phone.'))

# 3
s.append(CondPageBreak(6 * cm))
s.append(P('3. Start the backend', h2))
s.append(P('The app needs the API running. Copy the example settings once and fill in your own values '
           '(MongoDB, JWT secrets, Firebase, and a Paynow test integration if you test online payments):'))
s.append(C(['cd backend', 'cp .env.example .env              # then edit .env',
            '# Firebase service account: secrets/firebase-service-account.json (see docs/SECRETS.md)']))
s.append(P('Option A: backend on your laptop, databases in Docker (best for development)', h3))
s.append(C(['cd backend',
            'docker compose up -d mongo redis  # MongoDB on localhost:27018, Redis on localhost:6379',
            '# in .env for this option:',
            '#   MONGO_URI=mongodb://admin:<password>@localhost:27018/mobility?authSource=admin',
            '#   REDIS_HOST=localhost',
            'npm install                       # first time only',
            'npm run dev                       # restarts itself when you change the code']))
s.append(P('A MongoDB Atlas connection string in <i>MONGO_URI</i> works too, and then only Redis is needed from Docker.'))
s.append(P('Option B: everything in Docker', h3))
s.append(C(['cd backend', 'docker compose up -d --build       # API, ML service, MongoDB, Redis and Kafka']))
s.append(KeepTogether([P('Either way, check the API is up before touching the phone:'),
                      C(['curl http://localhost:5002/health', '# {"status":"success","code":200,"data":{"service":"mobility-backend",...}}'])]))
s.append(P('Kafka is optional. Without it the log repeats "Kafka not reachable yet; retrying" and events are handled inside '
           'the API, which is fine for testing.'))

# 4
s.append(P('4. Let the phone reach the laptop', h2))
s.append(P('The app talks to two services on the laptop: the API on port <b>5002</b> and, for development builds, the Metro '
           'bundler on port <b>8081</b>, which serves the JavaScript. Pick one of these methods.'))
s.append(P('Method 1: adb reverse (recommended, works with any adb device)', h3))
s.append(P('This makes <i>localhost</i> on the phone lead to the laptop, over the cable or wireless debugging. The app already '
           'uses <i>http://localhost:5002</i> in development, so nothing needs changing.'))
s.append(C(['adb reverse tcp:5002 tcp:5002', 'adb reverse tcp:8081 tcp:8081', 'adb reverse --list      # both should be listed']))
s.append(P('<b>Run these again</b> whenever the phone is unplugged, reconnected, restarted, or adb restarts (installing the app can '
           'restart adb). If the app suddenly says "Unable to connect to the server", this is almost always the reason.', note))
s.append(P('Method 2: same Wi-Fi, using the laptop\'s address', h3))
s.append(P('Find the laptop\'s address (<i>ip addr</i> on Linux, <i>ipconfig</i> on Windows), then set it in <i>frontend/.env</i> '
           'and restart Metro:'))
s.append(C(['REACT_NATIVE_API_BASE_URL=http://192.168.1.10:5002']))
s.append(P('The laptop firewall must allow ports 5002 and 8081. This does not work with Option B above, because Docker only '
           'publishes the API on 127.0.0.1.'))

# 5
s.append(CondPageBreak(7 * cm))
s.append(P('5. Build, install and run the app', h2))
s.append(C(['cd frontend',
            'npm install                  # first time only',
            'npx expo run:android         # builds the Android app, installs it and starts Metro']))
s.append(P('The first build downloads Gradle and the Android libraries and takes 5 to 15 minutes; later builds take about a '
           'minute. When it finishes, the app opens on the phone and Metro keeps running in the terminal.'))
s.append(P('Several devices connected', h3))
s.append(P('<i>npx expo run:android</i> asks which device to use when more than one is connected. To pick one directly, pass the '
           'device <b>name</b> (not the serial number), for example:'))
s.append(C(['npx expo run:android --device "SM_A047F"', '# adb commands take the serial number instead:',
            'adb -s RZ8W5021XNV reverse tcp:5002 tcp:5002']))
s.append(P('Next time: no rebuild needed', h3))
s.append(P('The installed app is a development build. Rebuild only when native code or packages change. Otherwise start Metro '
           'and open the app:'))
s.append(C(['cd frontend', 'npx expo start --dev-client     # then press "a", or tap the Siham icon on the phone']))
s.append(P('Code changes reload by themselves. Press <b>r</b> in the Metro terminal to reload by hand, or open the developer menu '
           'on the phone by shaking it or running <i>adb shell input keyevent 82</i>.'))

s.append(P('Installing on a phone without building on your laptop', h3))
s.append(P('Build an APK once and install it on any number of phones:'))
s.append(C(['cd frontend/android',
            '# output: app/build/outputs/apk/debug/app-debug.apk (it still needs Metro)',
            './gradlew assembleDebug',
            'adb -s <serial> install -r app/build/outputs/apk/debug/app-debug.apk']))
s.append(P('A <b>release</b> APK (<i>./gradlew assembleRelease</i>) contains the JavaScript, so it runs without Metro, but it must be '
           'built with <i>REACT_NATIVE_API_BASE_URL</i> set to an <b>https</b> address: release builds refuse plain http, and the '
           'app stops at start-up if the address is missing. This project signs release builds with the debug key, which is fine '
           'for testing but not for the Play Store.', note))

# 6
s.append(P('6. Useful while testing', h2))
s.append(table([
    ['Task', 'How'],
    ['Test a full trip on one phone', 'Settings > Testing > Simulate a ride (as rider or as driver). A bot plays the other person. '
                                     'Available when the backend is not in production mode.'],
    ['See the app\'s logs', 'In the Metro terminal, or: adb logcat -s ReactNativeJS'],
    ['See the API\'s logs', 'The terminal running npm run dev, or: docker compose logs -f app'],
    ['Take a screenshot', 'adb exec-out screencap -p > screen.png'],
    ['Record the screen', 'adb shell screenrecord /sdcard/test.mp4 (Ctrl+C to stop), then adb pull /sdcard/test.mp4'],
    ['Type text into the phone', 'adb shell input text "Borrowdale". On a slow emulator, send a code one digit at a time'],
    ['Sign in without SMS', 'With TWILIO_ENABLED=false and LOG_LEVEL=debug, the backend log prints "[DEV] OTP for +263…: 123456". '
                            'Seeded users: rider 0776 500 001, driver 0776 543 210'],
    ['Put an emulator in Harare', 'Time: adb shell service call alarm 3 s16 Africa/Harare. Location (when "geo fix" is ignored): '
                                   'adb shell appops set com.android.shell android:mock_location allow; '
                                   'adb shell cmd location providers add-test-provider gps; '
                                   'adb shell cmd location providers set-test-provider-enabled gps true; '
                                   'adb shell cmd location providers set-test-provider-location gps --location -17.8252,31.0532 '
                                   '(repeat every few seconds while the app looks for a fix)'],
    ['Open the dev build on Metro', 'adb shell am start -a android.intent.action.VIEW -d '
                                    '"exp+siham://expo-development-client/?url=http%3A%2F%2Flocalhost%3A8081" com.siham.app'],
    ['Start again from a clean app', 'adb shell pm clear com.siham.app (signs you out and clears saved data)'],
    ['Remove the app', 'adb uninstall com.siham.app'],
    ['Open the web admin', 'cd admin-web, npm run dev, then open the address it prints in a browser'],
], [5.0 * cm, 12.0 * cm]))
s.append(Spacer(1, 6))
s.append(P('Some features need services that may not be set up locally: text messages need Twilio (<i>TWILIO_*</i> in '
           '<i>backend/.env</i>), emails need an SMTP server (<i>SMTP_*</i>), online payments need a Paynow test integration '
           '(<i>PAYNOW_*</i>; test numbers such as 0771111111 pay after 5 seconds, see SETUP-TODO.md), and the support assistant needs '
           '<i>ANTHROPIC_API_KEY</i>. Without them the app says the feature is unavailable; wallet payments and the ride simulator work '
           'without any of them.'))

# 7
s.append(CondPageBreak(6 * cm))
s.append(P('7. Troubleshooting', h2))
s.append(table([
    ['Problem', 'Likely cause', 'Fix'],
    ['"Unable to connect to the server" in the app', 'The port forwarding dropped, or the API is not running',
     'curl http://localhost:5002/health on the laptop; then run both adb reverse commands again and pull down or tap retry'],
    ['Red screen: "Unable to load script"', 'The phone cannot reach Metro', 'Start Metro (npx expo start --dev-client) and run adb reverse tcp:8081 tcp:8081'],
    ['CommandError: Could not find device with name', '--device was given the serial number', 'Pass the device name (the model shown by adb devices -l), or leave --device out'],
    ['SDK location not found', 'Gradle cannot find the Android SDK', 'Set ANDROID_HOME, or create frontend/android/local.properties with sdk.dir=/path/to/Android/Sdk'],
    ['Unsupported class file major version', 'Wrong Java version', 'Use JDK 17 (set JAVA_HOME)'],
    ['INSTALL_FAILED_UPDATE_INCOMPATIBLE', 'A copy signed with another key is installed', 'adb uninstall com.siham.app, then install again'],
    ['Google sign-in fails', 'This computer\'s debug key is not registered in Firebase', 'Add the SHA-1 from ./gradlew signingReport to the Firebase Android app, or sign in with a phone number'],
    ['Map is blank', 'No internet on the phone', 'Map tiles come from OpenFreeMap over the internet; check the phone\'s data or Wi-Fi'],
    ['Code changes do not show up', 'Metro missed the file change', 'Stop Metro and start it again with --clear, then reopen the app'],
    ['"Couldn\'t find your location"', 'The emulator has no GPS fix', 'Use the mock-location commands in section 6'],
    ['Port 8081 or 5002 already in use', 'An old Metro or API process', 'Stop it (lsof -i :8081 on Linux or macOS), or run Metro on another port with --port 8082 and reverse that port'],
], [4.6 * cm, 4.6 * cm, 7.8 * cm]))

s.append(KeepTogether([
    P('8. Checklist before a demo or test session', h2),
    bullets([
        'Docker is running, and MongoDB and Redis are up',
        'curl http://localhost:5002/health returns status success',
        'adb devices shows the phone as <b>device</b>',
        'adb reverse --list shows 5002 and 8081',
        'Metro is running (npx expo start --dev-client), or you installed a release build',
        'The phone has internet access for maps and sign-in',
    ]),
]))

doc.build(s)
print('wrote', OUT)
