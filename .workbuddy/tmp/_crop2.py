# -*- coding: utf-8 -*-
from PIL import Image
S=r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shots"
import os
for n in ["f06","f96","f20"]:
    im=Image.open(os.path.join(S,n+".png")).convert("RGB")
    im.resize((im.width//2,im.height//2),Image.LANCZOS).save(os.path.join(S,"half_"+n+".png"))
    print(n, im.size)
