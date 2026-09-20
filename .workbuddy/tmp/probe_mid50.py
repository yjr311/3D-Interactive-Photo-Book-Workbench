# -*- coding: utf-8 -*-
"""针对用户反馈的「翻到中间图片就没了」——
在真正最窄的那一帧（qw≈0.5，纸面正对 90°）取两样证据：
  A. 每条带的 源切片宽度 / 目标宽度 之比 是否等于几何压缩比（修前会膨胀 3 倍以上）
  B. 逐条带回读目标像素，看纸上到底画出了什么颜色（是照片内容还是纸色）
"""
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

# drawImage(9 参) 时立刻回读目标条带的实际像素颜色
HOOK = r"""
var REC=[], _di=CanvasRenderingContext2D.prototype.drawImage;
CanvasRenderingContext2D.prototype.drawImage=function(src){
  var r=_di.apply(this,arguments), a=arguments;
  if(this===BV.ctx && a.length>=9 && REC.length<400){
    var dx=a[5], dy=a[6], dw=a[7], dh=a[8];
    var y1=Math.round(dy+dh*0.18), y2=Math.round(dy+dh*0.52), y3=Math.round(dy+dh*0.84);
    var c1=BV.ctx.getImageData(Math.round(dx+dw*0.5), y1, 1,1).data;
    var c2=BV.ctx.getImageData(Math.round(dx+dw*0.5), y2, 1,1).data;
    var c3=BV.ctx.getImageData(Math.round(dx+dw*0.5), y3, 1,1).data;
    REC.push({sw:a[3], dw:dw, dx:dx, r:(a[3]/Math.max(0.05,dw)),
      cols:[c1[0],c1[1],c1[2],c2[0],c2[1],c2[2],c3[0],c3[1],c3[2]]});
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
/* 步进到 p 最接近 0.50 的那一帧（qw 重映射后 90° 侧立就在 p=0.50） */
var best=null, bd=9, bp=0;
for(var f=0; f<80; f++){
  BV.raf=0; if(!BV.anim) break;
  BV.step(t0+f*16);
  var d=Math.abs(BV.anim.p-0.50);
  if(d<bd){ bd=d; bp=BV.anim.p; }
  else if(BV.anim.p>0.60) break;
}
/* 重跑一次并停在 bp 那一帧 */
BV.anim=null; BV.live=null; BV.queue=[]; BV.cur=3;
BV.offT=BV.targetOff(); BV.off=BV.offT; BV.layout(); BV.draw();
BV.flipOne('fwd',{dur:400});
BV.anim.t0=t0;
for(var f2=0; f2<80; f2++){
  BV.raf=0; if(!BV.anim) break;
  BV.step(t0+f2*16);
  if(BV.anim.p>=bp-1e-9) break;
}
BV.raf=0;
/* 纸面投影跨度 */
var sxp=(BV.cur>=0&&BV.anim)?null:null;
var info='';
try{ info='spine='+Math.round(BV.spineX); }catch(e){}
set('p', BV.anim?BV.anim.p.toFixed(4):'land');
set('span', (function(){
  try{
    var sx=BV.anim?BV.anim:null; return '';
  }catch(e){ return 'err'; }
})());
REC=[];
BV.draw();
set('n', REC.length);
/* 找出最窄的若干条带 + 它们画出来的颜色 */
var arr=REC.slice();
arr.sort(function(a,b){ return b.r-a.r; });
var top=arr.slice(0,6).map(function(o){
  return 'sw'+Math.round(o.sw)+'->dw'+o.dw.toFixed(1)+' x'+Math.round(o.dx)+' 比'+o.r.toFixed(1)
    +' RGB('+o.cols[0]+','+o.cols[1]+','+o.cols[2]+')('+o.cols[3]+','+o.cols[4]+','+o.cols[5]+')('+o.cols[6]+','+o.cols[7]+','+o.cols[8]+')';
});
set('worst', top.join(' ~ '));
var narrow=REC.filter(function(o){ return o.dw<6; });
var wide=REC.filter(function(o){ return o.dw>=20; });
set('cnt', 'total='+REC.length+' dw<6px='+narrow.length+' dw>=20px='+wide.length);
/* 所有条带颜色的方差（是否全是纸色） */
var allrgb=[]; REC.forEach(function(o){ for(var i=0;i<9;i+=3) allrgb.push(o.cols[i]); });
var mn=Math.min.apply(null,allrgb), mx=Math.max.apply(null,allrgb);
set('range', 'R 通道 min='+mn+' max='+mx+' 跨度='+(mx-mn));
"""

base = io.open(SRC, encoding="utf-8").read()
inj = ("<div id=\"__g\"></div><script>\n(function(){\n"
       "var G=document.getElementById('__g');\n"
       "function set(k,v){ G.setAttribute('data-'+k,String(v)); }\n"
       "function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}\n"
       + COMMON +
       "var BV=window.LUMEN.BV, state=window.LUMEN.state;\n"
       + HOOK +
       "async function main(){ try{ " + BODY + " }catch(e){ set('exception',(e.message||e)+' @'+(e.stack||'').split('\\n')[1]); } set('done','1'); }\n"
       "setTimeout(main,400);\n})();\n</script>")
p = os.path.join(TMP, "_m50.html")
io.open(p, "w", encoding="utf-8", newline="\n").write(base.replace("</body>", inj + "</body>"))
out = subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio",
                      "--window-size=1920,919", "--virtual-time-budget=60000",
                      "--dump-dom", "file:///" + p.replace("\\", "/")],
                     capture_output=True, timeout=600).stdout.decode("utf-8", "replace")
m = re.search(r'<div id="__g"([^>]*)>', out)
if not m:
    print("NO NODE"); print(out[:900]); raise SystemExit(1)
a = dict(re.findall(r'data-([\w-]+)="([^"]*)"', m.group(1)))
for k in ("p", "cnt", "range", "exception"):
    print("%-10s %s" % (k, a.get(k, "")))
print("\n--- 压缩比最大的 6 条（源切片/目标宽度）---")
for seg in a.get("worst", "").split(" ~ "):
    print("  ", seg)
