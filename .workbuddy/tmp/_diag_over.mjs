import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE='file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b=await launch({port:9480,windowSize:'1440,940'});
await b.goto(FILE,3000); await sleep(1000);
const r=await b.evaluate(`(async function(){try{
 var L=window.LUMEN,st=L.state; await L.loadEmbedded(true);
 st.photos.forEach(function(p,i){p.picked=(i<12);}); L.setStep(0);
 await new Promise(function(r){setTimeout(r,400);});
 function m(sel){var e=document.querySelector(sel); if(!e) return null;
   var r=e.getBoundingClientRect();
   return {sel:sel,l:Math.round(r.left),r:Math.round(r.right),w:Math.round(r.width),
     cw:e.clientWidth,sw:e.scrollWidth,over:e.scrollWidth>e.clientWidth+1,
     txt:(e.textContent||'').slice(0,30)};}
 var panel=document.getElementById('panel');
 var pr=panel.getBoundingClientRect();
 return JSON.stringify({panel:{l:Math.round(pr.left),r:Math.round(pr.right),
   cw:panel.clientWidth,sw:panel.scrollWidth,overflow:getComputedStyle(panel).overflow,
   ox:getComputedStyle(panel).overflowX},
  items:[m('.auto'),m('.auto .auto-hd'),m('.auto .auto-hd b'),m('.auto .auto-hd s'),
    m('.auto p.note'),m('.auto .row'),m('.auto p.fine'),m('.auto .btn'),
    m('.sec-body'),m('#panel details.sec')]});
}catch(e){return JSON.stringify({__err:String(e&&e.stack||e)})}})()`);
console.log(JSON.stringify(JSON.parse(r),null,1));
await b.close();
