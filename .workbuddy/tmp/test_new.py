# -*- coding: utf-8 -*-
"""针对本轮新增交互的自检：模版预览平移/缩放、胶片带拖拽/缩放、选片条惯性/滚轮/键盘/点击。"""
import io, os, subprocess, sys

SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/光匣-3D互动照片书.html"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"
WIN = sys.argv[1] if len(sys.argv) > 1 else "1496,805"

INJECT = r"""
<div id="__t"></div>
<script>
(function(){
  var T=document.getElementById('__t');
  var errs=[];
  window.addEventListener('error',function(e){ errs.push(String(e.message)+'@'+e.lineno); });
  window.addEventListener('unhandledrejection',function(e){ errs.push('rej:'+((e.reason&&e.reason.message)||e.reason)); });
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function pe(t,x,y,b){ return new PointerEvent(t,{clientX:x,clientY:y,bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',button:0,buttons:b}); }
  function wh(el,dy,opt){ el.dispatchEvent(new WheelEvent('wheel',Object.assign({deltaY:dy,deltaX:0,deltaMode:0,bubbles:true,cancelable:true},opt||{}))); }
  function log(){ var s=Array.prototype.join.call(arguments,' '); T.setAttribute('data-l'+T.dataset.n,s); }
  var L=[];
  function say(s){ L.push(s); }
  async function main(){
    try{
      /* headless + virtual time 下 rAF 不稳定，换成 setTimeout 驱动的等价实现，便于确定性验证 */
      window.requestAnimationFrame=function(cb){ return setTimeout(function(){ cb(performance.now()); },16); };
      window.cancelAnimationFrame=function(id){ clearTimeout(id); };
      for(var i=0;i<240;i++){ await sleep(150); if(state.photos.length>=28) break; }
      /* 应用不再自动生成成片（曾把用户从步骤一顶到步骤二），显式触发 */
      if(state.photos.length<28){ try{ await window.LUMEN.loadEmbedded(true); }catch(e){} }
      if(state.generated.length<28){ try{ await window.LUMEN.generate(); }catch(e){} }
      for(i=0;i<240;i++){ await sleep(150); if(state.generated.length>=28&&BV.pages.length) break; }
      await sleep(500);

      /* ============ A. 模版预览：平移 / 缩放 / 复位 ============ */
      setStep(1); await sleep(500);
      var wrap=document.getElementById('pvWrap'), inner=document.getElementById('pvInner');
      say('A1 pv exists='+!!wrap+' ar='+PV.ar.toFixed(3)+' fit='+PV.fit.toFixed(3)+' zoom='+PV.zoom);
      var r=wrap.getBoundingClientRect();
      var t0=inner.style.transform;
      wrap.dispatchEvent(pe('pointerdown',r.left+r.width*.5,r.top+r.height*.5,1));
      wrap.dispatchEvent(pe('pointermove',r.left+r.width*.5+120,r.top+r.height*.5+60,1));
      wrap.dispatchEvent(pe('pointerup',r.left+r.width*.5+120,r.top+r.height*.5+60,0));
      say('A2 pan tx='+Math.round(PV.tx)+' ty='+Math.round(PV.ty)+' changed='+(inner.style.transform!==t0));

      /* 以光标为锚点缩放：光标下的内容点应保持不动 */
      PV.tx=0; PV.ty=0; pvApply();
      var cx=r.left+r.width*.30, cy=r.top+r.height*.34;
      var ox=cx-r.left-r.width/2, oy=cy-r.top-r.height/2;
      var s0=PV.fit*PV.zoom, ux=(ox-PV.tx)/s0, uy=(oy-PV.ty)/s0;
      wh(wrap,-420,{ctrlKey:true,clientX:cx,clientY:cy});
      var s1=PV.fit*PV.zoom, ux2=(ox-PV.tx)/s1, uy2=(oy-PV.ty)/s1;
      say('A3 zoom '+PV.zoom.toFixed(2)+'x anchorDrift='+Math.abs(ux-ux2).toFixed(2)+','+Math.abs(uy-uy2).toFixed(2)+' (px@nominal)');
      var cw0=document.getElementById('previewCv').width;
      await sleep(500);
      say('A4 crisp edge '+cw0+' -> '+document.getElementById('previewCv').width+' (zoom '+PV.zoom.toFixed(2)+')');
      document.getElementById('pvFit').click(); await sleep(400);
      say('A5 fit zoom='+PV.zoom.toFixed(2)+' tx='+Math.round(PV.tx)+' ty='+Math.round(PV.ty)+' cvW='+document.getElementById('previewCv').width);
      /* 缩放上下限 */
      for(i=0;i<30;i++) pvZoomAt(PV.zoom*1.4);
      say('A6 max zoom='+PV.zoom.toFixed(2)+' inBtnDisabled='+document.getElementById('pvZoomIn').disabled);
      for(i=0;i<40;i++) pvZoomAt(PV.zoom/1.4);
      say('A7 min zoom='+PV.zoom.toFixed(2)+' outBtnDisabled='+document.getElementById('pvZoomOut').disabled);
      pvReset(); await sleep(260);
      /* 拖出边界后应被夹回，不会丢失内容 */
      PV.tx=99999; PV.ty=-99999; pvApply();
      say('A8 clamped tx='+Math.round(PV.tx)+' ty='+Math.round(PV.ty)+' (box '+Math.round(r.width)+'x'+Math.round(r.height)+')');
      pvReset();

      /* ============ B. 胶片带：拖拽平移 / Ctrl+滚轮缩放 / 点击不被误触 ============ */
      setStep(0); await sleep(500);
      var bar=document.getElementById('tplbar');
      var cards=bar.querySelectorAll('.tplcard');
      var w0=cards[0].getBoundingClientRect().width;
      wh(bar,-300,{ctrlKey:true,clientX:400,clientY:700});
      say('B1 ctrlWheel cardW '+w0.toFixed(0)+'->'+cards[0].getBoundingClientRect().width.toFixed(0)+' var='+bar.style.getPropertyValue('--tplW'));
      wh(bar,900,{ctrlKey:true,clientX:400,clientY:700});
      say('B2 ctrlWheel out cardW='+cards[0].getBoundingClientRect().width.toFixed(0)+' var='+bar.style.getPropertyValue('--tplW'));
      wh(bar,-192,{ctrlKey:true,clientX:400,clientY:700});
      await sleep(60);
      var cwNow=bar.querySelector('.tplcard').getBoundingClientRect().width;
      var canScroll=bar.scrollWidth-bar.clientWidth;
      say('B3 cardW='+cwNow.toFixed(0)+' scrollable='+canScroll+'px contentW='+bar.scrollWidth+' barW='+bar.clientWidth);
      if(canScroll>10){
        bar.scrollLeft=Math.min(80,canScroll);
        var sl0=bar.scrollLeft;
        var br=bar.getBoundingClientRect();
        var y=br.top+br.height/2;
        bar.dispatchEvent(pe('pointerdown',700,y,1));
        bar.dispatchEvent(pe('pointermove',560,y,1));
        var sl1=bar.scrollLeft;
        bar.dispatchEvent(pe('pointerup',560,y,0));
        say('B4 drag scrollLeft '+Math.round(sl0)+'->'+Math.round(sl1)+' (期望 +140)');
        await sleep(700);
        say('B5 inertia settle scrollLeft='+Math.round(bar.scrollLeft));
        /* 拖拽结束后有 70ms 的 click 抑制窗口（替代旧的 moved 标志位，避免误吞后续点击） */
        say('B6 抑制窗口已过期 sup='+Math.round(TPLBAR.sup-performance.now())+'ms moved='+TPLBAR.moved);
        var c3=bar.querySelectorAll('.tplcard')[3];
        var r3=c3.getBoundingClientRect();
        c3.dispatchEvent(new MouseEvent('click',{bubbles:true,
          clientX:Math.round(r3.left+r3.width/2),clientY:Math.round(r3.top+r3.height/2)}));
        await sleep(60);
        say('B6b 抑制窗口过期后点击卡片生效 tpl='+state.tpl+' (期望 '+c3.dataset.tpl+')');
        /* 键盘可达 */
        var c1=bar.querySelectorAll('.tplcard')[2];
        c1.focus();
        c1.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));
        await sleep(200);
        say('B6b Enter on card -> tpl='+state.tpl+' aria='+(bar.querySelector('.tplcard.on')||{getAttribute:function(){return '?';}}).getAttribute('aria-pressed'));
      } else {
        say('B4-B6 skip (content fits, 无横向溢出)');
      }
      var tplBefore=state.tpl;
      var c2=cards[Math.min(4,cards.length-1)];
      c2.dispatchEvent(new MouseEvent('click',{bubbles:true}));
      await sleep(200);
      say('B7 click template '+tplBefore+'->'+state.tpl+' onClass='+document.querySelectorAll('.tplcard.on').length);
      say('B8 tpl names ok='+Array.prototype.every.call(document.querySelectorAll('.tp-nm'),function(n){return n.textContent.trim().length>0;}));

      /* ============ C. 选片条：惯性 / 滚轮 / 键盘 / 点击 ============ */
      setStep(2); await sleep(600);
      var strip=document.getElementById('strip');
      var its=strip.querySelectorAll('.sitem');
      say('C1 n='+its.length+' size='+its[0].style.width+'x'+its[0].style.height+
          ' ctr='+(document.querySelector('.sitem.ctr')||{dataset:{}}).dataset.i+' pos='+STRIP.pos);
      var sy=strip.getBoundingClientRect().top+strip.getBoundingClientRect().height/2;
      var x0=820;
      strip.dispatchEvent(pe('pointerdown',x0,sy,1));
      for(i=1;i<=8;i++){ strip.dispatchEvent(pe('pointermove',x0-i*45,sy,1)); await sleep(16); }
      strip.dispatchEvent(pe('pointerup',x0-360,sy,0));
      var mid=STRIP.pos, v0=STRIP.vel;
      await sleep(300);
      say('C2a fling mid='+mid.toFixed(2)+' v0='+v0.toFixed(3)+' target='+STRIP.target+' pos300='+STRIP.pos.toFixed(3)+' vel='+STRIP.vel.toFixed(4)+' raf='+STRIP.raf);
      await sleep(900);
      say('C2b pos1200='+STRIP.pos.toFixed(4)+' vel='+STRIP.vel.toFixed(5)+' raf='+STRIP.raf+' target='+STRIP.target);
      await sleep(1500);
      say('C2c pos2700='+STRIP.pos.toFixed(4)+' raf='+STRIP.raf+' integer='+(STRIP.pos===Math.round(STRIP.pos)));
      wh(strip,120,{clientX:x0,clientY:sy}); await sleep(600);
      say('C3 wheel -> pos='+STRIP.pos);
      wh(strip,360,{clientX:x0,clientY:sy}); wh(strip,-360,{clientX:x0,clientY:sy}); await sleep(120);
      strip.focus();
      strip.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})); await sleep(600);
      say('C4 keyRight -> pos='+STRIP.pos);
      strip.dispatchEvent(new KeyboardEvent('keydown',{key:'End',bubbles:true})); await sleep(700);
      say('C5 End -> pos='+STRIP.pos+' nextDisabled='+document.getElementById('stripNext').disabled);
      strip.dispatchEvent(new KeyboardEvent('keydown',{key:'Home',bubbles:true})); await sleep(700);
      say('C6 Home -> pos='+STRIP.pos+' prevDisabled='+document.getElementById('stripPrev').disabled);
      var far=strip.querySelectorAll('.sitem')[Math.min(6,its.length-1)];
      strip.dispatchEvent(pe('pointerdown',x0,sy,1));
      strip.dispatchEvent(pe('pointerup',x0,sy,0));
      far.dispatchEvent(new MouseEvent('click',{bubbles:true}));
      await sleep(700);
      say('C7 click side item 6 -> pos='+STRIP.pos+' (期望 6)');
      var ctr=document.querySelector('.sitem.ctr');
      var pi=R(STRIP.pos), before=state.generated[pi].picked;
      strip.dispatchEvent(pe('pointerdown',x0,sy,1));
      strip.dispatchEvent(pe('pointerup',x0,sy,0));
      ctr.dispatchEvent(new MouseEvent('click',{bubbles:true}));
      await sleep(250);
      say('C8 click center toggles pick '+before+'->'+state.generated[pi].picked+' clsPick='+ctr.classList.contains('pick'));
      document.getElementById('stripNext').click(); await sleep(600);
      say('C9 arrowBtn next -> pos='+STRIP.pos);

      /* 窗口尺寸变化后应重新量算 */
      say('C10 sizeAfterResize tplBarCards='+document.querySelectorAll('.tplcard').length);
      var de=document.documentElement;
      say('C11 overflow='+(de.scrollHeight>window.innerHeight+1?'OVERFLOW':'ok'));

      /* 单页模式与阅读器仍可用 */
      state.book.spread=false; scheduleBook(false); await sleep(700);
      say('C12 single pages='+BV.pages.length+' n='+BV.n+' cv='+Math.round(BV.cw)+'x'+Math.round(BV.ch));
      state.book.spread=true; scheduleBook(false);
    }catch(e){ say('THROW '+e.message+' @'+e.stack.split('\n')[1]); }
    T.setAttribute('data-log',L.join(' ;; '));
    T.setAttribute('data-err',errs.join(' | '));
  }
  main();
})();
</script>
"""

html = io.open(SRC, encoding="utf-8").read()
assert html.rstrip().endswith("</html>")
out = html.replace("</body>", INJECT + "</body>")
test = os.path.join(os.path.dirname(SRC), ".workbuddy", "tmp", "_test_new.html")
io.open(test, "w", encoding="utf-8", newline="\n").write(out)

w, h = WIN.split(",")
cmd = [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
       "--allow-file-access-from-files", "--virtual-time-budget=26000",
       "--window-size=%s,%s" % (w, h), "--dump-dom", "file:///" + test.replace("\\", "/")]
p = subprocess.run(cmd, capture_output=True)
doc = p.stdout.decode("utf-8", "replace")
import re
m = re.search(r'data-log="([^"]*)"', doc)
e = re.search(r'data-err="([^"]*)"', doc)
log = (m.group(1) if m else "(no log)").replace("&quot;", '"').replace("&amp;", "&")
err = e.group(1) if e else "(none)"
print("VIEWPORT", WIN)
print("errors:", err if err else "0")
for part in log.split(" ;; "):
    print("  " + part)
