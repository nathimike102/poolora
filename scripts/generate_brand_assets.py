#!/usr/bin/env python3
"""Render every Poolora logo and app icon from branding/poolora-mark.svg.

Usage (from the repo root):
    pip install cairosvg pillow
    python3 scripts/generate_brand_assets.py

The master SVG has two groups: `tile` (the gradient rounded square) and
`car` (everything drawn on top). Variants are built by editing the SVG
text, so there is only one drawing to maintain.
"""

import io
import re
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
MASTER = (ROOT / "branding" / "poolora-mark.svg").read_text()

# Android densities: launcher icon size and splash logo canvas size, in px.
ANDROID_DENSITIES = {
    "mdpi": (48, 288),
    "hdpi": (72, 432),
    "xhdpi": (96, 576),
    "xxhdpi": (144, 864),
    "xxxhdpi": (192, 1152),
}

INK = "#1A1446"


def render(svg: str, size: int) -> Image.Image:
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=size, output_height=size)
    return Image.open(io.BytesIO(png)).convert("RGBA")


def square_tile(svg: str) -> str:
    """Full-bleed square: for iOS/app stores, which apply their own mask."""
    return svg.replace('rx="56" fill="url(#bg)"', 'fill="url(#bg)"')


def without_car(svg: str) -> str:
    return re.sub(r'<g id="car">.*?</g>\s*(?=</svg>)', "", svg, flags=re.S)


def car_only(svg: str, scale: float) -> str:
    """Transparent background, car group scaled about the centre."""
    svg = re.sub(r'<g id="tile">.*?</g>', "", svg, flags=re.S)
    offset = 128 * (1 - scale)
    return svg.replace(
        '<g id="car">',
        f'<g id="car" transform="translate({offset:.2f} {offset:.2f}) scale({scale})">',
    )


def on_canvas(mark: Image.Image, canvas: int) -> Image.Image:
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.paste(mark, ((canvas - mark.width) // 2, (canvas - mark.height) // 2), mark)
    return out


def round_icon(size: int) -> Image.Image:
    """Circular launcher icon; the car is shrunk so the circle doesn't clip it."""
    img = render(square_tile(without_car(MASTER)), size)
    car = render(car_only(MASTER, 0.84), size)
    img.alpha_composite(car)
    return circle_crop(img)


def circle_crop(img: Image.Image) -> Image.Image:
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).ellipse((0, 0, img.width - 1, img.height - 1), fill=255)
    out = Image.new("RGBA", img.size, (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def save(img: Image.Image, rel: str, **kwargs) -> None:
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, **kwargs)
    print(f"  {rel} ({img.width}x{img.height})")


def lockup() -> Image.Image:
    """Mark with the Poolora wordmark beside it, for docs and the README."""
    mark = render(MASTER, 360)
    font_path = next(
        (p for p in ("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",) if Path(p).exists()),
        None,
    )
    font = ImageFont.truetype(font_path, 190) if font_path else ImageFont.load_default()
    text = "Poolora"
    width = ImageDraw.Draw(Image.new("RGB", (1, 1))).textlength(text, font=font)
    img = Image.new("RGBA", (360 + 60 + int(width) + 40, 400), (0, 0, 0, 0))
    img.paste(mark, (20, 20), mark)
    ImageDraw.Draw(img).text((440, 200), text, font=font, fill=INK, anchor="lm")
    return img


def main() -> None:
    print("Rendering from branding/poolora-mark.svg")

    # Brand files
    save(render(MASTER, 1024), "branding/poolora-mark.png")
    save(lockup(), "branding/poolora-lockup.png")

    # Expo app (frontend)
    save(render(square_tile(MASTER), 1024).convert("RGB"), "frontend/assets/icon.png")
    save(render(car_only(MASTER, 0.62), 1024), "frontend/assets/adaptive-icon.png")
    save(render(square_tile(without_car(MASTER)), 1024).convert("RGB"),
         "frontend/assets/adaptive-icon-background.png")
    save(on_canvas(render(MASTER, 400), 1024), "frontend/assets/splash-icon.png")

    # Prebuilt Android project
    for density, (icon, splash) in ANDROID_DENSITIES.items():
        res = "android/app/src/main/res"
        save(render(MASTER, icon), f"{res}/mipmap-{density}/ic_launcher.webp", lossless=True)
        save(round_icon(icon), f"{res}/mipmap-{density}/ic_launcher_round.webp", lossless=True)
        save(on_canvas(render(MASTER, splash * 5 // 12), splash),
             f"{res}/drawable-{density}/splashscreen_logo.png")

    # Marketing site (web-landing)
    save(render(MASTER, 160), "web-landing/src/assets/poolora-logo.webp", lossless=True)
    save(render(square_tile(MASTER), 180).convert("RGB"), "web-landing/public/apple-touch-icon.png")
    save(render(MASTER, 32), "web-landing/public/favicon-32.png")
    favicon = render(MASTER, 256)
    favicon.save(ROOT / "web-landing/public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("  web-landing/public/favicon.ico (16, 32, 48)")


if __name__ == "__main__":
    main()
