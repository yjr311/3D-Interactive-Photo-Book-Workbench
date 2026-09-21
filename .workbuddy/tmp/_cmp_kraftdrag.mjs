/* 「改前 / 改后」对照：同一套四向拖拽，分别打在两份产物上。
   改前 = .workbuddy/tmp/_before.html（paintPhoto 返回局部坐标、不与画框求交）
   改后 = 正式产物

   只跑牛皮纸（用户报的那张），并同时打出 11 个模版的矩形表 ——
   因为"只看牛皮纸"正是上一轮漏掉双色/九宫格的原因。 */
import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

const CWD = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14';
const FILES = [
  ['改前', 'file:///' + CWD + '/.workbuddy/tmp/_before.html'],
  ['改后', 'file:///' + CWD + '/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html'],
];
const DRAGS = [['往右', .30, .50, .85, .50], ['往左', .85, .50, .30, .50],
               ['往下', .50, .30, .50, .85], ['往上', .50, .85, .50, .30],
               ['右下方', .35, .35, .90, .90]];

const report = [];

for (const [tag, url] of FILES) {
  const b = await launch({ port: 9531, windowSize: '1440,900' });
  await b.goto(url, 2600);
  await sleep(700);
  async function ev(body) {
    const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
    const o = JSON.parse(raw); if (o.__err) console.log('  [err] ' + o.__err); return o;
  }
  await ev(`await window.LUMEN.loadEmbedded(true); var L=window.LUMEN; L.setStep(2);
    await L.generate();
    for(var i=0;i<80;i++){ await new Promise(function(r){setTimeout(r,120);}); if(!L.bookStale()) break; }
    return JSON.stringify({ok:1});`);

  /* 11 个模版的矩形表 —— 每个模版单独把照片挑出来渲一遍 */
  const tbl = await ev(`
    var L=window.LUMEN, st=L.state, p=st.photos[0], out=[];
    Object.keys(L.TPL).forEach(function(k){
      var cv=L.renderCanvas(p,k,L.optsFor(p),st.spec.longEdge,true);
      var W=cv.width, H=cv.height;
      /* 改前双色这种"没人申报"的模版 photoRect 会是空的 —— 面板那边
         退化成整块画布（app.js 的 base.photoRect||{0,0,W,H}），这里照抄同一个退化，
         否则量到的不是用户看到的东西。 */
      var rc=cv.photoRect||{dx:0,dy:0,dw:W,dh:H};
      var inside = rc.dw>1&&rc.dh>1&&rc.dx>=-1&&rc.dy>=-1&&rc.dx+rc.dw<=W+1&&rc.dy+rc.dh<=H+1;
      out.push({k:k, W:W, H:H, inside:inside, fb:!cv.photoRect,
                rc:[+rc.dx.toFixed(1),+rc.dy.toFixed(1),+rc.dw.toFixed(1),+rc.dh.toFixed(1)]});
    });
    return JSON.stringify({le:st.spec.longEdge, out:out});`);

  /* 牛皮纸上四向拖拽 */
  const setup = await ev(`
    var L=window.LUMEN, st=L.state, p=st.photos[0];
    p.tpl='kraft';
    p.stickers=[L.stkFix({k:'heart',x:.5,y:.5,rot:0,s:1.2,text:''})];
    L.refreshStickerArt(p);
    st._stkIdx=st.photos.indexOf(p); st._stkSel=0;
    L.setStep(2); L.renderPanel();
    await new Promise(function(r){ setTimeout(r,520); });
    var cv=document.getElementById('stkStage');
    cv.scrollIntoView({block:'center'});
    await new Promise(function(r){ setTimeout(r,340); });
    var rc=L.stkStageRect();
    return JSON.stringify({rect:[+rc.dx.toFixed(1),+rc.dy.toFixed(1),+rc.dw.toFixed(1),+rc.dh.toFixed(1)]});`);

  const steps = [];
  for (const d of DRAGS) {
    const q = await ev(`
      var cv=document.getElementById('stkStage');
      cv.scrollIntoView({block:'center'});
      await new Promise(function(r){ setTimeout(r,300); });
      var box=cv.getBoundingClientRect(), rc=window.LUMEN.stkStageRect();
      function at(u,v){ return {x:box.left+(rc.dx+u*rc.dw)/cv.width*box.width,
                               y:box.top +(rc.dy+v*rc.dh)/cv.height*box.height}; }
      return JSON.stringify({a:at(${d[1]},${d[2]}), z:at(${d[3]},${d[4]})});`);
    const X = Math.round(q.a.x), Y = Math.round(q.a.y);
    const ZX = Math.round(q.z.x), ZY = Math.round(q.z.y);
    await b.mouse('mouseMoved', X, Y);
    await b.mouse('mousePressed', X, Y);
    for (let i = 1; i <= 6; i++) {
      await b.mouse('mouseMoved', Math.round(X + (ZX - X) * i / 6), Math.round(Y + (ZY - Y) * i / 6), { buttons: 1 });
      await sleep(16);
    }
    await b.mouse('mouseReleased', ZX, ZY);
    await sleep(340);
    const g = await ev(`var L=window.LUMEN; var s=L.stickOf(L.state.photos[0])[0];
      return JSON.stringify({x:s.x, y:s.y});`);
    steps.push({ name: d[0], tgt: [+d[3], +d[4]], got: [+g.x, +g.y] });
  }
  /* 顺带记一下"贴纸在面板画布上被画在哪儿" —— 修前它钉在角落，这是最直观的证据 */
  const apart = await ev(`
    var L=window.LUMEN, cv=document.getElementById('stkStage');
    var rc=L.stkStageRect(); var s=L.stickOf(L.state.photos[0])[0];
    return JSON.stringify({px:+(rc.dx+s.x*rc.dw).toFixed(1), py:+(rc.dy+s.y*rc.dh).toFixed(1),
                           W:cv.width, H:cv.height,
                           u:+((rc.dx+s.x*rc.dw)/cv.width*100).toFixed(1),
                           v:+((rc.dy+s.y*rc.dh)/cv.height*100).toFixed(1)});`);

  await b.close();
  report.push({ tag, tbl, setup, steps, apart });
}

for (const r of report) {
  console.log('');
  console.log('======== ' + r.tag + ' ========');
  console.log('牛皮纸照片矩形  ' + r.setup.rect.join(','));
  console.log('贴纸 (.5,.5) 被画在画布 ' + r.apart.px + ',' + r.apart.py
    + '  = 全画布的 ' + r.apart.u + '% / ' + r.apart.v + '%');
  console.log('四向拖拽：');
  for (const s of r.steps) {
    const bad = Math.abs(s.got[0] - s.tgt[0]) > .08 || Math.abs(s.got[1] - s.tgt[1]) > .08;
    console.log('  ' + (bad ? 'XX ' : '   ') + s.name.padEnd(4)
      + ' 瞄 ' + s.tgt[0].toFixed(2) + '/' + s.tgt[1].toFixed(2)
      + '  →  得到 ' + s.got[0].toFixed(3) + '/' + s.got[1].toFixed(3));
  }
  console.log('11 个模版矩形（XX = 越出画布，[退] = 没人申报、面板退化成整块画布）：');
  for (const o of r.tbl.out) {
    console.log('  ' + (o.inside ? '   ' : 'XX ') + o.k.padEnd(10) + ' rect=' + o.rc.join(',')
      + (o.fb ? '  [退]' : ''));
  }
}
