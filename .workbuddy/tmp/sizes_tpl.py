# -*- coding: utf-8 -*-
"""多尺寸检查：胶片带卡片是否完整落在 dock 内、选片条卡片是否落在 strip 内、是否有滚动溢出。"""
import io, os, re, subprocess, sys

SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/光匣-3D互动照片书.html"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"
SIZES = ["1920x1080", "1600x1000", "1512x900", "1440x800", "1366x720", "1280x700", "1100x780", "900x700"]

INJECT = r"""
<div id="__t"></div>
<script>
(function(){
  var T=document.getElementById('__t');
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function R(n){ return Math.round(n); }
  async function main(){
    var L=[];
    for(var i=0;i<240;i++){ await sleep(150); if(state.photos.length>=28) break; }
    /* 应用不再自动生成成片，显式触发 */
    if(state.photos.length<28){ try{ await window.LUMEN.loadEmbedded(true); }catch(e){} }
    if(state.generated.length<28){ try{ await window.LUMEN.generate(); }catch(e){} }
    for(i=0;i<240;i++){ await sleep(150); if(state.generated.length>=28&&BV.pages.length) break; }
    var de=document.documentElement;
    function rect(s){ var e=document.querySelector(s); return e?e.getBoundingClientRect():null; }
    /* --- step0 胶片带 --- */
    setStep(0); await sleep(500);
    var dock=rect('.dock'), tabs=rect('.dock-tabs'), bar=rect('.tplbar'), card=rect('.tplcard'), th=rect('.tp-th');
    var nm=rect('.tp-nm');
    var fits=(th.top>=dock.top+1)&&(th.bottom<=dock.bottom-1);
    L.push('S0 dock='+R(dock.top)+'..'+R(dock.bottom)+'(h'+R(dock.height)+') tabsH='+R(tabs.height)+
           ' card='+R(card.width)+'x'+R(card.height)+' th='+R(th.width)+'x'+R(th.height)+
           ' thTop='+R(th.top)+' thBot='+R(th.bottom)+' fitsDock='+fits+
           ' barScroll='+(bar.scrollLeft)+'/'+R(document.querySelector('.tplbar').scrollWidth-document.querySelector('.tplbar').clientWidth)+
           ' nmVisible='+(!!nm&&nm.height>3));
    /* --- step2 选片条 --- */
    setStep(2); await sleep(600);
    var sdock=rect('.dock'), strip=rect('#strip'), s0=document.querySelector('.sitem');
    var s0r=s0?s0.getBoundingClientRect():null;
    var navR=rect('.strip-nav'), arrow=rect('.strip-arrow.next');
    L.push('S2 dock='+R(sdock.top)+'..'+R(sdock.bottom)+' stripH='+R(strip.height)+
           ' item='+(s0r?R(s0r.width)+'x'+R(s0r.height):'-')+
           ' itemTop='+(s0r?R(s0r.top):'-')+' itemBot='+(s0r?R(s0r.bottom):'-')+
           ' fitsStrip='+(!!s0r&&s0r.top>=strip.top+1&&s0r.bottom<=navR.top+1)+
           ' navH='+R(navR.height)+' arrow='+R(arrow.width)+'x'+R(arrow.height));
    L.push('VP '+window.innerWidth+'x'+window.innerHeight+
           ' overflow='+(de.scrollHeight>window.innerHeight+1?'OVERFLOW':'ok'));
    T.setAttribute('data-log',L.join(' ;; '));
  }
  main();
})();
</script>
"""

html = io.open(SRC, encoding="utf-8").read()
out = html.replace("</body>", INJECT + "</body>")
test = os.path.join(os.path.dirname(SRC), ".workbuddy", "tmp", "_sizes_tpl.html")
io.open(test, "w", encoding="utf-8", newline="\n").write(out)

for s in SIZES:
    w, h = s.split("x")
    cmd = [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
           "--allow-file-access-from-files", "--virtual-time-budget=24000",
           "--window-size=%s,%s" % (w, h), "--dump-dom", "file:///" + test.replace("\\", "/")]
    p = subprocess.run(cmd, capture_output=True)
    doc = p.stdout.decode("utf-8", "replace")
    m = re.search(r'data-log="([^"]*)"', doc)
    log = (m.group(1) if m else "(none)").replace("&quot;", '"').replace("&amp;", "&").replace("&gt;", ">")
    print("== " + s)
    for part in log.split(" ;; "):
        print("   " + part)
