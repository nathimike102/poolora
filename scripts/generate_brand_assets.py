#!/usr/bin/env python3
"""Render every Poolora logo and app icon from branding/poolora-icon.png.

Usage (from the repo root):
    pip install pillow
    python3 scripts/generate_brand_assets.py

branding/poolora-icon.png is the master: a full-bleed, square 1024px
image with no rounded corners. It is rendered from the vector artwork in
branding/source/poolora-icon.svg by scripts/render_brand_master.py; run
that first after editing the artwork.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
MASTER = Image.open(ROOT / "branding" / "poolora-icon.png").convert("RGBA")

# Corner radius of the rounded tile, as a share of its width (iOS uses ~22%).
CORNER = 0.225

INK = "#1A1446"


def resized(img: Image.Image, size: int) -> Image.Image:
    out = img.resize((size, size), Image.LANCZOS)
    if size <= 96:
        # Downscaling a photo softens it; restore some edge contrast.
        out = out.filter(ImageFilter.UnsharpMask(radius=1, percent=60, threshold=2))
    return out


def rounded_mask(size: int, radius: float, feather: float = 0) -> Image.Image:
    # Draw at 4x and downsample for smooth, anti-aliased corners.
    big = size * 4
    mask = Image.new("L", (big, big), 0)
    inset = feather * 4
    ImageDraw.Draw(mask).rounded_rectangle(
        (inset, inset, big - 1 - inset, big - 1 - inset), radius=radius * 4, fill=255
    )
    mask = mask.resize((size, size), Image.LANCZOS)
    if feather:
        mask = mask.filter(ImageFilter.GaussianBlur(feather / 2))
    return mask


def tile(size: int) -> Image.Image:
    """The icon as a rounded tile on transparency."""
    img = resized(MASTER, size)
    img.putalpha(rounded_mask(size, size * CORNER))
    return img


def full_bleed(size: int) -> Image.Image:
    """Opaque square: iOS and the app stores apply their own mask."""
    return resized(MASTER, size).convert("RGB")


def backdrop(size: int) -> Image.Image:
    """The master's colours, heavily blurred: a seamless background layer."""
    return MASTER.resize((size, size), Image.LANCZOS).filter(
        ImageFilter.GaussianBlur(size / 14)
    )


def floating(size: int, scale: float) -> Image.Image:
    """The master shrunk onto transparency with feathered edges."""
    inner = int(size * scale)
    art = resized(MASTER, inner)
    art.putalpha(rounded_mask(inner, inner * CORNER, feather=inner * 0.06))
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.alpha_composite(art, ((size - inner) // 2, (size - inner) // 2))
    return out


def on_canvas(mark: Image.Image, canvas: int) -> Image.Image:
    out = Image.new("RGBA", (canvas, canvas), (0, 0, 0, 0))
    out.alpha_composite(mark, ((canvas - mark.width) // 2, (canvas - mark.height) // 2))
    return out


def lockup() -> Image.Image:
    """Tile with the Poolora wordmark beside it, for docs and the README."""
    mark = tile(360)
    font_path = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    font = ImageFont.truetype(font_path, 190) if Path(font_path).exists() else ImageFont.load_default()
    text = "Poolora"
    width = ImageDraw.Draw(Image.new("RGB", (1, 1))).textlength(text, font=font)
    img = Image.new("RGBA", (360 + 60 + int(width) + 40, 400), (0, 0, 0, 0))
    img.alpha_composite(mark, (20, 20))
    ImageDraw.Draw(img).text((440, 200), text, font=font, fill=INK, anchor="lm")
    return img


def og_image() -> Image.Image:
    """1200x630 link preview: tile and wordmark on the master's blurred colours."""
    w, h = 1200, 630
    bg = MASTER.resize((w, w), Image.LANCZOS).crop((0, (w - h) // 2, w, (w + h) // 2))
    bg = bg.filter(ImageFilter.GaussianBlur(60))
    shade = Image.new("RGBA", (w, h), (10, 8, 30, 110))
    bg.alpha_composite(shade)
    bg.alpha_composite(tile(450), (90, 90))
    draw = ImageDraw.Draw(bg)
    bold = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
    regular = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
    if Path(bold).exists():
        draw.text((600, 270), "Poolora", font=ImageFont.truetype(bold, 118), fill="white", anchor="ls")
        draw.text((604, 340), "Share the ride,", font=ImageFont.truetype(regular, 44), fill="white", anchor="ls")
        draw.text((604, 396), "split the cost.", font=ImageFont.truetype(regular, 44), fill="white", anchor="ls")
    return bg.convert("RGB")


def save(img: Image.Image, rel: str, **kwargs) -> None:
    path = ROOT / rel
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, **kwargs)
    print(f"  {rel} ({img.width}x{img.height})")


def main() -> None:
    print("Rendering from branding/poolora-icon.png")

    # Brand files
    save(tile(1024), "branding/poolora-mark.png", optimize=True)
    save(lockup(), "branding/poolora-lockup.png", optimize=True)

    # Expo app (frontend)
    save(full_bleed(1024), "frontend/assets/icon.png", optimize=True)
    save(floating(1024, 0.70), "frontend/assets/adaptive-icon.png", optimize=True)
    save(backdrop(1024).convert("RGB"), "frontend/assets/adaptive-icon-background.png", optimize=True)
    save(on_canvas(tile(560), 1024), "frontend/assets/splash-icon.png", optimize=True)
    # Shown at up to 150pt in the app; 320px covers 2x screens
    save(tile(320), "frontend/assets/logo-mark.png", optimize=True)

    # Marketing site (web-landing)
    save(tile(160), "web-landing/src/assets/poolora-logo.webp", quality=90, method=6)
    save(full_bleed(180), "web-landing/public/apple-touch-icon.png", optimize=True)
    save(tile(32), "web-landing/public/favicon-32.png", optimize=True)
    tile(256).save(ROOT / "web-landing/public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("  web-landing/public/favicon.ico (16, 32, 48)")
    save(og_image(), "web-landing/public/og-image.jpg", quality=88)


if __name__ == "__main__":
    main()
