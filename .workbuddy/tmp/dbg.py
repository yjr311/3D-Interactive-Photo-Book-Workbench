# -*- coding: utf-8 -*-
import io, os, subprocess, re, html as H
TMP=r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC=r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html"
CHROME=r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"
INJ=r"""
<script>
(function(){
window.__err=[];
window.addEventListener('error',function(e){window.__err.push('ERR '+(e.message||'')+' @'+(e.lineno||''));});
window.addEventListener('unhandledrejection',function(e){window.__err.push('REJ '+((e.reason&&e.reason.message)||e.reason));});
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
async function main(){
  for(var i=0;i<240;i++){ await sleep(150); if(window.LUMEN&&LUMEN.state.generated.length>=28&&LUMEN.state.step===2) break; }
  var BV=LUMEN.BV;
  var o={cw:BV.cw,ch:BV.ch,pw:Math.round(BV.pw),ph:Math.round(BV.ph),N:BV.N,pages:BV.pages.length,
         stageRect:(function(){var r=BV.stage.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height)];})()};
  try{
    BV.cur=2; BV.off=BV.targetOff(); BV.offT=BV.off;
    BV.live={i:2,dir:'fwd',p:0.5}; BV.bowBoost=0; BV.layout(); BV.draw();
    o.draw='ok';
  }catch(e){ o.draw='ERR '+e.message+' | '+(e.stack||'').split('\n')[1]; }
  o.err=window.__err;
  var d=document.createElement('div'); d.id='__dbg'; d.setAttribute('data-r',JSON.stringify(o)); document.body.appendChild(d);
}
setTimeout(main,400);
})();
</script>"""
html=io.open(SRC,encoding="utf-8").read().replace("</body>",INJ+"</body>")
p=os.path.join(TMP,"dbg.html"); io.open(p,"w",encoding="utf-8",newline="\n").write(html)
cmd=[CHROME,"--headless","--disable-gpu","--no-sandbox","--mute-audio","--hide-scrollbars",
     "--window-size=1180,760","--virtual-time-budget=45000","--dump-dom","file:///"+p.replace("\\","/")]
r=subprocess.run(cmd,capture_output=True,timeout=300)
dom=r.stdout.decode("utf-8","replace")
m=re.search(r'id="__dbg" data-r="(.*?)"',dom,re.S)
print(H.unescape(m.group(1)) if m else "NO DBG\n"+dom[-2000:])
