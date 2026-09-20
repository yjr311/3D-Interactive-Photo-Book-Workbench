import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'fs';
const b = await launch({ port: 9611, windowSize: '1240,900' });
await b.goto('file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-LOGO%E6%96%B9%E6%A1%88.html', 2000);
await sleep(900);
const out = await b.evaluate(`(function(){
  var el = document.querySelector('#ruler svg path');
  return JSON.stringify({ d: el.getAttribute('d') });
})()`);
const { d } = JSON.parse(out);
console.log('LEN', d.length);
fs.writeFileSync('C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/logo/path.json', JSON.stringify({ d }));
console.log(d);
await b.close();
