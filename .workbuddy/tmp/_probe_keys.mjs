import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9522, windowSize: '1200,800' });
await b.goto(FILE, 2000);
await sleep(400);
const raw = await b.evaluate(`JSON.stringify(Object.keys(window.LUMEN).sort())`);
console.log(raw);
await b.close();
