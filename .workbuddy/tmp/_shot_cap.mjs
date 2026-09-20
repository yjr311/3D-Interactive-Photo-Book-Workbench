import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'fs';

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14';
const b = await launch({ port: 9495, windowSize: '1440,940' });
await b.goto(FILE, 2600);
await sleep(900);
async function ev(body) {
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const o = JSON.parse(raw);
  if (o && o.__err) console.log('  [err] ' + o.__err);
  return o;
}

/* 走到「选片成书」，给几张照片写上文案（模拟用户点了文案候选） */
const info = await ev(`
  var L=window.LUMEN, st=L.state;
  await L.loadEmbedded(true);
  st.photos.forEach(function(p,i){ p.picked=(i<6); });
  L.setStep(2);
  await L.generate();
  for(var i=0;i<160;i++){ await new Promise(function(x){setTimeout(x,120);}); if(st.generated.length===6) break; }
  st.book.art='tpl'; st.book.cap='note'; st.book.layout='mat';
  var notes=['无题，但很喜欢','时间在此处停了一下','今天的风刚刚好','就这样，很好','随手拍的一张','嗯，值得留一张'];
  st.photos.forEach(function(p,i){ if(i<6) p.note=notes[i]; });
  L.renderPanel(); L.setStep(0); L.setStep(2);
  await new Promise(function(x){ setTimeout(x,1200); });
  /* 翻到有文案的内容页（封面页上看不到图注） */
  L.BV.go(3);
  await new Promise(function(x){ setTimeout(x,1600); });
  return JSON.stringify({step:st.step, gen:st.generated.length, picked:st.photos.filter(function(p){return p.picked;}).length,
    cur:L.BV.cur});
`);
console.log('state', JSON.stringify(info));
await sleep(1000);
await b.screenshot(OUT + '/文案修复-书页.png');
console.log('wrote 文案修复-书页.png');

/* 再出一张"书页画面对照"：同一页 ×（没文案 / 有文案）并排，放大版心底部 */
const r = await ev(`
  var L=window.LUMEN, st=L.state;
  var g=st.generated[0], ph=L.photoOfIm(g);
  var W=620,H=820, PAD=14;
  st.book.layout='mat'; st.book.cap='note';
  ph.note=''; var a=L.renderContent([g],3,W,H,'r');
  ph.note='无题，但很喜欢'; var c=L.renderContent([g],3,W,H,'r');
  ph.note='今天也是被自己可爱到的一天，风把头发吹乱了';
  var d=L.renderContent([g],3,W,H,'r');
  ph.note='';
  var sheet=document.createElement('canvas'); sheet.width=(W+PAD)*3+PAD; sheet.height=H+52;
  var sx=sheet.getContext('2d'); sx.fillStyle='#131317'; sx.fillRect(0,0,sheet.width,sheet.height);
  [['没写文案',a],['写了一句',c],['写了一句长的',d]].forEach(function(it,i){
    sx.drawImage(it[1],PAD+i*(W+PAD),PAD);
    sx.fillStyle='#e6e2dc'; sx.font='600 15px system-ui,sans-serif'; sx.textAlign='center';
    sx.fillText(it[0],PAD+i*(W+PAD)+W/2,H+36); sx.textAlign='left';
  });
  return JSON.stringify({url:sheet.toDataURL('image/png')});
`);
const m = /^data:image\/png;base64,([\s\S]+)$/.exec(r.url || '');
if (m) {
  fs.writeFileSync(OUT + '/文案修复-书页对照.png', Buffer.from(m[1], 'base64'));
  console.log('wrote 文案修复-书页对照.png');
}
await b.close();
