import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'node:fs';

/* 抓两个参考站的翻页效果，作为本轮对标的视觉依据。
   用本项目已有的 Chromium + CDP 工具链（agent-browser 未安装且需下载 ~500MB）。 */
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/ref';
fs.mkdirSync(OUT, { recursive: true });

const b = await launch({ port: 9411, windowSize: '1440,940' });

async function grab(url, tag, acts) {
  await b.goto(url, 2500);
  await sleep(1800);
  await b.screenshot(`${OUT}/${tag}-a.png`);
  if (acts) await acts();
  await sleep(300);
  await b.screenshot(`${OUT}/${tag}-b.png`);
}

/* --- StPageFlip 文档站自带 demo book --- */
await grab('https://nodlik.github.io/StPageFlip/', 'stpageflip', async () => {
  // 找到书并点右半边 → 触发翻页；翻页 1000ms，点完立刻连拍
  const box = await b.evaluate(`(function(){
    var el=document.querySelector('#book, .demo-book, .flipbook, #demo');
    if(!el) { var c=[...document.querySelectorAll('div')].filter(function(d){
        var r=d.getBoundingClientRect(); return r.width>300&&r.height>380; });
      el=c.sort(function(a,b){return b.getBoundingClientRect().width-a.getBoundingClientRect().width;})[0]; }
    if(!el) return 'null';
    var r=el.getBoundingClientRect();
    return JSON.stringify({x:Math.round(r.left+r.width*0.78),y:Math.round(r.top+r.height*0.5),
                           w:Math.round(r.width),h:Math.round(r.height),
                           cls:(el.className||'')+'#'+(el.id||'')});
  })()`);
  console.log('stpageflip book:', box);
  const o = JSON.parse(box);
  if (o && o.x) {
    await b.mouse('mouseMoved', o.x, o.y);
    await b.mouse('mousePressed', o.x, o.y);
    await b.mouse('mouseReleased', o.x, o.y);
    await sleep(180);
    await b.screenshot(`${OUT}/stpageflip-mid1.png`);
    await sleep(180);
    await b.screenshot(`${OUT}/stpageflip-mid2.png`);
    await sleep(300);
    await b.screenshot(`${OUT}/stpageflip-mid3.png`);
  }
});

/* --- create-photo-flipbook-ui --- */
await grab('https://haichaolihc.github.io/create-photo-flipbook-ui/', 'flipbookui', async () => {
  const box = await b.evaluate(`(function(){
    var els=[...document.querySelectorAll('*')].filter(function(d){
      var r=d.getBoundingClientRect(); return r.width>320&&r.height>380; });
    if(!els.length) return 'null';
    els.sort(function(a,b){return b.getBoundingClientRect().width-a.getBoundingClientRect().width;});
    var el=els[0], r=el.getBoundingClientRect();
    return JSON.stringify({x:Math.round(r.left+r.width*0.8),y:Math.round(r.top+r.height*0.5),
                           w:Math.round(r.width),h:Math.round(r.height),tag:el.tagName+'.'+(el.className||'').slice(0,60)});
  })()`);
  console.log('flipbookui target:', box);
  const o = JSON.parse(box);
  if (o && o.x) {
    await b.mouse('mouseMoved', o.x, o.y);
    await b.mouse('mousePressed', o.x, o.y);
    await b.mouse('mouseReleased', o.x, o.y);
    for (let i = 1; i <= 3; i++) { await sleep(200); await b.screenshot(`${OUT}/flipbookui-mid${i}.png`); }
  }
});

/* --- StPageFlip 也抓一下「角落折页」这一路交互的 DOM/样式证据 --- */
await b.goto('https://nodlik.github.io/StPageFlip/', 2200);
await sleep(1500);
const probe = await b.evaluate(`JSON.stringify((function(){
  var out={};
  var el=document.querySelector('#book');
  out.bookFound=!!el;
  if(el){ var r=el.getBoundingClientRect(); out.bookRect=[Math.round(r.width),Math.round(r.height)];
    out.bookCls=el.className;
    out.childTags=[...el.children].slice(0,4).map(function(c){return c.tagName+'.'+(c.className||'');});
    var deep=[...el.querySelectorAll('*')].slice(0,14).map(function(c){
      var cs=getComputedStyle(c);
      return {t:c.tagName,cls:(c.className||'').toString().slice(0,70),
              tr:(cs.transform||'').slice(0,60), tf:cs.transformStyle, bf:cs.backfaceVisibility};
    });
    out.deep=deep;
  }
  return out;
})())`);
console.log('\n--- StPageFlip DOM ---\n' + probe);

await b.close();
