# -*- coding: utf-8 -*-
import os
from PIL import Image
S = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shots"
for tag in ("light", "dark"):
    p = os.path.join(S, "cover_%s.png" % tag)
    im = Image.open(p).convert("RGB"); W, H = im.size
    y = int(H*0.55)
    row = [im.getpixel((x, y)) for x in range(W)]
    lum = [ (r*0.299+g*0.587+b*0.114) for (r,g,b) in row ]
    print("== %s  %dx%d  y=%d ==" % (tag, W, H, y))
    # 找最暗的一段（书脊左侧）
    # 打印 x=380..1000 每 8px
    s = []
    for x in range(360, 1020, 8):
        s.append("%d:%d" % (x, round(lum[x])))
    print("  " + " ".join(s))
    # 全局最暗点
    mn = min(range(W), key=lambda i: lum[i]); mx = max(range(W), key=lambda i: lum[i])
    print("  min lum %.0f @x=%d   max lum %.0f @x=%d" % (lum[mn], mn, lum[mx], mx))
    # 书脊带边界：在 x=500..900 找亮度跌落
    base = sum(lum[900:1000])/100.0
    print("  右侧桌面基准亮度 %.1f" % base)
    for x in range(400, 900):
        if lum[x] < base - 12 and lum[x-1] >= base - 12:
            print("    跌落在 x=%d lum=%.0f (Δ%.1f)" % (x, lum[x], lum[x]-base))
