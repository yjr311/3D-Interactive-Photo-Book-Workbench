# -*- coding: utf-8 -*-
import io,os,re,subprocess,html as H
from PIL import Image
TMP=r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC=r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/光匣-3D互动照片书.html"
CHROME=r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"
INJ=r"""
<script>(function(){
window.__err=[];window.addEventListener('error',function(e){window.__err.push('ERR '+(e.message||''));});
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
function rect(s){var e=document.querySelector(s);if(!e)return null;var b=e.getBoundingClientRect();
 return {t:Math.round(b.top),b:Math.round(b.bottom),l:Math.round(b.left),r:Math.round(b.right),w:Math.round(b.width),h:Math.round(b.height)};}
async function main(){
  for(var i=0;i<240;i++){ await sleep(120); if(window.LUMEN&&LUMEN.state.generated.length>=28&&LUMEN.state.step===2) break; }
  await sleep(800);
  var o={vp:{iw:innerWidth,ih:innerHeight,sh:document.documentElement.scrollHeight,ch:document.documentElement.clientHeight}};
  ['.app','.work','.dock','.dock-inner','.dock-tabs','.strip','.strip-track','.sitem','.rail','.panel'].forEach(function(s){o[s]=rect(s);});
  var it=document.querySelectorAll('.sitem');
  o.n=it.length;
  if(it.length){
    var lo=1e9,hi=-1e9; for(var i=0;i<it.length;i++){var b=it[i].getBoundingClientRect(); if(b.height<2)continue; lo=Math.min(lo,b.top); hi=Math.max(hi,b.bottom);}
    o.items={top:Math.round(lo),bottom:Math.round(hi)};
  }
  var st=document.querySelector('.strip'), tr=document.querySelector('.strip-track');
  o.err=window.__err;
  var d=document.createElement('div');d.id='__d';d.setAttribute('data-r',JSON.stringify(o));d.style.display='none';document.body.appendChild(d);
}
setTimeout(main,400);})();</script>"""
h=io.open(SRC,encoding="utf-8").read().replace("</body>",INJ+"</body>")
p=os.path.join(TMP,"dock.html");io.open(p,"w",encoding="utf-8",newline="\n").write(h)
# DOM
r=subprocess.run([CHROME,"--headless","--disable-gpu","--no-sandbox","--mute-audio","--hide-scrollbars",
   "--window-size=1512,900","--virtual-time-budget=45000","--dump-dom","file:///"+p.replace("\\","/")],capture_output=True,timeout=300)
dom=r.stdout.decode("utf-8","replace")
m=re.search(r'id="__d" data-r="(.*?)"',dom,re.S)
print(H.unescape(m.group(1)) if m else "NO DOM")
# 截图
out=os.path.join(TMP,"shots","layout-full.png").replace("\\","/")
subprocess.run([CHROME,"--headless","--disable-gpu","--no-sandbox","--mute-audio","--hide-scrollbars",
   "--window-size=1512,900","--virtual-time-budget=45000","--screenshot="+out,"file:///"+p.replace("\\","/")],capture_output=True,timeout=300)
im=Image.open(out); W,Hh=im.size
print("shot",W,Hh)
im.crop((0,max(0,Hh-300),W,Hh)).save(os.path.join(TMP,"shots","layout-dock.png"))
im.crop((0,0,W,340)).save(os.path.join(TMP,"shots","layout-top.png"))
print("crops ok")
