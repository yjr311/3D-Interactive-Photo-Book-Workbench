import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shots/';
const b = await launch({ port: 9381, windowSize: '1512,900' });
await b.goto(FILE, 1200);
const ev = (x) => b.evaluate(x);

for (let i = 0; i < 120; i++) { if ((await ev('state.photos.length')) >= 28) break; await sleep(200); }
if ((await ev('state.photos.length')) < 28) { try { await ev('window.LUMEN.loadEmbedded(true)'); } catch (e) { } }
if ((await ev('state.generated.length')) < 28) { try { await ev('window.LUMEN.generate()'); } catch (e) { } }
for (let i = 0; i < 240; i++) { if ((await ev('state.generated.length')) >= 28) break; await sleep(250); }
/* 关掉 rAF，靠手动 pump 让画面稳定可复现 */
await ev(`window.__raf=window.requestAnimationFrame; window.requestAnimationFrame=function(){return 0;};`);

const freeze = `BV.anim=null; BV.live=null; BV.queue=[]; BV.raf=0;`;

async function shot(name, body) {
  await ev('(function(){' + body + '})()');
  await sleep(260);
  await b.screenshot(OUT + name + '.png');
  console.log(name, 'ok');
}

/* 1) 合着书（封面态）· 浅色主题 —— 看书左侧还有没有灰痕 */
await shot('a-cover-light', freeze + `
  document.documentElement.setAttribute('data-theme','light');
  setStep(2); state.book.spread=true; BV.spread=true;
  BV.cur=0; BV.offT=BV.targetOff(); BV.off=BV.offT; BV.syncUI(); BV.layout(); BV.draw();`);

/* 2) 合着书 · 深色主题 */
await shot('b-cover-dark', freeze + `
  document.documentElement.setAttribute('data-theme','');
  BV.cur=0; BV.offT=BV.targetOff(); BV.off=BV.offT; BV.syncUI(); BV.layout(); BV.draw();`);

/* 3) 翻开后（跨页对开）· 浅色 —— 书脊阴影应只在纸张上 */
await shot('c-spread-light', freeze + `
  document.documentElement.setAttribute('data-theme','light');
  BV.cur=3; BV.offT=BV.targetOff(); BV.off=BV.offT; BV.syncUI(); BV.layout(); BV.draw();`);

/* 4) 翻页中间态 —— 着色/纸影/高光是否仍然有立体感 */
await shot('d-mid-flip', freeze + `
  document.documentElement.setAttribute('data-theme','light');
  BV.cur=3; BV.offT=BV.targetOff(); BV.off=BV.offT; BV.syncUI(); BV.layout();
  BV.live={i:3,dir:'fwd',p:0.55}; BV.draw();`);

/* 5) 模版预览 · 浅色主题 · 40% —— 看中间那团黑印还在不在 */
await shot('e-preview-light', freeze + `
  document.documentElement.setAttribute('data-theme','light');
  setStep(1); PV.zoom=0.4; PV.tx=0; PV.ty=0; pvApply(); pvRerender();`);

/* 6) 模版预览 · 深色主题 · 40% */
await shot('f-preview-dark', freeze + `
  document.documentElement.setAttribute('data-theme','');
  PV.zoom=0.4; PV.tx=0; PV.ty=0; pvApply(); pvRerender();`);


/* 7) 翻页过程三个进度 —— 确认纸面着色没有被改坏 */
for (const [nm,pp] of [['g-flip35',0.35],['h-flip55',0.55],['i-flip80',0.80]]) {
  await shot(nm, freeze + `
    document.documentElement.setAttribute('data-theme','light');
    setStep(2); state.book.spread=true; BV.spread=true;
    BV.cur=3; BV.offT=BV.targetOff(); BV.off=BV.offT; BV.syncUI(); BV.layout();
    BV.live={i:3,dir:'fwd',p:${pp}}; BV.bowBoost=0; BV.draw();`);
}

await ev('window.requestAnimationFrame=window.__raf;');
await b.close();
