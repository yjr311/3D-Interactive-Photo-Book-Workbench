import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9485, windowSize: '1400,920' });
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
  var L=window.LUMEN, st=L.state;
  var p=st.photos[0];
  var g=st.generated.find(function(x){ return x.photoId===p.id; });
  p.stickers=[]; L.refreshStickerArt(p);
  var AR0=g.art;
  /* 三个探针同时开：①普通 setTimeout(120) 对照 ②rAF 帧间隔 ③art 何时被换掉 */
  var t0=performance.now();
  var fireT=null;
  setTimeout(function(){ fireT=performance.now()-t0; },120);
  var frames=[], last=t0, markArt=null;
  function tick(){
    var n=performance.now();
    if(n-last>25) frames.push(Math.round(n-last));
    last=n;
    if(markArt===null && g.art!==AR0) markArt=n-t0;
    if(n-t0<1600) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  p.stickers=[L.stkFix({k:'ticket',x:.5,y:.5,rot:0,s:1.6,text:'KADA'})];
  L.scheduleArt(p);
  await new Promise(function(rr){ setTimeout(rr,1700); });
  frames.sort(function(a,b){ return b-a; });
  return JSON.stringify({plainTimer120:fireT===null?null:Math.round(fireT),
    markArt:markArt===null?null:Math.round(markArt),
    worstGaps:frames.slice(0,8)});
`);
console.log(JSON.stringify(r, null, 1));
await b.close();
