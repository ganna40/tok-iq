"""톡IQ OG thumbnail generator (1200x630)"""
import random
from PIL import Image, ImageDraw, ImageFont

W, H = 1200, 630

def _font(size):
    paths = ['C:/Windows/Fonts/malgunbd.ttf', 'C:/Windows/Fonts/malgun.ttf']
    for p in paths:
        try: return ImageFont.truetype(p, size)
        except: continue
    return ImageFont.load_default()

# Dark navy base
img = Image.new('RGBA', (W, H), (10, 14, 26, 255))
draw = ImageDraw.Draw(img)

# Glow effects
overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(overlay)
# Cyan glow top-center
for r in range(400, 0, -2):
    a = int(18 * (r / 400))
    od.ellipse([600-r, 100-r, 600+r, 100+r], fill=(0, 212, 255, a))
# Purple glow bottom-left
for r in range(350, 0, -2):
    a = int(15 * (r / 350))
    od.ellipse([200-r, 500-r, 200+r, 500+r], fill=(168, 85, 247, a))
# Gold glow right
for r in range(250, 0, -2):
    a = int(20 * (r / 250))
    od.ellipse([1000-r, 300-r, 1000+r, 300+r], fill=(251, 191, 36, a))
img = Image.alpha_composite(img, overlay)
draw = ImageDraw.Draw(img)

# Neuron dots
random.seed(42)
for _ in range(50):
    x, y = random.randint(0, W), random.randint(0, H)
    r = random.randint(1, 4)
    c = random.choice([(0, 212, 255, 30), (168, 85, 247, 30), (251, 191, 36, 25)])
    draw.ellipse([x-r, y-r, x+r, y+r], fill=c)
# Connection lines
for _ in range(15):
    x1, y1 = random.randint(0, W), random.randint(0, H)
    x2, y2 = x1 + random.randint(-200, 200), y1 + random.randint(-100, 100)
    draw.line([(x1, y1), (x2, y2)], fill=(0, 212, 255, 12), width=1)

# Brain icon (circle with text)
cx_brain, cy_brain = W // 2, 130
for r in range(55, 0, -1):
    a = int(180 * (r / 55))
    draw.ellipse([cx_brain-r, cy_brain-r, cx_brain+r, cy_brain+r], fill=(0, 212, 255, a))
draw.ellipse([cx_brain-40, cy_brain-40, cx_brain+40, cy_brain+40], fill=(0, 212, 255))
font_brain_text = _font(36)
draw.text((cx_brain, cy_brain), 'IQ', fill=(10, 14, 26), font=font_brain_text, anchor='mm')

# Title
font_title = _font(72)
draw.text((W//2, 265), '\ud1a1IQ', fill='white', font=font_title, anchor='mm')

# Subtitle
font_sub = _font(28)
draw.text((W//2, 340), '\uce74\uce74\uc624\ud1a1 \ub2e4\uc911\uc9c0\ub2a5 \ubd84\uc11d\uae30', fill=(0, 212, 255), font=font_sub, anchor='mm')

# Description
font_desc = _font(20)
draw.text((W//2, 395), '\ub2f9\uc2e0\uc758 \uce74\ud1a1 \ub300\ud654\ub85c \uce21\uc815\ud558\ub294 8\uac00\uc9c0 \ub2e4\uc911\uc9c0\ub2a5 IQ', fill=(148, 163, 184), font=font_desc, anchor='mm')

# 8 intelligence labels
labels = ['\uc5b8\uc5b4', '\ub17c\ub9ac', '\ub300\uc778', '\uc790\uae30', '\ub9ac\ub4ec', '\uacf5\uac04', '\uc790\uc5f0', '\uc2e4\uc874']
colors = [(168,85,247), (59,130,246), (244,63,94), (34,197,94), (245,158,11), (6,182,212), (132,204,22), (139,92,246)]
spacing = 120
start_x = W // 2 - (len(labels) - 1) * spacing // 2
font_label = _font(17)
for i, (label, color) in enumerate(zip(labels, colors)):
    lx = start_x + i * spacing
    # Small circle
    draw.ellipse([lx-14, 460-14, lx+14, 460+14], fill=(*color, 180))
    draw.text((lx, 460), label[0], fill='white', font=_font(14), anchor='mm')
    draw.text((lx, 490), label, fill=(*color, 200), font=font_label, anchor='mm')

# Bottom gradient bar
bar = Image.new('RGBA', (W, 3), (0, 0, 0, 0))
bd = ImageDraw.Draw(bar)
for x in range(W):
    t = x / W
    r = int(0 * (1 - t) + 168 * t)
    g = int(212 * (1 - t) + 85 * t)
    b = int(255 * (1 - t) + 247 * t)
    bd.line([(x, 0), (x, 2)], fill=(r, g, b, 180))
img.paste(bar, (0, H - 3), bar)

# Footer
font_tag = _font(13)
draw.text((W//2, 590), 'tok-iq.pearsoninsight.com', fill=(100, 116, 139), font=font_tag, anchor='mm')

# Save
img = img.convert('RGB')
img.save('og.png', 'PNG', optimize=True)
print(f'og.png created ({W}x{H})')
