"""Generate the app icons (PNG) without external libraries.

Draws a dorsal, nose-up mouse head with a notch in the right ear and a hole in
the left ear, matching the in-app diagram. Run from the project root:

    python3 scripts/make_icons.py
"""

import math
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(__file__), "..", "public", "icons")

BG = (24, 95, 165)  # #185FA5
EAR = (251, 234, 240)
EAR_EDGE = (114, 36, 62)
CONCHA = (240, 170, 194)
HEAD = (246, 245, 241)
HEAD_EDGE = (44, 44, 42)
EYE = (31, 30, 27)


def ellipse_r(x, y, cx, cy, rx, ry):
    return math.hypot((x - cx) / rx, (y - cy) / ry)


def head_r(x, y, cx=0.5, cy=0.56, rx=0.16, ry=0.27):
    # Teardrop: narrower toward the nose (top).
    t = min(1.0, max(0.0, (y - (cy - ry)) / (2 * ry)))
    w = rx * (0.35 + 0.65 * math.sqrt(t))
    return math.hypot((x - cx) / w, (y - cy) / ry)


def sample(x, y, rounded, bg_alpha):
    """Color at a point in unit coordinates; returns (r, g, b, a)."""
    # Rounded-square background (or full bleed for maskable icons).
    if rounded:
        m, rad = 0.0, 0.22
        dx = max(abs(x - 0.5) - (0.5 - rad), 0)
        dy = max(abs(y - 0.5) - (0.5 - rad), 0)
        if math.hypot(dx, dy) > rad:
            return (0, 0, 0, 0)
    color = BG + (bg_alpha,)

    # Cut-outs show the background colour.
    hole = math.hypot(x - 0.255, y - 0.55) < 0.042
    notch = math.hypot(x - 0.745, y - 0.355) < 0.05

    hr = head_r(x, y)
    if hr <= 1:
        color = (HEAD_EDGE if hr > 0.93 else HEAD) + (255,)
        for ex in (0.455, 0.545):
            if math.hypot(x - ex, y - 0.47) < 0.018:
                color = EYE + (255,)
        if math.hypot(x - 0.5, y - 0.305) < 0.016:
            color = HEAD_EDGE + (255,)

    for cx, cut in ((0.255, hole), (0.745, notch)):
        r = ellipse_r(x, y, cx, 0.55, 0.175, 0.2)
        if r <= 1 and not cut:
            if r > 0.92:
                color = EAR_EDGE + (255,)
            elif ellipse_r(x, y, cx + (0.012 if cx < 0.5 else -0.012), 0.565, 0.1, 0.12) <= 1:
                color = CONCHA + (255,)
            else:
                color = EAR + (255,)
    # Dark rim around the cut-outs so they read as punched marks.
    for px, py, pr in ((0.255, 0.55, 0.042), (0.745, 0.355, 0.05)):
        d = math.hypot(x - px, y - py)
        if pr <= d < pr + 0.012 and ellipse_r(x, y, px if px < 0.5 else 0.745, 0.55, 0.175, 0.2) <= 1:
            color = EAR_EDGE + (255,)
    return color


def render(size, rounded=True, content_scale=1.0, ss=3):
    rows = []
    for j in range(size):
        row = bytearray([0])
        for i in range(size):
            acc = [0, 0, 0, 0]
            for sj in range(ss):
                for si in range(ss):
                    u = (i + (si + 0.5) / ss) / size
                    v = (j + (sj + 0.5) / ss) / size
                    # Shrink the drawing toward the centre (maskable safe zone).
                    x = 0.5 + (u - 0.5) / content_scale
                    y = 0.5 + (v - 0.5) / content_scale
                    if rounded:
                        c = sample(x, y, True, 255) if 0 <= x <= 1 and 0 <= y <= 1 else (0, 0, 0, 0)
                        # Background shape uses unscaled coordinates.
                        if sample(u, v, True, 255)[3] == 0:
                            c = (0, 0, 0, 0)
                        elif c[3] == 0:
                            c = BG + (255,)
                    else:
                        c = sample(x, y, False, 255) if 0 <= x <= 1 and 0 <= y <= 1 else BG + (255,)
                    a = c[3]
                    acc[0] += c[0] * a
                    acc[1] += c[1] * a
                    acc[2] += c[2] * a
                    acc[3] += a
            n = ss * ss
            a = acc[3] / n
            if acc[3]:
                row += bytes((round(acc[0] / acc[3]), round(acc[1] / acc[3]), round(acc[2] / acc[3]), round(a)))
            else:
                row += bytes((0, 0, 0, 0))
        rows.append(bytes(row))
    return b"".join(rows)


def write_png(path, size, raw):
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    with open(path, "wb") as f:
        f.write(png)


def main():
    os.makedirs(OUT, exist_ok=True)
    jobs = [
        ("icon-192.png", 192, True, 0.92),
        ("icon-512.png", 512, True, 0.92),
        # Maskable: full-bleed background, drawing inside the 80% safe zone.
        ("maskable-512.png", 512, False, 0.72),
        # iOS home screen icon: no transparency, iOS rounds the corners itself.
        ("apple-touch-icon-180.png", 180, False, 0.86),
    ]
    for name, size, rounded, scale in jobs:
        write_png(os.path.join(OUT, name), size, render(size, rounded, scale))
        print("wrote", name)


if __name__ == "__main__":
    main()
