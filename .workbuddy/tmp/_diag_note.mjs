import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE='file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b=await launch({port:9481,windowSize:'1440,940'});
await b.goto(FILE,3000); await sleep(1000);
const r=await b.evaluate(`(async function(){try{
 var L=window.LUMEN,st=L.state; await L.loadEmbedded(true);
 st.photos.forEach(function(p,i){p.picked=(i<12);}); L.step=0; L.renderPanel();
 await new Promise(function(r){setTimeout(r,300);});
 var out=[];
 [].slice.call(document.querySelectorAll('#panel p.note')).forEach(function(e,i){
   var cs=getComputedStyle(e);
   out.push({i:i, ws:cs.whiteSpace, ov:cs.overflow, bd:cs.borderTopWidth,
     pad:cs.paddingTop, fs:cs.fontSize, lh:cs.lineHeight,
     cw:e.clientWidth, sw:e.scrollWidth, clipped:e.scrollWidth>e.clientWidth+1,
     lines:Math.round(e.getBoundingClientRect().height/parseFloat(cs.lineHeight)),
     t:(e.textContent||'').slice(0,18)});
 });
 var btn=document.querySelector('#panel .notes .note');
 var cs2=btn?getComputedStyle(btn):null;
 return JSON.stringify({notes:out, btnSample:cs2?{ws:cs2.whiteSpace,fs:cs2.fontSize,lh:cs2.lineHeight}:null});
}catch(e){return JSON.stringify({__err:String(e&&e.stack||e)})}})()`);
const o=JSON.parse(r); console.log(JSON.stringify(o,null,1));
await b.close();
