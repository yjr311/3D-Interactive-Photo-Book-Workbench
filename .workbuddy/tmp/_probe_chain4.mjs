import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9487, windowSize: '1400,920' });
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
  var log=[];
  var T0=performance.now();
  function wrap(obj,key,label){
    var o=obj[key]; if(typeof o!=='function') return label+'(不存在)';
    obj[key]=function(){ var s=performance.now(); var rv=o.apply(this,arguments);
      var d=performance.now()-s; if(d>8) log.push([label,Math.round(d),Math.round(s-T0)]); return rv; };
    return label+'(ok)';
  }
  var w=[];
  w.push(wrap(L.PERSIST,'save','PERSIST.save'));
  w.push(wrap(L.BV,'setPages','BV.setPages'));
  w.push(wrap(L,'renderDock','renderDock'));
  w.push(wrap(L,'buildBookPages','buildBookPages'));
  w.push(wrap(CanvasRenderingContext2D.prototype,'getImageData','getImageData'));
  w.push(wrap(HTMLCanvasElement.prototype,'toDataURL','toDataURL'));
  w.push(wrap(HTMLCanvasElement.prototype,'getContext','getContext'));
  var _set=localStorage.setItem.bind(localStorage);
  localStorage.setItem=function(k,v){ var s=performance.now(); var rv=_set(k,v);
    var d=performance.now()-s; if(d>8) log.push(['ls.setItem('+k+')',Math.round(d),Math.round(s-T0)]); return rv; };

  window.__t={hash:function(cv){ var x=cv.getContext('2d'); var d=x.getImageData(0,0,cv.width,cv.height).data;
    var h=2166136261; for(var i=0;i<d.length;i+=37){ h^=d[i]; h=Math.imul(h,16777619); } return (h>>>0); }};
  function pageHash(no){ var r=L.buildBookPages(), pg=null;
    for(var i=0;i<r.pages.length;i++){ if(r.pages[i].kind==='content'&&r.pages[i].no===no) pg=r.pages[i]; }
    return pg?window.__t.hash(pg.canvas):null; }
  var p=st.photos[0];
  st._stkIdx=0; st._stkSel=0;
  p.stickers=[]; L.refreshStickerArt(p);
  log=[];                                   /* 上面是热身，重新起算 */
  T0=performance.now();
  var h0=pageHash(1);
  var t0=performance.now();
  p.stickers=[L.stkFix({k:'ticket',x:.5,y:.5,rot:0,s:1.6,text:'KADA'})];
  L.scheduleArt(p);
  var ms=0, changed=false, waits=[];
  while(ms<1600){
    var a=performance.now();
    await new Promise(function(r2){ setTimeout(r2,30); });
    waits.push(Math.round(performance.now()-a));
    ms=performance.now()-t0;
    if(pageHash(1)!==h0){ changed=true; break; }
  }
  return JSON.stringify({wrap:w, waits:waits, changed:changed, ms:Math.round(ms),
    log:log.slice(0,26)});
`);
console.log(JSON.stringify(r, null, 1));
await b.close();
