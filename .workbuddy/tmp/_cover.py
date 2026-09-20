# -*- coding: utf-8 -*-
"""封面态（未翻开）截图：确认书脊左侧桌面上没有任何阴影痕迹。"""
import io, os, subprocess
from PIL import Image
TMP = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"
S = os.path.join(TMP, "shots"); os.makedirs(S, exist_ok=True)

COMMON = r"""
function freeze(){ if(BV.raf){ try{cancelAnimationFrame(BV.raf);}catch(e){} BV.raf=0; } }
function noTilt(){ BV.tilt.x=0;BV.tilt.y=0;BV.tiltT.x=0;BV.tiltT.y=0;BV.cv.style.transform=''; }
async function ready(){
  if(state.photos.length<28){ try{ await window.LUMEN.loadEmbedded(true); }catch(e){} }
  if(state.generated.length<28){ try{ await window.LUMEN.generate(); }catch(e){} }
  for(var i=0;i<240;i++){ await sleep(150); if(state.generated.length>=28&&state.step===2) break; }
  var end=performance.now()+2200;
  while(performance.now()<end){ BV.raf=0; try{BV.step(performance.now());}catch(e){} await sleep(10); }
}
"""
for tag, pre in (("dark", ""), ("light", "document.getElementById('themeBtn').click(); await sleep(500);")):
    body = ("await ready(); freeze(); noTilt(); " + pre +
            "setStep(2); BV.spread=false; state.book.spread=false;"
            "BV.anim=null; BV.live=null; BV.queue=[]; BV.cur=0;"
            "BV.offT=BV.targetOff(); BV.off=BV.offT; BV.syncUI(); BV.layout(); BV.draw();"
            "await sleep(500); freeze(); BV.draw(); await sleep(200);")
    inj = ("<script>\n(function(){\n"
           "function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}\n" + COMMON +
           "var BV=window.LUMEN.BV, state=window.LUMEN.state;\n"
           "async function main(){ try{ " + body + " }catch(e){ document.title='ERR '+e.message; } }\n"
           "setTimeout(main,400);\n})();\n</script>")
    p = os.path.join(TMP, "_cv.html")
    io.open(p, "w", encoding="utf-8", newline="\n").write(
        io.open(SRC, encoding="utf-8").read().replace("</body>", inj + "</body>"))
    o = os.path.join(S, "cover_" + tag + ".png").replace("\\", "/")
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio",
                    "--hide-scrollbars", "--window-size=1512,900", "--virtual-time-budget=60000",
                    "--screenshot=" + o, "file:///" + p.replace("\\", "/")],
                   capture_output=True, timeout=600)
    print(tag, "ok" if os.path.exists(o) else "FAIL")

# 裁书脊左右一带，暗色下用增亮拉伸看有没有残留痕迹
for tag in ("dark", "light"):
    p = os.path.join(S, "cover_" + tag + ".png")
    if not os.path.exists(p): continue
    im = Image.open(p).convert("RGB")
    W, H = im.size
    box = (int(W*0.30), int(H*0.10), int(W*0.72), int(H*0.92))
    c = im.crop(box); c = c.resize((int(c.width*1.15), int(c.height*1.15)), Image.LANCZOS)
    c.save(os.path.join(S, "coverz_" + tag + ".png")); print("zoom", tag, c.size)
