import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'node:fs';

/* v2：上一版没抓到翻页 —— 书在首屏之下，且 demo 放在 iframe 里。
   这版先滚到演示区，再按坐标点击触发翻页，并连拍。 */
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/ref';
fs.mkdirSync(OUT, { recursive: true });

const b = await launch({ port: 9412, windowSize: '1440,900' });

/* ---------- StPageFlip ---------- */
await b.goto('https://nodlik.github.io/StPageFlip/', 3000);
await sleep(2500);

// 滚到演示 book 的位置（demo 在 iframe 内，用外层滚动容器滚）
const info = await b.evaluate(`JSON.stringify((function(){
  var ifr=document.querySelector('iframe');
  var out={hasIframe:!!ifr};
  if(ifr){ var r=ifr.getBoundingClientRect();
    out.iframe={x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}; }
  return out;
})())`);
console.log('stpageflip frame:', info);

// 用 scrollIntoView 把 iframe 拉到视口中央
await b.evaluate(`(function(){
  var ifr=document.querySelector('iframe');
  if(ifr) ifr.scrollIntoView({block:'center'});
  return 1;
})()`);
await sleep(900);
await b.screenshot(`${OUT}/flip-ref-stpage-0.png`);

const fr = JSON.parse(info).iframe;
if (fr && fr.w > 100) {
  // 点击书页右半边中心 → 触发一次翻页，连拍若干帧
  const cx = Math.round(fr.x + fr.w * 0.72);
  const cy = Math.round(fr.y + fr.h * 0.50);
  console.log('click at', cx, cy);
  await b.mouse('mouseMoved', cx, cy);
  await sleep(120);
  await b.mouse('mousePressed', cx, cy);
  await b.mouse('mouseReleased', cx, cy);
  const frames = [90, 180, 130, 130, 200];
  for (let i = 0; i < frames.length; i++) {
    await sleep(frames[i]);
    await b.screenshot(`${OUT}/flip-ref-stpage-${i + 1}.png`);
  }
}

await b.close();
console.log('done');
