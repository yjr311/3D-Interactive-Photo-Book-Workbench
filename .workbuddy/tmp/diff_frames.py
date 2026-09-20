import io, os, re, subprocess

TMP = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"
S = os.path.join(TMP, "diffframes")
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

DUMP = r"""
function snap(){ return BV.ctx.getImageData(0,0,BV.cv.width,BV.cv.height).data; }
function dump(name){
  var W=BV.cv.width,H=BV.cv.height;
  var c=document.createElement('canvas'); c.width=W; c.height=H;
  var cx=c.getContext('2d');
  cx.drawImage(BV.cv,0,0);
  set(name, c.toDataURL('image/png'));
}
"""

BODY = r"""
await ready(); freeze(); noTilt();
window.requestAnimationFrame=function(){return 0;};
document.documentElement.setAttribute('data-theme','light');
setStep(2); BV.spread=true; state.book.spread=true;
var out=[];
for(var ti=0;ti<PS.length;ti++){
  var tgt=PS[ti];
  BV.anim=null; BV.live=null; BV.queue=[]; BV.cur=3;
  BV.offT=BV.targetOff(); BV.off=BV.offT; BV.syncUI(); BV.layout(); BV.draw();
  var base=snap();
  BV.flipOne('fwd',{dur:400});
  var t0=BV.anim.t0+100000; BV.anim.t0=t0;
  for(var f=0;f<60;f++){ BV.raf=0; if(!BV.anim) break; BV.step(t0+f*16); if(BV.anim&&BV.anim.p>=tgt) break; }
  BV.raf=0; BV.draw();
  var p=BV.anim?BV.anim.p:1;
  var withS=snap();
  BV.anim=null; BV.draw();
  var noS=snap();
  /* 生成差分图：差异放大 6 倍，落到一张新画布上 */
  var W=BV.cv.width,H=BV.cv.height;
  var c=document.createElement('canvas'); c.width=W; c.height=H;
  var cx=c.getContext('2d');
  var im=cx.createImageData(W,H);
  for(var i=0;i<W*H;i++){
    var d=Math.abs(withS[i*4]-noS[i*4])+Math.abs(withS[i*4+1]-noS[i*4+1])+Math.abs(withS[i*4+2]-noS[i*4+2]);
    var v=Math.min(255,d*6);
    im.data[i*4]=v; im.data[i*4+1]=v; im.data[i*4+2]=v; im.data[i*4+3]=255;
  }
  cx.putImageData(im,0,0);
  set('d'+ti, c.toDataURL('image/png'));
  out.push('p='+p.toFixed(2));
}
set('rows', out.join(' '));
"""

base = io.open(SRC, encoding="utf-8").read()
PS = [0.30, 0.50, 0.58, 0.72, 0.90]
inj = ("<div id=\"__g\"></div><script>\n(function(){\n"
       "var G=document.getElementById('__g');\n"
       "function set(k,v){ G.setAttribute('data-'+k,String(v)); }\n"
       "function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}\n"
       "var PS=" + str(PS).replace("'", '"') + ";\n"
       + COMMON + DUMP +
       "var BV=window.LUMEN.BV, state=window.LUMEN.state;\n"
       "async function main(){ try{ " + BODY + " }catch(e){ set('exception',e.message+' @'+(e.stack||'').split('\\n')[1]); } set('done','1'); }\n"
       "setTimeout(main,400);\n})();\n</script>")
p = os.path.join(TMP, "_df.html")
io.open(p, "w", encoding="utf-8", newline="\n").write(base.replace("</body>", inj + "</body>"))
out = subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio",
                      "--window-size=1920,919", "--virtual-time-budget=60000",
                      "--dump-dom", "file:///" + p.replace("\\", "/")],
                     capture_output=True, timeout=600).stdout.decode("utf-8", "replace")
m = re.search(r'<div id="__g"([^>]*)>', out)
a = dict(re.findall(r'data-([\w-]+)="([^"]*)"', m.group(1))) if m else {}
print("rows:", a.get("rows"), "| exc:", a.get("exception"))
import base64
from PIL import Image
for i, tgt in enumerate(PS):
    u = a.get("d%d" % i, "")
    if not u.startswith("data:image"):
        print(tgt, "no img"); continue
    raw = base64.b64decode(u.split(",", 1)[1])
    fn = os.path.join(S, "d%02d.png" % round(tgt * 100))
    io.open(fn, "wb").write(raw)
    print(tgt, "->", fn, Image.open(fn).size)
