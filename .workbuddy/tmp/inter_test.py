# -*- coding: utf-8 -*-
"""聚焦测试：键盘翻页 + 拖拽翻页 + 单页模式。"""
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
  function pe(type,x,y,b){ return new PointerEvent(type,{clientX:x,clientY:y,bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',button:0,buttons:b}); }
  /* 真实时间推进 + 手动驱动帧（无头虚拟时间下 rAF 不推进） */
  async function pump(ms){
    var end=performance.now()+ms;
    while(performance.now()<end){
      BV.raf=0; try{ BV.step(performance.now()); }catch(e){ return 'PUMP:'+e.message; }
      await sleep(10);
    }
    return 'ok';
  }
  var keys=0;
  window.addEventListener('keydown',function(){ keys++; },true);
  async function main(){
    try{
      for(var i=0;i<160;i++){ await sleep(200); if(state.generated.length>=20) break; }
      log.push('pump0='+await pump(2800));
      set('step',state.step); set('cur0',BV.cur); set('anim0',BV.anim?BV.anim.p.toFixed(2):'none');
      var log=[];
      /* 键盘 */
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
      log.push('keyfired='+keys+' animNow='+(BV.anim?('i'+BV.anim.i+'p1_'+BV.anim.p1):'none')+' cur='+BV.cur);
      await pump(1000);
      log.push('after1s cur='+BV.cur);
      /* 直接调用 next */
      BV.next();
      await pump(1000);
      log.push('afterNext cur='+BV.cur);
      /* 拖拽 */
      var r=BV.cv.getBoundingClientRect();
      var spine=r.left+(BV.spineX/BV.cw)*r.width;
      var y=r.top+r.height*0.5, x0=spine+r.width*0.22;
      log.push('rect w='+r.width.toFixed(0)+' spine='+spine.toFixed(0));
      BV.cv.dispatchEvent(pe('pointerdown',x0,y,1));
      await sleep(30);
      log.push('liveP='+(BV.live?BV.live.p.toFixed(2):'none'));
      window.dispatchEvent(pe('pointermove',x0-140,y,1));
      await sleep(30);
      window.dispatchEvent(pe('pointermove',x0-240,y,1));
      await sleep(40);
      log.push('dragP='+(BV.live?BV.live.p.toFixed(2):'none')+' ang='+(BV.live?(BV.live.p*180).toFixed(0):'-'));
      window.dispatchEvent(pe('pointerup',x0-240,y,0));
      await pump(1000);
      log.push('afterDrag cur='+BV.cur);
      /* 反向拖拽 */
      var x1=r.left+8;
      BV.cv.dispatchEvent(pe('pointerdown',x1,y,1));
      await sleep(30);
      log.push('backLiveP='+(BV.live?BV.live.p.toFixed(2)+' dir='+BV.live.dir:'none'));
      window.dispatchEvent(pe('pointermove',x1+240,y,1));
      await sleep(60);
      log.push('backDragP='+(BV.live?BV.live.p.toFixed(2):'none'));
      window.dispatchEvent(pe('pointerup',x1+240,y,0));
      await pump(1000);
      log.push('afterBack cur='+BV.cur);
      /* 单页模式 */
      state.book.spread=false; setStep(0); setStep(2);
      await sleep(700);
      log.push('single n='+BV.n+' pages='+BV.pages.length+' pw='+BV.pw.toFixed(0)+' spine='+BV.spineX.toFixed(0));
      BV.next(); log.push('pw='+await pump(1000));
      log.push('single afterNext cur='+BV.cur);
      var d=BV.cv.getContext('2d').getImageData(Math.round(BV.cv.width*.5),Math.round(BV.cv.height*.5),1,1).data;
      log.push('single center px='+d.join(','));
      state.book.spread=true;
      set('log',log.join(' ;; '));
    }catch(e){ set('log','EXC:'+e.message); }
    set('done','1');
  }
  setTimeout(main,300);
})();
</script>
"""

html = io.open(SRC, encoding="utf-8").read()
p = os.path.join(TMP, "inter_test.html")
io.open(p, "w", encoding="utf-8", newline="\n").write(html.replace("</body>", INJECT + "</body>"))
cmd = [CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio",
       "--window-size=1512,900", "--virtual-time-budget=90000", "--dump-dom",
       "file:///" + p.replace("\\", "/")]
out = subprocess.run(cmd, capture_output=True, timeout=400).stdout.decode("utf-8", "replace")
m = re.search(r'<div id="__test"([^>]*)>', out)
if not m:
    print("NO NODE", len(out)); print(out[:1200]); sys.exit(1)
attrs = dict(re.findall(r'data-([\w-]+)="([^"]*)"', m.group(1)))
for k in sorted(attrs):
    print(k, "=", attrs[k])
