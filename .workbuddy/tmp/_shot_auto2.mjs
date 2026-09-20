import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'fs';

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const ROOT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14';
const OUT = ROOT + '/.workbuddy/tmp/shotsauto';
fs.mkdirSync(OUT, { recursive: true });

const b = await launch({ port: 9483, windowSize: '1440,940' });
await b.goto(FILE, 3000);
await sleep(1000);
async function ev(x) {
  const raw = await b.evaluate(`(async function(){try{${x}}catch(e){return JSON.stringify({__err:String(e&&e.stack||e)})}})()`);
  const o = JSON.parse(raw); if (o && o.__err) console.log('  [err] ' + o.__err); return o;
}

/* ① 首屏 + 已勾选：卡片上那句推荐序列必须完整可见（不截断） */
const r1 = await ev(`
  var L=window.LUMEN, st=L.state;
  await L.loadEmbedded(true);
  st.photos.forEach(function(p,i){ p.picked=(i<12); });
  L.applySkin('studio'); L.setStep(0);
  await new Promise(function(r){ setTimeout(r,400); });
  var s=document.querySelector('.auto .auto-hd s');
  var cs=getComputedStyle(s);
  return JSON.stringify({text:s.textContent, h:s.offsetHeight,
    lh:parseFloat(cs.lineHeight), fs:parseFloat(cs.fontSize),
    lines:Math.round(s.offsetHeight/parseFloat(cs.lineHeight)),
    clipped:s.scrollWidth>s.clientWidth+1,
    btn:document.getElementById('autoBook').textContent});
`);
console.log('推荐序列:', r1.text, '| 行数', r1.lines, '| 被截断?', r1.clipped, '|', r1.btn);
await b.screenshot(OUT + '/10-一键氛围成书.png');
fs.copyFileSync(OUT + '/10-一键氛围成书.png', ROOT + '/预览-10-一键氛围成书.png');
console.log('-> 预览-10-一键氛围成书.png');

/* ② 一键成书（蜜桃）：出片 + 进选片成书 */
await ev(`var L=window.LUMEN,st=L.state; L.applySkin('peach'); await L.doAuto(false);
  await new Promise(function(r){setTimeout(r,2800);}); return JSON.stringify({});`);
await sleep(1300);
await b.screenshot(OUT + '/11-一键成书结果.png');
fs.copyFileSync(OUT + '/11-一键成书结果.png', ROOT + '/预览-11-一键成书结果.png');
console.log('-> 预览-11-一键成书结果.png');

/* ③ 换一版 */
const r3 = await ev(`
  var L=window.LUMEN,st=L.state;
  var before={tpl:st.generated.map(function(g){return g.tpl;}),cover:st.book.coverIdx,layout:st.book.layout};
  await L.doAuto(true);
  await new Promise(function(r){setTimeout(r,2800);});
  return JSON.stringify({before:before,
    after:{tpl:st.generated.map(function(g){return g.tpl;}),cover:st.book.coverIdx,layout:st.book.layout}});
`);
console.log('换一版:', r3.before.layout + '/' + r3.before.cover, '→', r3.after.layout + '/' + r3.after.cover);
await sleep(800);
await b.screenshot(OUT + '/12-换一版.png');
fs.copyFileSync(OUT + '/12-换一版.png', ROOT + '/预览-12-换一版.png');
console.log('-> 预览-12-换一版.png');

/* ④ 深底氛围（夜樱）一键成书，确认深色皮肤不塌 */
await ev(`var L=window.LUMEN; L.applySkin('sakura'); await L.doAuto(false);
  await new Promise(function(r){setTimeout(r,2800);}); return JSON.stringify({});`);
await sleep(1200);
await b.screenshot(OUT + '/13-一键成书-夜樱.png');

await b.close();
