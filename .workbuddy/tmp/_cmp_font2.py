# -*- coding: utf-8 -*-
"""判定用户截图里那句图注究竟是哪款字体：
   把真实浏览器截图（同显示比例 ≈0.52）也按同样的 JPEG 损伤处理后，
   比较"文字外框宽高比"这个尺度无关量。"""
import io, os
import numpy as np
from PIL import Image

SF = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsfont"
SHOT = r"C:/Users/zz/.workbuddy/clipboard-images/clipboard-2026-09-18T08-56-56-619Z-200f9d32.jpg"

def mask_stats(img, box, drop=22, min_cols=20):
    g = np.asarray(img.convert("L").crop(box)).astype(np.float32)
    bg = np.median(g)
    m = g < (bg - drop)
    if m.sum() == 0:
        return None
    rows = np.where(m.sum(axis=1) >= 1)[0]
    cols = np.where(m.sum(axis=0) >= 1)[0]
    # 丢掉只占极少数像素的噪点行列（JPEG 噪点）
    rowc = m.sum(axis=1)
    rows = np.where(rowc >= 2)[0]
    colc = m.sum(axis=0)
    cols = np.where(colc >= 1)[0]
    if len(rows) == 0 or len(cols) == 0:
        return None
    y0, y1 = rows[0], rows[-1] + 1
    x0, x1 = cols[0], cols[-1] + 1
    h, w = y1 - y0, x1 - x0
    return dict(w=w, h=h, ratio=round(w / h, 2), dens=round(float(m[y0:y1, x0:x1].mean()), 4),
                box=(x0, y0, x1, y1))

def jpeg_round(img, q=72):
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=q)
    buf.seek(0)
    return Image.open(buf).convert("RGB")

print("=== 参考：用户截图里的中文图注 ===")
ref = Image.open(SHOT).convert("RGB")
print("  ", mask_stats(ref, (620, 556, 800, 602)))

print("\n=== 真实浏览器截图（1500x950，pw=364，比例 0.414）===")
im = Image.open(SF + "/REAL-书页.png").convert("RGB")
print("  画布", im.size)
# 找书页的亮区外框（限制在舞台范围）
a = np.asarray(im.crop((340, 60, min(1520, im.width), 900)).convert("L"))
ys, xs = np.where(a > 150)
if len(ys):
    bx0, by0, bx1, by1 = xs.min() + 340, ys.min() + 60, xs.max() + 340, ys.max() + 60
    print("  舞台亮区外框 =", (bx0, by0, bx1, by1), " 宽", bx1 - bx0, "高", by1 - by0)

print("\n=== 真实浏览器截图（1850x1100，pw=456.5，比例 0.5188 ≈ 用户）===")
im2 = Image.open(SF + "/REAL449-书页.png").convert("RGB")
print("  画布", im2.size)
a2 = np.asarray(im2.crop((380, 60, min(1800, im2.width), 1040)).convert("L"))
ys2, xs2 = np.where(a2 > 150)
if len(ys2):
    bx0, by0, bx1, by1 = xs2.min() + 380, ys2.min() + 60, xs2.max() + 380, ys2.max() + 60
    print("  舞台亮区外框 =", (bx0, by0, bx1, by1), " 宽", bx1 - bx0, "高", by1 - by0)
    # 图注在版心底部：按 880x1173 画布坐标 y∈[1024,1060] 映射
    sc = (bx1 - bx0) / 1760.0          # 跨页 = 两页宽
    print("  推算显示比例 =", round(sc, 4))
    ytop = by0 + 1024 * sc
    ybot = by0 + 1062 * sc
    half = (bx1 - bx0) / 2
    box = (int(bx0), int(ytop) - 6, int(bx0 + half), int(ybot) + 6)
    print("  左页图注框 =", box)
    crop = im2.crop(box)
    print("  原样:", mask_stats(crop, (0, 0, crop.width, crop.height)))
    print("  经 JPEG q72 后:", mask_stats(jpeg_round(crop), (0, 0, crop.width, crop.height)))
    crop.resize((crop.width * 6, crop.height * 6), Image.LANCZOS).save(SF + "/REAL449-图注放大.png")
