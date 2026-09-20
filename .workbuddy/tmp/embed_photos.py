# -*- coding: utf-8 -*-
"""把示例照片压成 base64 内嵌进 photos.js —— 按**字节预算**自动搜索画质。

单文件应用必须能离线双击打开，所以示例照片只能内嵌（不能改成联网取）。
于是体积就是硬约束：这套脚本接受一个预算，自动在「长边」和「质量」两维上
搜索，取能满足预算的最大画质组合，并把结果如实打出来。

用法：
    python embed_photos.py                  # 默认预算 900 KB（base64 之后）
    python embed_photos.py 700              # 压到 700 KB
    python embed_photos.py 900 1024         # 指定预算 + 起始长边

要点：
- 用 **WebP** 而不是 JPEG：同画质体积约为 JPEG 的一半，浏览器全支持，
  data URL 直接可用，载入端（loadEmbedded 只认 {n,w,h,d}）零改动。
- 长边**从大到小**试，取「质量能守住下限」的最大长边 —— 书页里照片显示宽度
  约 550–700px，长边 900 左右已经够；再往上堆分辨率不如把预算花在压缩质量上。
- 搜索是全局的（所有图同一个 q），但**每张图单独量化后再求总和**，
  不然估出来的总量会和实际差很多（复杂图比简单图贵得多）。
"""
import base64, io, json, os, sys
from PIL import Image, ImageOps

SRC = r"D:/test/image"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "photos.js")

BUDGET_KB = int(sys.argv[1]) if len(sys.argv) > 1 else 900      # base64 之后的字节预算
LE_START = int(sys.argv[2]) if len(sys.argv) > 2 else 1024
LE_STEPS = [1024, 992, 960, 928, 896, 864, 832, 800, 768, 720]
Q_MIN = 52                                                       # 质量下限：低于它宁可降长边
Q_MAX = 88

files = sorted([f for f in os.listdir(SRC)
                if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))])
if not files:
    raise SystemExit("没找到源图：" + SRC)


def load(f, le):
    im = Image.open(os.path.join(SRC, f))
    im = ImageOps.exif_transpose(im).convert("RGB")
    w, h = im.size
    k = min(1.0, le / max(w, h))
    if k < 1.0:
        im = im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
    return im


def encode(im, q):
    b = io.BytesIO()
    im.save(b, "WEBP", quality=q, method=6)
    return b.getvalue()


def total_b64(images, q):
    """base64 之后的字节数（含 data URL 前缀），用于和预算比较"""
    raw = 0
    for im in images:
        raw += len(encode(im, q))
    return int(raw * 4 / 3)


def best_q(images, budget, lo=Q_MIN, hi=Q_MAX):
    """二分出「base64 总量 <= budget」的最大质量；lo 都放不下则返回 None"""
    if total_b64(images, lo) > budget:
        return None
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if total_b64(images, mid) <= budget:
            lo = mid
        else:
            hi = mid - 1
    return lo


budget = BUDGET_KB * 1024
chosen = None
for le in LE_STEPS:
    if le > LE_START:
        continue
    images = [load(f, le) for f in files]
    q = best_q(images, budget)
    print("长边 %4d → 满足预算的最大质量 = %s" % (le, q if q else "放不下"))
    if q is not None:
        chosen = (le, q, images)
        break

if not chosen:
    raise SystemExit("预算太小，连长边 %d / q=%d 都放不下" % (LE_STEPS[-1], Q_MIN))

LE, Q, images = chosen
data = []
raw_total = 0
sizes = []
for f, im in zip(files, images):
    b = encode(im, Q)
    raw_total += len(b)
    sizes.append(len(b))
    data.append({"n": os.path.splitext(f)[0], "w": im.size[0], "h": im.size[1],
                 "d": "data:image/webp;base64," + base64.b64encode(b).decode()})

js = "const PHOTO_DATA=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
with open(OUT, "w", encoding="utf-8", newline="\n") as fh:
    fh.write(js)

js_kb = len(js.encode("utf-8")) / 1024
print("\n选定：长边 %d · WebP q=%d" % (LE, Q))
print("原始图像总量   %7.1f KB（平均 %.1f KB，最大 %.1f KB）"
      % (raw_total / 1024, raw_total / 1024 / len(data), max(sizes) / 1024))
print("photos.js      %7.1f KB   ← 这就是进单文件的部分" % js_kb)
print("预算           %7.1f KB   余量 %.1f KB" % (budget / 1024, budget / 1024 - js_kb))
print("尺寸样例：", sorted({(d["w"], d["h"]) for d in data})[:4])
