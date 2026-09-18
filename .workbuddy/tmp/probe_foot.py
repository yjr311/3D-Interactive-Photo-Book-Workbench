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

MEASURE = r"""
function snap(){ return BV.ctx.getImageData(0,0,BV.cv.width,BV.cv.height).data; }
function footprint(a,b){
  var W=BV.cv.width,H=BV.cv.height;
  var n=0,x0=1e9,x1=-1,y0=1e9,y1=-1,paper=0,ink=0;
  for(var y=0;y<H;y+=2) for(var x=0;x<W;x+=2){
    var i=(y*W+x)*4;
    var d=Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])+Math.abs(a[i+3]-b[i+3]);
    if(d>14){
      n++; if(x<x0)x0=x; if(x>x1)x1=x; if(y<y0)y0=y; if(y>y1)y1=y;
      var r=a[i],g=a[i+1],bl=a[i+2];
      if(r>245&&g>245&&bl>245) paper++; else ink++;
    }
  }
  return {px:n, box:n?[Math.round(x0/BV.dpr),Math.round(y0/BV.dpr),
        Math.round(x1/BV.dpr),Math.round(y1/BV.dpr)]:null,
        paperFrac:+(paper/Math.max(1,n)*100).toFixed(1), inkFrac:+(ink/Math.max(1,n)*100).toFixed(1)};
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
  if(!BV.anim){ out.push('NOFLIP'); continue; }
  var t0=BV.anim.t0+100000; BV.anim.t0=t0;
  for(var f=0;f<60;f++){ BV.raf=0; if(!BV.anim) break; BV.step(t0+f*16); if(BV.anim&&BV.anim.p>=tgt) break; }
  BV.raf=0; BV.draw();
  var p=BV.anim?BV.anim.p:1;
  var withSheet=snap();
  /* 再画一次无翻页纸的版本，做差分 */
  BV.anim=null; BV.draw();
  var noSheet=snap();
  var fp=footprint(withSheet,noSheet);
  out.push('p='+p.toFixed(2)+' '+JSON.stringify(fp)+' lift='+(BV._lastLift||0).toFixed(2));
  /* 还原：把翻页纸重新打开给下一轮用 */
  BV.cur=3;
}
set('rows', out.join(' ;; '));
"""

base = io.open(SRC, encoding="utf-8").read()
PS = [0.15, 0.30, 0.42, 0.50, 0.58, 0.70, 0.82, 0.94]
inj = ("<div id=\"__g\"></div><script>\n(function(){\n"
       "var G=document.getElementById('__g');\n"
       "function set(k,v){ G.setAttribute('data-'+k,String(v)); }\n"
       "function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}\n"
       "var PS=" + str(PS).replace("'", '"') + ";\n"
       + COMMON + MEASURE +
       "var BV=window.LUMEN.BV, state=window.LUMEN.state;\n"
       "async function main(){ try{ " + BODY + " }catch(e){ set('exception',e.message+' @'+(e.stack||'').split('\\n')[1]); } set('done','1'); }\n"
       "setTimeout(main,400);\n})();\n</script>")
p = os.path.join(TMP, "_fp.html")
io.open(p, "w", encoding="utf-8", newline="\n").write(base.replace("</body>", inj + "</body>"))
out = subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio",
                      "--window-size=1920,919", "--virtual-time-budget=60000",
                      "--dump-dom", "file:///" + p.replace("\\", "/")],
                     capture_output=True, timeout=600).stdout.decode("utf-8", "replace")
m = re.search(r'<div id="__g"([^>]*)>', out)
if not m:
    print("NO NODE"); print(out[:1200]); raise SystemExit(1)
a = dict(re.findall(r'data-([\w-]+)="([^"]*)"', m.group(1)))
for row in a.get("rows", "").split(" ;; "):
    print(row.replace("&quot;", '"'))
print("exception:", a.get("exception"))
