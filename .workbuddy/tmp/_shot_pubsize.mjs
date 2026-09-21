import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

const F = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/logo';
const b = await launch({ port: 9641, windowSize: '2760,1800' });
await b.goto(F, 3200);
await b.evaluate(`try{localStorage.clear()}catch(e){}; 1`);
await b.goto(F, 3200);
await b.evaluate(`document.documentElement.style.zoom='2'; 1`);
await sleep(900);

await b.evaluate(`(async function(){
  var L=window.LUMEN, st=L.state;
  await L.loadEmbedded(true);
  st.spec.ratio='3:4'; st.spec.longEdge=1280;
  st.photos.forEach(function(p,i){ p.picked=(i<6); });
  L.setStep(2); await L.generate();
  for(var i=0;i<250;i++){ await new Promise(function(r){setTimeout(r,120);}); if(st.generated.length===6) break; }
  L.renderPanel(); L.setStep(0); L.setStep(2);
  await new Promise(function(r){setTimeout(r,900);});
  return 1;
})()`);
await sleep(700);

// 把导出这一段滚进视野
await b.evaluate(`(function(){
  var d=[].slice.call(document.querySelectorAll('#panel details'))
    .filter(function(x){return /导出/.test((x.querySelector('summary')||{}).textContent||'')})[0];
  if(d){ d.open=true; d.scrollIntoView({block:'center'}); }
  return 1;
})()`);
await sleep(700);
await b.screenshot(`${OUT}/pub_before.png`);
console.log('① 未改尺寸（成片 960×1280，小红书竖图 1080×1440）：无提示');

// 点「方图」→ 出现不一致提示
await b.evaluate(`(function(){ document.querySelector('.chip[data-export="square"]').click(); return 1 })()`);
await sleep(800);
await b.evaluate(`(function(){
  var d=[].slice.call(document.querySelectorAll('#panel details'))
    .filter(function(x){return /导出/.test((x.querySelector('summary')||{}).textContent||'')})[0];
  if(d){ d.open=true; d.scrollIntoView({block:'center'}); }
  return 1;
})()`);
await sleep(700);
await b.screenshot(`${OUT}/pub_after.png`);
const t = await b.evaluate(`(function(){
  var notes=[].map.call(document.querySelectorAll('#panel .note'),function(n){return n.textContent});
  return JSON.stringify(notes.filter(function(x){return /不一致/.test(x)}));
})()`);
console.log('② 改成方图后的提示：', t);
console.log('JS 异常', JSON.stringify(b.errors));
await b.close();
