import io, os, re, subprocess

TMP = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"
S = os.path.join(TMP, "flipframes")
os.makedirs(S, exist_ok=True)

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
PS = [0.10, 0.25, 0.40, 0.50, 0.60, 0.75, 0.90]

for p in PS:
    body = ("await ready(); freeze(); noTilt();"
            "document.documentElement.setAttribute('data-theme','light');"
            "setStep(2); BV.spread=true; state.book.spread=true; BV.cur=3;"
            "BV.offT=BV.targetOff(); BV.off=BV.offT;"
            "BV.anim=null; BV.live={i:3,dir:'fwd',p:%f}; BV.bowBoost=0;"
            "BV.layout(); BV.draw(); await sleep(300); BV.draw(); await sleep(200);" % p)
    inj = ("<script>\n(function(){\n"
           "function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}\n"
           + COMMON +
           "var BV=window.LUMEN.BV, state=window.LUMEN.state;\n"
           "async function main(){ try{ " + body + " }catch(e){ document.title='ERR '+e.message; } }\n"
           "setTimeout(main,400);\n})();\n</script>")
    ph = os.path.join(TMP, "_ff.html")
    io.open(ph, "w", encoding="utf-8", newline="\n").write(base.replace("</body>", inj + "</body>"))
    o = os.path.join(S, "p%02d.png" % round(p * 100)).replace("\\", "/")
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio", "--hide-scrollbars",
                    "--window-size=1920,919", "--virtual-time-budget=60000",
                    "--screenshot=" + o, "file:///" + ph.replace("\\", "/")], capture_output=True, timeout=600)
    print("p=%.2f" % p, os.path.exists(o))
