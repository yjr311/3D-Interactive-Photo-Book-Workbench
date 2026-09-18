# -*- coding: utf-8 -*-
import os
from PIL import Image
S = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shots"
for tag in ("f50", "f40", "f60"):
    p = os.path.join(S, tag + ".png")
    if not os.path.exists(p): print("miss", tag); continue
    im = Image.open(p).convert("RGB")
    W, H = im.size
    # 书页区域大致在画面中右部，裁一个 520x700 再放大 2.2x
    box = (int(W*0.44), int(H*0.02), int(W*0.44)+560, int(H*0.02)+760)
    c = im.crop(box)
    c = c.resize((int(c.width*1.35), int(c.height*1.35)), Image.LANCZOS)
    o = os.path.join(S, "zoom_" + tag + ".png")
    c.save(o); print("->", o, c.size)
