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

PROBE = r"""
function inkBox(){
  var d=BV.ctx.getImageData(0,0,BV.cv.width,BV.cv.height).data;
  var W=BV.cv.width, H=BV.cv.height, x0=1e9,x1=-1,y0=1e9,y1=-1,n=0;
  for(var y=0;y<H;y+=2) for(var x=0;x<W;x+=2){
    if(d[(y*W+x)*4+3]>8){ n++; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y; }
  }
  return {x0:Math.round(x0/BV.dpr),x1:Math.round(x1/BV.dpr),y0:Math.round(y0/BV.dpr),
          y1:Math.round(y1/BV.dpr),px:n};
}
"""

BODY = r"""
await ready(); freeze(); noTilt();
document.documentElement.setAttribute('data-theme','light');
setStep(2); BV.spread=true; state.book.spread=true; BV.cur=3;
BV.offT=BV.targetOff(); BV.off=BV.offT;
BV.anim=null; BV.live={i:3,dir:'fwd',p:0.5}; BV.bowBoost=0;
BV.layout(); BV.draw();
set('live0', BV.live?('i='+BV.live.i+' p='+BV.live.p+' dir='+BV.live.dir):'null');
set('anim0', BV.anim?BV.anim.dir:'null');
set('spread', BV.spread+'/'+state.book.spread);
set('pwph', Math.round(BV.pw)+'x'+Math.round(BV.ph)+' top='+Math.round(BV.top)+' spine='+Math.round(BV.spineX));
set('box0', JSON.stringify(inkBox()));
await sleep(400);
set('live1', BV.live?('i='+BV.live.i+' p='+BV.live.p):'null');
set('anim1', BV.anim?BV.anim.dir:'null');
BV.draw();
set('box1', JSON.stringify(inkBox()));
set('pages', BV.pages.length+' nulls='+BV.pages.filter(function(p){return !p;}).length);
set('frontBack', 'F='+(BV.sheetFront(3)?'ok':'NULL')+' B='+(BV.sheetBack(3)?'ok':'NULL'));
"""

base = io.open(SRC, encoding="utf-8").read()
inj = ("<div id=\"__g\"></div><script>\n(function(){\n"
       "var G=document.getElementById('__g');\n"
       "function set(k,v){ G.setAttribute('data-'+k,String(v)); }\n"
       "function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}\n"
       + COMMON + PROBE +
       "var BV=window.LUMEN.BV, state=window.LUMEN.state;\n"
       "async function main(){ try{ " + BODY + " }catch(e){ set('exception',e.message+' @'+(e.stack||'').split('\\n')[1]); } set('done','1'); }\n"
       "setTimeout(main,400);\n})();\n</script>")
p = os.path.join(TMP, "_lp.html")
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
