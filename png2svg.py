"""
PNG to SVG Converter using color quantization and region detection
Creates optimized SVG with merged color regions instead of per-pixel rectangles
"""

from PIL import Image
import svgwrite
from collections import defaultdict
import sys
import os

def rgb_to_hex(r, g, b):
    return f'#{r:02x}{g:02x}{b:02x}'

def quantize_color(r, g, b, levels=32):
    """Reduce color precision to group similar colors"""
    step = 256 // levels
    r = (r // step) * step + step // 2
    g = (g // step) * step + step // 2
    b = (b // step) * step + step // 2
    return min(r, 255), min(g, 255), min(b, 255)

def png_to_svg_optimized(input_path, output_path, max_size=400, color_levels=24):
    """
    Convert PNG to SVG with color quantization and horizontal run-length encoding

    Args:
        input_path: Path to PNG file
        output_path: Path for SVG output
        max_size: Max dimension (will resize if larger)
        color_levels: Color quantization levels (fewer = smaller file, less detail)
    """
    # Load and resize image
    img = Image.open(input_path).convert('RGBA')

    # Resize if too large
    w, h = img.size
    if max(w, h) > max_size:
        ratio = max_size / max(w, h)
        new_w, new_h = int(w * ratio), int(h * ratio)
        img = img.resize((new_w, new_h), Image.LANCZOS)
        print(f"Resized from {w}x{h} to {new_w}x{new_h}")

    w, h = img.size
    pixels = img.load()

    # Create SVG
    dwg = svgwrite.Drawing(output_path, size=(w, h), profile='tiny')

    # Add white background
    dwg.add(dwg.rect(insert=(0, 0), size=(w, h), fill='white'))

    # Group pixels by quantized color using horizontal runs
    runs = []  # (x, y, width, color_hex)

    for y in range(h):
        x = 0
        while x < w:
            r, g, b, a = pixels[x, y]

            # Skip transparent pixels
            if a < 128:
                x += 1
                continue

            # Quantize color
            qr, qg, qb = quantize_color(r, g, b, color_levels)
            color_hex = rgb_to_hex(qr, qg, qb)

            # Find run length (consecutive pixels of same quantized color)
            run_start = x
            while x < w:
                r2, g2, b2, a2 = pixels[x, y]
                if a2 < 128:
                    break
                qr2, qg2, qb2 = quantize_color(r2, g2, b2, color_levels)
                if (qr2, qg2, qb2) != (qr, qg, qb):
                    break
                x += 1

            run_length = x - run_start
            runs.append((run_start, y, run_length, color_hex))

    print(f"Created {len(runs)} color runs")

    # Group runs by color for better SVG organization
    color_runs = defaultdict(list)
    for x, y, width, color in runs:
        color_runs[color].append((x, y, width))

    print(f"Unique colors: {len(color_runs)}")

    # Create SVG elements grouped by color
    for color, run_list in color_runs.items():
        group = dwg.g(fill=color)
        for x, y, width in run_list:
            group.add(dwg.rect(insert=(x, y), size=(width, 1)))
        dwg.add(group)

    dwg.save()

    # Report file sizes
    input_size = os.path.getsize(input_path) / 1024
    output_size = os.path.getsize(output_path) / 1024
    print(f"\nInput PNG: {input_size:.1f} KB")
    print(f"Output SVG: {output_size:.1f} KB")
    print(f"Saved to: {output_path}")

def png_to_svg_simple(input_path, output_path, scale=1):
    """
    Simple pixel-by-pixel conversion (for comparison)
    Warning: Creates large files!
    """
    img = Image.open(input_path).convert('RGBA')
    w, h = img.size
    pixels = img.load()

    dwg = svgwrite.Drawing(output_path, size=(w * scale, h * scale))

    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 128:
                color = rgb_to_hex(r, g, b)
                dwg.add(dwg.rect(
                    insert=(x * scale, y * scale),
                    size=(scale, scale),
                    fill=color
                ))

    dwg.save()
    print(f"Saved to: {output_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python png2svg.py <input.png> [output.svg] [max_size] [color_levels]")
        print("\nOptions:")
        print("  max_size: Maximum dimension (default: 400)")
        print("  color_levels: Color quantization 8-64 (default: 24, fewer=smaller)")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else input_path.replace('.png', '.svg')
    max_size = int(sys.argv[3]) if len(sys.argv) > 3 else 400
    color_levels = int(sys.argv[4]) if len(sys.argv) > 4 else 24

    print(f"Converting: {input_path}")
    print(f"Max size: {max_size}, Color levels: {color_levels}")

    png_to_svg_optimized(input_path, output_path, max_size, color_levels)
