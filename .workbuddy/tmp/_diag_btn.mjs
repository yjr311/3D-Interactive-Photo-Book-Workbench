import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE='file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b=await launch({port:9482,windowSize:'1440,940'});
await b.goto(FILE,3000); await sleep(1000);
const r=await b.evaluate(`(async function(){try{
 var L=window.LUMEN,st=L.state; await L.loadEmbedded(true);
 st.photos.forEach(function(p,i){p.picked=(i<12);}); L.setStep(2);
 await new Promise(function(r){setTimeout(r,500);});
 var btns=[].slice.call(document.querySelectorAll('#panel .notes .note'));
 var out=[];
 if(btns.length){ var cs=getComputedStyle(btns[0]);
   out.push({ws:cs.whiteSpace,bd:cs.borderTopWidth,pad:cs.paddingTop,bg:cs.backgroundColor,fs:cs.fontSize}); }
 // 点第一个候选，确认仍能选中
 var before=st.photos.filter(function(p){return p.picked;})[0].note||'';
 btns[0].click(); await new Promise(function(r){setTimeout(r,260);});
 var after=st.photos.filter(function(p){return p.picked;})[0].note||'';
 var on=document.querySelectorAll('#panel .notes .note.on').length;
 return JSON.stringify({n:btns.length,style:out[0],picked:before+' -> '+after,onN:on,
   notesP:document.querySelectorAll('#panel p.note').length});
}catch(e){return JSON.stringify({__err:String(e&&e.stack||e)})}})()`);
console.log(r);
await b.close();
