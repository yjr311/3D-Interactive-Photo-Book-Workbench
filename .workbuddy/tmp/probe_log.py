import io, os, re, subprocess

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

HOOK = r"""
var LOG=[], _di=CanvasRenderingContext2D.prototype.drawImage;
var _fr=CanvasRenderingContext2D.prototype.fillRect;
CanvasRenderingContext2D.prototype.drawImage=function(src){
  if(this===BV.ctx && LOG.length<4000){
    var a=arguments, tag='?';
    if(src===null||src===undefined) tag='NULL';
    else if(src.__pi!==undefined) tag='p'+src.__pi;
    else tag='other';
    if(a.length>=9) LOG.push('DI '+tag+' src['+Math.round(a[1])+'+'+Math.round(a[3])+'] -> dst['+Math.round(a[5])+'+'+Math.round(a[7])+'] y'+Math.round(a[6]));
    else LOG.push('DI '+tag+' 5arg');
  }
  return _di.apply(this,arguments);
};
CanvasRenderingContext2D.prototype.fillRect=function(x,y,w,h){
  if(this===BV.ctx && LOG.length<4000) LOG.push('FR '+Math.round(x)+','+Math.round(y)+' '+Math.round(w)+'x'+Math.round(h)+' fill='+this.fillStyle);
  return _fr.apply(this,arguments);
};
function unhook(){ CanvasRenderingContext2D.prototype.drawImage=_di; CanvasRenderingContext2D.prototype.fillRect=_fr; }
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
LOG=[];                       /* 只记录最后这一次 draw() 里的调用 */
BV.draw();
unhook();
set('p', BV.anim?BV.anim.p.toFixed(3):'land');
set('nlog', LOG.length);
set('log', LOG.slice(0,60).join(' | '));
set('logTail', LOG.slice(-14).join(' | '));
set('frontBack', 'F='+(BV.sheetFront(3)?('p'+BV.sheetFront(3).__pi):'NULL')+' B='+(BV.sheetBack(3)?('p'+BV.sheetBack(3).__pi):'NULL'));
set('geom', 'spine='+Math.round(BV.spineX)+' pw='+Math.round(BV.pw)+' ph='+Math.round(BV.ph)+' cy='+Math.round(BV.cy)+' N='+BV.N+' dpr='+BV.dpr);
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
p = os.path.join(TMP, "_lg.html")
io.open(p, "w", encoding="utf-8", newline="\n").write(base.replace("</body>", inj + "</body>"))
out = subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio",
                      "--window-size=1920,919", "--virtual-time-budget=60000",
                      "--dump-dom", "file:///" + p.replace("\\", "/")],
                     capture_output=True, timeout=600).stdout.decode("utf-8", "replace")
m = re.search(r'<div id="__g"([^>]*)>', out)
if not m:
    print("NO NODE"); print(out[:1000]); raise SystemExit(1)
a = dict(re.findall(r'data-([\w-]+)="([^"]*)"', m.group(1)))
for k in ("p", "nlog", "geom", "frontBack", "exception"):
    print("%-10s %s" % (k, a.get(k, "").replace("&quot;", '"')))
print("\n--- 开头 60 条 ---")
for seg in a.get("log", "").replace("&quot;", '"').split(" | "):
    print(" ", seg)
print("\n--- 末尾 14 条 ---")
for seg in a.get("logTail", "").replace("&quot;", '"').split(" | "):
    print(" ", seg)
