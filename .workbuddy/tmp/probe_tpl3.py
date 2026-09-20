# -*- coding: utf-8 -*-
import io, os, re, subprocess, sys

SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"
WIN = sys.argv[1] if len(sys.argv) > 1 else "1480,710"

INJECT = r"""
<div id="__t"></div>
<script>
(function(){
  var T=document.getElementById('__t');
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  async function main(){
    var L=[];
    for(var i=0;i<200;i++){ await sleep(150); if(state.photos.length>=28) break; }
    setStep(0); await sleep(700);
    var bar=document.getElementById('tplbar');
    var all=document.querySelectorAll('#tplbar .tplcard');
    var c=all[0];
    L.push('count='+all.length+' barId='+bar.id+' barChildren='+bar.children.length);
    L.push('cardParent='+c.parentElement.id+'/'+c.parentElement.className);
    L.push('cardHTML='+c.outerHTML.slice(0,110));
    var cs=getComputedStyle(c);
    L.push('W='+cs.width+' offsetW='+c.offsetWidth+' flex='+cs.flexGrow+'/'+cs.flexShrink+'/'+cs.flexBasis+
           ' minW='+cs.minWidth+' maxW='+cs.maxWidth+' pos='+cs.position+' disp='+cs.display+' ar='+cs.aspectRatio+' zoom='+cs.zoom);
    bar.style.setProperty('--tplW','150px');
    await sleep(100);
    L.push('AFTER var150: W='+getComputedStyle(c).width+' rect='+c.getBoundingClientRect().width.toFixed(2)+' offsetW='+c.offsetWidth);
    c.style.setProperty('width','150px','important');
    await sleep(100);
    L.push('AFTER card width!important: W='+getComputedStyle(c).width+' rect='+c.getBoundingClientRect().width.toFixed(2)+' offsetW='+c.offsetWidth);
    c.style.removeProperty('width');
    var th=c.firstElementChild;
    L.push('th tag='+th.tagName+' cls='+th.className+' disp='+getComputedStyle(th).display+' W='+getComputedStyle(th).width);
    /* 是否有祖先带 transform */
    var p=c, chain=[];
    while(p&&p!==document.body){ var t=getComputedStyle(p).transform; if(t&&t!=='none') chain.push(p.tagName+'.'+p.className+' '+t); p=p.parentElement; }
    L.push('ancestorTransforms='+(chain.join(' | ')||'none'));
    /* 直接量 canvas 里第一张 */
    L.push('supports clamp='+CSS.supports('width','clamp(56px,calc((124px - 47px)*.75),118px)'));
    /* 用一个新的 div 测同样的变量 */
    var d=document.createElement('div'); d.style.cssText='width:var(--tplW);height:4px';
    bar.appendChild(d); await sleep(60);
    L.push('probeDiv W='+getComputedStyle(d).width);
    d.remove();
    T.setAttribute('data-log',L.join(' ;; '));
  }
  main();
})();
</script>
"""

html = io.open(SRC, encoding="utf-8").read()
out = html.replace("</body>", INJECT + "</body>")
test = os.path.join(os.path.dirname(SRC), ".workbuddy", "tmp", "_probe_tpl3.html")
io.open(test, "w", encoding="utf-8", newline="\n").write(out)
w_, h_ = WIN.split(",")
cmd = [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
       "--allow-file-access-from-files", "--virtual-time-budget=12000",
       "--window-size=%s,%s" % (w_, h_), "--dump-dom", "file:///" + test.replace("\\", "/")]
p = subprocess.run(cmd, capture_output=True)
doc = p.stdout.decode("utf-8", "replace")
m = re.search(r'data-log="([^"]*)"', doc)
print("VIEWPORT", WIN)
for part in (m.group(1) if m else "(none)").replace("&quot;", '"').replace("&amp;", "&").replace("&gt;", ">").replace("&lt;", "<").split(" ;; "):
    print("  " + part)
