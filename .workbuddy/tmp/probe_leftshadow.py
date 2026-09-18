# -*- coding: utf-8 -*-
"""封面态「书左侧桌面有没有痕迹」——多窗口尺寸，双路取证。

路 A（画布 alpha，权威）：在画布中线扫描，找最左边的已绘制像素 = 书左外沿；
   再看它左边 60px 内画布是否完全没画（alphaMax<=8）。没画 = 不可能有阴影。
路 B（截图 RGB，合成后所见）：把画布 rect.left 换算成页面坐标，
   取书左外沿左侧 30px 与 100px 两处桌面像素，比较亮度差（>4 的变暗才算痕迹）。

同时报出 spineX / pw / 封面跨度，确认"书"确实是那个位置。
"""
import io, os, re, json, subprocess
from PIL import Image

TMP = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/光匣-3D互动照片书.html"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"
S = os.path.join(TMP, "shots"); os.makedirs(S, exist_ok=True)

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

BODY = r"""
await ready(); freeze(); noTilt();
window.requestAnimationFrame=function(){return 0;};
document.documentElement.setAttribute('data-theme','light');
setStep(2); BV.spread=false; state.book.spread=false;
BV.anim=null; BV.live=null; BV.queue=[]; BV.cur=0;
BV.offT=BV.targetOff(); BV.off=BV.offT; BV.syncUI(); BV.layout(); BV.draw();
await sleep(500); freeze(); BV.draw(); await sleep(300);

var cv=BV.cv, ctx=BV.ctx, dpr=BV.dpr||1;
var W=cv.width, H=cv.height, y=Math.round(H*0.52);
var d=ctx.getImageData(0,y,W,1).data;
var left=-1;
for(var x=1;x<W;x++){ if(d[x*4+3]>8 && d[(x+1)*4+3]>8 && d[(x+2)*4+3]>8){ left=x; break; } }
function amax(a,b){ var m=0; for(var x=Math.max(0,a);x<b;x++){ if(d[x*4+3]>m) m=d[x*4+3]; } return m; }
var o={};
o.cw=W; o.ch=H; o.dpr=dpr; o.leftPx=left;
o.leftCss=(left/dpr).toFixed(1);
o.spineX=BV.spineX.toFixed(1); o.pw=BV.pw.toFixed(1);
o.coverL=(BV.spineX-BV.pw).toFixed(1);
o.rectL=BV.cv.getBoundingClientRect().left.toFixed(1);
o.alphaLeft60=amax(left-Math.round(60*dpr), left-Math.round(3*dpr));
o.alphaLeft200=amax(left-Math.round(200*dpr), left-Math.round(60*dpr));
/* 也扫几条别的 y，防止中线恰好落在空隙 */
var y2=Math.round(H*0.30), y3=Math.round(H*0.72), mm=[];
[y2,y3].forEach(function(yy){
  var dd=ctx.getImageData(0,yy,W,1).data;
  var L=-1;
  for(var x=1;x<W;x++){ if(dd[x*4+3]>8 && dd[(x+1)*4+3]>8 && dd[(x+2)*4+3]>8){ L=x; break; } }
  var m=0; for(var x=Math.max(0,L-Math.round(60*dpr));x<L-Math.round(3*dpr);x++){ if(dd[x*4+3]>m) m=dd[x*4+3]; }
  mm.push('y'+yy+' left='+L+' aMaxL60='+m);
});
o.otherRows=mm.join(' ; ');
/* 亮色像素（可能来自投影的软阴影）计数 */
var cnt=0; for(var x=Math.max(0,left-Math.round(60*dpr));x<left-Math.round(3*dpr);x++){ if(d[x*4+3]>0) cnt++; }
o.nonZeroPx=cnt;
set('r', JSON.stringify(o));
"""

base = io.open(SRC, encoding="utf-8").read()
SIZES = [(1920, 919), (1512, 900), (1440, 900), (1366, 768), (1280, 720), (1180, 700), (1100, 660), (1024, 640)]

def lum(px): return px[0]*0.299 + px[1]*0.587 + px[2]*0.114

print("%-11s %-9s %-9s %-7s %-8s %-9s %-9s %s" % (
    "window", "封面左沿", "spineX", "alpha", "画布左偏", "桌面@-30", "桌面@-100", "判定"))
bad = 0
for w, h in SIZES:
    inj = ("<div id=\"__g\"></div><script>\n(function(){\n"
           "var G=document.getElementById('__g');\n"
           "function set(k,v){ G.setAttribute('data-'+k,String(v)); }\n"
           "function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}\n"
           + COMMON +
           "var BV=window.LUMEN.BV, state=window.LUMEN.state;\n"
           "async function main(){ try{ " + BODY + " }catch(e){ set('r','{\"exc\":\"'+(e.message||e)+'\"}'); } set('done','1'); }\n"
           "setTimeout(main,400);\n})();\n</script>")
    p = os.path.join(TMP, "_ls.html")
    io.open(p, "w", encoding="utf-8", newline="\n").write(base.replace("</body>", inj + "</body>"))
    shot = os.path.join(S, "ls_%dx%d.png" % (w, h)).replace("\\", "/")
    dom = subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio",
                          "--hide-scrollbars", "--window-size=%d,%d" % (w, h),
                          "--virtual-time-budget=60000", "--screenshot=" + shot, "--dump-dom",
                          "file:///" + p.replace("\\", "/")],
                         capture_output=True, timeout=600).stdout.decode("utf-8", "replace")
    m = re.search(r'<div id="__g"([^>]*)>', dom)
    a = dict(re.findall(r'data-([\w-]+)="([^"]*)"', m.group(1))) if m else {}
    try: o = json.loads(a.get("r", "{}").replace("&quot;", '"'))
    except Exception: o = {}
    if not o or "exc" in o:
        print("%-11s EXC %s" % ("%dx%d" % (w, h), (o or {}).get("exc", "no data"))); bad += 1; continue
    amax = max(int(o["alphaLeft60"]), int(o["alphaLeft200"]))
    # 路 B：截图取桌面
    dl = d100 = -1
    if os.path.exists(shot):
        im = Image.open(shot).convert("RGB")
        bx = int(float(o["rectL"]) + float(o["leftCss"]))
        yy = int(im.height * 0.52)
        if bx - 100 > 0:
            dl = lum(im.getpixel((bx - 30, yy)))
            d100 = lum(im.getpixel((bx - 100, yy)))
    dRGB = (dl - d100) if (dl >= 0 and d100 >= 0) else -999
    okA = amax <= 8
    okB = (dRGB == -999) or (dRGB > -4.0)
    ok = okA and okB
    if not ok: bad += 1
    print("%-11s %-9s %-9s %-7s %-8s %-9s %-9s %s" % (
        "%dx%d" % (w, h), o["coverL"], o["spineX"], "aMax=%d" % amax, o["rectL"],
        ("%.1f" % dl) if dl >= 0 else "-", ("%.1f" % d100) if d100 >= 0 else "-",
        ("OK 左侧无绘制、桌面平坦" if ok else "!! 有痕迹 (alphaMax=%d, ΔRGB=%.1f)" % (amax, dRGB))))
print("\n失败 %d / %d" % (bad, len(SIZES)))
