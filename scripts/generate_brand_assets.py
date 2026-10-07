#!/usr/bin/env python3
"""Render every Siham logo and app icon from the master images.

Usage (from the repo root):
    pip install cairosvg pillow
    python3 scripts/render_brand_master.py   # after editing branding/source
    python3 scripts/generate_brand_assets.py

Inputs, all written by render_brand_master.py:
    branding/siham-icon.png          full-bleed 1024 app icon (symbol on navy)
    branding/siham-symbol.png        symbol on transparency, for dark backgrounds
    branding/siham-symbol-light.png  symbol for light backgrounds
    branding/siham-wordmark.png      navy SIHAM wordmark on transparency

The app icon is the symbol only; the wordmark goes beside or below it in
lockups and is never put inside the icon.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BRAND = ROOT / "branding"


def load(name: str) -> Image.Image:
    return Image.open(BRAND / name).convert("RGBA")


ICON = load("siham-icon.png")
SYMBOL = load("siham-symbol.png")
SYMBOL_LIGHT = load("siham-symbol-light.png")
WORDMARK = load("siham-wordmark.png")

NAVY = "#0B2530"
NAVY_DEEP = "#061A22"
NAVY_LIFT = "#123A47"
IVORY = "#F5F1E7"

# Corner radius of the rounded tile, as a share of its width (iOS uses ~22%).
CORNER = 0.225


def resized(img: Image.Image, size: int) -> Image.Image:
    out = img.resize((size, int(img.height * size / img.width)), Image.LANCZOS)
    if size <= 96:
        out = out.filter(ImageFilter.UnsharpMask(radius=1, percent=60, threshold=2))
    return out


def tinted(img: Image.Image, colour: str) -> Image.Image:
    """The image's shape filled with one colour (alpha kept)."""
    out = Image.new("RGBA", img.size, colour)
    out.putalpha(img.getchannel("A"))
    return out


def rounded_mask(size: int, radius: float) -> Image.Image:
    big = size * 4
    mask = Image.new("L", (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, big - 1, big - 1), radius=radius * 4, fill=255)
    return mask.resize((size, size), Image.LANCZOS)


def tile(size: int) -> Image.Image:
    """The app icon as a rounded tile on transparency."""
    img = resized(ICON, size)
    img.putalpha(rounded_mask(size, size * CORNER))
    return img


def full_bleed(size: int) -> Image.Image:
    """Opaque square: iOS and the app stores apply their own mask."""
    return resized(ICON, size).convert("RGB")


def centred(mark: Image.Image, canvas: int, scale: float) -> Image.Image:
    """`mark` scaled to `scale` of a transparent square canvas, centred."""
    art = resized(mark, int(canvas * scale))
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.alpha_composite(art, ((canvas - art.width) // 2, (canvas - art.height) // 2))
    return out


def lockup(symbol: Image.Image, wordmark: Image.Image, height: int = 400) -> Image.Image:
    """Horizontal lockup: symbol, then the wordmark at ~40% of its height."""
    mark = resized(symbol, height)
    word = resized(wordmark, int(height * 0.40 * wordmark.width / wordmark.height))
    gap = int(height * 0.22)
    pad = int(height * 0.06)
    img = Image.new("RGBA", (pad + mark.width + gap + word.width + pad, height + 2 * pad), (0, 0, 0, 0))
    img.alpha_composite(mark, (pad, pad))
    img.alpha_composite(word, (pad + mark.width + gap, pad + (height - word.height) // 2))
    return img


def stacked(symbol: Image.Image, wordmark: Image.Image, width: int = 1000) -> Image.Image:
    """Primary logo: symbol above the wordmark."""
    mark = resized(symbol, int(width * 0.62))
    word = resized(wordmark, int(width * 0.78))
    gap = int(width * 0.08)
    img = Image.new("RGBA", (width, mark.height + gap + word.height + width // 10), (0, 0, 0, 0))
    img.alpha_composite(mark, ((width - mark.width) // 2, width // 20))
    img.alpha_composite(word, ((width - word.width) // 2, width // 20 + mark.height + gap))
    return img


def og_image() -> Image.Image:
    """1200x630 link preview: symbol and wordmark on navy, tagline in ivory."""
    w, h = 1200, 630
    bg = Image.new("RGBA", (w, h), NAVY_DEEP)
    light = Image.new("L", (w, h), 0)
    ImageDraw.Draw(light).ellipse((-w * 0.2, -h * 0.5, w * 0.7, h * 1.1), fill=255)
    bg.paste(Image.new("RGBA", (w, h), NAVY_LIFT), mask=light.filter(ImageFilter.GaussianBlur(160)))
    bg.alpha_composite(resized(SYMBOL, 380), (110, (h - 380) // 2))
    word = resized(tinted(WORDMARK, IVORY), 520)
    bg.alpha_composite(word, (580, 205))
    draw = ImageDraw.Draw(bg)
    regular = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    if Path(regular).exists():
        font = ImageFont.truetype(regular, 40)
        draw.text((584, 360), "Share the ride,", font=font, fill=IVORY, anchor="ls")
        draw.text((584, 412), "split the cost.", font=font, fill=IVORY, anchor="ls")
    return bg.convert("RGB")


def save(img: Image.Image, rel: str, **kwargs) -> None:
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, **kwargs)
    print(f"  {rel} ({img.width}x{img.height})")


def main() -> None:
    print("Rendering from branding/")
    ivory_word = tinted(WORDMARK, IVORY)

    # Brand files
    save(tile(1024), "branding/siham-mark.png", optimize=True)
    save(lockup(SYMBOL_LIGHT, WORDMARK), "branding/siham-lockup.png", optimize=True)
    save(lockup(SYMBOL, ivory_word), "branding/siham-lockup-dark.png", optimize=True)
    save(stacked(SYMBOL_LIGHT, WORDMARK), "branding/siham-logo.png", optimize=True)
    save(stacked(SYMBOL, ivory_word), "branding/siham-logo-dark.png", optimize=True)

    # Expo app (frontend). Android adaptive icons crop to the middle 66%, so
    # the foreground symbol sits well inside it.
    save(full_bleed(1024), "frontend/assets/icon.png", optimize=True)
    save(centred(SYMBOL, 1024, 0.56), "frontend/assets/adaptive-icon.png", optimize=True)
    save(Image.new("RGB", (1024, 1024), NAVY), "frontend/assets/adaptive-icon-background.png", optimize=True)
    save(centred(SYMBOL, 1024, 0.9), "frontend/assets/splash-icon.png", optimize=True)
    # Android draws notification icons as a white silhouette
    save(centred(tinted(SYMBOL, "#FFFFFF"), 96, 0.92), "frontend/assets/notification-icon.png", optimize=True)

    # Marketing site (web-landing)
    save(full_bleed(180), "web-landing/public/apple-touch-icon.png", optimize=True)
    save(tile(32), "web-landing/public/favicon-32.png", optimize=True)
    tile(256).save(ROOT / "web-landing/public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("  web-landing/public/favicon.ico (16, 32, 48)")
    save(og_image(), "web-landing/public/og-image.jpg", quality=88)

    # Admin (admin-web)
    save(tile(64), "admin-web/public/favicon.png", optimize=True)


if __name__ == "__main__":
    main()
