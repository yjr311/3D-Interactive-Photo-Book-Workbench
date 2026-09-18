# -*- coding: utf-8 -*-
from PIL import Image
import os
S=os.path.join(r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp","shots")
# 舞台区域(隐藏侧栏后)：书大致居中于 1512x846
jobs=[("f34",(430,300,1120,860)),("f48",(380,280,1100,840)),("f62",(360,280,1120,850)),("f74",(380,280,1120,850))]
for n,(a,b,c,d) in jobs:
    im=Image.open(os.path.join(S,n+".png")).convert("RGB").crop((a,b,c,d))
    o=os.path.join(S,"crop_"+n+".png"); im.save(o); print(o, im.size)
