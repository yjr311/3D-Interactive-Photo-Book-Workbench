# -*- coding: utf-8 -*-
"""按"文字外框"归一化后做像素纹理对照：谁的字形纹理像用户截图，谁就是用户在看的字体。"""
import io, os
import numpy as np
from PIL import Image

SF = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsfont"
SHOT = r"C:/Users/zz/.workbuddy/clipboard-images/clipboard-2026-09-18T08-56-56-619Z-200f9d32.jpg"
ROOT = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14"

SCALE = 456.5 / 880.0
BAND = (300, 1022, 600, 1058)
TARGET_W = 900
UP = 8

def tight(img, drop=20):
    g = np.asarray(img.convert("L")).astype(np.float32)
    bg = np.median(g)
    m = g < (bg - drop)
    rc, cc = m.sum(axis=1), m.sum(axis=0)
    rows = np.where(rc >= 2)[0]; cols = np.where(cc >= 1)[0]
    return img.crop((int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1)), m

def norm(img):
    t, _ = tight(img)
    return t.resize((TARGET_W, max(1, int(round(t.height * TARGET_W / t.width)))), Image.LANCZOS)

panels = []
u = Image.open(SHOT).convert("RGB").crop((640, 572, 760, 600))
panels.append(("你的截图", norm(u)))

for key, title in [("A-current", "宋体 SimSun"), ("D-yahei", "微软雅黑 YaHei"),
                   ("E-dengxian", "等线 DengXian"), ("B-kaiti", "楷体 KaiTi"),
                   ("C-fangsong", "仿宋 FangSong")]:
    p = "%s/%s-cjk.png" % (SF, key)
    if not os.path.exists(p):
        continue
    im = Image.open(p).convert("RGB")
    disp = im.resize((int(im.width * SCALE), int(im.height * SCALE)), Image.LANCZOS)
    x0, y0, x1, y1 = BAND
    c = disp.crop((int(x0 * SCALE), int(y0 * SCALE), int(x1 * SCALE), int(y1 * SCALE)))
    b = io.BytesIO(); c.save(b, "JPEG", quality=60); b.seek(0)
    panels.append((title, norm(Image.open(b).convert("RGB"))))

H = max(p[1].height for p in panels)
sheet = Image.new("RGB", (TARGET_W + 4, (H + 8) * len(panels)), (255, 255, 255))
y = 0
for title, im in panels:
    sheet.paste(im, (2, y))
    print("%-18s -> %dx%d (原始外框已归一化)" % (title, im.width, im.height))
    y += H + 8
sheet = sheet.resize((sheet.width * UP // 2, sheet.height * UP // 2), Image.NEAREST)
out = ROOT + "/图注字体-像素级对照.png"
sheet.save(out)
print("wrote", out, sheet.size)
