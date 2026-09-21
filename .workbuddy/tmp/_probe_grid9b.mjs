import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9523, windowSize: '1440,900' });
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
  /* ① 先看这张照片/这个状态本身有没有会变的东西 */
  var info={rot:p.rot, zoom:p.zoom, ox:p.ox, oy:p.oy, w:p.w, h:p.h, fit:st.spec.fit};

  /* ② 连渲两次 grid9，看选中的矩形是否稳定 */
  var a=L.renderCanvas(p,'grid9',L.optsFor(p),st.spec.longEdge,true);
  var b2=L.renderCanvas(p,'grid9',L.optsFor(p),st.spec.longEdge,true);
  info.grid9_a=[+a.photoRect.dx.toFixed(2),+a.photoRect.dy.toFixed(2)];
  info.grid9_b=[+b2.photoRect.dx.toFixed(2),+b2.photoRect.dy.toFixed(2)];

  /* ③ 把所有 getTransform 调用录下来（renderCanvas 期间），看 CTM 到底是不是单位阵 */
  var P=CanvasRenderingContext2D.prototype, orig=P.getTransform, ctm=[], n=0;
  P.getTransform=function(){ n++; var m=orig.apply(this,arguments);
    if(ctm.length<40) ctm.push([m.a,m.b,m.c,m.d,+m.e.toFixed(4),+m.f.toFixed(4)].join(','));
    return m; };
  var cv=L.renderCanvas(p,'grid9',L.optsFor(p),st.spec.longEdge,true);
  P.getTransform=orig;
  info.nGetTransform=n;
  info.ctms=ctm.slice(0,24);
  info.grid9_c=[+cv.photoRect.dx.toFixed(2),+cv.photoRect.dy.toFixed(2)];
  info.rect=[+cv.photoRect.dx.toFixed(2),+cv.photoRect.dy.toFixed(2),
             +cv.photoRect.dw.toFixed(2),+cv.photoRect.dh.toFixed(2)];
  info.area=+(cv.photoRect.dw*cv.photoRect.dh).toFixed(3);
  return JSON.stringify(info);
`);
console.log(JSON.stringify(r, null, 1));
await b.close();
