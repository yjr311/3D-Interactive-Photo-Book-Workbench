import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9486, windowSize: '1400,920' });
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
  window.__t={hash:function(cv){ var x=cv.getContext('2d'); var d=x.getImageData(0,0,cv.width,cv.height).data;
    var h=2166136261; for(var i=0;i<d.length;i+=37){ h^=d[i]; h=Math.imul(h,16777619); } return (h>>>0); }};
  function pageHash(no){
    var r=L.buildBookPages(), pg=null;
    for(var i=0;i<r.pages.length;i++){ if(r.pages[i].kind==='content'&&r.pages[i].no===no) pg=r.pages[i]; }
    return pg?window.__t.hash(pg.canvas):null;
  }
  var p=st.photos[0];
  st._stkIdx=0; st._stkSel=0;
  p.stickers=[]; L.refreshStickerArt(p);
  var h0=pageHash(1);
  var iter=[];
  var t0=performance.now();
  p.stickers=[L.stkFix({k:'ticket',x:.5,y:.5,rot:0,s:1.6,text:'KADA · 入场券'})];
  L.scheduleArt(p);
  var ms=0, changed=false;
  while(ms<1600){
    var a=performance.now();
    await new Promise(function(r2){ setTimeout(r2,30); });
    var b1=performance.now();
    var hh=pageHash(1);
    var c=performance.now();
    ms=c-t0;
    iter.push({w:Math.round(b1-a), h:Math.round(c-b1), hit:hh!==h0});
    if(hh!==h0){ changed=true; break; }
  }
  return JSON.stringify({step:st.step, changed:changed, ms:Math.round(ms), nIter:iter.length,
    iter:iter.slice(0,10)});
`);
console.log(JSON.stringify(r, null, 1));
await b.close();
