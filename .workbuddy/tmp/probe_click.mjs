import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%85%89%E5%8C%A3-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9351, windowSize: '1440,900' });
await b.goto(FILE, 1500);
const ev = (x) => b.evaluate(x);

await b.click('#demoBtn');
for (let i = 0; i < 40; i++) { if ((await ev('state.photos.length')) > 0) break; await sleep(150); }
await sleep(600);

/* 记录每一次真实 click 的目标元素 */
await ev(`window.__LOG=[];
document.addEventListener('click', function(e){
  var c = e.target.closest && e.target.closest('.tplcard');
  window.__LOG.push('t=' + (e.target.id || e.target.className || e.target.tagName)
    + ' card=' + (c ? c.dataset.tpl : 'NULL') + ' x=' + e.clientX);
}, true);`);

const keys = await ev('Object.keys(TPL)');
console.log('TPL keys 顺序:', keys.join(' , '));
console.log('初始 state.tpl =', await ev('state.tpl'));

for (const k of keys) {
  const c = await b.center('.tplcard[data-tpl="' + k + '"]');
  const hit = await ev(`(function(){var el=document.elementFromPoint(${c.x},${c.y});
    var cc=el&&el.closest?el.closest('.tplcard'):null;
    return cc?cc.dataset.tpl:'NONE/'+(el?el.className||el.tagName:'null');})()`);
  await b.click('.tplcard[data-tpl="' + k + '"]', { settle: 120 });
  const now = await ev('state.tpl');
  const log = JSON.parse(await ev('JSON.stringify(window.__LOG.splice(0))'));
  console.log(`click ${k.padEnd(11)} at(${c.x},${c.y}) hit=${String(hit).padEnd(14)} -> state=${now.padEnd(11)} ${now === k ? 'OK' : 'FAIL'}  事件:${JSON.stringify(log)}`);
}

await b.close();
