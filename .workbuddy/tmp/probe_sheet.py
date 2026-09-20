import io, os, re, subprocess

TMP = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html"
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

PATCH = r"""
var DI={n:0,cw:0,minX:1e9,maxX:-1,minY:1e9,maxY:-1,zeroW:0,nullSrc:0,calls:[]};
var proto=CanvasRenderingContext2D.prototype;
var _di=proto.drawImage;
proto.drawImage=function(src){
  if(this===BV.ctx){
    DI.n++;
    var a=arguments;
    if(a.length>=9){
      var dx=a[5],dy=a[6],dw=a[7],dh=a[8];
      if(Math.abs(dw)<.01){ DI.zeroW++; }
      if(dx<DI.minX)DI.minX=dx; if(dx+dw>DI.maxX)DI.maxX=dx+dw;
      if(dy<DI.minY)DI.minY=dy; if(dy+dh>DI.maxY)DI.maxY=dy+dh;
      if(DI.calls.length<6) DI.calls.push([Math.round(dx),Math.round(dy),Math.round(dw),Math.round(dh)]);
    } else if(a.length>=5){
      var dx1=a[1],dy1=a[2],dw1=a[3],dh1=a[4];
      if(dx1<DI.minX)DI.minX=dx1; if(dx1+dw1>DI.maxX)DI.maxX=dx1+dw1;
      if(dy1<DI.minY)DI.minY=dy1; if(dy1+dh1>DI.maxY)DI.maxY=dy1+dh1;
      if(DI.calls.length<6) DI.calls.push([Math.round(dx1),Math.round(dy1),Math.round(dw1),Math.round(dh1),'5arg']);
    }
  }
  return _di.apply(this,arguments);
};
"""

BODY = r"""
await ready(); freeze(); noTilt();
window.requestAnimationFrame=function(){return 0;};
document.documentElement.setAttribute('data-theme','light');
setStep(2); BV.spread=true; state.book.spread=true;
BV.anim=null; BV.live=null; BV.queue=[]; BV.cur=3;
BV.offT=BV.targetOff(); BV.off=BV.offT; BV.syncUI(); BV.layout(); BV.draw();
/* 静帧基准 */
DI.n=0; DI.minX=1e9;DI.maxX=-1;DI.minY=1e9;DI.maxY=-1;DI.zeroW=0;DI.calls=[];
BV.draw();
set('staticDI', DI.n+' box='+[DI.minX,DI.minY,DI.maxX,DI.maxY].map(Math.round).join(',')+' zeroW='+DI.zeroW);
set('staticCalls', JSON.stringify(DI.calls));
set('geom', 'spine='+Math.round(BV.spineX)+' pw='+Math.round(BV.pw)+' ph='+Math.round(BV.ph)+' top='+Math.round(BV.top)+' cy='+Math.round(BV.cy)+' N='+BV.N);
BV.flipOne('fwd',{dur:400});
var t0=BV.anim.t0+100000; BV.anim.t0=t0;
var f=0;
for(f=0;f<40;f++){ BV.raf=0; if(!BV.anim) break; BV.step(t0+f*16); if(BV.anim&&BV.anim.p>=0.5) break; }
set('p', BV.anim?BV.anim.p.toFixed(3):'landed');
DI.n=0; DI.minX=1e9;DI.maxX=-1;DI.minY=1e9;DI.maxY=-1;DI.zeroW=0;DI.calls=[];
BV.draw();
set('flipDI', DI.n+' box='+[DI.minX,DI.minY,DI.maxX,DI.maxY].map(Math.round).join(',')+' zeroW='+DI.zeroW);
set('flipCalls', JSON.stringify(DI.calls));
set('lastLift', (BV._lastLift||0).toFixed(3));
"""

base = io.open(SRC, encoding="utf-8").read()
inj = ("<div id=\"__g\"></div><script>\n(function(){\n"
       "var G=document.getElementById('__g');\n"
       "function set(k,v){ G.setAttribute('data-'+k,String(v)); }\n"
       "function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}\n"
       + COMMON +
       "var BV=window.LUMEN.BV, state=window.LUMEN.state;\n"
       + PATCH +
       "async function main(){ try{ " + BODY + " }catch(e){ set('exception',e.message+' @'+(e.stack||'').split('\\n')[1]); } set('done','1'); }\n"
       "setTimeout(main,400);\n})();\n</script>")
p = os.path.join(TMP, "_di.html")
io.open(p, "w", encoding="utf-8", newline="\n").write(base.replace("</body>", inj + "</body>"))
out = subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio",
                      "--window-size=1920,919", "--virtual-time-budget=60000",
                      "--dump-dom", "file:///" + p.replace("\\", "/")],
                     capture_output=True, timeout=600).stdout.decode("utf-8", "replace")
m = re.search(r'<div id="__g"([^>]*)>', out)
if not m:
    print("NO NODE"); print(out[:1200]); raise SystemExit(1)
for k, v in sorted(dict(re.findall(r'data-([\w-]+)="([^"]*)"', m.group(1))).items()):
    print("%-12s %s" % (k, v))
