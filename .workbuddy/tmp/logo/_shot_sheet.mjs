import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

/* 合并后的方案页自检：确认 216 个预览注入属性被洗掉、标题口径改了、
   第十节已换成"落地清单"，并且整页没有 JS 异常。
   路径写死在脚本里 —— 中文文件名走 bash argv 会被 Git Bash 吃掉。 */
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/logo';
const F = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-LOGO方案.html';

const b = await launch({ port: 9663, windowSize: '1240,1000' });
await b.goto('file:///' + encodeURI(F), 2200);
await sleep(800);

const info = await b.evaluate(`(function(){
  var inj=document.querySelectorAll('[data-page-node-id]').length;
  var h1=document.querySelector('h1');
  var ten=[].slice.call(document.querySelectorAll('h2')).filter(function(e){return /十/.test(e.textContent)});
  var call=[].slice.call(document.querySelectorAll('span')).filter(function(e){return /已实施/.test(e.textContent)});
  var tb=document.querySelectorAll('table tr').length;
  return JSON.stringify({
    injected:inj,
    h1:(h1?h1.textContent.trim():'-'),
    h2s:[].slice.call(document.querySelectorAll('h2')).map(function(e){return e.textContent.trim().slice(0,14)}),
    ten:(ten[0]?ten[0].textContent.trim():'NO-十'),
    tenRows:(ten[0]? (ten[0].nextElementSibling? ten[0].nextElementSibling.querySelectorAll('tr').length : -1):-1),
    callout:(call[0]? call[0].textContent.slice(0,80):'NO-CALLOUT'),
    height:Math.ceil(document.documentElement.scrollHeight)
  });
})()`);
console.log(info);
console.log('errors', JSON.stringify(b.errors));

await b.evaluate('window.scrollTo(0,0); 1'); await sleep(400);
await b.screenshot(`${OUT}/sheet_top.png`);

// 滚到带"已实施"标记的那段说明
await b.evaluate(`(function(){
  var s=[].slice.call(document.querySelectorAll('span')).filter(function(e){return /已实施/.test(e.textContent)})[0];
  if(s) s.scrollIntoView({block:'center'}); else window.scrollTo(0,0);
  return 1;
})()`);
await sleep(500);
await b.screenshot(`${OUT}/sheet_callout.png`);

// 滚到第十节
await b.evaluate(`(function(){
  var h=[].slice.call(document.querySelectorAll('h2')).filter(function(e){return /十/.test(e.textContent)})[0];
  if(h) h.scrollIntoView({block:'start'}); return 1;
})()`);
await sleep(500);
await b.screenshot(`${OUT}/sheet_ten.png`);

await b.close();
console.log('done');
