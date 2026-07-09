"""
add_caption.py — text overlay on cover images (editorial domain example)
Elegant gradient + text guaranteed to stay inside the zone.
The output file is named after the title (slug) if out_path is a folder or "-".

Usage: python add_caption.py <img_url_or_path> <title> <subtitle> <out_path_or_dir> [left|right|bottom]

Examples:
  python add_caption.py img.jpg "Without these 3 files" "Subtitle" out/  left
    -> saves as out/without-these-3-files.jpg
  python add_caption.py img.jpg "Title" "Sub" out/custom-name.jpg  left
    -> saves as out/custom-name.jpg

Dependencies: pip install Pillow
"""
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageStat
import urllib.request, io, sys, os, re, unicodedata

img_src   = sys.argv[1]
title     = sys.argv[2]
subtitle  = sys.argv[3] if len(sys.argv) > 3 else ""
out_arg   = sys.argv[4]
zone_hint = sys.argv[5] if len(sys.argv) > 5 else "left"

# -- Slug from the title -> file name --------------------------------------------
def slugify(text):
    text = unicodedata.normalize("NFKD", text)
    text = text.encode("ascii", "ignore").decode("ascii")
    text = text.lower()
    text = re.sub(r"[^\w\s-]", "", text)
    text = re.sub(r"[\s_]+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return text

if out_arg in ("-", "") or out_arg.endswith("/") or out_arg.endswith("\\") or os.path.isdir(out_arg):
    slug     = slugify(title)
    out_path = os.path.join(out_arg.rstrip("/\\") if out_arg not in ("-", "") else ".", slug + ".jpg")
elif not os.path.splitext(out_arg)[1]:
    os.makedirs(out_arg, exist_ok=True)
    out_path = os.path.join(out_arg, slugify(title) + ".jpg")
else:
    out_path = out_arg

# -- Load image ----------------------------------------------------------
if img_src.startswith("http"):
    with urllib.request.urlopen(img_src) as r:
        img = Image.open(io.BytesIO(r.read())).convert("RGBA")
else:
    img = Image.open(img_src).convert("RGBA")
W, H = img.size

# -- Font helper ----------------------------------------------------------------
def get_font(size):
    for name in ["segoeuib.ttf", "arialbd.ttf", "arial.ttf", "DejaVuSans-Bold.ttf"]:
        for base in [r"C:\Windows\Fonts", "/usr/share/fonts/truetype/dejavu"]:
            p = os.path.join(base, name)
            if os.path.exists(p):
                return ImageFont.truetype(p, size)
    return ImageFont.load_default()

# -- Fixed text zone -----------------------------------------------------------
PAD = int(W * 0.025)

if zone_hint == "right":
    zone_x0, zone_x1 = int(W * 0.62), W - PAD
    zone_y0, zone_y1 = int(H * 0.48), int(H * 0.93)
    grad_x0, grad_x1 = zone_x0 - int(W * 0.08), W
elif zone_hint == "bottom":
    zone_x0, zone_x1 = PAD, W - PAD
    zone_y0, zone_y1 = int(H * 0.68), H - PAD
    grad_x0, grad_x1 = 0, W
else:  # left
    zone_x0, zone_x1 = PAD, int(W * 0.42)
    zone_y0, zone_y1 = int(H * 0.48), int(H * 0.93)
    grad_x0, grad_x1 = 0, int(W * 0.52)

zone_w = zone_x1 - zone_x0
zone_h = zone_y1 - zone_y0
IPAD     = int(W * 0.030)
IPAD_TOP = int(H * 0.020)

title_max_w    = zone_x1 - (zone_x0 + IPAD) - IPAD
subtitle_max_w = int(title_max_w * 0.86)

print(f"Output: {out_path}")
print(f"Zone: ({zone_x0},{zone_y0})-({zone_x1},{zone_y1}) | title_max_w={title_max_w}px")

# -- Elegant gradient -----------------------------------------------------------
grad_layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))

def draw_gradient_left(layer, x0, x1):
    gw      = x1 - x0
    solid_w = int(gw * 0.28)
    for x in range(gw):
        t     = max(0.0, (x - solid_w) / max(1, gw - solid_w))
        alpha = int(220 * (1 - t ** 1.6))
        alpha = max(0, min(255, alpha))
        prog  = x / gw
        col   = (int(6+2*prog), int(6+2*prog), int(26+22*prog), alpha)
        for y in range(H):
            layer.putpixel((x0 + x, y), col)

if zone_hint in ("left", "auto"):
    draw_gradient_left(grad_layer, grad_x0, grad_x1)
elif zone_hint == "right":
    tmp = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw_gradient_left(tmp, grad_x0, grad_x1)
    grad_layer = tmp.transpose(Image.FLIP_LEFT_RIGHT)

img = Image.alpha_composite(img, grad_layer)

# -- Wrapping and adaptive font size -------------------------------------------------
def wrap_text(text, font, max_px_w):
    dummy = ImageDraw.Draw(Image.new("RGBA", (1, 1)))
    words = text.upper().split()
    lines, cur = [], ""
    for w in words:
        test = (cur + " " + w).strip()
        if dummy.textbbox((0, 0), test, font=font)[2] > max_px_w:
            if cur: lines.append(cur)
            cur = w
        else:
            cur = test
    if cur: lines.append(cur)
    return lines

avail_h = zone_h - IPAD_TOP * 2

def fit_all(title_size):
    ft     = get_font(title_size)
    tlines = wrap_text(title, ft, title_max_w)
    if len(tlines) > 5: return None
    sub_size = max(22, int(title_size * 0.52))
    fs       = get_font(sub_size)
    slines   = wrap_text(subtitle, fs, subtitle_max_w) if subtitle else []
    lh, slh  = title_size + 8, sub_size + 6
    h        = lh * len(tlines) + (14 + slh * len(slines) if slines else 0)
    if h <= avail_h:
        return ft, tlines, fs, slines, lh, slh
    return None

best = None
for size in range(80, 22, -2):
    result = fit_all(size)
    if result:
        best = result
        break

if best is None:
    ft = get_font(24); fs = get_font(18)
    best = (ft, wrap_text(title, ft, title_max_w), fs,
            wrap_text(subtitle, fs, subtitle_max_w) if subtitle else [], 32, 24)

font_title, title_lines, font_sub, sub_lines, line_h, sub_line_h = best
print(f"Font: {font_title.size}px | title {len(title_lines)} lines | sub {len(sub_lines)} lines")

# -- Draw text ------------------------------------------------------------------
draw = ImageDraw.Draw(img)

def draw_outlined(draw, pos, text, font, fill=(255,255,255), outline=(0,0,0), ow=4):
    x, y = pos
    for dx in range(-ow, ow+1):
        for dy in range(-ow, ow+1):
            if dx or dy:
                draw.text((x+dx, y+dy), text, font=font, fill=outline)
    draw.text((x, y), text, font=font, fill=fill)

x_text, y = zone_x0 + IPAD, zone_y0 + IPAD_TOP
for line in title_lines:
    draw_outlined(draw, (x_text, y), line, font_title)
    y += line_h

if sub_lines:
    y += 12
    for line in sub_lines:
        draw_outlined(draw, (x_text, y), line, font_sub,
                      fill=(255, 200, 50), outline=(0, 0, 0), ow=3)
        y += sub_line_h

# Save as JPEG if the path ends in .jpg/.jpeg, PNG otherwise
ext = os.path.splitext(out_path)[1].lower()
fmt = "JPEG" if ext in (".jpg", ".jpeg") else "PNG"
os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
img.convert("RGB").save(out_path, fmt, quality=88 if fmt == "JPEG" else None, optimize=True)
print(f"Saved: {out_path} ({W}x{H}) [{fmt}]")
