import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9441, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(900);
await b.evaluate(`(async function(){ await window.LUMEN.loadEmbedded(true); window.LUMEN.setStep(2); await window.LUMEN.generate(); await new Promise(r=>setTimeout(r,700)); return 'ok'; })()`);
const r = await b.evaluate(`(async function(){
  try{
    function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
    var L=window.LUMEN, st=L.state;
    st.photos.forEach(function(p,i){ p.picked=(i===0); p.tpl='polaroid'; });
    await L.generate();
    return 'gen-ok len='+st.generated.length;
  }catch(e){ return 'ERR:'+(e&&e.stack||e); }
})()`);
console.log(r);
await b.close();
