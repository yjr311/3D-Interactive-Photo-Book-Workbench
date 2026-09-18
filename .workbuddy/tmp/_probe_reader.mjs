import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%85%89%E5%8C%A3-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9432, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(900);

const r = await b.evaluate(`(async function(){
  var L=window.LUMEN;
  var log=[];
  try{
    await L.loadEmbedded(true);
    log.push('loaded');
    L.setStep(2);
    log.push('setStep2, generated='+L.state.generated.length+', bvInDom='+!!L.BV.el.parentNode);
    await L.generate();
    log.push('generated='+L.state.generated.length+', bvInDom='+!!L.BV.el.parentNode+
             ', cw='+Math.round(L.BV.cw));
    await new Promise(function(r){ setTimeout(r,600); });
    log.push('after600 cw='+Math.round(L.BV.cw)+', bvInDom='+!!L.BV.el.parentNode);
    L.openReader();
    await new Promise(function(r){ setTimeout(r,600); });
    var st=document.querySelector('#reader .bv-stage');
    var rect=st?st.getBoundingClientRect():null;
    log.push('afterOpenReader cw='+Math.round(L.BV.cw)+
             ' stageRect='+(rect?Math.round(rect.width)+'x'+Math.round(rect.height):'null')+
             ' readerOn='+document.getElementById('reader').classList.contains('on'));
    L.BV.layout();
    log.push('afterExplicitLayout cw='+Math.round(L.BV.cw));
    return log.join('\\n');
  }catch(e){ return 'ERR:'+(e&&e.stack||e.message||e); }
})()`);
console.log(r);
await b.close();
