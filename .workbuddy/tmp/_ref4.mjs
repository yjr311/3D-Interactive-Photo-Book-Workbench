import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/ref';
fs.mkdirSync(OUT, { recursive: true });

const b = await launch({ port: 9414, windowSize: '1440,900' });

async function focusAndShoot(url, sel, tag, frames) {
  await b.goto(url, 3200);
  await sleep(2600);
  const ok = await b.evaluate(`(function(){
    var e=document.querySelector(${JSON.stringify(sel)});
    if(!e) return 'null';
    e.scrollIntoView({block:'center'});
    var r=e.getBoundingClientRect();
    return JSON.stringify({x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)});
  })()`);
  await sleep(900);
  await b.screenshot(`${OUT}/${tag}-0.png`);
  console.log('[' + tag + ']', ok);
  if (ok === 'null') return null;
  const t = JSON.parse(ok);
  if (t.w < 200) return null;
  const cx = Math.round(t.x + t.w * 0.74);
  const cy = Math.round(t.y + t.h * 0.5);
  await b.mouse('mouseMoved', cx, cy);
  await sleep(160);
  await b.mouse('mousePressed', cx, cy);
  await b.mouse('mouseReleased', cx, cy);
  for (let i = 0; i < frames.length; i++) {
    await sleep(frames[i]);
    await b.screenshot(`${OUT}/${tag}-${i + 1}.png`);
  }
  return t;
}

await focusAndShoot('https://nodlik.github.io/StPageFlip/', '.stf__parent', 'flip-ref-stpage',
  [70, 110, 110, 110, 130, 170, 220]);

await focusAndShoot('https://haichaolihc.github.io/create-photo-flipbook-ui/', 'body', 'flip-ref-ui',
  [120, 160, 200, 260]);

await b.close();
console.log('done');
