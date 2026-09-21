import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9484, windowSize: '1400,920' });
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

const r = await ev(`
  var L=window.LUMEN, st=L.state;
  var p=st.photos[0];
  var g=st.generated.find(function(x){ return x.photoId===p.id; });
  /* 单段成本先各自量一遍 */
  var t=performance.now(); L.refreshStickerArt(p); var T_ref=performance.now()-t;
  t=performance.now(); var pages=L.buildBookPages(); var T_build=performance.now()-t;
  /* setPages 单独量（先把它包起来记时长） */
  var orig=L.BV.setPages, T_set=null, marks={};
  L.BV.setPages=function(){ var s=performance.now(); var rv=orig.apply(this,arguments);
    T_set=performance.now()-s; marks.set=performance.now()-t0; return rv; };
  /* 顺手量一下测试里那个 pageHash 检测器有多贵 */
  t=performance.now();
  var cv=null; for(var k=0;k<pages.pages.length;k++){ if(pages.pages[k].kind==='content'&&pages.pages[k].no===1) cv=pages.pages[k].canvas; }
  var x=cv.getContext('2d'), d=x.getImageData(0,0,cv.width,cv.height).data;
  var h=2166136261; for(var i2=0;i2<d.length;i2+=37){ h^=d[i2]; h=Math.imul(h,16777619); }
  var T_hash=performance.now()-t;

  p.stickers=[];
  L.refreshStickerArt(p);
  var AR0=g.art;
  var t0=performance.now();
  p.stickers=[L.stkFix({k:'ticket',x:.5,y:.5,rot:0,s:1.6,text:'KADA'})];
  L.scheduleArt(p);
  var markArt=null;
  function tick(){
    if(markArt===null && g.art!==AR0) markArt=performance.now()-t0;
    if(marks.set===undefined) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  for(var w=0;w<200 && marks.set===undefined;w++){ await new Promise(function(rr){ setTimeout(rr,15); }); }
  var total=performance.now()-t0;
  return JSON.stringify({T_ref:Math.round(T_ref), T_build:Math.round(T_build), T_set:T_set===null?null:Math.round(T_set),
    T_hash:Math.round(T_hash), markArt:markArt===null?null:Math.round(markArt),
    markSet:Math.round(marks.set), total:Math.round(total), pages:pages.pages.length,
    canvas:cv.width+'x'+cv.height});
`);
console.log(JSON.stringify(r, null, 1));
await b.close();
