import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%85%89%E5%8C%A3-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9349, windowSize: '1440,900' });
await b.goto(FILE, 1500);
const ev = (x) => b.evaluate(x);

await b.click('#demoBtn');
for (let i = 0; i < 40; i++) { if ((await ev('state.photos.length')) > 0) break; await sleep(150); }
await sleep(600);

console.log('viewport:', await ev('JSON.stringify({w:innerWidth,h:innerHeight})'));
console.log('step:', await ev('state.step'));
console.log('tplbar rect:', await ev('JSON.stringify($("#tplbar").getBoundingClientRect())'));
console.log('tplbar 样式:', await ev('JSON.stringify((s=>({disp:s.display,of:s.overflowX,w:s.width,sw:$("#tplbar").scrollWidth}))(getComputedStyle($("#tplbar"))))'));
console.log('卡片数:', await ev('document.querySelectorAll(".tplcard").length'));
console.log('首卡 rect:', await ev('JSON.stringify(document.querySelector(".tplcard").getBoundingClientRect())'));
console.log('末卡 rect:', await ev('JSON.stringify([...document.querySelectorAll(".tplcard")].pop().getBoundingClientRect())'));
console.log('--tplW:', await ev('getComputedStyle($("#tplbar")).getPropertyValue("--tplW")'));
console.log('card 样式:', await ev('JSON.stringify((s=>({disp:s.display,flex:s.flex,width:s.width}))(getComputedStyle(document.querySelector(".tplcard"))))'));

console.log('\n=== 进入 step2 ===');
await b.click('#genBtn');
for (let i = 0; i < 200; i++) { const g = await ev('(state.generated||[]).length'); if (g > 0) break; await sleep(200); }
await sleep(900);
console.log('strip rect:', await ev('JSON.stringify($("#strip").getBoundingClientRect())'));
console.log('track rect:', await ev('JSON.stringify($("#stripTrack").getBoundingClientRect())'));
console.log('sitem 数:', await ev('document.querySelectorAll(".sitem").length'));
const items = await ev(`JSON.stringify([...document.querySelectorAll('.sitem')].map(function(el){
  var r=el.getBoundingClientRect();
  var hit=document.elementFromPoint(Math.round(r.left+r.width/2),Math.round(r.top+r.height/2));
  return {i:el.dataset.i, x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2),
          w:Math.round(r.width), hit:hit?(hit.className||hit.tagName)+':'+((hit.closest&&hit.closest('.sitem'))?hit.closest('.sitem').dataset.i:'-'):'null'};
}))`);
console.log(JSON.parse(items).map(o => `i=${o.i} x=${o.x} y=${o.y} w=${o.w} hit=${o.hit}`).join('\n'));

await b.close();
