import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9524, windowSize: '1440,900' });
await b.goto(FILE, 2600);
await sleep(700);
async function ev(body){
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const o = JSON.parse(raw); if(o.__err) console.log('  [err] '+o.__err); return o;
}
await ev(`await window.LUMEN.loadEmbedded(true); var L=window.LUMEN; L.setStep(2);
  await L.generate(); for(var i=0;i<80;i++){ await new Promise(function(r){setTimeout(r,120);}); if(!L.bookStale()) break; }
  return JSON.stringify({ok:1}); `);

const r = await ev(`
  var L=window.LUMEN, st=L.state;
  var p=st.photos[0];
  p.tpl='kraft';   /* 面板认 p.tpl（stkBase 里 tplKey=TPL[p.tpl]?p.tpl:state.tpl） */
  p.stickers=[L.stkFix({k:'heart',x:.5,y:.5,rot:0,s:1.2,text:''})];
  L.refreshStickerArt(p);
  st._stkIdx=st.photos.indexOf(p); st._stkSel=0;
  L.renderPanel();
  await new Promise(function(r){ setTimeout(r,500); });
  var cv=document.getElementById('stkStage');
  cv.scrollIntoView({block:'center'});
  await new Promise(function(r){ setTimeout(r,300); });
  var box=cv.getBoundingClientRect();
  var rc=L.stkStageRect();
  /* 模拟真实手指：从照片矩形里 30% 处按下去，拖到 85% 处 */
  function at(u,v){ return {x:box.left+(rc.dx+u*rc.dw)/cv.width*box.width,
                            y:box.top +(rc.dy+v*rc.dh)/cv.height*box.height}; }
  function pd(t,pt){ cv.dispatchEvent(new PointerEvent(t,{bubbles:true,clientX:pt.x,clientY:pt.y,pointerId:9})); }
  var out={rect:[+rc.dx.toFixed(1),+rc.dy.toFixed(1),+rc.dw.toFixed(1),+rc.dh.toFixed(1)],
           box:[Math.round(box.width),Math.round(box.height)], step:[]};
  function step(name,u0,v0,u1,v1){
    var a=at(u0,v0), z=at(u1,v1);
    pd('pointerdown',a);
    pd('pointermove',z);
    pd('pointerup',z);
    var s=L.stickOf(p)[0];
    out.step.push({name:name, from:[u0,v0], to:[u1,v1], got:[+s.x.toFixed(3),+s.y.toFixed(3)]});
  }
  step('往右拖', .30,.5, .85,.5);
  step('往左拖', .85,.5, .30,.5);
  step('往下拖', .5,.30, .5,.85);
  step('往上拖', .5,.85, .5,.30);
  step('右下角', .35,.35, .90,.90);
  return JSON.stringify(out);
`);
console.log('照片矩形 ' + r.rect.join(',') + '  画布显示 ' + r.box.join('x'));
for (const s of (r.step || [])) {
  console.log('  ' + s.name + '  瞄 ' + s.to.join('/') + ' → 得到 ' + s.got.join('/'));
}
await b.close();
