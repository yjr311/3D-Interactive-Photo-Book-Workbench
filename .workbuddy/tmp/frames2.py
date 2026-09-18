import io, os, re, subprocess

TMP = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/光匣-3D互动照片书.html"
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
/* 用产品自身的 flipOne 驱动，再把时间戳挪到远未来，逐帧步进到指定进度。
   否则真实时钟会抢先把动画推完，抓到的帧不是我要的那一帧。 */
function gotoP(target, dir){
  BV.anim=null; BV.live=null; BV.queue=[]; BV.cur=3;
  BV.offT=BV.targetOff(); BV.off=BV.offT; BV.syncUI(); BV.layout(); BV.draw();
  BV.flipOne(dir||'fwd',{dur:400});
  if(!BV.anim) return 'NOFLIP';
  var t0=BV.anim.t0+100000; BV.anim.t0=t0;
  var f=0, lastP=0;
  for(f=0;f<60;f++){
    BV.raf=0;
    if(!BV.anim) break;
    BV.step(t0+f*16);
    lastP=BV.anim?BV.anim.p:1;
    if(lastP>=target) break;
  }
  BV.raf=0;
  BV.draw();
  return lastP.toFixed(3);
}
"""

PROBE = r"""
function sheetInk(){
  /* 统计画布上「书本范围之外/之上」被绘制出来的部分，用来找站起来的翻动纸 */
  var d=BV.ctx.getImageData(0,0,BV.cv.width,BV.cv.height).data;
  var W=BV.cv.width,H=BV.cv.height,cnt=0,ys=[];
  var bookTop=Math.round(BV.top*BV.dpr), bookBot=Math.round((BV.top+BV.ph)*BV.dpr);
  for(var y=0;y<H;y+=2){
    var c=0;
    for(var x=0;x<W;x+=2){ if(d[(y*W+x)*4+3]>8) c++; }
    if(c>0) ys.push(y);
    if(y<bookTop && c>0) cnt++;
  }
  return {aboveBookRows:cnt, topMost:ys.length?Math.round(ys[0]/BV.dpr):-1,
          botMost:ys.length?Math.round(ys[ys.length-1]/BV.dpr):-1, H:Math.round(BV.ch)};
}
"""

base = io.open(SRC, encoding="utf-8").read()
for tgt in (0.08, 0.25, 0.42, 0.50, 0.58, 0.72, 0.88, 0.97):
    body = ("await ready(); freeze(); noTilt();"
            "window.requestAnimationFrame=function(){return 0;};"
            "document.documentElement.setAttribute('data-theme','light');"
            "setStep(2); BV.spread=true; state.book.spread=true;"
            "var got=gotoP(%f,'fwd'); set('p',got); set('ink',JSON.stringify(sheetInk()));"
            "await sleep(300); BV.draw(); await sleep(150);" % tgt)
    inj = ("<script>\n(function(){\n"
           "function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}\n"
           + COMMON + PROBE +
           "var BV=window.LUMEN.BV, state=window.LUMEN.state;\n"
           "var G=document.getElementById('__g');\n"
           "function set(k,v){ G.setAttribute('data-'+k,String(v)); }\n"
           "async function main(){ try{ " + body + " }catch(e){ set('exception',e.message); } set('done','1'); }\n"
           "setTimeout(main,400);\n})();\n</script>")
    ph = os.path.join(TMP, "_ff.html")
    io.open(ph, "w", encoding="utf-8", newline="\n").write(
        base.replace("</body>", '<div id="__g"></div>' + inj + "</body>"))
    o = os.path.join(S, "q%02d.png" % round(tgt * 100)).replace("\\", "/")
    rr = subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio", "--hide-scrollbars",
                         "--window-size=1920,919", "--virtual-time-budget=60000",
                         "--dump-dom", "file:///" + ph.replace("\\", "/")], capture_output=True, timeout=600)
    out = rr.stdout.decode("utf-8", "replace")
    m = re.search(r'<div id="__g"([^>]*)>', out)
    attrs = dict(re.findall(r'data-([\w-]+)="([^"]*)"', m.group(1))) if m else {}
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio", "--hide-scrollbars",
                    "--window-size=1920,919", "--virtual-time-budget=60000",
                    "--screenshot=" + o, "file:///" + ph.replace("\\", "/")], capture_output=True, timeout=600)
    print("target=%.2f  p=%s  ink=%s" % (tgt, attrs.get("p"), attrs.get("ink")))
