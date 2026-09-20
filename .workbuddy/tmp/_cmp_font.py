# -*- coding: utf-8 -*-
"""用户截图里那句图注，到底是哪款字体？
做法：把用户截图里的图注抠成二值掩膜，再把每款候选字体的真实渲染
（降到同一显示比例）也抠成掩膜，统一缩放到同一外框后求像素差 —— 差最小者即当前字体。
"""
import os, math
import numpy as np
from PIL import Image

SHOT = r"C:/Users/zz/.workbuddy/clipboard-images/clipboard-2026-09-18T08-56-56-619Z-200f9d32.jpg"
SF = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsfont"

def mask_from_region(img, box, thresh_drop=22):
    """在 box 区域内按"比背景暗"取墨，返回 (掩膜, 外框)"""
    reg = np.asarray(img.convert("L").crop(box)).astype(np.float32)
    bg = np.median(reg)
    m = reg < (bg - thresh_drop)
    if m.sum() == 0:
        return None, None
    rows = np.where(m.any(axis=1))[0]
    cols = np.where(m.any(axis=0))[0]
    y0, y1 = rows[0], rows[-1] + 1
    x0, x1 = cols[0], cols[-1] + 1
    return m[y0:y1, x0:x1], (x0, y0, x1, y1)

def mask_from_page(path, rule_off_px=0):
    """从 880 宽的书页渲染里取出图注掩膜（跳过上方那条细线）"""
    im = Image.open(path).convert("RGB")
    W, H = im.size
    # 图注带：细线 y≈1009，文字 y∈[1026,1056]（880 画布坐标系）
    reg = im.crop((0, 1024, W, 1062))
    m, bb = mask_from_region(reg, (0, 0, reg.width, reg.height), 18)
    return m, bb

def norm(mask, size):
    im = Image.fromarray((mask * 255).astype(np.uint8))
    im = im.resize(size, Image.LANCZOS)
    a = np.asarray(im).astype(np.float32) / 255.0
    return a

# ---- 1) 参考：用户截图里的那句中文图注 ----
shot = Image.open(SHOT)
# 左页图注所在的大致区域（宽取大一点，靠自动找外框）
REF_BOX = (620, 556, 800, 602)
ref, ref_bb = mask_from_region(shot, REF_BOX)
print("参考掩膜尺寸(h,w) =", ref.shape, " 外框偏移 =", ref_bb)
print("参考文字宽 / 高 =", ref.shape[1], "/", ref.shape[0])

CANDS = ["A-current", "F-simsun-first", "B-kaiti", "C-fangsong", "D-yahei", "E-dengxian"]
print("\n%-16s %-8s %-8s %-8s" % ("候选", "宽/高", "墨占比", "与参考的差"))
rows = []
for c in CANDS:
    p = "%s/%s-cjk.png" % (SF, c)
    if not os.path.exists(p):
        continue
    m, bb = mask_from_page(p)
    if m is None:
        continue
    r = norm(m, (ref.shape[1], ref.shape[0]))
    d = float(np.abs(r - ref.astype(np.float32)).mean())
    density = float(m.mean())
    rows.append((c, m.shape[1] / m.shape[0], density, d))
    print("%-16s %-8.2f %-8.4f %-8.4f" % (c, m.shape[1] / m.shape[0], density, d))

rows.sort(key=lambda t: t[3])
print("\n按与用户截图最像排序：")
for i, t in enumerate(rows, 1):
    print("  %d. %-16s 差=%.4f" % (i, t[0], t[3]))
