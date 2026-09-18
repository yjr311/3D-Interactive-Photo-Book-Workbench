# -*- coding: utf-8 -*-
"""光匣 v2 综合自检：布局 / 书页 / 键盘 / 拖拽 / 单页模式 / 阅读器 / 报错。"""
import io, os, re, subprocess, sys

TMP = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/光匣-3D互动照片书.html"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"

INJECT = r"""
<div id="__test"></div>
<script>
(function(){
  var T=document.getElementById('__test');
  var errs=[];
  window.addEventListener('error',function(e){ errs.push(String(e.message)+'@'+e.lineno); });
  window.addEventListener('unhandledrejection',function(e){ errs.push('rej:'+((e.reason&&e.reason.message)||e.reason)); });
  function set(k,v){ T.setAttribute('data-'+k,String(v)); }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function pe(t,x,y,b){ return new PointerEvent(t,{clientX:x,clientY:y,bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',button:0,buttons:b}); }
  async function pump(ms){
    var end=performance.now()+ms, bad='';
    while(performance.now()<end){
      BV.raf=0;
      try{ BV.step(performance.now()); }catch(e){ bad=bad||('PUMP:'+e.message); }
      await sleep(8);
    }
    return bad||'ok';
  }
  function px(fx,fy){
    try{
      var d=BV.cv.getContext('2d').getImageData(Math.round(BV.cv.width*fx),Math.round(BV.cv.height*fy),1,1).data;
      return d[0]+','+d[1]+','+d[2]+','+d[3];
    }catch(e){ return 'ERR:'+e.message; }
  }
  /* 书页区域的“非空白覆盖率”：判断确实画出了内容 */
  function inkRatio(){
    try{
      var c=BV.cv, ctx=c.getContext('2d');
      var w=Math.round(c.width*0.5), h=Math.round(c.height*0.5);
      var d=ctx.getImageData(Math.round(c.width*0.25),Math.round(c.height*0.25),w,h).data;
      var n=0, tot=0;
      for(var i=0;i<d.length;i+=4*37){
        tot++;
        if(d[i+3]>10 && (d[i]<235||d[i+1]<235||d[i+2]<235)) n++;
      }
      return tot? (n/tot).toFixed(2) : '0';
    }catch(e){ return 'ERR'; }
  }
  var log=[];
  async function main(){
    try{
      for(var i=0;i<200;i++){ await sleep(150); if(state.photos.length>=28) break; }
      /* 应用不再自动生成成片，显式触发 */
      if(state.photos.length<28){ try{ await window.LUMEN.loadEmbedded(true); }catch(e){} }
      if(state.generated.length<28){ try{ await window.LUMEN.generate(); }catch(e){} }
      for(i=0;i<200;i++){ await sleep(150); if(state.generated.length>=28&&state.step===2) break; }
      log.push('gen='+state.generated.length+' step='+state.step+' photos='+state.photos.length);
      await pump(1500);
      log.push('cur0='+BV.cur+' intro='+(BV._intro?1:0));
      /* 布局 */
      var de=document.documentElement;
      log.push('docScroll='+(de.scrollHeight>window.innerHeight+1?'OVERFLOW':'ok')+' win='+window.innerWidth+'x'+window.innerHeight);
      var dock=document.querySelector('.dock').getBoundingClientRect();
      var body=document.getElementById('stageBody').getBoundingClientRect();
      log.push('dockH='+Math.round(dock.height)+' dockBottom='+Math.round(dock.bottom)+' stageH='+Math.round(body.height));
      /* 画布内容 */
      log.push('book pages='+BV.pages.length+' sheets='+BV.n+' pw='+BV.pw.toFixed(0)+' cv='+Math.round(BV.cw)+'x'+Math.round(BV.ch));
      log.push('ink='+inkRatio()+' pxL='+px(.3,.5)+' pxR='+px(.7,.5));
      /* 键盘翻页 */
      var before=BV.cur;
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
      var mn=BV.anim?('i'+BV.anim.i+'/'+BV.anim.p1):'none';
      await pump(900);
      log.push('key: anim='+mn+' '+before+'->'+BV.cur);
      log.push('inkKey='+inkRatio());
      /* 拖拽前进 */
      var r=BV.cv.getBoundingClientRect();
      var spine=r.left+(BV.spineX/BV.cw)*r.width, y=r.top+r.height*0.5;
      var x0=spine+r.width*0.22;
      var c1=BV.cur;
      BV.cv.dispatchEvent(pe('pointerdown',x0,y,1));
      await sleep(20);
      window.dispatchEvent(pe('pointermove',x0-150,y,1));
      await sleep(20);
      window.dispatchEvent(pe('pointermove',x0-260,y,1));
      await sleep(30);
      var midP=BV.live?BV.live.p.toFixed(2):'none';
      var midInk=inkRatio();
      window.dispatchEvent(pe('pointerup',x0-260,y,0));
      await pump(900);
      log.push('drag: p='+midP+' ang='+(BV.live?(+midP*180).toFixed(0):'-')+' '+c1+'->'+BV.cur+' midInk='+midInk);
      /* 拖拽后退（从左侧拖回） */
      var c2=BV.cur;
      var x1=r.left+10;
      BV.cv.dispatchEvent(pe('pointerdown',x1,y,1));
      await sleep(20);
      var bp=BV.live?(BV.live.p.toFixed(2)+'/'+BV.live.dir):'none';
      window.dispatchEvent(pe('pointermove',x1+250,y,1));
      await sleep(30);
      var bp2=BV.live?BV.live.p.toFixed(2):'none';
      window.dispatchEvent(pe('pointerup',x1+250,y,0));
      await pump(900);
      log.push('back: p='+bp+'->'+bp2+' '+c2+'->'+BV.cur);
      /* 跳页 */
      BV.go(6); await pump(1500);
      log.push('go6 cur='+BV.cur);
      /* 单页模式 */
      state.book.spread=false; setStep(0); setStep(2); await pump(700);
      log.push('single: n='+BV.n+' pages='+BV.pages.length+' spine='+Math.round(BV.spineX)+' halfW='+Math.round(BV.cw/2));
      var sc=BV.cur; BV.next(); await pump(900);
      log.push('single flip '+sc+'->'+BV.cur+' ink='+inkRatio()+' pxC='+px(.5,.5));
      state.book.spread=true; setStep(0); setStep(2); await pump(700);
      /* 阅读器 */
      openReader(); await pump(400);
      log.push('reader on='+document.getElementById('reader').classList.contains('on')+' cvW='+Math.round(BV.cw)+'x'+Math.round(BV.ch)+' ink='+inkRatio());
      closeReader(); await pump(400);
      log.push('reader closed, stage has bv='+(document.getElementById('stageBody').contains(BV.el)?1:0)+' ink='+inkRatio());
      /* 明暗主题 */
      document.getElementById('themeBtn').click();
      log.push('theme='+document.documentElement.getAttribute('data-theme'));
      document.getElementById('themeBtn').click();
    }catch(e){ log.push('EXC:'+e.message+' @@ '+(e.stack||'').split('\n')[1]); }
    set('log',log.join(' ;; '));
    set('errors',errs.length);
    set('firstErr',errs.slice(0,2).join(' | '));
    set('done','1');
  }
  setTimeout(main,300);
})();
</script>
"""

html = io.open(SRC, encoding="utf-8").read()
p = os.path.join(TMP, "test_all.html")
io.open(p, "w", encoding="utf-8", newline="\n").write(html.replace("</body>", INJECT + "</body>"))
cmd = [CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio",
       "--window-size=1512,900", "--virtual-time-budget=120000", "--dump-dom",
       "file:///" + p.replace("\\", "/")]
out = subprocess.run(cmd, capture_output=True, timeout=600).stdout.decode("utf-8", "replace")
m = re.search(r'<div id="__test"([^>]*)>', out)
if not m:
    print("NO NODE", len(out)); print(out[:1500]); sys.exit(1)
attrs = dict(re.findall(r'data-([\w-]+)="([^"]*)"', m.group(1)))
for k in ('done', 'errors', 'firstErr', 'log'):
    print(k, "=", attrs.get(k))
for item in attrs.get('log', '').split(' ;; '):
    print("   ", item)
