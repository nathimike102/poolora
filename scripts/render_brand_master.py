#!/usr/bin/env python3
"""Build branding/poolora-icon.png from branding/source/poolora-icon.svg.

Usage (from the repo root):
    pip install cairosvg pillow
    python3 scripts/render_brand_master.py
    python3 scripts/generate_brand_assets.py

SVG renderers do blur filters poorly, so the neon glow is done here: the
`glow` group is rendered alone, blurred at two radii and screened over the
background, then the sharp `art` group goes on top.
"""

import io
import re
from pathlib import Path

import cairosvg
from PIL import Image, ImageChops, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SVG = (ROOT / "branding" / "source" / "poolora-icon.svg").read_text()
SIZE = 1024
SCALE = 2  # render at 2x, then downsample for clean edges


def only(group: str) -> str:
    """The SVG with every top-level layer except `group` removed."""
    svg = SVG
    for other in ("background", "glow", "art"):
        if other != group:
            svg = re.sub(rf'<g id="{other}">.*?\n  </g>', "", svg, flags=re.S)
    return svg


def render(svg: str) -> Image.Image:
    px = SIZE * SCALE
    png = cairosvg.svg2png(bytestring=svg.encode(), output_width=px, output_height=px)
    return Image.open(io.BytesIO(png)).convert("RGBA")


def main() -> None:
    background = render(only("background"))
    glow = render(only("glow"))
    art = render(only("art"))

    wide = glow.filter(ImageFilter.GaussianBlur(28 * SCALE))
    tight = glow.filter(ImageFilter.GaussianBlur(9 * SCALE))
    out = background.convert("RGB")
    for layer, strength in ((wide, 1.0), (wide, 0.7), (tight, 1.0)):
        rgb = Image.new("RGB", layer.size, (0, 0, 0))
        rgb.paste(layer.convert("RGB"), mask=layer.getchannel("A"))
        if strength < 1:
            rgb = Image.eval(rgb, lambda v: int(v * strength))
        out = ImageChops.screen(out, rgb)
    out = out.convert("RGBA")
    out.alpha_composite(art)
    out = out.resize((SIZE, SIZE), Image.LANCZOS).convert("RGB")
    out.save(ROOT / "branding" / "poolora-icon.png", optimize=True)
    print("wrote branding/poolora-icon.png")


if __name__ == "__main__":
    main()
