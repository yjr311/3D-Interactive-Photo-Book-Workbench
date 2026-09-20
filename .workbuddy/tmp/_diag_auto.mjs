import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9474, windowSize: '1440,940' });
await b.goto(FILE, 3000);
await sleep(1200);
const r = await b.evaluate(`JSON.stringify({ready:document.readyState,title:document.title,
  lumen:typeof window.LUMEN, panel:!!document.getElementById('panel'),
  bodyLen:(document.body?document.body.innerHTML.length:-1), url:location.href})`);
console.log(r);
await b.screenshot('C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsauto/_diag.png');
await b.close();
