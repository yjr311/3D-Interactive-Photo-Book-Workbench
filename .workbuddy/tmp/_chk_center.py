# -*- coding: utf-8 -*-
import io, os, re, subprocess
SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/光匣-3D互动照片书.html"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"
INJECT = r"""
<div id="__t"></div><script>
(function(){var T=document.getElementById('__t');
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
async function main(){var L=[];
 for(var i=0;i<240;i++){await sleep(150);if(state.generated.length>=28)break;}
 setStep(0);await sleep(600);
 var bar=document.getElementById('tplbar'),c=bar.querySelector('.tplcard');
 var br=bar.getBoundingClientRect(),cr=c.getBoundingClientRect();
 L.push('barW='+Math.round(br.width)+' contentW='+bar.scrollWidth+' firstCardX='+Math.round(cr.left)+
        ' leftGap='+Math.round(cr.left-br.left)+' rightGap='+Math.round(br.right-cr.right)+
        ' card='+Math.round(cr.width)+'x'+Math.round(cr.height)+' over='+(bar.scrollWidth-bar.clientWidth));
 L.push('justify='+getComputedStyle(bar).justifyContent);
 T.setAttribute('data-log',L.join(' ;; '));}
 main();})();</script>
"""
html = io.open(SRC, encoding="utf-8").read()
out = html.replace("</body>", INJECT + "</body>")
t = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/_center.html"
io.open(t,"w",encoding="utf-8",newline="\n").write(out)
for size in ["1920,1080","1512,900","1100,780"]:
    w,h=size.split(",")
    p=subprocess.run([CHROME,"--headless=new","--disable-gpu","--no-sandbox","--hide-scrollbars",
      "--allow-file-access-from-files","--virtual-time-budget=24000","--window-size=%s,%s"%(w,h),
      "--dump-dom","file:///"+t],capture_output=True)
    d=p.stdout.decode("utf-8","replace")
    m=re.search(r'data-log="([^"]*)"',d)
    print(size, (m.group(1) if m else "none").replace("&quot;",'"'))
