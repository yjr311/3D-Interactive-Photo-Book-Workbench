# -*- coding: utf-8 -*-
import io, os, re, subprocess
SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"
INJECT = r"""
<div id="__t"></div><script>
(function(){var T=document.getElementById('__t');
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
async function main(){var L=[];
 for(var i=0;i<240;i++){await sleep(150);if(state.photos.length>=28)break;}
 var s=state.photos.slice(0,5).map(function(p){return p.name+':'+p.img.naturalWidth+'x'+p.img.naturalHeight;});
 L.push('sources '+s.join(' '));
 L.push('spec.longEdge='+state.spec.longEdge+' gen[0] canvas='+state.generated[0].canvas.width+'x'+state.generated[0].canvas.height);
 setStep(1); await sleep(600);
 L.push('pvEdge@fit='+pvEdge()+' ar='+PV.ar.toFixed(3));
 pvZoomAt(2.15); await sleep(600);
 L.push('pvEdge@2.15='+pvEdge()+' cv='+document.getElementById('previewCv').width+'x'+document.getElementById('previewCv').height);
 L.push('inner='+getComputedStyle(document.getElementById('pvInner')).width+'x'+getComputedStyle(document.getElementById('pvInner')).height+' tf='+document.getElementById('pvInner').style.transform);
 T.setAttribute('data-log',L.join(' ;; '));}
 main();})();</script>
"""
html = io.open(SRC, encoding="utf-8").read()
out = html.replace("</body>", INJECT + "</body>")
t = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/_res.html"
io.open(t,"w",encoding="utf-8",newline="\n").write(out)
p=subprocess.run([CHROME,"--headless=new","--disable-gpu","--no-sandbox","--hide-scrollbars",
  "--allow-file-access-from-files","--virtual-time-budget=24000","--window-size=1512,900",
  "--dump-dom","file:///"+t],capture_output=True)
d=p.stdout.decode("utf-8","replace")
m=re.search(r'data-log="([^"]*)"',d)
print((m.group(1) if m else "none").replace("&quot;",'"'))
