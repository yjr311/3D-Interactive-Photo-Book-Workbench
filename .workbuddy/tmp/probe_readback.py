import io, os, re, subprocess

TMP = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/光匣-3D互动照片书.html"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"

COMMON = r"""
function sleepf(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
function freeze(){ if(BV.raf){ try{cancelAnimationFrame(BV.raf);}catch(e){} BV.raf=0; } }
function noTilt(){ BV.tilt.x=0;BV.tilt.y=0;BV.tiltT.x=0;BV.tiltT.y=0;BV.cv.style.transform=''; }
async function ready(){
  if(state.photos.length<28){ try{ await window.LUMEN.loadEmbedded(true); }catch(e){} }
  if(state.generated.length<28){ try{ await window.LUMEN.generate(); }catch(e){} }
  for(var i=0;i<240;i++){ await sleepf(150); if(state.generated.length>=28&&state.step===2) break; }
  var end=performance.now()+2200;
  while(performance.now()<end){ BV.raf=0; try{BV.step(performance.now());}catch(e){} await sleepf(10); }
}
"""

HOOK = r"""
/* 每条带画完后，立刻回读目标列在若干 y 上的颜色 —— 判断「这条带到底画出了什么」 */
var REC=[], _di=CanvasRenderingContext2D.prototype.drawImage;
CanvasRenderingContext2D.prototype.drawImage=function(src){
  var r=_di.apply(this,arguments);
  var a=arguments;
  if(this===BV.ctx && a.length>=9 && REC.length<300){
    var dx=a[5], dy=a[6], dw=a[7];
    var c=BV.ctx.getImageData(Math.round(dx), Math.round(dy+20), Math.max(1,Math.round(dw)), 1).data;
    var c2=BV.ctx.getImageData(Math.round(dx), Math.round(dy+200), Math.max(1,Math.round(dw)), 1).data;
    var c3=BV.ctx.getImageData(Math.round(dx), Math.round(dy+400), Math.max(1,Math.round(dw)), 1).data;
    var tag=(src&&src.__pi!==undefined)?('p'+src.__pi):'?';
    REC.push(tag+' src'+Math.round(a[1])+'+'+Math.round(a[3])+' dst'+Math.round(dx)+'w'+dw.toFixed(1)
      +' | ['+c[0]+','+c[1]+','+c[2]+'] ['+c2[0]+','+c2[1]+','+c2[2]+'] ['+c3[0]+','+c3[1]+','+c3[2]+']');
  }
  return r;
};
"""

BODY = r"""
await ready(); freeze(); noTilt();
window.requestAnimationFrame=function(){return 0;};
document.documentElement.setAttribute('data-theme','light');
setStep(2); BV.spread=true; state.book.spread=true;
for(var k=0;k<BV.pages.length;k++){ if(BV.pages[k]) BV.pages[k].__pi=k; }
BV.anim=null; BV.live=null; BV.queue=[]; BV.cur=3;
BV.offT=BV.targetOff(); BV.off=BV.offT; BV.syncUI(); BV.layout();
BV.draw();
BV.flipOne('fwd',{dur:400});
var t0=BV.anim.t0+100000; BV.anim.t0=t0;
for(var f=0;f<60;f++){ BV.raf=0; if(!BV.anim) break; BV.step(t0+f*16); if(BV.anim&&BV.anim.p>=0.56) break; }
BV.raf=0;
REC=[];
BV.draw();
set('p', BV.anim?BV.anim.p.toFixed(3):'land');
set('n', REC.length);
set('mid', REC.slice(30,50).join(' ~ '));
set('late', REC.slice(90,110).join(' ~ '));
"""

base = io.open(SRC, encoding="utf-8").read()
inj = ("<div id=\"__g\"></div><script>\n(function(){\n"
       "var G=document.getElementById('__g');\n"
       "function set(k,v){ G.setAttribute('data-'+k,String(v)); }\n"
       "function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}\n"
       + COMMON +
       "var BV=window.LUMEN.BV, state=window.LUMEN.state;\n"
       + HOOK +
       "async function main(){ try{ " + BODY + " }catch(e){ set('exception',e.message+' @'+(e.stack||'').split('\\n')[1]); } set('done','1'); }\n"
       "setTimeout(main,400);\n})();\n</script>")
p = os.path.join(TMP, "_rd.html")
io.open(p, "w", encoding="utf-8", newline="\n").write(base.replace("</body>", inj + "</body>"))
out = subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio",
                      "--window-size=1920,919", "--virtual-time-budget=60000",
                      "--dump-dom", "file:///" + p.replace("\\", "/")],
                     capture_output=True, timeout=600).stdout.decode("utf-8", "replace")
m = re.search(r'<div id="__g"([^>]*)>', out)
if not m:
    print("NO NODE"); print(out[:900]); raise SystemExit(1)
a = dict(re.findall(r'data-([\w-]+)="([^"]*)"', m.group(1)))
print("p =", a.get("p"), " n =", a.get("n"), " exc =", a.get("exception"))
for key in ("mid", "late"):
    print("\n=== %s ===" % key)
    for seg in a.get(key, "").replace("&quot;", '"').split(" ~ "):
        print(" ", seg)
