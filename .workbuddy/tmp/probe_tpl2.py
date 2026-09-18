# -*- coding: utf-8 -*-
import io, os, re, subprocess, sys

SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/光匣-3D互动照片书.html"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"
WIN = sys.argv[1] if len(sys.argv) > 1 else "1480,710"

INJECT = r"""
<div id="__t"></div>
<script>
(function(){
  var T=document.getElementById('__t');
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function q(){ return document.querySelector('#tplbar .tplcard'); }
  function w(){ var c=q(); return c?c.getBoundingClientRect().width.toFixed(2):'none'; }
  async function main(){
    var L=[];
    for(var i=0;i<200;i++){ await sleep(150); if(state.photos.length>=28) break; }
    setStep(0); await sleep(700);
    L.push('inner='+window.innerWidth+'x'+window.innerHeight);
    L.push('t0 width='+w());
    var bar=document.getElementById('tplbar');
    bar.style.setProperty('--tplW','150px');
    await sleep(80);
    L.push('inline="'+bar.style.getPropertyValue('--tplW')+'" cssText="'+bar.style.cssText+'"');
    L.push('barComputed="'+getComputedStyle(bar).getPropertyValue('--tplW')+'"');
    L.push('cardComputed="'+getComputedStyle(q()).getPropertyValue('--tplW')+'" cardWidthProp='+getComputedStyle(q()).width);
    L.push('t1 width='+w());
    var c=q(); c.style.width='150px';
    await sleep(60);
    L.push('t2 width after element inline='+w());
    c.style.width='';
    /* 直接改 :root 的 --dockH */
    document.documentElement.style.setProperty('--dockH','220px');
    await sleep(80);
    L.push('t3 after --dockH=220 width='+w()+' dockH='+document.querySelector('.dock').getBoundingClientRect().height.toFixed(1));
    document.documentElement.style.removeProperty('--dockH');
    await sleep(60);
    /* 统计所有命中 .tplcard 的规则 */
    var hits=[];
    for(var s=0;s<document.styleSheets.length;s++){
      var rs; try{ rs=document.styleSheets[s].cssRules; }catch(e){ continue; }
      (function walk(list){
        for(var j=0;j<list.length;j++){
          var r=list[j];
          if(r.cssRules&&!r.selectorText){ walk(r.cssRules); continue; }
          if(r.selectorText&&/tplcard|tplbar|tp-th/.test(r.selectorText)){
            hits.push(r.selectorText+' { '+r.style.cssText.slice(0,120)+' }');
          }
        }
      })(rs);
    }
    L.push('rules: '+hits.join(' || '));
    T.setAttribute('data-log',L.join(' ;; '));
  }
  main();
})();
</script>
"""

html = io.open(SRC, encoding="utf-8").read()
out = html.replace("</body>", INJECT + "</body>")
test = os.path.join(os.path.dirname(SRC), ".workbuddy", "tmp", "_probe_tpl2.html")
io.open(test, "w", encoding="utf-8", newline="\n").write(out)
w_, h_ = WIN.split(",")
cmd = [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
       "--allow-file-access-from-files", "--virtual-time-budget=12000",
       "--window-size=%s,%s" % (w_, h_), "--dump-dom", "file:///" + test.replace("\\", "/")]
p = subprocess.run(cmd, capture_output=True)
doc = p.stdout.decode("utf-8", "replace")
m = re.search(r'data-log="([^"]*)"', doc)
print("VIEWPORT", WIN)
for part in (m.group(1) if m else "(none)").replace("&quot;", '"').replace("&amp;", "&").replace("&gt;", ">").split(" ;; "):
    print("  " + part)
