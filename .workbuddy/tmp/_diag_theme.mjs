import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9478, windowSize: '1440,940' });
await b.goto(FILE, 3000); await sleep(1000);
async function ev(x){ return JSON.parse(await b.evaluate(`(async function(){try{${x}}catch(e){return JSON.stringify({__err:String(e)})}})()`)); }
console.log('init', await ev(`
 var r=document.documentElement; var c=document.querySelector('.auto');
 var g=function(el,p){return getComputedStyle(el)[p];};
 return JSON.stringify({theme:r.getAttribute('data-theme'),
   panelBg:g(document.getElementById('panel'),'backgroundColor'),
   autoBg:c?g(c,'backgroundColor'):null, autoBorder:c?g(c,'borderLeftColor'):null,
   accent:g(r,'--accent'), text:g(document.body,'color')});`));
await ev(`document.getElementById('themeBtn').click(); return JSON.stringify({});`);
await sleep(600);
console.log('after toggle', await ev(`
 var r=document.documentElement; var c=document.querySelector('.auto');
 var g=function(el,p){return getComputedStyle(el)[p];};
 return JSON.stringify({theme:r.getAttribute('data-theme'),
   panelBg:g(document.getElementById('panel'),'backgroundColor'),
   autoBg:c?g(c,'backgroundColor'):null, autoBorder:c?g(c,'borderLeftColor'):null,
   accent:g(r,'--accent'), text:g(document.body,'color')});`));
await b.screenshot('C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsauto/09-浅色主题首屏.png');
await b.close();
