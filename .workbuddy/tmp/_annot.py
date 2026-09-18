# -*- coding: utf-8 -*-
"""「本轮修复对照」图（干净版）。"""
import os
from PIL import Image, ImageDraw, ImageFont

S = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shots"
OUT = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/本轮修复对照.png"
def F(sz, bold=False):
    p = r"C:/Windows/Fonts/msyhbd.ttc" if bold else r"C:/Windows/Fonts/msyh.ttc"
    try: return ImageFont.truetype(p, sz)
    except Exception: return ImageFont.load_default()

def wrap(d, txt, font, maxw):
    lines, cur = [], ""
    for ch in txt:
        if ch == "\n":
            lines.append(cur); cur = ""; continue
        if d.textlength(cur + ch, font=font) > maxw:
            lines.append(cur); cur = ch
        else:
            cur += ch
    if cur: lines.append(cur)
    return lines

L = Image.open(os.path.join(S, "cover_light.png")).convert("RGB")
Lc = L.crop((380, 30, 900, 830))
R = Image.open(os.path.join(S, "zoom_f50.png")).convert("RGB")

PH = 620
def fit(im, h):
    k = h / im.height
    return im.resize((max(1, int(im.width*k)), h), Image.LANCZOS), k
Lc, kl = fit(Lc, PH)
Rz, kr = fit(R, PH)

PAD, GAP = 22, 22
Wc = PAD*2 + Lc.width + GAP + Rz.width
canvas = Image.new("RGB", (Wc, 46 + PH + 190), (248, 247, 244))
d = ImageDraw.Draw(canvas)
F22, F19, F17 = F(22, True), F(19, True), F(17)

d.text((PAD, 14), "① 封面未翻开（浅色主题）", font=F22, fill=(22, 20, 18))
d.text((PAD + Lc.width + GAP, 14), "② 翻页翻到正中间（纸面 90° 侧立）", font=F22, fill=(22, 20, 18))
TOP = 46
canvas.paste(Lc, (PAD, TOP)); canvas.paste(Rz, (PAD + Lc.width + GAP, TOP))
d = ImageDraw.Draw(canvas)

bx = PAD + int((536 - 380) * kl)
# 绿：书左外侧桌面
d.rectangle((bx - 104, TOP + 150, bx - 12, TOP + 470), outline=(40, 158, 88), width=3)
d.text((bx - 104, TOP + 126), "①-a", font=F17, fill=(30, 120, 66))
# 橙：书脊带本体
d.rectangle((bx - 1, TOP + 88, bx + int(29*kl) + 1, TOP + 532), outline=(210, 146, 28), width=3)
d.text((bx + int(29*kl) + 8, TOP + 64), "①-b", font=F17, fill=(158, 108, 18))

rx0 = PAD + Lc.width + GAP
d.rectangle((rx0 + int(Rz.width*0.29), TOP + int(PH*0.26), rx0 + int(Rz.width*0.52), TOP + int(PH*0.74)),
            outline=(40, 158, 88), width=3)
d.text((rx0 + int(Rz.width*0.29), TOP + int(PH*0.26) - 26), "②-a", font=F17, fill=(30, 120, 66))

# 图例
ly = TOP + PH + 20
items = [
    ("①-a", (30, 120, 66), "书左外侧 66px 桌面亮度恒为 226→227（与远处桌面完全一致），没有「越靠近书越暗」的渐变。"),
    ("①-b", (158, 108, 18), "这抹浅灰不是阴影，是封面自带的「书脊」设计：代码里 W×8.5% 的暗带 + 2px 高光 + 竖排 LUMEN · 2026。"),
    ("②-a", (30, 120, 66), "这一帧纸面只剩约 90px 宽，但逐条带回读到的像素是 RGB(0,0,0) / (144,92,76) / (241,239,234) —— 真实照片内容。"),
]
for tag, col, txt in items:
    d.text((PAD, ly), tag, font=F19, fill=col)
    lines = wrap(d, txt, F17, Wc - PAD*2 - 56)
    for i, ln in enumerate(lines):
        d.text((PAD + 56, ly + i*24), ln, font=F17, fill=(62, 58, 53))
    ly += 24*len(lines) + 10
canvas.save(OUT); print("->", OUT, canvas.size)
