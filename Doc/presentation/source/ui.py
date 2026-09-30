"""Drive the phone over adb and capture screens for the presentation.

python3 ui.py snap NAME     screenshot + the screen's labelled elements -> ../screens/NAME.png, NAME.json
python3 ui.py list          print labelled elements and their centres
python3 ui.py tap TEXT      tap the element whose label is exactly TEXT
python3 ui.py taptxt TEXT   tap the first element whose label contains TEXT
python3 ui.py tapxy X Y | back | swipe
"""
import json, os, re, subprocess, sys, time

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'screens')


def adb(*a, out=False):
    r = subprocess.run(['adb', *a], capture_output=True)
    return r.stdout if out else None


def nodes():
    adb('shell', 'uiautomator', 'dump', '/sdcard/ui.xml')
    x = adb('exec-out', 'cat', '/sdcard/ui.xml', out=True).decode('utf8', 'ignore')
    for m in re.finditer(r'<node [^>]*>', x):
        n = m.group(0)
        t = (re.search(r' text="([^"]*)"', n) or re.match('()', '')).group(1)
        d = (re.search(r'content-desc="([^"]*)"', n) or re.match('()', '')).group(1)
        b = re.search(r'bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"', n)
        label = (t or d).replace('&amp;', '&')
        if label and b and not label.startswith('&#'):
            x1, y1, x2, y2 = map(int, b.groups())
            yield {'label': label, 'x': (x1 + x2) // 2, 'y': (y1 + y2) // 2, 'bounds': [x1, y1, x2, y2]}


cmd = sys.argv[1]
if cmd == 'snap':
    os.makedirs(OUT, exist_ok=True)
    name = sys.argv[2]
    png = adb('exec-out', 'screencap', '-p', out=True)
    open(os.path.join(OUT, name + '.png'), 'wb').write(png)
    json.dump(list(nodes()), open(os.path.join(OUT, name + '.json'), 'w'), indent=1)
    print('saved', name)
elif cmd == 'list':
    for n in nodes():
        print(f"{n['x']:4d},{n['y']:4d}  {n['label'][:70]!r}")
elif cmd in ('tap', 'taptxt'):
    want = sys.argv[2].lower()
    for n in nodes():
        hit = n['label'].lower() == want if cmd == 'tap' else want in n['label'].lower()
        if hit:
            adb('shell', 'input', 'tap', str(n['x']), str(n['y']))
            print('tapped', repr(n['label']))
            break
    else:
        print('NOT FOUND', want)
        sys.exit(1)
elif cmd == 'tapxy':
    adb('shell', 'input', 'tap', sys.argv[2], sys.argv[3])
elif cmd == 'back':
    adb('shell', 'input', 'keyevent', '4')
elif cmd == 'swipe':
    adb('shell', 'input', 'swipe', '360', '1300', '360', '500', '400')
if cmd not in ('snap', 'list'):
    time.sleep(float(os.environ.get('WAIT', '2.5')))
