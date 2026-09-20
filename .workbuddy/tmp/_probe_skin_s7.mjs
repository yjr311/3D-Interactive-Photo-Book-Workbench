import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9447, windowSize: '1400,920' });
b.on && 0;
await b.goto(FILE, 2600); await sleep(900);
const r = await b.evaluate(`(async function(){
  try{
    function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
    var L=window.LUMEN;
    L.setStep(0);
    await sleep(200);
    var cards=document.querySelectorAll('.skin[data-skin]');
    return 'ok n='+cards.length;
  }catch(e){ return 'ERR:'+(e&&e.stack||e); }
})()`);
console.log('s7:', r);
const r2 = await b.evaluate(`(async function(){
  try{
    function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
    var L=window.LUMEN;
    var card=document.querySelector('.skin[data-skin="mint"]');
    if(!card) return 'no card';
    card.click();
    await sleep(260);
    return 'ok skin='+L.state.skin+' paper='+L.state.book.paper;
  }catch(e){ return 'ERR:'+(e&&e.stack||e); }
})()`);
console.log('s8:', r2);
await b.close();
