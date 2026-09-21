import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

/* 新图标落地后：顶栏（深/浅）2× 实拍 + favicon 采样 + 纯色底适配 */
const F = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/logo';
const Z = 2, W = 1240, H = 260;

const b = await launch({ port: 9651, windowSize: `${W * Z},${H * Z}` });
await b.goto(F, 3200);
await b.evaluate(`document.documentElement.style.zoom='${Z}'; 1`);
await sleep(900);

// 顶栏几何自检
const geo = await b.evaluate(`(function(){
  var e=document.querySelector('.brand .logo');
  if(!e) return 'no logo';
  var r=e.getBoundingClientRect();
  var cs=getComputedStyle(e);
  return JSON.stringify({box:Math.round(r.width)+'x'+Math.round(r.height),
    left:Math.round(r.left), top:Math.round(r.top),
    filter:cs.filter, color:cs.color,
    paths:e.querySelectorAll('path').length,
    hasGrad:e.querySelector('linearGradient')?e.querySelector('linearGradient').id:'-'});
})()`);
console.log('顶栏图标', geo);

await b.screenshot(`${OUT}/new_dark.png`);
await b.click('#themeBtn');
await sleep(900);
console.log('主题 =', await b.evaluate(`document.documentElement.getAttribute('data-theme')`));
await b.screenshot(`${OUT}/new_light.png`);

// 图标实际画出来的像素（不是"元素在不在"，是"有没有墨"）——在浅色页面上换几种底色量
const ink = await b.evaluate(`(function(){
  var L=window.LUMEN;
  var e=document.querySelector('.brand .logo');
  var g=e.querySelector('linearGradient');
  var out={stops:[].map.call(g.querySelectorAll('stop'),function(s){return s.getAttribute('stop-color')})};
  var c=document.createElement('canvas'); c.width=c.height=58;
  var x=c.getContext('2d');
  var s=new XMLSerializer().serializeToString(e);
  return JSON.stringify(out);
})()`);
console.log('渐变端点', ink);

console.log('favicon =', await b.evaluate(`(function(){
  var l=document.querySelector('link[rel="icon"]');
  return l? l.href.slice(0,42)+'… len='+l.href.length : 'none';
})()`));

console.log('JS 异常', JSON.stringify(b.errors));
await b.close();
console.log('done');
