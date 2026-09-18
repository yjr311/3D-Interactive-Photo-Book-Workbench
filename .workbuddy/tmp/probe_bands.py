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

MEAS = r"""
/* 记录 drawSheet 的每条带：目标宽度、源宽度、以及该带是否走了「纸」的兜底分支 */
var REC={bands:0,paperFallback:0,dw:[],sw:[],srcsX:[]};
function hookSheet(){
  var proto=CanvasRenderingContext2D.prototype, _di=proto.drawImage, _fr=proto.fillRect;
  REC={bands:0,paperFallback:0,dw:[],sw:[],srcsX:[]};
  proto.drawImage=function(src){
    if(this===BV.ctx){
      var a=arguments;
      if(a.length>=9){
        REC.bands++;
        REC.dw.push(+a[7].toFixed(2));
        REC.sw.push(+a[3].toFixed(2));
        REC.srcsX.push(Math.round(a[1]));
      }
    }
    return _di.apply(this,arguments);
  };
  return function(){ proto.drawImage=_di; };
}
function row(y){
  var d=BV.ctx.getImageData(0,0,BV.cv.width,BV.cv.height).data;
  var W=BV.cv.width,x0=Math.max(0,Math.round((BV.spineX-70)*BV.dpr)),x1=Math.min(W,Math.round((BV.spineX+70)*BV.dpr));
  var out=[];
  for(var x=x0;x<x1;x+=6){
    var i=((Math.round(y*BV.dpr))*W+x)*4;
    out.push(d[i]+','+d[i+1]+','+d[i+2]);
  }
  return out.join(' ');
}
"""

BODY = r"""
await ready(); freeze(); noTilt();
window.requestAnimationFrame=function(){return 0;};
document.documentElement.setAttribute('data-theme','light');
setStep(2); BV.spread=true; state.book.spread=true;
BV.anim=null; BV.live=null; BV.queue=[]; BV.cur=3;
BV.offT=BV.targetOff(); BV.off=BV.offT; BV.syncUI(); BV.layout(); BV.draw();
var unhook=hookSheet();
BV.flipOne('fwd',{dur:400});
var t0=BV.anim.t0+100000; BV.anim.t0=t0;
for(var f=0;f<60;f++){ BV.raf=0; if(!BV.anim) break; BV.step(t0+f*16); if(BV.anim&&BV.anim.p>=0.58) break; }
BV.raf=0;
BV.draw();
set('p', BV.anim?BV.anim.p.toFixed(3):'land');
set('bands', REC.bands);
set('dwStats', 'min='+Math.min.apply(null,REC.dw)+' max='+Math.max.apply(null,REC.dw)
   +' 中位='+REC.dw.slice().sort(function(a,b){return a-b;})[Math.floor(REC.dw.length/2)]);
set('swStats', 'min='+Math.min.apply(null,REC.sw)+' max='+Math.max.apply(null,REC.sw));
set('paperColor', state.book.paper);
set('rowMid', row(BV.cy));
set('rowUp', row(BV.cy-BV.ph*0.28));
set('geom','spine='+Math.round(BV.spineX)+' cy='+Math.round(BV.cy)+' pw='+Math.round(BV.pw));
unhook();
"""

base = io.open(SRC, encoding="utf-8").read()
inj = ("<div id=\"__g\"></div><script>\n(function(){\n"
       "var G=document.getElementById('__g');\n"
       "function set(k,v){ G.setAttribute('data-'+k,String(v)); }\n"
       "function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}\n"
       + COMMON + MEAS +
       "var BV=window.LUMEN.BV, state=window.LUMEN.state;\n"
       "async function main(){ try{ " + BODY + " }catch(e){ set('exception',e.message+' @'+(e.stack||'').split('\\n')[1]); } set('done','1'); }\n"
       "setTimeout(main,400);\n})();\n</script>")
p = os.path.join(TMP, "_rr.html")
io.open(p, "w", encoding="utf-8", newline="\n").write(base.replace("</body>", inj + "</body>"))
out = subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio",
                      "--window-size=1920,919", "--virtual-time-budget=60000",
                      "--dump-dom", "file:///" + p.replace("\\", "/")],
                     capture_output=True, timeout=600).stdout.decode("utf-8", "replace")
m = re.search(r'<div id="__g"([^>]*)>', out)
if not m:
    print("NO NODE"); print(out[:1000]); raise SystemExit(1)
for k, v in sorted(dict(re.findall(r'data-([\w-]+)="([^"]*)"', m.group(1))).items()):
    print("%-11s %s" % (k, v))
