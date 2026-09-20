import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const b = await launch({ port: 9701, windowSize: '1120,900' });
await b.goto('file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-LOGO%E6%96%B9%E6%A1%882.html', 2200);
await sleep(1200);
console.log('errors:', JSON.stringify(b.errors));
// 检查所有空 svg 容器（说明 put 没命中）
const empty = await b.evaluate(`(()=>{const out=[];document.querySelectorAll('svg').forEach(s=>{if(!s.innerHTML.trim()) out.push(s.id||'(no id)')});return JSON.stringify(out)})()`);
console.log('empty svg:', empty);
const boxes = await b.evaluate(`(()=>{const e=document.querySelectorAll('.bar .logo');const r=[];e.forEach(x=>{const b=x.getBoundingClientRect();r.push(Math.round(b.width)+'x'+Math.round(b.height))});return JSON.stringify(r)})()`);
console.log('bar logo sizes:', boxes);
await b.close();
