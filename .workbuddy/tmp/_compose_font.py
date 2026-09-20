# -*- coding: utf-8 -*-
"""同一显示比例下的图注对照：用户截图裁切 vs 各候选字体真实渲染。
显示比例由用户截图里的字距反推：8 个字占 101px → 字号≈11.4px → 880 画布的比例≈0.50"""
import os
from PIL import Image, ImageDraw, ImageFont

SF = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsfont"
SHOT = r"C:/Users/zz/.workbuddy/clipboard-images/clipboard-2026-09-18T08-56-56-619Z-200f9d32.jpg"
ROOT = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14"

SCALE = 0.50
BAND = (0, 1000, 880, 1070)          # 880 画布坐标下的图注带
UP = 4

ROWS = [
    ("A-current",   "现在的宋体 SimSun"),
    ("F-simsun-first", "宋体打头（同 A）"),
    ("B-kaiti",     "楷体 KaiTi"),
    ("C-fangsong",  "仿宋 FangSong"),
    ("D-yahei",     "微软雅黑 YaHei"),
    ("E-dengxian",  "等线 DengXian"),
]

def lf(sz):
    for p in [r"C:/Windows/Fonts/msyhbd.ttc", r"C:/Windows/Fonts/msyh.ttc"]:
        if os.path.exists(p):
            try: return ImageFont.truetype(p, sz)
            except Exception: pass
    return ImageFont.load_default()

def strip(path):
    im = Image.open(path).convert("RGB")
    disp = im.resize((int(im.width * SCALE), int(im.height * SCALE)), Image.LANCZOS)
    x0, y0, x1, y1 = BAND
    b = disp.crop((int(x0 * SCALE), int(y0 * SCALE), int(x1 * SCALE), int(y1 * SCALE)))
    return b

items = []
ref = Image.open(SHOT).convert("RGB").crop((620, 556, 800, 602))
items.append(("你的截图（原样，1:1）", ref))
for key, title in ROWS:
    p = "%s/%s-cjk.png" % (SF, key)
    if os.path.exists(p):
        items.append((title, strip(p)))
lat = strip(SF + "/A-current-lat.png")
items.append(("右页拉丁 Georgia", lat))

CW = max(i[1].width for i in items)
LAB = 230
TH = 62
sheet = Image.new("RGB", ((LAB + CW + 30) * 1, (TH + 14) * len(items) + 16), (246, 242, 235))
d = ImageDraw.Draw(sheet)
f = lf(16)
y = 8
for title, im in items:
    d.text((10, y + 22), title, fill=(52, 46, 38), font=f)
    # 贴在一条与纸色接近的底上，避免视觉差异来自底色
    sheet.paste(im, (LAB, y))
    d.rectangle([LAB - 1, y - 1, LAB + im.width, y + im.height], outline=(206, 198, 186))
    d.line([(0, y + TH + 4), (sheet.width, y + TH + 4)], fill=(220, 213, 202))
    y += TH + 14

sheet = sheet.resize((sheet.width * UP, sheet.height * UP), Image.LANCZOS)
out = ROOT + "/图注字体对照.png"
sheet.save(out)
print("wrote", out, sheet.size)
