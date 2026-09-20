import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'fs';
const F = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/logo';
fs.mkdirSync(OUT, { recursive: true });

const b = await launch({ port: 9612, windowSize: '1380,880' });
await b.goto(F, 3000);
await sleep(900);

// ① 首屏（步骤一）——顶栏 + 引导
await b.screenshot(`${OUT}/app-01-首屏.png`);
// 顶栏局部
await b.screenshot(`${OUT}/app-00-顶栏.png`);

// ② 进到成书步骤，让书出现
await b.evaluate(`(async function(){
  var L=window.LUMEN, st=L.state;
  await L.loadEmbedded(true);
  st.photos.forEach(function(p,i){ p.picked=(i<6); });
  L.setStep(2); await L.generate();
  for(var i=0;i<200;i++){ await new Promise(function(r){setTimeout(r,120);}); if(st.generated.length===6) break; }
  L.renderPanel(); L.setStep(0); L.setStep(2);
  await new Promise(function(r){setTimeout(r,2400);});
  L.BV.go(0);
  await new Promise(function(r){setTimeout(r,2200);});
  return 1;
})()`);
await sleep(1400);
await b.screenshot(`${OUT}/app-02-成书步骤.png`);

// ③ 环衬页（那枚「咔」印）
const info = await b.evaluate(`(function(){
  var B=window.LUMEN.BV;
  return JSON.stringify({cur:B.cur, n:B.pages.length, spread:B.spread});
})()`);
console.log('书页状态', info);

// 翻到环衬（通常是第 1 页）
await b.evaluate(`(function(){ window.LUMEN.BV.go(1); return 1; })()`);
await sleep(2000);
await b.screenshot(`${OUT}/app-03-环衬.png`);

// ④ 扉页（书名 + KADA STUDIO）
await b.evaluate(`(function(){ window.LUMEN.BV.go(2); return 1; })()`);
await sleep(2000);
await b.screenshot(`${OUT}/app-04-扉页.png`);

const errs = await b.evaluate('JSON.stringify((window.__errs||[]).slice(0,3))');
console.log('JS 异常', errs);
await b.close();
console.log('shots done');
