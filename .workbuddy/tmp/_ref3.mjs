import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/ref';
fs.mkdirSync(OUT, { recursive: true });

const b = await launch({ port: 9413, windowSize: '1440,900' });
await b.goto('https://nodlik.github.io/StPageFlip/', 3000);
await sleep(2500);

// 滚到页面底部，让演示书进入视口
await b.evaluate(`(function(){ window.scrollTo(0, document.body.scrollHeight); return window.scrollY; })()`);
await sleep(1200);

// 探针：找 StPageFlip 生成的翻页容器（它会给根节点加 stf__parent / stf__block 之类）
const probe = await b.evaluate(`JSON.stringify((function(){
  var sel=['.stf__parent','.stf__block','.stf__wrapper','.flipbook','#book','.demo-block'];
  var out={scrollY:window.scrollY, innerH:window.innerHeight, found:{}, best:null};
  sel.forEach(function(s){ var e=document.querySelector(s); if(e){
    var r=e.getBoundingClientRect();
    out.found[s]={x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)};
  }});
  // 找出视口内面积最大的“像书页”的元素
  var all=[...document.querySelectorAll('div,canvas')].filter(function(d){
    var r=d.getBoundingClientRect();
    return r.top>-50 && r.top<window.innerHeight && r.width>250 && r.height>300;
  });
  all.sort(function(a,b){ var ra=a.getBoundingClientRect(), rb=b.getBoundingClientRect();
    return rb.width*rb.height-ra.width*ra.height; });
  if(all[0]){ var r=all[0].getBoundingClientRect();
    out.best={x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),
              tag:all[0].tagName, cls:(all[0].className||'').toString().slice(0,80)}; }
  return out;
})())`);
console.log('probe:', probe);
await b.screenshot(`${OUT}/flip-ref-scrolled.png`);

const p = JSON.parse(probe);
const t = p.best;
if (t && t.w > 200) {
  const cx = Math.round(t.x + t.w * 0.75);
  const cy = Math.round(t.y + t.h * 0.5);
  console.log('click', cx, cy);
  await b.mouse('mouseMoved', cx, cy);
  await sleep(150);
  await b.mouse('mousePressed', cx, cy);
  await b.mouse('mouseReleased', cx, cy);
  const fr = [80, 120, 120, 120, 160, 200];
  for (let i = 0; i < fr.length; i++) {
    await sleep(fr[i]);
    await b.screenshot(`${OUT}/flip-ref-${i + 1}.png`);
  }
}

await b.close();
console.log('done');
