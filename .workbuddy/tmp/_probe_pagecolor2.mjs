import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9457, windowSize: '1400,920' });
await b.goto(FILE, 2600); await sleep(900);
await b.evaluate(`(async function(){
  await window.LUMEN.loadEmbedded(true);
  var st=window.LUMEN.state;
  st.photos.forEach(function(p,i){ p.picked=(i<6); p.tpl='minimal'; });
  window.LUMEN.setStep(2);
  await window.LUMEN.generate();
  await new Promise(r=>setTimeout(r,600));
  return 'ok';
})()`);
await sleep(1500);
const r = await b.evaluate(`(async function(){
  var L=window.LUMEN;
  function px(cv){
    var x=cv.getContext('2d'); var d=x.getImageData(4,4,1,1).data;
    return '#'+[d[0],d[1],d[2]].map(function(v){return ('0'+v.toString(16)).slice(-2);}).join('');
  }
  var log={};
  log.before=px(L.BV.pages[3].canvas||L.BV.pages[3]);
  var card=document.querySelector('.skin[data-skin="sakura"]');
  log.cardFound=!!card;
  card.click();
  await new Promise(r=>setTimeout(r,1200));
  log.after=px(L.BV.pages[3].canvas||L.BV.pages[3]);
  log.statePaper=L.state.book.paper;
  log.pagesLen=L.BV.pages.length;
  return JSON.stringify(log);
})()`);
console.log(r);
await b.close();
