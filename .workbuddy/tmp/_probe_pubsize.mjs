import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

const F = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9631, windowSize: '1380,900' });
await b.goto(F, 3200);
await sleep(800);

// 清掉上次跑的存档，从干净状态开始
await b.evaluate(`try{localStorage.clear()}catch(e){}; 1`);
await b.goto(F, 3200);
await sleep(900);

console.log('== 1) 载入示例照片 + 生成成片 ==');
await b.evaluate(`(async function(){
  var L=window.LUMEN, st=L.state;
  await L.loadEmbedded(true);
  st.photos.forEach(function(p,i){ p.picked=(i<6); });
  L.setStep(2);
  await L.generate();
  for(var i=0;i<200;i++){ await new Promise(function(r){setTimeout(r,120);}); if(st.generated.length===6) break; }
  L.renderPanel(); L.setStep(0); L.setStep(2);
  await new Promise(function(r){setTimeout(r,900);});
  return 1;
})()`);
await sleep(600);

const snap = async (tag) => {
  const r = await b.evaluate(`(function(){
    var L=window.LUMEN, s=L.state;
    var g=s.generated[0];
    var chips=[].map.call(document.querySelectorAll('.chip[data-export]'),
      function(c){ return c.dataset.export+(c.classList.contains('on')?'*':''); });
    var note=document.querySelector('#panel .note');
    var staleTxt='';
    var notes=[].map.call(document.querySelectorAll('#panel .note'),function(n){return n.textContent.slice(0,26)});
    return JSON.stringify({
      ratio:s.spec.ratio, longEdge:s.spec.longEdge,
      curPreset:(typeof L.exportPresetNow==='function'?L.exportPresetNow():'n/a'),
      gen0:g? (g.canvas? g.canvas.width+'x'+g.canvas.height : (g.w+'x'+g.h)) : 'none',
      gen0keys:g?Object.keys(g).join(',').slice(0,90):'',
      chips:chips, notes:notes
    });
  })()`);
  console.log(tag, r);
};

await snap('【初始 小红书竖图】');

console.log('== 2) 真实点击「方图」 ==');
const c = await b.center('.chip[data-export="square"]');
console.log('chip 位置', JSON.stringify(c));
if (!c) { console.log('!! 找不到方图 chip'); }
else {
  await b.evaluate(`(function(){var e=document.querySelector('.chip[data-export="square"]'); if(e) e.scrollIntoView({block:'center'}); return 1})()`);
  await sleep(400);
  const c2 = await b.center('.chip[data-export="square"]');
  await b.mouse('mousePressed', c2.x, c2.y, { button: 'left', clickCount: 1 });
  await b.mouse('mouseReleased', c2.x, c2.y, { button: 'left', clickCount: 1 });
  await sleep(1200);
}
await snap('【点方图后】');

console.log('== 3) 重新生成成片 ==');
await b.evaluate(`(async function(){
  var L=window.LUMEN, st=L.state;
  await L.generate();
  for(var i=0;i<250;i++){ await new Promise(function(r){setTimeout(r,120);}); if(st.generated.length===6 && st._genSig) break; }
  L.renderPanel(); L.setStep(0); L.setStep(2);
  await new Promise(function(r){setTimeout(r,900);});
  return 1;
})()`);
await sleep(600);
await snap('【重出后】');

console.log('== 4) 导出预设 vs 目标尺寸 ==');
const t = await b.evaluate(`(function(){
  var L=window.LUMEN, s=L.state;
  var out=window.EXPORT_PRESETS? window.EXPORT_PRESETS.map(function(p){return p.id+' '+p.ratio+' '+p.longEdge}) : 'n/a';
  return JSON.stringify({presets:out, spec:s.spec.ratio+' '+s.spec.longEdge});
})()`);
console.log(t);

console.log('JS 异常', JSON.stringify(b.errors));
await b.close();
