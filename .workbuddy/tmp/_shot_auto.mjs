import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'fs';

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsauto';
fs.mkdirSync(OUT, { recursive: true });

const b = await launch({ port: 9475, windowSize: '1440,940' });
await b.goto(FILE, 2600);
await sleep(900);

async function shot(name) {
  await b.screenshot(OUT + '/' + name + '.png');
  console.log('shot', name);
}
async function ev(body) {
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const o = JSON.parse(raw);
  if (o && o.__err) console.log('  [err] ' + o.__err);
  return o;
}

/* 1) 首屏（空） */
await shot('01-首屏空');

/* 2) 首屏 + 照片（未勾选） */
await ev(`var L=window.LUMEN,st=L.state; await L.loadEmbedded(true);
  st.photos.forEach(function(p){ p.picked=false; }); L.renderPanel();
  await new Promise(function(r){setTimeout(r,300);}); return JSON.stringify({});`);
await sleep(500);
await shot('02-首屏有照片未勾选');

/* 3) 首屏 + 已勾选 */
await ev(`var L=window.LUMEN,st=L.state; st.photos.forEach(function(p,i){ p.picked=(i<12); });
  L.setStep(0); await new Promise(function(r){setTimeout(r,300);}); return JSON.stringify({});`);
await sleep(500);
await shot('03-首屏已勾选12张');

/* 4) 一键成书（蜜桃） */
await ev(`var L=window.LUMEN,st=L.state; L.applySkin('peach'); await L.doAuto(false);
  await new Promise(function(r){setTimeout(r,2600);}); return JSON.stringify({step:st.step,gen:st.generated.length});`);
await sleep(1200);
await shot('04-一键成书-蜜桃');

/* 只在面板上截图：把 panel 单独截 */
const pv = await ev(`var r=document.querySelector('#panel').getBoundingClientRect();
  return JSON.stringify({x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)});`);
console.log('panel rect', pv);

/* 5) 换一版 */
await ev(`var L=window.LUMEN; await L.doAuto(true);
  await new Promise(function(r){setTimeout(r,2600);}); return JSON.stringify({});`);
await sleep(1200);
await shot('05-换一版-蜜桃');

/* 6) 夜樱 + 一键成书（深底氛围） */
await ev(`var L=window.LUMEN,st=L.state; L.applySkin('sakura'); await L.doAuto(false);
  await new Promise(function(r){setTimeout(r,2600);}); return JSON.stringify({});`);
await sleep(1200);
await shot('06-一键成书-夜樱');

/* 7) 浅色主题下的面板 */
await ev(`var L=window.LUMEN,st=L.state; L.applySkin('cream'); await L.doAuto(false);
  await new Promise(function(r){setTimeout(r,2400);});
  var t=document.getElementById('themeBtn'); if(t) t.click();
  await new Promise(function(r){setTimeout(r,400);});
  return JSON.stringify({theme:document.documentElement.getAttribute('data-theme')});`);
await sleep(900);
await shot('07-浅色主题-奶油日记');

/* 8) 逐张分配那一步的折叠入口 */
await ev(`var L=window.LUMEN,st=L.state; L.setStep(1);
  var d=[].slice.call(document.querySelectorAll('#panel details.sec')).filter(function(x){
    return x.querySelector('summary').textContent.indexOf('一键氛围成书')>=0; })[0];
  if(d) d.open=true;
  await new Promise(function(r){setTimeout(r,400);}); return JSON.stringify({found:!!d});`);
await sleep(600);
await shot('08-逐张分配步骤的入口');

await b.close();
