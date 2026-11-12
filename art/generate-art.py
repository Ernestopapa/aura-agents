#!/usr/bin/env python3
"""Generate 16 distinct pixel aura / mood agents (32x32 pixel grid, 8x scale = 256x256 PNG).
Deterministic (seeded per variant). No copied art: original pixel spirits,
each with its own palette, eye/mouth mood, halo shape and sparkles.
Variant of token N is (N-1) % 16. Files: art/aura-01.png .. art/aura-16.png
"""
import random
from PIL import Image, ImageDraw

# name, mood, body, glow, accent, eye style, mouth style
AURAS = [
    ("Ember",  "determined", (232, 90, 30),  (255, 170, 60),  (255, 220, 120), "sharp", "flat"),
    ("Tide",   "calm",       (40, 120, 220), (90, 190, 255),  (180, 230, 255), "soft",  "smile"),
    ("Bloom",  "joyful",     (235, 90, 160), (255, 150, 200), (255, 220, 240), "happy", "open"),
    ("Volt",   "excited",    (240, 200, 20), (255, 240, 100), (255, 255, 200), "wide",  "open"),
    ("Frost",  "serene",     (120, 200, 240), (200, 240, 255),(255, 255, 255), "soft",  "smile"),
    ("Shadow", "mysterious", (110, 70, 180), (170, 120, 255), (220, 180, 255), "sharp", "flat"),
    ("Solar",  "radiant",    (250, 170, 30), (255, 220, 90),  (255, 245, 180), "happy", "smile"),
    ("Moss",   "grounded",   (70, 170, 90),  (140, 230, 140), (200, 250, 190), "soft",  "smile"),
    ("Nova",   "bold",       (220, 40, 140), (255, 90, 200),  (255, 170, 230), "sharp", "open"),
    ("Mist",   "dreamy",     (150, 140, 190),(200, 190, 235), (240, 235, 255), "soft",  "flat"),
    ("Coral",  "playful",    (255, 110, 90), (255, 170, 130), (255, 220, 190), "happy", "open"),
    ("Abyss",  "thoughtful", (30, 60, 160),  (70, 120, 255),  (140, 180, 255), "soft",  "flat"),
    ("Honey",  "warm",       (220, 150, 40), (255, 200, 90),  (255, 235, 170), "happy", "smile"),
    ("Jade",   "balanced",   (20, 170, 150), (80, 230, 200),  (170, 250, 230), "soft",  "smile"),
    ("Crimson","fierce",     (200, 30, 50),  (255, 80, 90),   (255, 160, 160), "sharp", "flat"),
    ("Lunar",  "lunar",      (140, 130, 220),(190, 180, 255), (235, 230, 255), "soft",  "smile"),
]

GRID = 32
SCALE = 8
SIZE = GRID * SCALE
BG = (12, 12, 20)

def shade(c, f):
    return tuple(max(0, min(255, int(v * f))) for v in c)

def draw_aura(idx, name, mood, body, glow, accent, eyes, mouth):
    rng = random.Random(1000 + idx)
    img = Image.new("RGB", (SIZE, SIZE), BG)
    d = ImageDraw.Draw(img)
    def px(x, y, color):
        d.rectangle([x * SCALE, y * SCALE, (x + 1) * SCALE - 1, (y + 1) * SCALE - 1], fill=color)
    cx = 16
    # halo: concentric pixel rings around the spirit
    for r, col in [(13, shade(glow, 0.35)), (12, shade(glow, 0.55)), (11, shade(glow, 0.8))]:
        for x in range(GRID):
            for y in range(GRID):
                dist = ((x - cx + 0.5) ** 2 + (y - 15.5) ** 2) ** 0.5
                if abs(dist - r) < 0.7 and rng.random() < 0.85:
                    px(x, y, col)
    # body: pixel blob, rows widen then narrow
    widths = {7: 6, 8: 8, 9: 10, 10: 11, 11: 12, 12: 13, 13: 13, 14: 13, 15: 13,
              16: 13, 17: 13, 18: 12, 19: 12, 20: 11, 21: 10, 22: 9, 23: 8, 24: 6}
    for y, w in widths.items():
        x0 = cx - w // 2
        for x in range(x0, x0 + w):
            c = body
            if x in (x0, x0 + w - 1):
                c = shade(body, 0.7)
            if y in (7, 8):
                c = shade(body, 1.25)
            px(x, y, c)
    # belly glow
    for x in range(13, 19):
        for y in range(17, 21):
            if rng.random() < 0.7:
                px(x, y, shade(glow, 0.9))
    # eyes
    eye_y = 12
    if eyes == "sharp":
        for x in range(11, 14):
            px(x, eye_y, (10, 10, 14))
        for x in range(18, 21):
            px(x, eye_y, (10, 10, 14))
        px(10, eye_y - 1, (10, 10, 14)); px(21, eye_y - 1, (10, 10, 14))
    elif eyes == "wide":
        for x in (12, 13, 18, 19):
            for y in (eye_y, eye_y + 1):
                px(x, y, (10, 10, 14))
        px(13, eye_y, (255, 255, 255)); px(19, eye_y, (255, 255, 255))
    elif eyes == "happy":
        for x in range(11, 14):
            px(x, eye_y + 1, (10, 10, 14))
        px(11, eye_y, (10, 10, 14)); px(13, eye_y, (10, 10, 14))
        for x in range(18, 21):
            px(x, eye_y + 1, (10, 10, 14))
        px(18, eye_y, (10, 10, 14)); px(20, eye_y, (10, 10, 14))
    else:  # soft
        for x in (12, 13, 18, 19):
            px(x, eye_y, (10, 10, 14))
        px(12, eye_y, accent); px(18, eye_y, accent)
    # mouth
    if mouth == "smile":
        for x in range(14, 18):
            px(x, 16, (10, 10, 14))
        px(14, 15, (10, 10, 14)); px(17, 15, (10, 10, 14))
    elif mouth == "open":
        for x in range(14, 18):
            for y in (15, 16):
                px(x, y, (40, 10, 20))
    else:  # flat
        for x in range(14, 18):
            px(x, 16, (10, 10, 14))
    # sparkles around the halo
    for _ in range(14):
        x = rng.randint(2, 29); y = rng.randint(2, 29)
        if ((x - cx) ** 2 + (y - 15) ** 2) ** 0.5 > 13:
            px(x, y, accent)
    # ground shadow
    for x in range(11, 21):
        px(x, 26, shade(BG, 1.6))
    return img

if __name__ == "__main__":
    import os
    os.makedirs("art", exist_ok=True)
    for i, a in enumerate(AURAS, start=1):
        img = draw_aura(i, *a)
        img.save(f"art/aura-{i:02d}.png")
        print(f"aura-{i:02d}.png  {a[0]} ({a[1]})")
    print("16 aura images written to art/")
