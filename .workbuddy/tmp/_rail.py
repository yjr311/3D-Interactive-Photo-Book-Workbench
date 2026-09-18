# -*- coding: utf-8 -*-
import os
from PIL import Image
S = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shots"
im = Image.open(os.path.join(S, "p2.png")).convert("RGB")
W, H = im.size
print("p2.png", W, H)
c = im.crop((0, 80, 175, 560))
c = c.resize((c.width*2, c.height*2), Image.LANCZOS)
o = os.path.join(S, "railzoom_p2.png"); c.save(o); print("->", o, c.size)
# 统计缩略图左上角圆圈处的像素：是不是琥珀色 (#f0a63c 附近)
cnt_amber = cnt_total = 0
for row in range(14):
    for col in range(2):
        x = 14 + col*84 + 4 + 9
        y = 96 + row*118 + 4 + 9
        if x >= W or y >= H: continue
        r,g,b = im.getpixel((x,y))
        cnt_total += 1
        if r > 190 and 120 < g < 200 and b < 120: cnt_amber += 1
print("抽样圆圈 %d 个，琥珀色 %d 个" % (cnt_total, cnt_amber))
