import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9522, windowSize: '1440,900' });
await b.goto(FILE, 2600);
await sleep(700);
async function ev(body){
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const o = JSON.parse(raw); if(o.__err) console.log('  [err] '+o.__err); return o;
}
await ev(`await window.LUMEN.loadEmbedded(true); var L=window.LUMEN; L.setStep(2);
  await L.generate(); for(var i=0;i<80;i++){ await new Promise(function(r){setTimeout(r,120);}); if(!L.bookStale()) break; }
  return JSON.stringify({ok:1}); `);

/* 把 TPL.grid9.draw 临时换掉：每次 paint 都记一笔，看 9 格的矩形与 CTM */
const r = await ev(`
  var L=window.LUMEN, st=L.state;
  var p=st.photos[0];
  var cv=L.renderCanvas(p,'grid9',L.optsFor(p),st.spec.longEdge,true);
  /* 重跑一遍 draw，这次自己插桩 */
  var c=document.createElement('canvas'); c.width=cv.width; c.height=cv.height;
  var ctx=c.getContext('2d');
  var log=[];
  var tpl=L.TPL.grid9;
  var cx={ctx:ctx,W:cv.width,H:cv.height,photo:p,o:L.optsFor(p),f:function(k){return 'sans-serif';},
    paint:function(x,y,w,h,rr,ov){
      var m=ctx.getTransform();
      var d={w:p.w,h:p.h};   /* prep() 未导出；这些照片 rot=0，等价 */
      var zoom=(ov&&ov.zoom!=null?ov.zoom:p.zoom)||1;
      var k=Math.max(w/d.w,h/d.h)*zoom;
      var dw=d.w*k, dh=d.h*k;
      var dx=x+(w-dw)/2+((ov&&ov.ox!=null?ov.ox:p.ox)||0)*w*.5;
      var dy=y+(h-dh)/2+((ov&&ov.oy!=null?ov.oy:p.oy)||0)*h*.5;
      log.push({box:[x,y,w,h], z:zoom, local:[+dx.toFixed(1),+dy.toFixed(1),+dw.toFixed(1),+dh.toFixed(1)],
        area:+(dw*dh).toFixed(2),
        ctm:[m.a,m.b,m.c,m.d,m.e,m.f].join(',')});
      ctx.fillStyle='#000'; ctx.fillRect(x,y,w,h);
      return {dx:dx,dy:dy,dw:dw,dh:dh};
    },
    plate:function(){}, rr:function(){}, grain:function(){}};
  tpl.draw(cx);
  /* 选出"面积最大"的那一个（和 renderCanvas 同样的规则：严格大于） */
  var pick=null;
  log.forEach(function(o){ if(!pick||o.area>pick.area) pick=o; });
  return JSON.stringify({log:log, pick:pick});
`);
console.log('每次 paint 的矩形：');
(r.log || []).forEach((o, i) => console.log('  #' + i + ' box=' + String(o.box).padEnd(22) +
  ' z=' + o.z + ' local=' + o.local.join(',') + ' area=' + o.area + ' ctm=' + o.ctm));
console.log('选中：' + JSON.stringify(r.pick));
await b.close();
