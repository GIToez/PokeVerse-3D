"""Builds the six Events-board images for a raid boss (ui/events/<slug>/{pc,celular}-{detalhe,destaque,miniatura}.webp) from a
transparent render (render.cjs), in the style of the Mew art: a two-colour gradient, a glowing ring behind the boss, sparkles and
thin gold lines. Usage: python3 tools/raid_art/compose.py render.png <slug> <#dark> <#mid> <#glow>"""
import sys, os, random, math
from PIL import Image, ImageDraw, ImageFilter, ImageChops

SIZES = {'pc-detalhe': (2249, 1417), 'pc-destaque': (2594, 550), 'pc-miniatura': (668, 216),
         'celular-detalhe': (1615, 727), 'celular-destaque': (1495, 336), 'celular-miniatura': (406, 148)}
hexc = lambda h: tuple(int(h.lstrip('#')[i:i + 2], 16) for i in (0, 2, 4))

def gradient(w, h, a, b, c):
    im = Image.new('RGB', (w, h))
    px = im.load()
    for x in range(w):
        t = x / max(1, w - 1)
        col = tuple(int(a[k] + (b[k] - a[k]) * min(1, t * 1.6)) for k in range(3)) if t < 0.62 else \
              tuple(int(b[k] + (c[k] - b[k]) * (t - 0.62) / 0.38 * 0.55) for k in range(3))
        for y in range(h):
            v = 1 - 0.18 * abs(y / max(1, h - 1) - 0.4)
            px[x, y] = tuple(int(q * v) for q in col)
    return im

def banner(boss, w, h, dark, mid, glow, seed=7):
    random.seed(seed)
    base = gradient(w, h, dark, mid, glow).convert('RGBA')
    s = min(w, h)
    cx, cy = int(w * (0.74 if w / h > 2.5 else 0.72)), int(h * 0.52)
    R = int(s * (0.46 if w / h < 2.5 else 0.44))
    halo = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(halo)
    d.ellipse([cx - R, cy - R, cx + R, cy + R], fill=glow + (70,))
    halo = halo.filter(ImageFilter.GaussianBlur(R * 0.35)); base = Image.alpha_composite(base, halo)
    ring = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(ring)
    lw = max(2, int(s * 0.012))
    d.ellipse([cx - R, cy - R, cx + R, cy + R], outline=(255, 255, 255, 220), width=lw)
    d.ellipse([cx - R * 1.08, cy - R * 1.08, cx + R * 1.08, cy + R * 1.08], outline=glow + (120,), width=max(1, lw // 2))
    base = Image.alpha_composite(base, ring.filter(ImageFilter.GaussianBlur(lw * 0.8)))
    base = Image.alpha_composite(base, ring)
    sp = Image.new('RGBA', (w, h), (0, 0, 0, 0)); d = ImageDraw.Draw(sp)
    for _ in range(int(w * h / 9000) + 12):
        x, y, r = random.randint(0, w), random.randint(0, h), random.choice([1, 1, 2, 2, 3]) * max(1, s // 300)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 255, 255, random.randint(90, 220)))
    for _ in range(5):
        x, y, r = random.randint(int(w * 0.45), w), random.randint(0, h), max(6, s // 28)
        d.polygon([(x, y - r), (x + r * .22, y - r * .22), (x + r, y), (x + r * .22, y + r * .22), (x, y + r), (x - r * .22, y + r * .22), (x - r, y), (x - r * .22, y - r * .22)], fill=(255, 255, 255, 230))
    base = Image.alpha_composite(base, sp)
    bb = boss.getbbox(); b = boss.crop(bb)
    k = (R * 2.25) / max(b.size); b = b.resize((max(1, int(b.width * k)), max(1, int(b.height * k))), Image.LANCZOS)
    pad = max(4, s // 20)
    sh = Image.new('RGBA', (b.width + 2 * pad, b.height + 2 * pad), glow + (0,))
    a = Image.new('L', sh.size, 0); a.paste(b.split()[3].point(lambda v: int(v * 0.55)), (pad, pad)); sh.putalpha(a)
    sh = sh.filter(ImageFilter.GaussianBlur(max(2, s // 60)))
    ox, oy = cx - b.width // 2 - pad, cy - b.height // 2 - pad
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0)); layer.paste(sh, (ox, oy)); base = Image.alpha_composite(base, layer)
    layer = Image.new('RGBA', (w, h), (0, 0, 0, 0)); layer.paste(b, (cx - b.width // 2, cy - b.height // 2), b); base = Image.alpha_composite(base, layer)
    if h > 300:
        d = ImageDraw.Draw(base); gold = (240, 200, 120, 230); m = int(h * 0.03); lw2 = max(2, h // 400)
        for y in (m, h - m):
            d.line([(int(w * .01), y), (int(w * .99), y)], fill=gold, width=lw2)
            r = max(8, h // 45); x = w // 2
            d.polygon([(x, y - r), (x + r * .3, y), (x, y + r), (x - r * .3, y)], fill=gold)
    mask = Image.new('L', (w, h), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, w - 1, h - 1], radius=max(6, s // 30), fill=255)
    base.putalpha(ImageChops.multiply(base.split()[3], mask))
    return base

if __name__ == '__main__':
    src, slug, dark, mid, glow = sys.argv[1:6]
    boss = Image.open(src).convert('RGBA')
    out = os.path.join(os.path.dirname(__file__), '..', '..', 'ui', 'events', slug); os.makedirs(out, exist_ok=True)
    for name, (w, h) in SIZES.items():
        banner(boss, w, h, hexc(dark), hexc(mid), hexc(glow)).save(os.path.join(out, name + '.webp'), quality=88)
        print('wrote', os.path.join('ui/events', slug, name + '.webp'))
