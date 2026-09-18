import io, os, subprocess

TMP = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/光匣-3D互动照片书.html"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"

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

PROBE = r"""
function alphaBand(x0,x1,y0,y1){
  x0=Math.max(0,Math.round(x0*BV.dpr)); x1=Math.min(BV.cv.width,Math.round(x1*BV.dpr));
  y0=Math.max(0,Math.round(y0*BV.dpr)); y1=Math.min(BV.cv.height,Math.round(y1*BV.dpr));
  var d=BV.ctx.getImageData(0,0,BV.cv.width,BV.cv.height).data, s=0,n=0,mx=0,cols=0,first=-1;
  for(var y=y0;y<y1;y+=3) for(var x=x0;x<x1;x+=3){
    var a=d[(y*BV.cv.width+x)*4+3]; s+=a; n++; if(a>mx) mx=a; if(a>2){ cols++; if(first<0) first=x; }
  }
  return {avg:+(s/Math.max(1,n)).toFixed(1), max:mx, hit:cols, firstX:first, n:n};
}
"""

BODY = r"""
await ready(); freeze(); noTilt();
document.documentElement.setAttribute('data-theme','light');
setStep(2); BV.spread=true; state.book.spread=true;
BV.cur=0; BV.anim=null; BV.live=null;
BV.offT=BV.targetOff(); BV.off=BV.offT; BV.layout(); BV.draw();
await sleep(600); BV.draw(); await sleep(300);
var r=BV.cv.getBoundingClientRect();
set('geo','spine='+Math.round(BV.spineX)+' pw='+Math.round(BV.pw)+' ph='+Math.round(BV.ph)
  +' top='+Math.round(BV.top)+' cw='+Math.round(BV.cw)+' ch='+Math.round(BV.ch)
  +' off='+BV.off.toFixed(1)+' dpr='+BV.dpr+' cvRect='+Math.round(r.left)+','+Math.round(r.top)+','+Math.round(r.width)+'x'+Math.round(r.height));
/* 画布上：书脊左侧桌面（紧贴 0..70px）*/
set('desk0_70', JSON.stringify(alphaBand(BV.spineX-70, BV.spineX-2, BV.top+20, BV.top+BV.ph-20)));
set('desk70_140', JSON.stringify(alphaBand(BV.spineX-140, BV.spineX-72, BV.top+20, BV.top+BV.ph-20)));
set('desk140_240', JSON.stringify(alphaBand(BV.spineX-240, BV.spineX-142, BV.top+20, BV.top+BV.ph-20)));
set('insideCover', JSON.stringify(alphaBand(BV.spineX+2, BV.spineX+70, BV.top+20, BV.top+BV.ph-20)));
set('aboveBook', JSON.stringify(alphaBand(BV.spineX-140, BV.spineX-2, BV.top-16, BV.top-4)));
"""

base = io.open(SRC, encoding="utf-8").read()
inj = ("<div id=\"__g\"></div><script>\n(function(){\n"
       "var G=document.getElementById('__g');\n"
       "function set(k,v){ G.setAttribute('data-'+k,String(v)); }\n"
       "function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}\n"
       + COMMON + PROBE +
       "var BV=window.LUMEN.BV, state=window.LUMEN.state;\n"
       "async function main(){ try{ " + BODY + " }catch(e){ set('exception',e.message); } set('done','1'); }\n"
       "setTimeout(main,400);\n})();\n</script>")
p = os.path.join(TMP, "_light.html")
io.open(p, "w", encoding="utf-8", newline="\n").write(base.replace("</body>", inj + "</body>"))
o = os.path.join(TMP, "light_cover.png").replace("\\", "/")
r = subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio", "--hide-scrollbars",
                    "--window-size=1920,919", "--virtual-time-budget=60000",
                    "--dump-dom", "file:///" + p.replace("\\", "/")], capture_output=True, timeout=600)
out = r.stdout.decode("utf-8", "replace")
import re
m = re.search(r'<div id="__g"([^>]*)>', out)
if m:
    for k, v in sorted(dict(re.findall(r'data-([\w-]+)="([^"]*)"', m.group(1))).items()):
        print("%-12s %s" % (k, v))
else:
    print("NO NODE", out[:800])

subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio", "--hide-scrollbars",
                "--window-size=1920,919", "--virtual-time-budget=60000",
                "--screenshot=" + o, "file:///" + p.replace("\\", "/")], capture_output=True, timeout=600)
print("shot:", os.path.exists(o))
