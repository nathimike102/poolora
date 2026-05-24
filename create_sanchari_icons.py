#!/usr/bin/env python3
"""Generate Sanchari app icons for Android in multiple densities."""

import os
from PIL import Image, ImageDraw, ImageFont
import subprocess

# Icon sizes for different densities (in pixels)
DENSITIES = {
    'mdpi': 192,
    'hdpi': 288,
    'xhdpi': 384,
    'xxhdpi': 576,
    'xxxhdpi': 768,
}

# Sanchari brand colors
PRIMARY_COLOR = '#1F4D7B'  # Dark blue
ACCENT_COLOR = '#FF9500'   # Orange
TEXT_COLOR = '#FFFFFF'     # White

def create_sanchari_icon(size):
    """Create a Sanchari app icon at specified size."""
    # Create image with brand color background
    img = Image.new('RGB', (size, size), PRIMARY_COLOR)
    draw = ImageDraw.Draw(img)
    
    # Create a more polished design
    # Draw a gradient-like effect with circles
    orange_radius = int(size * 0.35)
    center = size // 2
    
    # Draw accent circle
    draw.ellipse(
        [center - orange_radius, center - orange_radius,
         center + orange_radius, center + orange_radius],
        fill=ACCENT_COLOR
    )
    
    # Draw white inner circle
    white_radius = int(size * 0.25)
    draw.ellipse(
        [center - white_radius, center - white_radius,
         center + white_radius, center + white_radius],
        fill=TEXT_COLOR
    )
    
    # Add text "S" in the center
    try:
        font_size = int(size * 0.5)
        # Try to use a available font, fall back to default
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", font_size)
        except:
            font = ImageFont.load_default()
        
        # Draw "S" text
        bbox = draw.textbbox((0, 0), "S", font=font)
        text_width = bbox[2] - bbox[0]
        text_height = bbox[3] - bbox[1]
        text_x = center - text_width // 2
        text_y = center - text_height // 2
        draw.text((text_x, text_y), "S", fill=PRIMARY_COLOR, font=font)
    except Exception as e:
        print(f"Warning: Could not draw text - {e}")
    
    return img

def convert_to_webp(img, quality=80):
    """Convert PIL image to WebP bytes."""
    # Convert RGBA if needed, PIL handles it
    if img.mode != 'RGB':
        img = img.convert('RGB')
    return img

def main():
    """Generate icons for all Android densities."""
    base_dir = '/home/ghost/Desktop/final_sanchari/frontend/android/app/src/main/res'
    
    for density, size in DENSITIES.items():
        print(f"Generating {density} icon ({size}x{size})...")
        
        # Create icon
        icon = create_sanchari_icon(size)
        
        # Create mipmap directory if needed
        mipmap_dir = os.path.join(base_dir, f'mipmap-{density}')
        os.makedirs(mipmap_dir, exist_ok=True)
        
        # Save as WebP
        icon_path = os.path.join(mipmap_dir, 'ic_launcher.webp')
        icon.save(icon_path, 'WebP', quality=95)
        print(f"  Saved: {icon_path}")
        
        # Save round variant
        round_icon = Image.new('RGBA', (size, size), (0, 0, 0, 0))
        draw = ImageDraw.Draw(round_icon)
        
        # Draw circular mask
        draw.ellipse([0, 0, size-1, size-1], fill=PRIMARY_COLOR)
        
        # Paste the icon in the center
        round_icon.paste(icon, (0, 0))
        round_icon_path = os.path.join(mipmap_dir, 'ic_launcher_round.webp')
        round_icon.save(round_icon_path, 'WebP', quality=95)
        print(f"  Saved: {round_icon_path}")
        
        # Save foreground variant
        icon.save(os.path.join(mipmap_dir, 'ic_launcher_foreground.webp'), 'WebP', quality=95)
    
    print("\n✓ Sanchari icons generated successfully!")
    print(f"Icons saved to: {base_dir}")

if __name__ == '__main__':
    main()
