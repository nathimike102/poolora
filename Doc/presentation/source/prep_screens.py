"""Clean the phone captures for the deck: crop the Android navigation bar and
paint over the Expo developer "Tools" button. Reads ../screens/*.png (+ .json),
writes ../screens/clean/*.png and ../screens/clean/*.json (bounds adjusted).
"""
import glob, json, os
from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '..', 'screens')
OUT = os.path.join(SRC, 'clean')
os.makedirs(OUT, exist_ok=True)


def navbar_top(im):
    """First row of the system navigation bar: a uniform band at the bottom."""
    px = im.load()
    w, h = im.size
    bottom = px[3, h - 3]
    for y in range(h - 1, int(h * 0.8), -1):
        if px[3, y] != bottom or px[w - 4, y] != bottom:
            return y + 1
    return h


for path in sorted(glob.glob(os.path.join(SRC, '*.png'))):
    name = os.path.splitext(os.path.basename(path))[0]
    if name.startswith('_'):
        continue
    im = Image.open(path).convert('RGB')
    nodes = json.load(open(os.path.join(SRC, name + '.json'))) if os.path.exists(os.path.join(SRC, name + '.json')) else []
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
    im = im.crop((0, 0, im.width, top))
    im.thumbnail((540, 1200))
    im.save(os.path.join(OUT, name + '.png'), optimize=True)
    kept = [n for n in nodes if n['label'] != 'Tools' and n['bounds'][3] <= top]
    json.dump({'width': 720, 'height': top, 'nodes': kept}, open(os.path.join(OUT, name + '.json'), 'w'))
    print(f'{name}: cropped to 720x{top}')
