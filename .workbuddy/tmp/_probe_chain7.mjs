import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9492, windowSize: '1400,920' });
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
  var lt=[];
  try{
    new PerformanceObserver(function(list){
      list.getEntries().forEach(function(e){ lt.push({s:Math.round(e.startTime), d:Math.round(e.duration)}); });
    }).observe({entryTypes:['longtask']});
  }catch(e){ out.ltErr=String(e); }
  var p=st.photos[0];
  var g=st.generated.find(function(x){ return x.photoId===p.id; });
  p.stickers=[]; L.refreshStickerArt(p);
  var AR0=g.art, tArt=null, tSet=null;
  var origSet=L.BV.setPages;
  L.BV.setPages=function(){ if(tSet===null) tSet=performance.now(); return origSet.apply(this,arguments); };
  var base=performance.now();
  function beat(){ if(tArt===null && g.art!==AR0) tArt=performance.now(); if(performance.now()-base<2500) requestAnimationFrame(beat); }
  requestAnimationFrame(beat);
  p.stickers=[L.stkFix({k:'ticket',x:.5,y:.5,rot:0,s:1.6,text:'KADA'})];
  L.scheduleArt(p);
  /* 主线程是否被饿：一个 30ms 定时器 + 一个 0ms 定时器链 */
  var w30a=performance.now();
  await new Promise(function(rr){ setTimeout(rr,30); });
  out.wait1=Math.round(performance.now()-w30a);
  var w30b=performance.now();
  await new Promise(function(rr){ setTimeout(rr,30); });
  out.wait2=Math.round(performance.now()-w30b);
  await new Promise(function(rr){ setTimeout(rr,1500); });
  L.BV.setPages=origSet;
  out.tArt=tArt===null?null:Math.round(tArt-base);
  out.tSet=tSet===null?null:Math.round(tSet-base);
  out.longtasks=lt.filter(function(e){ return e.d>60; }).slice(0,10);
  out.nLT=lt.length;
  return JSON.stringify(out);
`);
console.log(JSON.stringify(r, null, 1));
await b.close();
