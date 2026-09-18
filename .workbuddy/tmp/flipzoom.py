# -*- coding: utf-8 -*-
"""翻页特写：隐藏侧栏、放大舞台，在多组进度下渲染并拼成一张对比图。"""
import io, os, subprocess, sys
from PIL import Image

TMP = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/光匣-3D互动照片书.html"
SHOT = os.path.join(TMP, "shots")
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"
os.makedirs(SHOT, exist_ok=True)

PS = [float(x) for x in (sys.argv[1].split(",") if len(sys.argv) > 1 else
      ["0.04","0.16","0.3","0.42","0.5","0.58","0.7","0.84","0.94"])]
DIR = sys.argv[2] if len(sys.argv) > 2 else "fwd"
TAG = sys.argv[3] if len(sys.argv) > 3 else "flipzoom"

COMMON = r"""
function freeze(){ if(BV.raf){ try{cancelAnimationFrame(BV.raf);}catch(e){} BV.raf=0; } }
function noTilt(){ BV.tilt.x=0;BV.tilt.y=0;BV.tiltT.x=0;BV.tiltT.y=0;BV.cv.style.transform=''; }
async function ready(){
  for(var i=0;i<240;i++){ await sleep(150); if(state.generated.length>=28&&state.step===2) break; }
  var end=performance.now()+2200;
  while(performance.now()<end){ BV.raf=0; try{BV.step(performance.now());}catch(e){} await sleep(10); }
}
"""

STYLE = ("<style>.rail,.panel,.dock{display:none!important}"
         ".work{grid-template-columns:minmax(0,1fr)!important}"
         ".stage{min-height:0!important}"
         ".work{min-height:0!important;height:auto!important}"
         ".bv-stage{min-height:0!important}"
         ".bv-thumbs,.bv-hint,.stage-note{display:none!important}</style>")

files = []
for p in PS:
    body = """
      await ready(); freeze(); noTilt();
      BV.cur=2; BV.off=BV.targetOff(); BV.offT=BV.off;
      BV.live={i:2,dir:'%s',p:%f};
      BV.bowBoost=0.0;
      BV.layout(); BV.draw();
      await sleep(300); BV.draw();
      await sleep(200);
    """ % (DIR, p)
    inj = ("<script>\n(function(){\n"
           "function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}\n"
           + COMMON +
           "var BV=window.LUMEN.BV, state=window.LUMEN.state;\n"
           "async function main(){ try{ " + body + " }catch(e){ document.title='ERR '+e.message; } }\n"
           "setTimeout(main,400);\n})();\n</script>")
    html = io.open(SRC, encoding="utf-8").read().replace("</body>", STYLE + inj + "</body>")
    pth = os.path.join(TMP, "zoom.html")
    io.open(pth, "w", encoding="utf-8", newline="\n").write(html)
    out = os.path.join(SHOT, "%s-%02d.png" % (TAG, int(p * 100))).replace("\\", "/")
    cmd = [CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio", "--hide-scrollbars",
           "--window-size=1180,760", "--virtual-time-budget=60000", "--screenshot=" + out,
           "file:///" + pth.replace("\\", "/")]
    subprocess.run(cmd, capture_output=True, timeout=600)
    if os.path.exists(out):
        files.append((p, out)); print("p=%.2f ok" % p)
    else:
        print("p=%.2f FAIL" % p)

if not files:
    raise SystemExit("no shots")
ims = [Image.open(f).convert("RGB") for _, f in files]
W, H = ims[0].size
cw, ch = int(W * 0.70), int(H * 0.72)
crops = [im.crop(((W - cw) // 2, int(H * 0.10), (W - cw) // 2 + cw, int(H * 0.10) + ch)) for im in ims]
tw, th = cw, ch
cols = 3
rows = (len(crops) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * th), (10, 10, 12))
for i, im in enumerate(crops):
    sheet.paste(im.resize((tw, th), Image.LANCZOS), ((i % cols) * tw, (i // cols) * th))
outp = os.path.join(SHOT, TAG + ".png")
sheet.save(outp)
print("montage:", outp, sheet.size)
