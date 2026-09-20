import io, os, subprocess

TMP = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"

BODY = ("await ready(); freeze(); noTilt(); setStep(2); BV.spread=true; state.book.spread=true;"
        "BV.cur=%d; BV.anim=null; BV.live=null; BV.offT=BV.targetOff(); BV.off=BV.offT;"
        "BV.layout(); BV.draw(); await sleep(500); BV.draw(); await sleep(300);")

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

base = io.open(SRC, encoding="utf-8").read()
for name, cur in [("cover", 0), ("mid", 3)]:
    inj = ("<script>\n(function(){\n"
           "function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}\n"
           + COMMON +
           "var BV=window.LUMEN.BV, state=window.LUMEN.state;\n"
           "async function main(){ try{ " + (BODY % cur) + " }catch(e){ document.title='ERR '+e.message; } }\n"
           "setTimeout(main,400);\n})();\n</script>")
    p = os.path.join(TMP, "_cmp.html")
    io.open(p, "w", encoding="utf-8", newline="\n").write(base.replace("</body>", inj + "</body>"))
    o = os.path.join(TMP, "cmp_%s.png" % name).replace("\\", "/")
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio", "--hide-scrollbars",
                    "--window-size=1920,919", "--virtual-time-budget=60000",
                    "--screenshot=" + o, "file:///" + p.replace("\\", "/")], capture_output=True, timeout=600)
    print(name, os.path.exists(o))
