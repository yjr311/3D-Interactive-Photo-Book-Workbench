import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'fs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsfont';
const b = await launch({ port: 9561, windowSize: '1500,950' });
await b.goto(FILE, 3000);
await sleep(700);
const raw = await b.evaluate(`(async function(){
  try{
    var L=window.LUMEN, st=L.state;
    await L.loadEmbedded(true);
    st.photos.forEach(function(p,i){ p.picked=(i<6); });
    L.setStep(2); await L.generate();
    for(var i=0;i<200;i++){ await new Promise(function(x){setTimeout(x,120);}); if(st.generated.length>=6) break; }
    L.renderPanel(); L.setStep(0); L.setStep(2);
    await new Promise(function(x){setTimeout(x,1500);});
    L.BV.go(3); await new Promise(function(x){setTimeout(x,1500);});
    /* 把图注字体那一行滚到视口中间 */
    var ps=document.querySelector('.panel-scroll')||document.querySelector('#panel');
    var all=document.querySelectorAll('#panel p.note');
    var t=null;
    for(var i=0;i<all.length;i++) if(all[i].innerText.indexOf('图注字体')>=0) t=all[i];
    if(t){ t.scrollIntoView({block:'center'}); }
    await new Promise(function(x){setTimeout(x,600);});
    return JSON.stringify({found:!!t, text:t?t.innerText.replace(/\\s+/g,' '):'', h:t?Math.round(t.getBoundingClientRect().height):0});
  }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); }
})()`);
console.log(raw);
await sleep(400);
await b.screenshot(OUT + '/PANEL-图注字体行.png');
console.log('shot saved');
await b.close();
