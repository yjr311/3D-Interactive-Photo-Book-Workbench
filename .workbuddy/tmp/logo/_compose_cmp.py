# -*- coding: utf-8 -*-
"""把 cmp_old/new × dark/light 四张实拍拼成一张改前改后对照图。

四张底图的取景完全一致（品牌块都在 l=42,t=36,87×87 设备像素），
所以这里可以硬裁同一个矩形 —— 对照图的公平性来自"同一取景"，不是来自事后对齐。
"""
from PIL import Image, ImageDraw, ImageFont

LOGO = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/logo"
OUT = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-图标对照-落地后.png"

CROP = (0, 0, 760, 168)          # 设备像素（zoom=3 → 253×56 CSS px）
PAD, GAP = 28, 26
FONT = "C:/Windows/Fonts/msyh.ttc"
FONTB = "C:/Windows/Fonts/msyhbd.ttc"
try:
    f_title = ImageFont.truetype(FONTB, 34)
    f_sub = ImageFont.truetype(FONT, 21)
    f_lab = ImageFont.truetype(FONT, 23)
    f_lab2 = ImageFont.truetype(FONT, 19)
except OSError:
    f_title = f_sub = f_lab = f_lab2 = ImageFont.load_default()

BG = (16, 15, 14)
INK = (240, 236, 228)
MUTED = (150, 145, 136)
GOLD = (240, 166, 60)

CW, CH = CROP[2] - CROP[0], CROP[3] - CROP[1]
TITLE_H, ROWLAB_H = 92, 44

W = PAD + CW + GAP + CW + PAD
# 末尾多留 30px：末排的说明文字画在裁切框之下，留窄了会被切掉（第一版就是这么被切的）
H = PAD + TITLE_H + ROWLAB_H + CH + 34 + ROWLAB_H + CH + PAD + 30

canvas = Image.new("RGB", (W, H), BG)
d = ImageDraw.Draw(canvas)

d.text((PAD, PAD - 4), "顶栏图标 · 改前 / 改后", font=f_title, fill=INK)
d.text((PAD, PAD + 42), "同一份产品、只差图标；3× 放大实拍，图标 29×29 CSS px，取景四张完全相同",
       font=f_sub, fill=MUTED)

ROWS = [("深色主题", "dark"), ("浅色主题", "light")]
COLS = [("改前 · 圆角方块", "old", (110, 106, 100)),
        ("改后 · 手绘小书", "new", GOLD)]

for ri, (rlabel, rkey) in enumerate(ROWS):
    y0 = PAD + TITLE_H + ri * (ROWLAB_H + CH + 34)
    d.text((PAD, y0 + 10), rlabel, font=f_lab, fill=MUTED)
    y = y0 + ROWLAB_H
    for ci, (clabel, ckey, ccol) in enumerate(COLS):
        x = PAD + ci * (CW + GAP)
        im = Image.open(f"{LOGO}/cmp_{ckey}_{rkey}.png").convert("RGB").crop(CROP)
        # 细边框：改后用金色，一眼分得出哪张是新的
        canvas.paste(im, (x, y))
        d.rectangle([x - 2, y - 2, x + CW + 1, y + CH + 1], outline=ccol, width=3 if ckey == "new" else 2)
        d.text((x + 4, y + CH + 8), clabel, font=f_lab2, fill=ccol)

canvas.save(OUT)
print("written", OUT, canvas.size)
