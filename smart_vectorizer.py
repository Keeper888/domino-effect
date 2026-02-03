"""
Smart PNG to SVG Vectorizer
Combines color quantization with mathematical edge tracing

1. Quantize colors to reduce complexity
2. Find connected regions of each color
3. Trace contours mathematically
4. Simplify paths using Douglas-Peucker
5. Output true vector SVG with smooth paths
"""

import cv2
import numpy as np
from PIL import Image
from collections import defaultdict
import sys
import os

def rgb_to_hex(color):
    """Convert RGB tuple to hex string"""
    return f'#{color[0]:02x}{color[1]:02x}{color[2]:02x}'

def quantize_image(img, n_colors=32):
    """
    Reduce image to n_colors using K-means clustering
    Returns quantized image and color palette
    """
    # Reshape image to be a list of pixels
    pixels = img.reshape(-1, 3).astype(np.float32)

    # K-means clustering
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 100, 0.2)
    _, labels, centers = cv2.kmeans(pixels, n_colors, None, criteria, 10, cv2.KMEANS_PP_CENTERS)

    # Convert centers to uint8
    centers = np.uint8(centers)

    # Map pixels to their cluster centers
    quantized = centers[labels.flatten()]
    quantized = quantized.reshape(img.shape)

    return quantized, centers

def simplify_contour(contour, epsilon_factor=0.002):
    """
    Simplify contour using Douglas-Peucker algorithm
    Lower epsilon = more detail, higher = more simplification
    """
    epsilon = epsilon_factor * cv2.arcLength(contour, True)
    return cv2.approxPolyDP(contour, epsilon, True)

def contour_to_svg_path(contour, simplify=True, epsilon=0.002):
    """
    Convert OpenCV contour to SVG path string
    """
    if simplify:
        contour = simplify_contour(contour, epsilon)

    if len(contour) < 3:
        return None

    # Start path
    points = contour.reshape(-1, 2)
    path = f"M {points[0][0]} {points[0][1]}"

    # Add line segments
    for point in points[1:]:
        path += f" L {point[0]} {point[1]}"

    # Close path
    path += " Z"

    return path

def create_svg_header(width, height):
    """Create SVG header"""
    return f'''<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="{width}" height="{height}" viewBox="0 0 {width} {height}">
'''

def vectorize_image(input_path, output_path, n_colors=24, min_area=10, epsilon=0.001, max_size=500):
    """
    Main vectorization function

    Args:
        input_path: Path to input PNG
        output_path: Path for output SVG
        n_colors: Number of colors after quantization
        min_area: Minimum contour area to include
        epsilon: Simplification factor (lower = more detail)
        max_size: Max dimension (resizes if larger)
    """
    print(f"Loading: {input_path}")

    # Load image with alpha channel
    img_pil = Image.open(input_path).convert('RGBA')

    # Resize if needed
    w, h = img_pil.size
    if max(w, h) > max_size:
        ratio = max_size / max(w, h)
        new_w, new_h = int(w * ratio), int(h * ratio)
        img_pil = img_pil.resize((new_w, new_h), Image.LANCZOS)
        print(f"Resized: {w}x{h} -> {new_w}x{new_h}")
        w, h = new_w, new_h

    # Split into RGB and Alpha
    img_rgba = np.array(img_pil)
    img_rgb = img_rgba[:, :, :3]
    alpha = img_rgba[:, :, 3]

    # Convert to BGR for OpenCV
    img_bgr = cv2.cvtColor(img_rgb, cv2.COLOR_RGB2BGR)

    # Quantize colors
    print(f"Quantizing to {n_colors} colors...")
    quantized, palette = quantize_image(img_bgr, n_colors)

    # Start SVG
    svg_content = create_svg_header(w, h)

    # Add white background
    svg_content += f'  <rect width="{w}" height="{h}" fill="white"/>\n'

    # Process each color
    print("Tracing contours...")
    total_paths = 0

    for i, color in enumerate(palette):
        # Create mask for this color
        mask = cv2.inRange(quantized, color, color)

        # Apply alpha mask (ignore transparent areas)
        mask = cv2.bitwise_and(mask, mask, mask=alpha)

        # Find contours
        contours, hierarchy = cv2.findContours(mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)

        if not contours:
            continue

        # Convert BGR to RGB for SVG
        color_rgb = (int(color[2]), int(color[1]), int(color[0]))
        hex_color = rgb_to_hex(color_rgb)

        # Group paths by color
        paths = []

        for j, contour in enumerate(contours):
            area = cv2.contourArea(contour)
            if area < min_area:
                continue

            path_d = contour_to_svg_path(contour, simplify=True, epsilon=epsilon)
            if path_d:
                paths.append(path_d)
                total_paths += 1

        if paths:
            svg_content += f'  <g fill="{hex_color}">\n'
            for path in paths:
                svg_content += f'    <path d="{path}"/>\n'
            svg_content += '  </g>\n'

    svg_content += '</svg>'

    # Save SVG
    with open(output_path, 'w') as f:
        f.write(svg_content)

    # Report
    input_size = os.path.getsize(input_path) / 1024
    output_size = os.path.getsize(output_path) / 1024

    print(f"\n--- Results ---")
    print(f"Colors: {n_colors}")
    print(f"Total paths: {total_paths}")
    print(f"Input PNG: {input_size:.1f} KB")
    print(f"Output SVG: {output_size:.1f} KB")
    print(f"Saved: {output_path}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Smart PNG to SVG Vectorizer")
        print("-" * 40)
        print("Usage: python smart_vectorizer.py <input.png> [output.svg] [options]")
        print("\nOptions (in order):")
        print("  n_colors  : Number of colors (default: 24)")
        print("  min_area  : Min contour area in pixels (default: 10)")
        print("  epsilon   : Path simplification 0.0001-0.01 (default: 0.001)")
        print("  max_size  : Max dimension (default: 500)")
        print("\nExample:")
        print("  python smart_vectorizer.py image.png output.svg 32 5 0.002 600")
        sys.exit(1)

    input_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else input_path.replace('.png', '_vector.svg')
    n_colors = int(sys.argv[3]) if len(sys.argv) > 3 else 24
    min_area = int(sys.argv[4]) if len(sys.argv) > 4 else 10
    epsilon = float(sys.argv[5]) if len(sys.argv) > 5 else 0.001
    max_size = int(sys.argv[6]) if len(sys.argv) > 6 else 500

    vectorize_image(input_path, output_path, n_colors, min_area, epsilon, max_size)
