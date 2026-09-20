# -*- coding: utf-8 -*-
"""直接调用 generate() 并抓取异常。"""
import io, os, re, subprocess, sys

TMP = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"

INJECT = r"""
<div id="__test"></div>
<script>
(function(){
  var T=document.getElementById('__test');
  function set(k,v){ T.setAttribute('data-'+k,String(v)); }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  async function main(){
    var log=[];
    for(var i=0;i<80;i++){ await sleep(200); if(state.photos.length>=28) break; }
    set('photos',state.photos.length);
    try{
      var art=renderCanvas(state.photos[0],state.tpl,state.opts,1280);
      log.push('renderCanvas '+art.width+'x'+art.height);
      var fin=finalize(art);
      log.push('finalize '+fin.width);
      var th=makeThumb(fin);
      log.push('thumb '+th.slice(0,24)+' len='+th.length);
    }catch(e){ log.push('ERR-stage1:'+e.message+' @@ '+(e.stack||'').split('\n').slice(0,3).join(' | ')); }
    try{ await generate(); log.push('generate ok, n='+state.generated.length+' step='+state.step); }
    catch(e){ log.push('ERR-generate:'+e.message+' @@ '+(e.stack||'').split('\n').slice(0,4).join(' | ')); }
    try{
      var r=buildBookPages();
      log.push('book pages='+r.pages.length+' ratio='+r.ratio.toFixed(3));
    }catch(e){ log.push('ERR-book:'+e.message+' @@ '+(e.stack||'').split('\n').slice(0,4).join(' | ')); }
    set('log',log.join(' ;; '));
    set('done','1');
  }
  setTimeout(main,300);
})();
</script>
"""

html = io.open(SRC, encoding="utf-8").read()
p = os.path.join(TMP, "gen_test.html")
io.open(p, "w", encoding="utf-8", newline="\n").write(html.replace("</body>", INJECT + "</body>"))
cmd = [CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio",
       "--window-size=1512,900", "--virtual-time-budget=60000", "--dump-dom",
       "file:///" + p.replace("\\", "/")]
out = subprocess.run(cmd, capture_output=True, timeout=300).stdout.decode("utf-8", "replace")
m = re.search(r'<div id="__test"([^>]*)>', out)
if not m:
    print("NO NODE", len(out)); print(out[:1500]); sys.exit(1)
attrs = dict(re.findall(r'data-([\w-]+)="([^"]*)"', m.group(1)))
for k in sorted(attrs):
    print(k, "=", attrs[k])
