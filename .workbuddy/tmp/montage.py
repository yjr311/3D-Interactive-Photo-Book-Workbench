# -*- coding: utf-8 -*-
"""翻页过程九宫格：同一本书在不同进度 p 下的渲染。"""
import io, os, subprocess, sys
from PIL import Image

TMP = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html"
SHOT = os.path.join(TMP, "shots")
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"

PS = [0.06, 0.2, 0.34, 0.46, 0.58, 0.7, 0.82, 0.94]
CROP = (300, 110, 760, 620)   # 截图内的书页区域（1080x674 缩放后坐标）

files = []
for idx, p in enumerate(PS):
    body = ("""
      await ready(); freeze(); noTilt();
      BV.cur=1; BV.off=BV.pw*-0.06; BV.offT=BV.off;
      BV.live={i:1,dir:'fwd',p:%f};
      BV.bowBoost=0.0;
      BV.draw();
      await sleep(300);
    """ % p)
    inj = ("<script>\n(function(){\n"
           "function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}\n"
           "function freeze(){ if(BV.raf){try{cancelAnimationFrame(BV.raf);}catch(e){} BV.raf=0;} }\n"
           "function noTilt(){ BV.tilt.x=0;BV.tilt.y=0;BV.tiltT.x=0;BV.tiltT.y=0;BV.cv.style.transform=''; }\n"
           "async function ready(){\n"
           "  for(var i=0;i<240;i++){ await sleep(150); if(state.generated.length>=28&&state.step===2) break; }\n"
           "  var end=performance.now()+2000;\n"
           "  while(performance.now()<end){ BV.raf=0; try{BV.step(performance.now());}catch(e){} await sleep(10); }\n"
           "}\n"
           "window.BV=window.LUMEN.BV; window.state=window.LUMEN.state;\n"
           "async function main(){ try{ " + body + " }catch(e){ document.title='ERR '+e.message; } }\n"
           "setTimeout(main,400);\n})();\n</script>")
    html = io.open(SRC, encoding="utf-8").read().replace("</body>", inj + "</body>")
    pth = os.path.join(TMP, "flip.html")
    io.open(pth, "w", encoding="utf-8", newline="\n").write(html)
    out = os.path.join(SHOT, "p%02d.png" % int(p * 100)).replace("\\", "/")
    cmd = [CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio", "--hide-scrollbars",
           "--window-size=1512,900", "--virtual-time-budget=60000", "--screenshot=" + out,
           "file:///" + pth.replace("\\", "/")]
    subprocess.run(cmd, capture_output=True, timeout=600)
    if os.path.exists(out):
        files.append((p, out))
        print("p=%.2f ok" % p)
    else:
        print("p=%.2f FAIL" % p)

ims = [Image.open(f).convert("RGB").crop(CROP) for _, f in files]
w, h = ims[0].size
cols = 2
rows = (len(ims) + cols - 1) // cols
sheet = Image.new("RGB", (cols * w, rows * h), (16, 17, 20))
for i, im in enumerate(ims):
    sheet.paste(im, ((i % cols) * w, (i // cols) * h))
outp = os.path.join(SHOT, "flip-montage.png")
sheet.save(outp)
print("montage:", outp, sheet.size)
