import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9523, windowSize: '1440,940' });
await b.goto(FILE, 2500);
await sleep(600);
async function ev(x) {
  const raw = await b.evaluate(`(async function(){try{${x}}catch(e){return JSON.stringify({__err:String(e&&e.stack||e)})}})()`);
  const o = JSON.parse(raw); if (o && o.__err) console.log('  [err] ' + o.__err); return o;
}
const r = await ev(`
  var L=window.LUMEN, st=L.state;
  await L.loadEmbedded(true);
  var t0=performance.now(); await L.generate(); var genMs=performance.now()-t0;
  for(var i=0;i<80;i++){ await new Promise(function(r){setTimeout(r,100);}); if(!L.bookStale()) break; }
  var p=st.photos[0], LE=st.spec.longEdge;
  function ms(f,n){ var t=performance.now(); for(var i=0;i<n;i++) f(); return +((performance.now()-t)/n).toFixed(1); }
  var r2=L.buildBookPages();
  var cps=r2.pages.filter(function(q){return q.kind==='content';});
  return JSON.stringify({
    longEdge:LE, nPicked:st.photos.filter(function(q){return q.picked;}).length,
    nPages:r2.pages.length,
    genAll28:+genMs.toFixed(0),
    renderPlain_1: ms(function(){ L.renderPlain(p,LE); },6),
    buildBookPages: ms(function(){ L.buildBookPages(); },5),
    renderCover_880: ms(function(){ L.renderCover(880,1320); },5),
    renderContent_880: ms(function(){ L.renderContent(cps.slice(0,1),1,880,1320,'c'); },5),
    plateOf_1: ms(function(){ L.plateOf(st.generated[0]); },50),
    srcIsCanvas: (function(){ var a=L.plateOf(st.generated[0]); return a&&a.width+'x'+a.height; })()
  });
`);
console.log(JSON.stringify(r, null, 1));
await b.close();
