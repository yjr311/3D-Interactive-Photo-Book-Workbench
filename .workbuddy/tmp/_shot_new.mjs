import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/out3';
fs.mkdirSync(OUT, { recursive: true });
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';

const b = await launch({ port: 9421, windowSize: '1500,1000' });
await b.goto(FILE, 2600);
await sleep(900);

const err0 = await b.evaluate('JSON.stringify((window.__errs||[]))');
console.log('page errors at load:', err0);

// 载入示例照片 → 生成成片 → 进沉浸阅读
const prep = await b.evaluate(`(async function(){
  try{
    await window.LUMEN.loadEmbedded(true);
    window.LUMEN.setStep(2);
    await window.LUMEN.generate();
    await new Promise(function(r){ setTimeout(r,700); });
    window.LUMEN.openReader();
    await new Promise(function(r){ setTimeout(r,900); });
    return 'ok:'+window.LUMEN.state.generated.length+'/'+window.LUMEN.BV.pages.length;
  }catch(e){ return 'ERR:'+(e&&e.message||e); }
})()`);
console.log('prep:', prep);
await sleep(1200);

async function shot(tag, ms) { await sleep(ms || 260); await b.screenshot(`${OUT}/${tag}.png`); }

// 1) 封面（单独居中）
await b.evaluate('(function(){ var B=window.LUMEN.BV; B.cur=0; B.anim=null; B.live=null; B.syncUI(); B.kick(); return 1; })()');
await shot('01-封面', 900);

// 2) 跨页正文（跳到一个内容页）
await b.evaluate('(function(){ var B=window.LUMEN.BV; B.cur=3; B.anim=null; B.live=null; B.syncUI(); B.kick(); return 1; })()');
await shot('02-跨页正文', 900);

await b.evaluate('(function(){ var B=window.LUMEN.BV; B.cur=7; B.anim=null; B.syncUI(); B.kick(); return 1; })()');
await shot('03-跨页正文2', 900);

// 3) 扉页 / 环衬
await b.evaluate('(function(){ var B=window.LUMEN.BV; B.cur=1; B.anim=null; B.syncUI(); B.kick(); return 1; })()');
await shot('04-扉页', 800);

// 4) 翻页动画连拍（从封面开始点右半边 → 硬纸板翻开）
await b.evaluate('(function(){ var B=window.LUMEN.BV; B.cur=0; B.anim=null; B.syncUI(); B.kick(); return 1; })()');
await sleep(700);
const box = await b.evaluate(`JSON.stringify((function(){
  var c=document.querySelector('#reader .bv-stage canvas');
  var r=c.getBoundingClientRect();
  return {x:Math.round(r.left+r.width*0.72),y:Math.round(r.top+r.height*0.5)};
})())`);
console.log('click point:', box);
const pt = JSON.parse(box);
await b.mouse('mouseMoved', pt.x, pt.y);
await sleep(150);
await b.mouse('mousePressed', pt.x, pt.y);
await b.mouse('mouseReleased', pt.x, pt.y);
for (let i = 1; i <= 5; i++) { await sleep(120); await b.screenshot(`${OUT}/05-翻页封面-${i}.png`); }

// 5) 内页翻页连拍（纸页）
await b.evaluate('(function(){ var B=window.LUMEN.BV; B.cur=4; B.anim=null; B.syncUI(); B.kick(); return 1; })()');
await sleep(700);
await b.mouse('mousePressed', pt.x, pt.y);
await b.mouse('mouseReleased', pt.x, pt.y);
for (let i = 1; i <= 6; i++) { await sleep(110); await b.screenshot(`${OUT}/06-翻页内页-${i}.png`); }

// 6) 折角提示：把鼠标停在右下角
await b.evaluate('(function(){ var B=window.LUMEN.BV; B.cur=7; B.anim=null; B.syncUI(); B.kick(); return 1; })()');
await sleep(800);
const corner = await b.evaluate(`JSON.stringify((function(){
  var c=document.querySelector('#reader .bv-stage canvas');
  var r=c.getBoundingClientRect();
  return {x:Math.round(r.left+r.width*0.5+window.LUMEN.BV.pw*0.92),
          y:Math.round(r.top+r.height*0.5+window.LUMEN.BV.ph*0.47)};
})())`);
console.log('corner point:', corner);
const cp = JSON.parse(corner);
await b.mouse('mouseMoved', cp.x, cp.y);
await sleep(900);
await shot('07-折角提示', 300);

// 7) 单页模式
await b.evaluate('(function(){ var B=window.LUMEN.BV; B.setPages(B.pages.map(function(c,i){return {canvas:c,kind:B.kinds[i]};}),B.ratio,false,false); B.cur=2; B.syncUI(); B.kick(); return 1; })()');
await shot('08-单页模式', 900);

console.log('errors:', await b.evaluate('JSON.stringify((window.__errs||[]))'));
await b.close();
console.log('done');
