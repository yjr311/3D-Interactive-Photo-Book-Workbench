# -*- coding: utf-8 -*-
"""无头 Chrome 自检：布局完整性 + 翻页交互 + 控制台报错。"""
import io, os, re, subprocess, sys

TMP = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"

INJECT = r"""
<div id="__test"></div>
<script>
(function(){
  var T=document.getElementById('__test');
  var errs=[];
  window.addEventListener('error',function(e){ errs.push(String(e.message)+' @'+e.lineno); });
  var _ce=console.error; console.error=function(){ errs.push('console:'+[].join.call(arguments,' ')); _ce.apply(console,arguments); };
  /* --virtual-time-budget 下 requestAnimationFrame 不触发，翻页动画永远推不完，
     会造成「键盘/拖拽没反应」的假警报。这里把 rAF 落到 setTimeout 上，
     虚拟时间会正常快进它。 */
  window.requestAnimationFrame=function(cb){ return setTimeout(function(){ cb(performance.now()); },16); };
  window.cancelAnimationFrame=function(id){ clearTimeout(id); };
  function set(k,v){ T.setAttribute('data-'+k,String(v)); }
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function pe(type,x,y,buttons){
    var ev=new PointerEvent(type,{clientX:x,clientY:y,bubbles:true,cancelable:true,pointerId:1,pointerType:'mouse',button:0,buttons:buttons});
    return ev;
  }
  function box(sel){
    var el=document.querySelector(sel);
    if(!el) return null;
    var r=el.getBoundingClientRect();
    return {t:r.top,b:r.bottom,l:r.left,r:r.right,w:r.width,h:r.height};
  }
  async function main(){
    try{
      /* 等示例照片载入（应用已不再自动成书，需显式触发生成） */
      for(var i=0;i<200;i++){ await sleep(150); if(state.photos.length>=28) break; }
      if(state.photos.length<28){ try{ await window.LUMEN.loadEmbedded(true); }catch(e){} }
      if(state.generated.length<28){ try{ await window.LUMEN.generate(); }catch(e){} }
      for(var i=0;i<200;i++){ await sleep(150); if(state.generated.length>=28 && state.step===2) break; }
      await sleep(1600);
      set('photos',state.photos.length);
      set('generated',state.generated.length);
      set('picked',state.generated.filter(function(g){return g.picked;}).length);
      set('step',state.step);
      var de=document.documentElement;
      set('docScrollH',de.scrollHeight);
      set('winH',window.innerHeight);
      set('winW',window.innerWidth);
      /* 底部胶片带 / 选片条是否被裁切 */
      var dock=box('.dock'), dk=box('.dock-inner'), bar=box('#tplbar');
      set('dock',dock?Math.round(dock.h):-1);
      set('dockBottom',dock?Math.round(dock.b):-1);
      var cards=[].slice.call(document.querySelectorAll('.tplcard'));
      set('cards',cards.length);
      var clipped=0; [].forEach.call(cards,function(c){
        var r=c.getBoundingClientRect();
        if(r.bottom>dock.b+0.5||r.top<dock.t-0.5) clipped++;
      });
      set('tplClipped',clipped);
      /* 回到第 2 步检查模版胶片带 */
      setStep(1);
      await sleep(500);
      var cards2=[].slice.call(document.querySelectorAll('.tplcard'));
      var dk2=box('.dock'), cl2=0, worst=0;
      [].forEach.call(cards2,function(c){
        var r=c.getBoundingClientRect();
        var over=Math.max(r.bottom-dk2.b, dk2.t-r.top);
        if(over>0.5){ cl2++; worst=Math.max(worst,over); }
      });
      set('tplCards',cards2.length);
      set('tplClipped2',cl2);
      set('tplWorst',worst.toFixed(1));
      var c0=cards2[0]?cards2[0].getBoundingClientRect():null;
      if(c0) set('cardBox',Math.round(c0.width)+'x'+Math.round(c0.height)+'@'+Math.round(c0.top));
      set('railThumbs',document.querySelectorAll('.rthumb').length);
      /* 回到第 3 步：书本 */
      setStep(2);
      await sleep(900);
      set('pages',BV.pages.length);
      set('sheets',BV.n);
      set('cur0',BV.cur);
      set('pw',BV.pw.toFixed(1)); set('ph',BV.ph.toFixed(1));
      set('cvw',BV.cw.toFixed(0)); set('cvh',BV.ch.toFixed(0));
      /* 画布中心像素（应有纸） */
      function px(fx,fy){
        var x=BV.cv.getContext('2d');
        var d=x.getImageData(Math.round(BV.cv.width*fx),Math.round(BV.cv.height*fy),1,1).data;
        return d[0]+','+d[1]+','+d[2]+','+d[3];
      }
      set('pxCenter',px(.5,.5));
      set('pxLeft',px(.25,.5));
      set('pxRight',px(.75,.5));
      /* 键盘翻页 */
      window.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));
      await sleep(900);
      set('afterKey',BV.cur);
      set('pxLeft2',px(.25,.5));
      /* 指针拖拽翻页 */
      var r=BV.cv.getBoundingClientRect();
      var spineC=r.left+(BV.spineX/BV.cw)*r.width;
      var y=r.top+r.height*0.5;
      var x0=spineC+r.width*0.16;
      BV.cv.dispatchEvent(pe('pointerdown',x0,y,1));
      await sleep(30);
      window.dispatchEvent(pe('pointermove',x0-120,y,1));
      await sleep(30);
      window.dispatchEvent(pe('pointermove',x0-260,y,1));
      await sleep(40);
      set('dragP',BV.live?BV.live.p.toFixed(2):'none');
      set('dragAngleDeg',BV.live?(BV.live.p*180).toFixed(0):'none');
      set('pxDrag',px(.42,.5));
      window.dispatchEvent(pe('pointerup',x0-260,y,0));
      await sleep(60);
      set('animDir',BV.anim?BV.anim.dir:'none');
      await sleep(1200);
      set('curAfterDrag',BV.cur);
      set('soundOn',Sound.isOn());
      set('dotsOK',1);
    }catch(e){ set('exception',e.message+' | '+e.stack.split('\n')[1]); }
    set('errors',errs.length);
    set('firstErr',errs.slice(0,3).join(' || '));
    set('done','1');
  }
  setTimeout(main,600);
})();
</script>
"""

html = io.open(SRC, encoding="utf-8").read()
test_path = os.path.join(TMP, "selfcheck.html")
io.open(test_path, "w", encoding="utf-8", newline="\n").write(html.replace("</body>", INJECT + "</body>"))

cmd = [CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio",
       "--window-size=1512,900", "--virtual-time-budget=45000",
       "--dump-dom", "file:///" + test_path.replace("\\", "/")]
out = subprocess.run(cmd, capture_output=True, timeout=300).stdout.decode("utf-8", "replace")
m = re.search(r'<div id="__test"([^>]*)>', out)
if not m:
    print("NO TEST NODE. len=", len(out))
    print(out[:2000])
    sys.exit(1)
attrs = dict(re.findall(r'data-([\w-]+)="([^"]*)"', m.group(1)))
for k in sorted(attrs):
    print("%-14s %s" % (k, attrs[k]))
