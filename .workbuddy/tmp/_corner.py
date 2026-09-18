# -*- coding: utf-8 -*-
import os
from PIL import Image
S = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shots"
for tag in ("f60", "f74"):
    p = os.path.join(S, tag + ".png")
    if not os.path.exists(p): print("miss", tag); continue
    im = Image.open(p).convert("RGB"); W, H = im.size
    box = (int(W*0.30), 0, int(W*0.62), int(H*0.42))
    c = im.crop(box); c = c.resize((int(c.width*2.0), int(c.height*2.0)), Image.LANCZOS)
    o = os.path.join(S, "corner_" + tag + ".png"); c.save(o); print("->", o, c.size)
