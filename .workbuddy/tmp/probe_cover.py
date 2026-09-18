import io, os, re, subprocess

TMP = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/光匣-3D互动照片书.html"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"

INJECT = r"""
<div id="__t"></div>
<script>
(function(){
  var T=document.getElementById('__t');
  function set(k,v){ T.setAttribute('data-'+k,String(v)); }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  async function main(){
    try{
      for(var i=0;i<240;i++){ await sleep(150); if(state.photos.length>=28) break; }
      if(state.photos.length<28){ try{ await window.LUMEN.loadEmbedded(true); }catch(e){} }
      if(state.generated.length<28){ try{ await window.LUMEN.generate(); }catch(e){} }
      for(i=0;i<240;i++){ await sleep(150); if(state.generated.length>=28) break; }
      setStep(2); BV.spread=true; state.book.spread=true;
      BV.anim=null; BV.live=null; BV.cur=0;
      BV.offT=BV.targetOff(); BV.off=BV.offT; BV.layout(); BV.draw();
      await sleep(400);
      BV.draw();
      var ctx=BV.ctx, dpr=BV.dpr;
      /* 画布上「名义左页槽位」里到底有没有墨？ */
      function alphaBand(x0,x1){
        x0=Math.max(0,Math.round(x0*dpr)); x1=Math.min(BV.cv.width,Math.round(x1*dpr));
        var d=ctx.getImageData(0,0,BV.cv.width,BV.cv.height).data, s=0,n=0,mx=0;
        var y0=Math.round((BV.top+BV.ph*0.25)*dpr), y1=Math.round((BV.top+BV.ph*0.75)*dpr);
        for(var y=y0;y<y1;y+=2) for(var x=x0;x<x1;x+=2){ var a=d[(y*BV.cv.width+x)*4+3]; s+=a; n++; if(a>mx) mx=a; }
        return {avg:+(s/Math.max(1,n)).toFixed(1), max:mx, n:n};
      }
      set('spine', Math.round(BV.spineX));
      set('pw', Math.round(BV.pw));
      set('off', BV.off.toFixed(1));
      set('cur', BV.cur);
      set('spread', BV.spread);
      set('sxLeftEdge', Math.round(BV.spineX-BV.pw));
      set('slotLeft', JSON.stringify(alphaBand(BV.spineX-BV.pw+20, BV.spineX-60)));
      set('slotRight', JSON.stringify(alphaBand(BV.spineX+60, BV.spineX+BV.pw-20)));
      set('under', JSON.stringify(BV.restFor(BV.cur)));
      set('pages', BV.pages.length);
      /* 桌面（书外）——应当是纯透明 */
      set('deskFar', JSON.stringify(alphaBand(BV.spineX-BV.pw-90, BV.spineX-BV.pw-30)));
      /* 采样几个具体像素的颜色 */
      function px(x,y){ var d=ctx.getImageData(Math.round(x*dpr),Math.round(y*dpr),1,1).data; return d[0]+','+d[1]+','+d[2]+','+d[3]; }
      set('pxSlotL', px(BV.spineX-BV.pw*0.5, BV.top+BV.ph*0.5));
      set('pxSlotR', px(BV.spineX+BV.pw*0.5, BV.top+BV.ph*0.5));
      set('pxNearSpineL', px(BV.spineX-12, BV.top+BV.ph*0.5));
      set('pxNearSpineR', px(BV.spineX+12, BV.top+BV.ph*0.5));
      set('paper', state.book.paper||'');
    }catch(e){ set('exception', e.message+' | '+(e.stack||'').split('\n')[1]); }
    set('done','1');
  }
  setTimeout(main,600);
})();
</script>
"""

html = io.open(SRC, encoding="utf-8").read()
p = os.path.join(TMP, "probe_cover.html")
io.open(p, "w", encoding="utf-8", newline="\n").write(html.replace("</body>", INJECT + "</body>"))
cmd = [CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio",
       "--window-size=1512,900", "--virtual-time-budget=45000",
       "--dump-dom", "file:///" + p.replace("\\", "/")]
out = subprocess.run(cmd, capture_output=True, timeout=300).stdout.decode("utf-8", "replace")
m = re.search(r'<div id="__t"([^>]*)>', out)
if not m:
    print("NO TEST NODE"); print(out[:1500]); raise SystemExit(1)
attrs = dict(re.findall(r'data-([\w-]+)="([^"]*)"', m.group(1)))
for k in sorted(attrs):
    print("%-14s %s" % (k, attrs[k]))
