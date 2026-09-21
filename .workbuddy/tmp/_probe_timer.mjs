import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9483, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(700);
async function ev(body){
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const o = JSON.parse(raw); if(o.__err) console.log('  [err] '+o.__err); return o;
}
const t = await ev(`
  var out={vis:document.visibilityState, hidden:document.hidden, focus:document.hasFocus()};
  function delay(ms){ var t0=performance.now();
    return new Promise(function(r){ setTimeout(function(){ r(performance.now()-t0); }, ms); }); }
  out.d30=Math.round(await delay(30));
  out.d120=Math.round(await delay(120));
  out.d40=Math.round(await delay(40));
  /* rAF 是否在跑 */
  out.raf = await new Promise(function(r){ var t0=performance.now();
    requestAnimationFrame(function(){ r(Math.round(performance.now()-t0)); }); });
  /* 重排一次书页 + setPages 各多久 */
  var L=window.LUMEN, st=L.state;
  var t1=performance.now(); var rr=L.buildBookPages(); out.build=Math.round(performance.now()-t1);
  var p=st.photos[0];
  var t2=performance.now(); L.refreshStickerArt(p); out.refresh=Math.round(performance.now()-t2);
  return JSON.stringify(out);
`);
console.log(JSON.stringify(t, null, 1));
/* 关键实验：把页面拉到前台后，setTimeout(30) 还是不是 1s */
/* bringToFront: cdp.mjs 没暴露 send，跳过 */
await sleep(50);
const t2 = await ev(`
  var out={vis:document.visibilityState, focus:document.hasFocus()};
  function delay(ms){ var t0=performance.now();
    return new Promise(function(r){ setTimeout(function(){ r(performance.now()-t0); }, ms); }); }
  out.d30=Math.round(await delay(30));
  out.raf = await new Promise(function(r){ var t0=performance.now();
    requestAnimationFrame(function(){ r(Math.round(performance.now()-t0)); }); });
  return JSON.stringify(out);
`);
console.log('bringToFront 之后: ' + JSON.stringify(t2));
await b.close();
