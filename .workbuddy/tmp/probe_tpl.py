# -*- coding: utf-8 -*-
"""探针：胶片带卡片宽度 / CSS 变量 / dock 高度 到底是多少。"""
import io, os, re, subprocess, sys

SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/光匣-3D互动照片书.html"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"
WIN = sys.argv[1] if len(sys.argv) > 1 else "1496,805"

INJECT = r"""
<div id="__t"></div>
<script>
(function(){
  var T=document.getElementById('__t');
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  async function main(){
    var L=[];
    for(var i=0;i<200;i++){ await sleep(150); if(state.photos.length>=28) break; }
    setStep(0); await sleep(600);
    var bar=document.getElementById('tplbar');
    var card=bar.querySelector('.tplcard');
    var th=bar.querySelector('.tp-th');
    var cs=getComputedStyle(bar), csc=getComputedStyle(card);
    L.push('inner='+window.innerWidth+'x'+window.innerHeight+' dpr='+window.devicePixelRatio);
    L.push('dock h='+document.querySelector('.dock').getBoundingClientRect().height.toFixed(1));
    L.push('--dockH='+getComputedStyle(document.body).getPropertyValue('--dockH'));
    L.push('--tplW(bar)="'+cs.getPropertyValue('--tplW')+'" inline="'+bar.style.getPropertyValue('--tplW')+'"');
    L.push('card w='+csc.width+' h='+csc.height+' flexBasis='+csc.flexBasis+' display='+csc.display);
    L.push('card rect='+JSON.stringify(card.getBoundingClientRect().toJSON()));
    if(th) L.push('th rect='+JSON.stringify(th.getBoundingClientRect().toJSON())+' ar='+getComputedStyle(th).aspectRatio);
    L.push('bar pad='+cs.padding+' gap='+cs.gap+' scrollW='+bar.scrollWidth+' clientW='+bar.clientWidth);
    L.push('tabs h='+document.querySelector('.dock-tabs').getBoundingClientRect().height.toFixed(1));
    /* 手工设一遍变量看看是否生效 */
    bar.style.setProperty('--tplW','150px');
    await sleep(60);
    L.push('after inline150: card w='+card.getBoundingClientRect().width.toFixed(1)+' th h='+th.getBoundingClientRect().height.toFixed(1));
    bar.style.setProperty('--tplW','clamp(56px,calc((var(--dockH) - 47px)*.75),118px)');
    await sleep(60);
    L.push('after re-clamp: card w='+card.getBoundingClientRect().width.toFixed(1));
    T.setAttribute('data-log',L.join(' ;; '));
  }
  main();
})();
</script>
"""

html = io.open(SRC, encoding="utf-8").read()
out = html.replace("</body>", INJECT + "</body>")
test = os.path.join(os.path.dirname(SRC), ".workbuddy", "tmp", "_probe_tpl.html")
io.open(test, "w", encoding="utf-8", newline="\n").write(out)
w, h = WIN.split(",")
cmd = [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
       "--allow-file-access-from-files", "--virtual-time-budget=12000",
       "--window-size=%s,%s" % (w, h), "--dump-dom", "file:///" + test.replace("\\", "/")]
p = subprocess.run(cmd, capture_output=True)
doc = p.stdout.decode("utf-8", "replace")
m = re.search(r'data-log="([^"]*)"', doc)
print("VIEWPORT", WIN)
for part in (m.group(1) if m else "(none)").replace("&quot;", '"').replace("&amp;", "&").split(" ;; "):
    print("  " + part)
