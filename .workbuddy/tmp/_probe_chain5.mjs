import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9489, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(800);
async function ev(body){
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const o = JSON.parse(raw); if(o.__err) console.log('  [err] '+o.__err); return o;
}
await ev(`await window.LUMEN.loadEmbedded(true); window.LUMEN.setStep(2); await window.LUMEN.generate();
  var st=window.LUMEN.state;
  for(var i=0;i<80;i++){ await new Promise(function(r){setTimeout(r,120);});
    if(st.generated.length===st.photos.filter(function(p){return p.picked;}).length) break; }
  return JSON.stringify({gen:st.generated.length}); `);
await sleep(900);

const r = await ev(`
  var L=window.LUMEN, st=L.state, out={};
  function time(label,fn){ var s=performance.now(); var rv=fn(); out[label]=Math.round(performance.now()-s); return rv; }
  var p=st.photos[0];
  p.stickers=[L.stkFix({k:'ticket',x:.5,y:.5,rot:0,s:1.6,text:'KADA'})];
  time('refresh', function(){ return L.refreshStickerArt(p); });
  time('renderDock', function(){ return L.renderDock(); });
  time('PERSIST.save', function(){ return L.PERSIST.save(); });
  time('buildBookPages', function(){ return L.buildBookPages(); });
  time('renderPanel', function(){ return L.renderPanel(); });
  /* 再量一次，避免"第一次因为缓存冷"的偏差 */
  time('renderDock2', function(){ return L.renderDock(); });
  time('refresh2', function(){ return L.refreshStickerArt(p); });
  /* setPages 也单独量：这次直接调 L.BV.setPages */
  var pages=L.buildBookPages();
  time('setPages', function(){ return L.BV.setPages(pages.pages, pages.ratio, !!st.book.spread, true); });
  out.dockHTML = (document.querySelector('#dock')||{children:[]}).children.length;
  out.thumbs = st.generated.length;
  return JSON.stringify(out);
`);
console.log(JSON.stringify(r, null, 1));
await b.close();
