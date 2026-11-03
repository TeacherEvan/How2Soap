#!/usr/bin/env python3
"""
How2Soap — cinematic intro splash generator.

Deterministic, code-rendered 1920x1080 @ 30fps, ~9s. No external assets.
Pipeline: PIL frames -> ffmpeg (h264 MP4 + VP9 WebM) -> poster PNG + analysis stills.

Usage:
    python3 make_splash.py            # render everything into ./out
    python3 make_splash.py --check    # ffprobe + size assertions only (after render)

Design tokens (mirror src/styles.css):
    --bg #0b0f12   --panel #12181d   --accent #e0a458 (amber)
    --accent-2 #5fb3a1 (teal lye)   --text #dce6ec   --muted #7f929f
"""
import argparse
import json
import math
import os
import random
import subprocess
import sys
import wave
import struct
from PIL import Image, ImageDraw, ImageFilter, ImageFont

W, H = 1920, 1080
FPS = 30
DURATION = 9.0
N_FRAMES = int(DURATION * FPS)
SEED = 1337

# ---------------------------------------------------------------- tokens
BG_TOP = (5, 7, 10)
BG_MID = (11, 15, 18)          # #0b0f12
BG_BOT = (18, 14, 10)
AMBER = (224, 164, 88)         # #e0a458
AMBER_HOT = (255, 214, 140)
DEEP_FIRE = (122, 44, 5)
MID_FIRE = (217, 95, 16)
HOT_CORE = (255, 196, 77)
TEAL = (95, 179, 161)          # #5fb3a1
CREAM = (232, 217, 184)
MUTED = (127, 146, 159)        # #7f929f
TEXT = (220, 230, 236)         # #dce6ec

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
FRAMES = os.path.join(OUT, 'frames')

SERIF_BOLD = '/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf'
SERIF_REG = '/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf'

# ---------------------------------------------------------------- helpers
def clamp(v, lo=0.0, hi=1.0):
    return max(lo, min(hi, v))

def ease(t):
    """smoothstep 0..1"""
    t = clamp(t)
    return t * t * (3 - 2 * t)

def band(t, a, b):
    """half-sine window in [a,b], 0 outside"""
    if t <= a or t >= b:
        return 0.0
    return math.sin(math.pi * (t - a) / (b - a))

def lerp(a, b, t):
    return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

def flicker(t, seed=0.0):
    """cheap organic flicker from layered sines, 0..1 around 0.5"""
    return (0.5 + 0.28 * math.sin(t * 7.3 + seed)
                + 0.16 * math.sin(t * 13.7 + 1.7 + seed * 2.1)
                + 0.06 * math.sin(t * 29.1 + 4.2 + seed * 3.7))

def heat_level(t):
    """crucible heat 0..1 across the timeline"""
    if t < 0.9:
        return clamp(0.10 + 0.25 * ease(t / 0.9))
    if t < 2.4:
        return clamp(0.35 + 0.65 * ease((t - 0.9) / 1.5))
    if t < 3.7:
        return clamp(1.0 - 0.15 * ease((t - 2.4) / 1.3))       # peak hold, slight sag
    if t < 5.2:
        return clamp(0.85 - 0.75 * ease((t - 3.7) / 1.5))      # fire subsiding to ash
    return 0.06

def wordmark_alpha(t):
    return ease((t - 6.25) / 0.95)

# ---------------------------------------------------------------- plate (computed once)
def build_plate():
    plate = Image.new('RGB', (W, H))
    px = plate.load()
    for y in range(H):
        fy = y / H
        if fy < 0.55:
            c = lerp(BG_TOP, BG_MID, ease(fy / 0.55))
        else:
            c = lerp(BG_MID, BG_BOT, ease((fy - 0.55) / 0.45))
        for x in range(0, W, 4):          # 4px steps then nearest-ish fill is too coarse; do full row via slice instead
            pass
        row = Image.new('RGB', (W, 1), c)
        plate.paste(row, (0, y))
    # warm heart glow behind crucible (half-res radial, upscaled)
    gw, gh = 480, 270
    glow = Image.new('RGB', (gw, gh), (0, 0, 0))
    gpx = glow.load()
    cx, cy, rx, ry = gw / 2, gh * 0.60, gw * 0.46, gh * 0.52
    for y in range(gh):
        for x in range(gw):
            d = math.sqrt(((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2)
            v = clamp(1 - d) ** 2.6
            gpx[x, y] = (int(70 * v), int(38 * v), int(12 * v))
    glow = glow.resize((W, H), Image.BILINEAR)
    plate = Image.blend(plate, Image.composite(
        Image.new('RGB', (W, H), (70, 38, 12)), plate, glow.convert('L')), 0.55)
    # teal wash for the soap reveal (separate plate, blended per-frame)
    return plate, glow

def build_teal_plate():
    teal = Image.new('RGB', (W, H), BG_MID)
    px = teal.load()
    for y in range(H):
        row_a = ease(y / H)
        c = lerp((7, 12, 15), (13, 26, 26), row_a)
        teal.paste(Image.new('RGB', (W, 1), c), (0, y))
    return teal

def build_vignette():
    vw, vh = 480, 270
    vig = Image.new('L', (vw, vh), 0)
    px = vig.load()
    cx, cy = vw / 2, vh / 2
    for y in range(vh):
        for x in range(vw):
            d = math.sqrt(((x - cx) / (vw * 0.62)) ** 2 + ((y - cy) / (vh * 0.62)) ** 2)
            px[x, y] = int(clamp((d - 0.55) * 1.65) * 150)
    return vig.resize((W, H), Image.BILINEAR)

_PLATE, _PLATE_GLOW = build_plate()
_TEAL = build_teal_plate()
_VIG = build_vignette()

# ---------------------------------------------------------------- embers
class EmberField:
    def __init__(self, seed):
        rng = random.Random(seed)
        self.embers = []
        for _ in range(110):
            self.embers.append({
                'x': rng.uniform(0.18, 0.82) * W,
                'speed': rng.uniform(95, 235),        # px/s upward
                'phase': rng.uniform(0, math.tau),
                'drift': rng.uniform(14, 46),
                'size': rng.uniform(1.4, 4.6),
                'hue': rng.uniform(0, 1),
                'off': rng.uniform(0, H + 300),
                'tw': rng.uniform(3.5, 9.0),
            })
        self.motes = []
        for _ in range(46):
            self.motes.append({
                'x': rng.uniform(0.05, 0.95) * W,
                'speed': rng.uniform(28, 70),
                'phase': rng.uniform(0, math.tau),
                'size': rng.uniform(0.8, 2.0),
                'off': rng.uniform(0, H + 300),
            })

    def draw(self, glow_layer, t, intensity=1.0):
        d = ImageDraw.Draw(glow_layer)
        for e in self.embers:
            y = H + 40 - ((t * e['speed'] + e['off']) % (H + 260))
            x = e['x'] + math.sin(t * 0.9 + e['phase']) * e['drift']
            tw = 0.55 + 0.45 * math.sin(t * e['tw'] + e['phase'] * 3)
            a = clamp(tw) * clamp((y / H) ** -0.25 if y > 0 else 0) * intensity
            if a <= 0.03:
                continue
            col = lerp((255, 176, 60), (255, 110, 28), e['hue'])
            s = e['size']
            d.ellipse([x - s, y - s, x + s, y + s],
                      fill=(col[0], col[1], col[2], int(255 * clamp(a))))
        for m in self.motes:
            y = H + 30 - ((t * m['speed'] + m['off']) % (H + 240))
            x = m['x'] + math.sin(t * 0.6 + m['phase']) * 30
            d.ellipse([x - m['size'], y - m['size'], x + m['size'], y + m['size']],
                      fill=(150, 150, 146, 60))

_EMBERS = EmberField(SEED)

# ---------------------------------------------------------------- crucible drawing
CX, RIM_Y, RIM_RX, RIM_RY = 960, 566, 236, 34
BASE_Y = 786

def crucible_body_points():
    pts = []
    steps = 26
    for i in range(steps + 1):                    # left wall: rim -> base
        t = i / steps
        y = RIM_Y + t * (BASE_Y - RIM_Y)
        half = RIM_RX + (118 - RIM_RX) * (t ** 1.55)
        sway = 26 * math.sin(t * math.pi)         # belly curve
        pts.append((CX - half - sway * 0.28, y))
    for i in range(steps, -1, -1):                # right wall mirrored
        t = i / steps
        y = RIM_Y + t * (BASE_Y - RIM_Y)
        half = RIM_RX + (118 - RIM_RX) * (t ** 1.55)
        sway = 26 * math.sin(t * math.pi)
        pts.append((CX + half + sway * 0.28, y))
    return pts

_BODY_PTS = crucible_body_points()

def draw_crucible(img, t, heat, glow_gain=1.0):
    """heat 0..1 drives molten colour, wall light and bloom."""
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)

    # ---- molten bloom behind/around the rim (quarter-res, then upscaled)
    bl = Image.new('RGBA', (W // 4, H // 4), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bl)
    bcx, brx = CX // 4, int(RIM_RX * 1.55) // 4
    bri = int(150 * heat * glow_gain)
    if bri > 4:
        core = lerp(DEEP_FIRE, HOT_CORE, heat ** 1.6)
        bd.ellipse([bcx - brx, (RIM_Y - 30) // 4 - 26, bcx + brx, (RIM_Y + 46) // 4 + 26],
                   fill=(core[0], core[1], core[2], bri))
    bl = bl.resize((W, H), Image.BILINEAR).filter(ImageFilter.GaussianBlur(46))
    img.alpha_composite(bl)

    # ---- body silhouette
    d.polygon(_BODY_PTS, fill=(22, 26, 31, 255))
    # wall shading: left warm kiss, right cool falloff
    shade = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    sd.polygon(_BODY_PTS, fill=(0, 0, 0, 0))
    warm = int(120 * heat)
    if warm > 6:
        sd.polygon(_BODY_PTS, fill=(warm, int(warm * 0.52), int(warm * 0.14), 92))
        shade = shade.filter(ImageFilter.GaussianBlur(60))
        layer.alpha_composite(shade)
    # rim arc highlight
    d.arc([CX - RIM_RX, RIM_Y - RIM_RY, CX + RIM_RX, RIM_Y + RIM_RY],
          start=195, end=345, fill=(90, 78, 60, 255), width=5)
    rim_a = int(120 + 135 * heat * flicker(t, 3.1))
    d.arc([CX - RIM_RX, RIM_Y - RIM_RY, CX + RIM_RX, RIM_Y + RIM_RY],
          start=205, end=335, fill=(255, 208, 130, int(clamp(rim_a / 255) * 255)), width=3)
    # base foot
    d.ellipse([CX - 128, BASE_Y - 12, CX + 128, BASE_Y + 22], fill=(15, 18, 22, 255))

    # ---- molten surface
    mel_col = lerp((28, 10, 4), lerp(MID_FIRE, HOT_CORE, clamp(heat * 1.15 - 0.35)), clamp(heat ** 1.35))
    flick = 1 + 0.16 * (flicker(t, 7.7) - 0.5) * 2
    mel_col = tuple(int(clamp(c * flick, 0, 255)) for c in mel_col)
    d.ellipse([CX - RIM_RX + 16, RIM_Y - RIM_RY + 6, CX + RIM_RX - 16, RIM_Y + RIM_RY - 4],
              fill=mel_col + (255,))
    # hot specular blobs drifting inside the melt
    for i, (spd, ph, rr) in enumerate(((0.9, 0.0, 34), (0.7, 2.1, 22), (1.2, 4.4, 15))):
        bx = CX + math.sin(t * spd + ph) * 92
        by = RIM_Y + math.sin(t * spd * 1.7 + ph + 1.0) * 7
        blob = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        bd2 = ImageDraw.Draw(blob)
        hot = (255, 224, 150, int(190 * heat))
        bd2.ellipse([bx - rr, by - rr * 0.35, bx + rr, by + rr * 0.35], fill=hot)
        blob = blob.filter(ImageFilter.GaussianBlur(12))
        layer.alpha_composite(blob)

    img.alpha_composite(layer)

def draw_ash(img, t):
    """grey crust settles over the melt between 4.35s and 5.5s"""
    a = ease((t - 4.35) / 1.05)
    if a <= 0:
        return
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    base = (96, 93, 87)
    hi = (150, 147, 140)
    d.ellipse([CX - RIM_RX + 16, RIM_Y - RIM_RY + 6, CX + RIM_RX - 16, RIM_Y + RIM_RY - 4],
              fill=base + (int(235 * a),))
    rng = random.Random(99)
    for _ in range(90):
        px = CX + rng.uniform(-1, 1) * (RIM_RX - 30)
        py = RIM_Y + rng.uniform(-1, 1) * (RIM_RY - 10)
        s = rng.uniform(1.5, 5.5)
        shade = hi if rng.random() < 0.45 else (62, 60, 56)
        d.ellipse([px - s, py - s * 0.6, px + s, py + s * 0.6], fill=shade + (int(200 * a),))
    img.alpha_composite(layer)

def draw_droplet(img, t):
    """single lye droplet falls 5.02s -> 5.34s, flash on landing"""
    t0, t1 = 5.02, 5.34
    impact_t = t1 + 0.02
    if t0 < t < t1:
        p = (t - t0) / (t1 - t0)
        y = 340 + (RIM_Y - 18 - 340) * p * p
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        d.ellipse([CX - 7, y - 13, CX + 7, y + 13], fill=(188, 233, 224, 235))
        d.ellipse([CX - 3, y - 7, CX + 1, y + 3], fill=(240, 255, 250, 220))
        layer = layer.filter(ImageFilter.GaussianBlur(1.2))
        img.alpha_composite(layer)
        glow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        gd.ellipse([CX - 14, y - 18, CX + 14, y + 18], fill=(95, 179, 161, 120))
        glow = glow.filter(ImageFilter.GaussianBlur(10))
        img.alpha_composite(glow)
    elif impact_t <= t < impact_t + 0.38:
        p = (t - impact_t) / 0.38
        r = 14 + 150 * ease(p)
        a = int(210 * (1 - p))
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        d.ellipse([CX - r, RIM_Y - r * 0.32, CX + r, RIM_Y + r * 0.32],
                  outline=(150, 220, 208, a), width=4)
        img.alpha_composite(layer.filter(ImageFilter.GaussianBlur(2)))

def draw_lye_vapor(img, t):
    """teal wisps curl upward from 3.1s to 6.2s"""
    a = band(t, 3.1, 6.3) * 0.8
    if a <= 0.01:
        return
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rng_t = t * 1.6
    for i in range(5):
        off = (i - 2) * 74
        rise = ((t * 92 + i * 53) % 300)
        yb = RIM_Y - 14 - rise
        xo = off + 26 * math.sin(rng_t * 1.7 + i * 1.9)
        seg_a = int(95 * a * clamp(1 - rise / 320))
        if seg_a <= 4:
            continue
        for j in range(6):
            yy = yb - j * 34
            xx = xo + math.sin(rng_t * 2.1 + j * 0.9 + i * 2.3) * 22
            rr = 17 + j * 12
            shade = (95, 179, 161, max(0, seg_a - j * 12))
            d.ellipse([xx - rr, yy - rr, xx + rr, yy + rr], fill=shade)
    layer = layer.filter(ImageFilter.GaussianBlur(16))
    img.alpha_composite(layer)

# ---------------------------------------------------------------- soap bar
SOAP_CX, SOAP_CY = 960, 397
SOAP_W, SOAP_H, SOAP_R = 560, 212, 46

def soap_alpha(t):
    return ease((t - 5.45) / 0.9)   # persists until the global fade to black

def draw_soap(img, t):
    a = soap_alpha(t)
    if a <= 0:
        return
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))

    x0, y0 = SOAP_CX - SOAP_W // 2, SOAP_CY - SOAP_H // 2
    x1, y1 = SOAP_CX + SOAP_W // 2, SOAP_CY + SOAP_H // 2

    # body: single vertical gradient masked by the rounded-rect outline
    grad = Image.new('RGBA', (SOAP_W, SOAP_H))
    gd = ImageDraw.Draw(grad)
    for i in range(SOAP_H):
        fy = i / (SOAP_H - 1)
        col = lerp((247, 238, 213), (175, 157, 121), fy ** 1.45)
        gd.line([(0, i), (SOAP_W, i)], fill=col + (255,))
    mask = Image.new('L', (SOAP_W, SOAP_H), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, SOAP_W - 1, SOAP_H - 1], radius=SOAP_R, fill=255)
    layer.paste(grad, (x0, y0), mask)

    d = ImageDraw.Draw(layer)
    # outline + soft top bevel light
    d.rounded_rectangle([x0, y0, x1, y1], radius=SOAP_R, outline=(96, 84, 60, 255), width=3)
    bevel = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    bd = ImageDraw.Draw(bevel)
    bd.rounded_rectangle([x0 + 8, y0 + 7, x1 - 8, y0 + 26], radius=SOAP_R * 0.6,
                         fill=(252, 246, 226, 95))
    bevel = bevel.filter(ImageFilter.GaussianBlur(6))
    layer.alpha_composite(bevel)

    # embossed droplet inside a rounded-square cartouche
    ecx, ecy, er = SOAP_CX, SOAP_CY, 62
    d.rounded_rectangle([ecx - er, ecy - er, ecx + er, ecy + er], radius=22,
                        outline=(150, 132, 100, 235), width=5)
    dark = (158, 140, 104, 235)
    lite = (238, 229, 202, 200)
    d.polygon([(ecx, ecy - 36), (ecx + 19, ecy + 6), (ecx - 19, ecy + 6)], fill=dark)
    d.ellipse([ecx - 19, ecy - 6, ecx + 19, ecy + 28], fill=dark)
    d.polygon([(ecx, ecy - 27), (ecx + 11, ecy + 5), (ecx - 11, ecy + 5)], fill=lite)
    d.ellipse([ecx - 11, ecy + 1, ecx + 11, ecy + 21], fill=lite)

    # travelling specular sweep 5.7s -> 6.65s, clipped to the bar
    sp = (t - 5.7) / 0.95
    if 0 < sp < 1:
        sweep = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        sd = ImageDraw.Draw(sweep)
        band_x = -320 + sp * (W + 640)
        bw = 120
        sd.polygon([(band_x - bw, 0), (band_x + bw, 0), (band_x + bw - 260, H), (band_x - bw - 260, H)],
                   fill=(255, 250, 230, 110))
        sweep = sweep.filter(ImageFilter.GaussianBlur(34))
        clip = Image.new('L', (W, H), 0)
        ImageDraw.Draw(clip).rounded_rectangle([x0, y0, x1, y1], radius=SOAP_R, fill=255)
        zero = Image.new('L', (W, H), 0)
        sweep.putalpha(Image.composite(sweep.getchannel('A'), zero, clip))
        layer.alpha_composite(sweep)

    # slab shadow beneath the bar
    shadow = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    shd = ImageDraw.Draw(shadow)
    shd.ellipse([x0 + 40, y1 + 6, x1 - 40, y1 + 44], fill=(0, 0, 0, 150))
    shadow = shadow.filter(ImageFilter.GaussianBlur(16))
    out = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    out.alpha_composite(shadow)
    out.alpha_composite(layer)

    if a < 1:
        r, g, b, al = out.split()
        al = al.point(lambda v: int(v * a))
        out.putalpha(al)
    img.alpha_composite(out)

# ---------------------------------------------------------------- text
_font_cache = {}
def font(path, size):
    key = (path, size)
    if key not in _font_cache:
        _font_cache[key] = ImageFont.truetype(path, size)
    return _font_cache[key]

def draw_tracked_text(img, text, cx, y, size, fill, tracking, alpha, font_path=SERIF_REG):
    if alpha <= 0:
        return
    f = font(font_path, size)
    scratch = ImageDraw.Draw(Image.new('RGBA', (8, 8)))
    widths = [scratch.textlength(ch, font=f) for ch in text]
    total = sum(widths) + tracking * (len(text) - 1)
    x = cx - total / 2
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    a = int(255 * clamp(alpha))
    for ch, w in zip(text, widths):
        d.text((x, y), ch, font=f, fill=fill + (a,))
        x += w + tracking
    img.alpha_composite(layer)

def draw_simple_text(img, text, cx, y, size, fill, alpha, font_path=SERIF_REG):
    if alpha <= 0:
        return
    f = font(font_path, size)
    scratch = ImageDraw.Draw(Image.new('RGBA', (8, 8)))
    w = scratch.textlength(text, font=f)
    layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.text((cx - w / 2, y), text, font=f, fill=fill + (int(255 * clamp(alpha)),))
    img.alpha_composite(layer)

# ---------------------------------------------------------------- frame assembly
def render_frame(t):
    soap_t = ease((t - 5.45) / 1.0)      # 0 warm crucible world -> 1 soap world
    # base: crossfade warm plate to teal plate
    if soap_t <= 0:
        img = _PLATE.copy().convert('RGBA')
    else:
        img = Image.blend(_PLATE, _TEAL, soap_t).convert('RGBA')

    heat = heat_level(t)
    if soap_t < 1:
        # crucible world fades out during soap transition
        cw_alpha = 1 - ease((t - 5.45) / 0.85)
        if cw_alpha > 0.01:
            world = Image.new('RGBA', (W, H), (0, 0, 0, 0))
            draw_crucible(world, t, heat)
            draw_ash(world, t)
            draw_droplet(world, t)
            draw_lye_vapor(world, t)
            if cw_alpha < 1:
                r, g, b, a = world.split()
                a = a.point(lambda v: int(v * cw_alpha))
                world.putalpha(a)
            img.alpha_composite(world)
            del world

    draw_soap(img, t)

    # embers + motes throughout (nice continuity behind text too)
    ember_layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    _EMBERS.draw(ember_layer, t, intensity=1.0 - 0.55 * soap_t)
    ember_layer = ember_layer.filter(ImageFilter.GaussianBlur(1.6))
    img.alpha_composite(ember_layer)
    spark_glow = ember_layer.filter(ImageFilter.GaussianBlur(6))
    img.alpha_composite(spark_glow)

    # half-res bloom for heat
    if heat > 0.12 and soap_t < 0.9:
        bl = Image.new('RGBA', (W // 2, H // 2), (0, 0, 0, 0))
        bd = ImageDraw.Draw(bl)
        br = int(230 * heat)
        bc = lerp((120, 40, 6), (255, 160, 60), heat)
        bd.ellipse([(CX - 330) // 2, (RIM_Y - 190) // 2, (CX + 330) // 2, (RIM_Y + 130) // 2],
                   fill=bc + (br,))
        bl = bl.resize((W, H), Image.BILINEAR).filter(ImageFilter.GaussianBlur(60))
        r, g, b, a = bl.split()
        a = a.point(lambda v: int(v * (1 - soap_t) * 0.75))
        bl.putalpha(a)
        img.alpha_composite(bl)

    # gold rule between soap and wordmark
    rule_a = ease((t - 6.55) / 0.55)
    if rule_a > 0:
        rule_w = int(300 * ease((t - 6.55) / 0.75))
        layer = Image.new('RGBA', (W, H), (0, 0, 0, 0))
        d = ImageDraw.Draw(layer)
        d.rectangle([CX - rule_w, 706, CX + rule_w, 709], fill=AMBER + (int(225 * rule_a),))
        d.rectangle([CX - rule_w, 706, CX + rule_w, 707], fill=AMBER_HOT + (int(140 * rule_a),))
        img.alpha_composite(layer)

    # wordmark — tracks in
    wm_a = wordmark_alpha(t)
    if wm_a > 0:
        tracking = 38 - 26 * ease((t - 6.25) / 1.15)
        rise = int(16 * (1 - ease((t - 6.25) / 1.1)))
        draw_tracked_text(img, 'How2Soap', CX, 730 + rise, 118, AMBER, tracking, wm_a, SERIF_BOLD)

    # tagline
    tag_a = ease((t - 6.95) / 0.7)
    if tag_a > 0:
        draw_tracked_text(img, 'FIRE · ASH · LYE · SOAP', CX, 884, 30, (201, 194, 180), 9.5, tag_a, SERIF_REG)

    # footer
    foot_a = ease((t - 7.45) / 0.65)
    if foot_a > 0:
        draw_tracked_text(img, 'AN EMERGENT CHEMISTRY SURVIVAL', CX, 940, 17, MUTED, 6.0, foot_a * 0.9, SERIF_REG)

    # grade: vignette + global fade to black at the end
    black = Image.new('RGBA', (W, H), (0, 0, 0, 255))
    img = Image.composite(black, img, _VIG)
    fade_out = ease((t - 8.55) / 0.45)
    if fade_out > 0:
        img = Image.blend(img, Image.new('RGBA', (W, H), (0, 0, 0, 255)), fade_out)
    return img.convert('RGB')

# ---------------------------------------------------------------- audio
def synth_audio(path):
    sr = 48000
    nsamp = int(DURATION * sr)
    rng = random.Random(20240607)
    # pre-render one-pole lowpassed noise for fire bed
    noise = [rng.uniform(-1, 1) for _ in range(nsamp)]
    lp = 0.0
    alpha = 0.055
    bed = []
    for i, n in enumerate(noise):
        lp += alpha * (n - lp)
        bed.append(lp)
    # sparse crackle impulses
    crackle = [0.0] * nsamp
    i = 0
    while i < nsamp:
        i += int(rng.expovariate(1 / (sr * 0.09)))  # avg one crackle / 90ms
        if i < nsamp:
            amp = rng.uniform(0.35, 1.0)
            decay = rng.uniform(0.008, 0.03)
            for j in range(int(decay * sr)):
                if i + j < nsamp:
                    crackle[i + j] += amp * math.exp(-j / (decay * sr / 3.2)) * (1 if rng.random() > 0.22 else -1)
    out = []
    for i in range(nsamp):
        t = i / sr
        # sub-bass swell 0..2.6s then settle
        sub_env = (t / 2.6) ** 2 if t < 2.6 else max(0.0, 1 - (t - 2.6) / 1.4)
        sub = math.sin(2 * math.pi * 55 * t) * 0.30 * sub_env
        # deep ember rumble continues
        rumble = math.sin(2 * math.pi * 41 * t) * 0.10 * clamp(1 - t / DURATION)
        # fire bed: strong 0..4s, then embers dying to low murmur
        fire_env = 0.55 if t < 3.4 else max(0.16, 0.55 - 0.36 * (t - 3.4))
        fire = bed[i] * 1.35 * fire_env + crackle[i] * 0.5 * fire_env
        # droplet impact thunk at ~5.36s
        thunk = 0.0
        dt_imp = t - 5.36
        if 0 <= dt_imp < 0.5:
            thunk = math.sin(2 * math.pi * 62 * dt_imp) * math.exp(-7.5 * dt_imp) * 0.42
        # pad after soap reveal: 110 + 165Hz with tremolo
        pad = 0.0
        if t > 5.1:
            pad_env = ease((t - 5.1) / 0.9) * (1 - ease((t - 8.35) / 1.05))
            trem = 1 + 0.32 * math.sin(2 * math.pi * 0.35 * t)
            pad = (math.sin(2 * math.pi * 110 * t) * 0.16 +
                   math.sin(2 * math.pi * 165 * t) * 0.10 +
                   math.sin(2 * math.pi * 220 * t) * 0.05) * pad_env * trem
        # wordmark chime at 6.35s
        chime = 0.0
        dt_ch = t - 6.35
        if 0 <= dt_ch < 2.2:
            chime = (math.sin(2 * math.pi * 880 * dt_ch) * 0.16 +
                     math.sin(2 * math.pi * 1320 * dt_ch) * 0.085 +
                     math.sin(2 * math.pi * 1760 * dt_ch) * 0.04) * math.exp(-1.9 * dt_ch)
        s = sub + rumble + fire + thunk + pad + chime
        # global fade in/out
        s *= ease(t / 0.22) * (1 - ease((t - 8.5) / 0.5))
        out.append(s)
    peak = max(abs(s) for s in out) or 1.0
    gain = 0.30 / peak
    with wave.open(path, 'wb') as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(sr)
        frames = b''.join(struct.pack('<h', int(clamp(s * gain, -1, 1) * 32767)) for s in out)
        wf.writeframes(frames)
    return path

# ---------------------------------------------------------------- main
def render(from_frame=0):
    os.makedirs(FRAMES, exist_ok=True)
    analysis_frames = {12, 66, 116, 160, 195, 220, 255}
    for i in range(from_frame, N_FRAMES):
        t = (i + 0.5) / FPS
        img = render_frame(t)
        img.save(os.path.join(FRAMES, f'f{i:04d}.png'), optimize=False)
        if i in analysis_frames:
            img.save(os.path.join(OUT, f'analysis_f{i:04d}.png'))
        if i % 30 == 0:
            print(f'  frame {i}/{N_FRAMES}', flush=True)
    # poster = frame the moment the wordmark has fully landed
    Image.open(os.path.join(FRAMES, 'f0231.png')).save(os.path.join(OUT, 'poster.png'))

def encode():
    wav = os.path.join(OUT, 'intro.wav')
    synth_audio(wav)
    mp4 = os.path.join(OUT, 'how2soap-intro.mp4')
    webm = os.path.join(OUT, 'how2soap-intro.webm')
    subprocess.run(['ffmpeg', '-y', '-framerate', str(FPS), '-i', os.path.join(FRAMES, 'f%04d.png'),
                    '-i', wav,
                    '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p',
                    '-movflags', '+faststart', '-c:a', 'aac', '-b:a', '160k', '-shortest', mp4],
                   check=True, capture_output=True)
    subprocess.run(['ffmpeg', '-y', '-framerate', str(FPS), '-i', os.path.join(FRAMES, 'f%04d.png'),
                    '-i', wav,
                    '-c:v', 'libvpx-vp9', '-crf', '36', '-b:v', '0', '-row-mt', '1', '-cpu-used', '4',
                    '-c:a', 'libopus', '-b:a', '96k', '-shortest', webm],
                   check=True, capture_output=True)
    return mp4, webm

def check():
    ok = True
    for f in ('how2soap-intro.mp4', 'how2soap-intro.webm'):
        p = os.path.join(OUT, f)
        if not os.path.exists(p):
            print(f'MISSING {p}')
            ok = False
            continue
        size_mb = os.path.getsize(p) / 1e6
        probe = subprocess.run(['ffprobe', '-v', 'error', '-show_entries',
                                'format=duration:stream=codec_name,width,height,r_frame_rate',
                                '-of', 'json', p], capture_output=True, text=True).stdout
        data = json.loads(probe)
        dur = float(data['format']['duration'])
        stream = data['streams'][0]
        good = 6.5 <= dur <= 10.5 and size_mb < 3.0
        print(f'{f}: {size_mb:.2f} MB, {dur:.2f}s, {stream["codec_name"]} {stream.get("width")}x{stream.get("height")} {stream.get("r_frame_rate")}  {"OK" if good else "FAIL"}')
        ok = ok and good
    sys.exit(0 if ok else 1)

if __name__ == '__main__':
    ap = argparse.ArgumentParser()
    ap.add_argument('--check', action='store_true')
    ap.add_argument('--frames-only', action='store_true')
    ap.add_argument('--from-frame', type=int, default=0)
    args = ap.parse_args()
    if args.check:
        check()
        sys.exit(0)
    print('rendering frames…')
    render(args.from_frame)
    if args.frames_only:
        sys.exit(0)
    print('synthesizing audio + encoding…')
    encode()
    print('done ->', OUT)
