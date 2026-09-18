# -*- coding: utf-8 -*-
import os
from PIL import Image
S = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shots"
p = os.path.join(S, "cover_light.png")
im = Image.open(p).convert("RGB"); W, H = im.size
y = int(H*0.55)
print("light 封面态 y=%d  x=470..620 逐像素亮度" % y)
line = []
for x in range(470, 621):
    r,g,b = im.getpixel((x,y)); line.append("%d:%.0f" % (x, r*0.299+g*0.587+b*0.114))
print("  " + " ".join(line))
print()
# 换 3 条 y 复核
for frac in (0.30, 0.42, 0.68):
    yy = int(H*frac)
    L = []
    for x in range(500, 601, 4):
        r,g,b = im.getpixel((x,yy)); L.append("%d:%.0f" % (x, r*0.299+g*0.587+b*0.114))
    print("  y=%d  %s" % (yy, " ".join(L)))
