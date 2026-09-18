import { launch } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'node:fs';

/* 最小复现：容器在 pointerdown 时 setPointerCapture，
   容器的 click 委托用 e.target.closest('.card') 命中卡片。
   问：真实鼠标点击时，click 事件的 target 到底是卡片还是容器？ */

const html = `<!doctype html><html><body style="margin:0">
<div id="bar" style="display:flex;gap:10px;padding:20px">
  <div class="card" data-k="a" style="width:100px;height:80px;background:#ddd"></div>
  <div class="card" data-k="b" style="width:100px;height:80px;background:#ccc"></div>
</div>
<script>
window.REC=[];
var bar=document.getElementById('bar');
bar.addEventListener('pointerdown',function(e){
  try{ bar.setPointerCapture(e.pointerId); }catch(err){}
  window.REC.push('pd target='+e.target.className+' native='+e.target.className);
});
bar.addEventListener('click',function(e){
  var card=e.target.closest('.card');
  window.REC.push('click target='+e.target.id+'|'+e.target.className+' closest='+(card?card.dataset.k:'NULL'));
});
document.querySelectorAll('.card').forEach(function(c){
  c.addEventListener('click',function(){ window.REC.push('card-own-click '+c.dataset.k); });
});
<\/script></body></html>`;

fs.mkdirSync('C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp', { recursive: true });
const f = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/repro.html';
fs.writeFileSync(f, html);

const b = await launch({ port: 9341, windowSize: '900,600' });
await b.goto('file:///' + f, 800);

const info = await b.click('.card');
console.log('点击坐标:', JSON.stringify(info));
console.log('事件记录:', JSON.stringify(await b.evaluate('window.REC'), null, 1));

await b.close();
