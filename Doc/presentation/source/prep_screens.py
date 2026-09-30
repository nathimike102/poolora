"""Prepare the phone and admin captures for the decks.

Reads ../screens/*.png (+ .json from ui.py snap) and writes:
  ../screens/clean/NAME.png   the screen: Android navigation bar cropped, the
                              Expo dev-client "Tools" button painted over, 540 px wide
  ../screens/frames/NAME.png  the clean screen in a phone frame with a soft shadow,
                              on a transparent background, for the slides and 3D scenes
Admin captures (admin_*.png, from a desktop browser) get a browser-window frame instead.
"""
import glob, json, os
from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'screens')
CLEAN = os.path.join(SRC, 'clean')
FRAMES = os.path.join(SRC, 'frames')
os.makedirs(CLEAN, exist_ok=True)
os.makedirs(FRAMES, exist_ok=True)

NAVY = (27, 20, 70)
BEZEL = (18, 16, 32)


def navbar_top(im):
    """First row of the system navigation bar: a uniform band at the bottom."""
    px = im.load()
    w, h = im.size
    bottom = px[3, h - 3]
    for y in range(h - 1, int(h * 0.8), -1):
        if px[3, y] != bottom or px[w - 4, y] != bottom:
            return y + 1
    return h


def rounded_mask(size, radius):
    mask = Image.new('L', size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size[0] - 1, size[1] - 1), radius, fill=255)
    return mask


def phone_frame(screen):
    """The screen inside a thin-bezel phone, with a drop shadow; RGBA."""
    sw, sh = screen.size
    bezel, radius = 18, 58
    pw, ph = sw + 2 * bezel, sh + 2 * bezel
    pad = 60
    out = Image.new('RGBA', (pw + 2 * pad, ph + 2 * pad), (0, 0, 0, 0))
    shadow = Image.new('RGBA', out.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((pad, pad + 22, pad + pw, pad + ph + 22), radius + bezel, fill=(10, 8, 30, 110))
    out.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(26)))
    body = Image.new('RGBA', (pw, ph), BEZEL + (255,))
    body.putalpha(rounded_mask((pw, ph), radius + bezel))
    # A faint rim so the frame reads on dark slides
    ImageDraw.Draw(body).rounded_rectangle((1, 1, pw - 2, ph - 2), radius + bezel, outline=(70, 66, 100, 255), width=3)
    out.alpha_composite(body, (pad, pad))
    glass = screen.convert('RGBA')
    glass.putalpha(rounded_mask(screen.size, radius))
    out.alpha_composite(glass, (pad + bezel, pad + bezel))
    # Camera punch-hole
    cx = pad + pw // 2
    ImageDraw.Draw(out).ellipse((cx - 9, pad + bezel + 14, cx + 9, pad + bezel + 32), fill=(12, 12, 20, 255))
    return out


def browser_frame(page):
    """A desktop capture in a minimal browser window; RGBA."""
    w, h = page.size
    bar = 44
    pad = 50
    out = Image.new('RGBA', (w + 2 * pad, h + bar + 2 * pad), (0, 0, 0, 0))
    shadow = Image.new('RGBA', out.size, (0, 0, 0, 0))
    ImageDraw.Draw(shadow).rounded_rectangle((pad, pad + 16, pad + w, pad + bar + h + 16), 18, fill=(10, 8, 30, 90))
    out.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(22)))
    win = Image.new('RGBA', (w, h + bar), (236, 238, 243, 255))
    d = ImageDraw.Draw(win)
    for i, col in enumerate([(255, 95, 86), (255, 189, 46), (39, 201, 63)]):
        d.ellipse((18 + i * 22, 15, 32 + i * 22, 29), fill=col)
    d.rounded_rectangle((110, 10, w - 110, 34), 12, fill=(255, 255, 255))
    win.paste(page.convert('RGBA'), (0, bar))
    win.putalpha(rounded_mask(win.size, 14))
    out.alpha_composite(win, (pad, pad))
    return out


for path in sorted(glob.glob(os.path.join(SRC, '*.png'))):
    name = os.path.splitext(os.path.basename(path))[0]
    if name.startswith('_'):
        continue
    im = Image.open(path).convert('RGB')
    if name.startswith('admin_'):
        im.thumbnail((1440, 900))
        im.save(os.path.join(CLEAN, name + '.png'), optimize=True)
        browser_frame(im).save(os.path.join(FRAMES, name + '.png'), optimize=True)
        print(f'{name}: browser frame')
        continue
    jpath = os.path.join(SRC, name + '.json')
    nodes = json.load(open(jpath)) if os.path.exists(jpath) else []
    px = im.load()
    # The dev-client button: fill each row with the colour just right of it
    for n in nodes:
        if n['label'] == 'Tools':
            x1, y1, x2, y2 = n['bounds']
            x1, y1, x2, y2 = max(0, x1 - 6), max(0, y1 - 6), x2 + 6, y2 + 6
            for y in range(y1, min(y2, im.height)):
                c = px[min(x2 + 4, im.width - 1), y]
                for x in range(x1, x2):
                    px[x, y] = c
    top = navbar_top(im)
    scale = 540 / im.width
    im = im.crop((0, 0, im.width, top))
    im = im.resize((540, round(top * scale)), Image.LANCZOS)
    im.save(os.path.join(CLEAN, name + '.png'), optimize=True)
    phone_frame(im).save(os.path.join(FRAMES, name + '.png'), optimize=True)
    kept = [dict(n, bounds=[round(b * scale) for b in n['bounds']]) for n in nodes if n['label'] != 'Tools' and n['bounds'][3] <= top]
    json.dump({'width': 540, 'height': im.height, 'nodes': kept}, open(os.path.join(CLEAN, name + '.json'), 'w'))
    print(f'{name}: 540x{im.height}')
