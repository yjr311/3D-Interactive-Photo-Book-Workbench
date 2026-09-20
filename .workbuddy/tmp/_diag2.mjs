import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9476, windowSize: '1440,940' });
await b.goto(FILE, 3000);
await sleep(1200);
console.log(await b.evaluate(`JSON.stringify({
  keys:Object.keys(window.LUMEN).filter(function(k){return /auto|Auto/.test(k);}),
  doAuto:typeof window.LUMEN.doAuto, autoBook:typeof window.LUMEN.autoBook,
  roll:typeof window.LUMEN.autoRoll, html:typeof window.LUMEN.autoHTML,
  panel:!!document.getElementById('panel')})`));
// 截图一次并打印大小
await b.screenshot('C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsauto/_probe.png');
console.log('errors:', JSON.stringify(b.errors.slice(0,5)));
await b.close();
