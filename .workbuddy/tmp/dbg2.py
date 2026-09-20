# -*- coding: utf-8 -*-
import io,os,re,subprocess,html as H
TMP=r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC=r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html"
CHROME=r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"
INJ=r"""
<script>(function(){
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
async function main(){
  for(var i=0;i<240;i++){ await sleep(150); if(window.LUMEN&&LUMEN.state.generated.length>=28&&LUMEN.state.step===2) break; }
  var BV=LUMEN.BV;
  BV.cur=2; BV.off=BV.targetOff(); BV.offT=BV.off;
  BV.live={i:2,dir:'fwd',p:0.45}; BV.bowBoost=0; BV.layout();
  var W=BV.pw,N=BV.N,du=W/N,lam=W*0.34,c=W+lam/2-0.45*(W+lam);
  function ss(t){t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);}
  var AN=[],XX=[0],CC=[0];
  for(var k=0;k<=N;k++)AN.push(Math.PI*ss((k*du-(c-lam/2))/lam));
  for(k=0;k<N;k++){var aa=(AN[k]+AN[k+1])/2;XX.push(XX[k]+du*Math.cos(aa));CC.push(CC[k]+du*Math.sin(aa));}
  var sx0=BV.spineX,D=BV.D;
  var rows=[];
  [0,Math.round(N*0.2),Math.round(N*0.4),Math.round(N*0.5),Math.round(N*0.6),Math.round(N*0.7),Math.round(N*0.8),N].forEach(function(k){
    var f=Math.max(1,Math.min(1.26,D/Math.max(140,D-1.15*CC[k])));
    var x=sx0+XX[k]*f, y0=BV.cy-BV.ph*f/2;
    rows.push({k:k,A:+(AN[k]*57.3).toFixed(1),facing:+Math.abs(Math.cos(AN[k])).toFixed(3),
               X:+XX[k].toFixed(1),C:+CC[k].toFixed(1),f:+f.toFixed(3),x:+x.toFixed(1),y0:+y0.toFixed(1)});
  });
  var o={pw:+W.toFixed(1),ph:+BV.ph.toFixed(1),top:+BV.top.toFixed(1),cy:+BV.cy.toFixed(1),
         spineX:+sx0.toFixed(1),D:D,N:N,lam:+lam.toFixed(1),c:+c.toFixed(1),
         cylTop:+BV.top.toFixed(1), rows:rows,
         front:!!BV.sheetFront(2), back:!!BV.sheetBack(2),
         fw:BV.sheetFront(2)?BV.sheetFront(2).width:0};
  var d=document.createElement('div');d.id='__d';d.setAttribute('data-r',JSON.stringify(o));document.body.appendChild(d);
}
setTimeout(main,400);})();</script>"""
h=io.open(SRC,encoding="utf-8").read().replace("</body>",INJ+"</body>")
p=os.path.join(TMP,"dbg2.html");io.open(p,"w",encoding="utf-8",newline="\n").write(h)
r=subprocess.run([CHROME,"--headless","--disable-gpu","--no-sandbox","--mute-audio","--hide-scrollbars",
   "--window-size=1512,900","--virtual-time-budget=45000","--dump-dom","file:///"+p.replace("\\","/")],capture_output=True,timeout=300)
dom=r.stdout.decode("utf-8","replace")
m=re.search(r'id="__d" data-r="(.*?)"',dom,re.S)
print(H.unescape(m.group(1)) if m else dom[-1500:])
