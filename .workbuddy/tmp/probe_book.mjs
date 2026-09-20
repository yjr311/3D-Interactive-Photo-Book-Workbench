import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

/* 用 CDP 原生输入确认「翻页」这条路径本身没问题：
   键盘 ArrowRight/ArrowLeft、画布上真实鼠标拖拽。 */

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const R = [];
const ok = (n, c, extra = '') => R.push((c ? 'PASS' : '**FAIL**') + ' ' + n + (extra ? '  ' + extra : ''));

const b = await launch({ port: 9401, windowSize: '1512,900' });
await b.goto(FILE, 1200);
const ev = (x) => b.evaluate(x);

for (let i = 0; i < 120; i++) { if ((await ev('state.photos.length')) >= 28) break; await sleep(200); }
if ((await ev('state.photos.length')) < 28) { try { await ev('window.LUMEN.loadEmbedded(true)'); } catch (e) { } }
if ((await ev('state.generated.length')) < 28) { try { await ev('window.LUMEN.generate()'); } catch (e) { } }
for (let i = 0; i < 240; i++) { if ((await ev('state.generated.length')) >= 28) break; await sleep(250); }
await ev('setStep(2); state.book.spread=true; BV.spread=true;'); await sleep(1400);
await ev('BV.anim=null; BV.live=null; BV.queue=[]; BV.offT=BV.targetOff(); BV.off=BV.offT; BV.syncUI(); BV.draw();');
await sleep(200);

const geo = JSON.parse(await ev(`JSON.stringify((function(){
  var r=BV.cv.getBoundingClientRect();
  return {l:r.left,t:r.top,w:r.width,h:r.height,
          spinePx:r.left+(BV.spineX/BV.cw)*r.width, cur:BV.cur, n:BV.n};
})())`));
ok('书本已就绪', geo.n > 3, 'n=' + geo.n + ' cur=' + geo.cur);

/* ---- 1. 键盘右翻 ---- */
const keyPress = (k) => ev(`(function(){
  window.dispatchEvent(new KeyboardEvent('keydown',{key:${JSON.stringify(k)},bubbles:true,cancelable:true}));
  return 1;})()`);

const c0 = await ev('BV.cur');
await keyPress('ArrowRight');
await sleep(1200);
const c1 = await ev('BV.cur');
ok('键盘 ArrowRight 前进一页', c1 === c0 + 1, c0 + ' -> ' + c1);

await keyPress('ArrowLeft');
await sleep(1200);
const c2 = await ev('BV.cur');
ok('键盘 ArrowLeft 后退一页', c2 === c1 - 1, c1 + ' -> ' + c2);

/* ---- 2. 真实鼠标拖拽翻页 ---- */
const y = Math.round(geo.t + geo.h * 0.5);
const x0 = Math.round(geo.spinePx + geo.w * 0.14);
await b.mouse('mouseMoved', x0, y);
await b.mouse('mousePressed', x0, y);
await b.mouse('mouseMoved', x0 - 20, y);
await sleep(40);
const liveOn = await ev('!!BV.live');
await b.mouse('mouseMoved', x0 - 120, y);
await sleep(40);
const pMid = await ev('BV.live?BV.live.p:-1');
await b.mouse('mouseMoved', x0 - 230, y);
await sleep(60);
await b.mouse('mouseReleased', x0 - 230, y);
await sleep(1600);
const c3 = await ev('BV.cur');
ok('拖拽起手建立 live（不再被 click 抑制吃掉）', liveOn === true, 'live=' + liveOn);
ok('拖拽过程中 p 在推进', pMid > 0.02 && pMid < 0.99, 'p=' + (+pMid).toFixed(3));
ok('拖拽松手后完成翻页', c3 === c2 + 1, c2 + ' -> ' + c3);

/* ---- 3. 左半区点击只前进一页（不跳页 / 不误吞） ---- */
const c4 = await ev('BV.cur');
const xr = Math.round(geo.spinePx + geo.w * 0.30);
await b.mouse('mouseMoved', xr, y);
await b.mouse('mousePressed', xr, y);
await b.mouse('mouseReleased', xr, y);
await sleep(1300);
const c5 = await ev('BV.cur');
ok('右半区单击前进一页', c5 === c4 + 1, c4 + ' -> ' + c5);

const errors = b.errors.filter(e => !/favicon|net::ERR_FILE/.test(e));
console.log(R.join('\n'));
console.log('\n--- JS 异常:' + (errors.length ? '\n' + errors.join('\n') : ' none'));
console.log('--- 失败项: ' + R.filter(r => r.startsWith('**')).length + ' / ' + R.length);
await b.close();
