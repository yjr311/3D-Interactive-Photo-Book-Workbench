import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9531, windowSize: '1440,940' });
await b.goto(FILE, 2500);
await sleep(700);
async function ev(x) {
  const raw = await b.evaluate(`(async function(){try{${x}}catch(e){return JSON.stringify({__err:String(e&&e.stack||e)})}})()`);
  const o = JSON.parse(raw); if (o && o.__err) console.log('  [err] ' + o.__err); return o;
}

const r1 = await ev(`
  var L=window.LUMEN, st=L.state;
  await L.loadEmbedded(true);
  await L.generate();
  for(var i=0;i<80;i++){ await new Promise(function(r){setTimeout(r,100);}); if(!L.bookStale()) break; }
  L.setStep(2);
  var p=st.photos[0];
  var out={photoRectOnTemplate:{},};
  /* 每种模版把照片画在哪 —— 这就是贴纸坐标系的地基 */
  ['polaroid','magazine','film','minimal2','kraft'].forEach(function(k){
    if(!L.TPL[k]) return;
    var cv=L.renderCanvas(p,k,L.optsFor(p),st.spec.longEdge,true);
    var rc=cv.photoRect;
    out.photoRectOnTemplate[k]=[cv.width,cv.height].join('x')+' rect '+
      [Math.round(rc.dx),Math.round(rc.dy),Math.round(rc.dw),Math.round(rc.dh)].join(',');
  });
  return JSON.stringify(out);
`);
console.log('① 各模版里的照片矩形：'); console.log(JSON.stringify(r1, null, 1));

const r2 = await ev(`
  var L=window.LUMEN, st=L.state;
  var p=st.photos[0], g=st.generated.find(function(x){return x.photoId===p.id;});
  p.stickers=[L.stkFix({k:'heart',x:.72,y:.30,rot:.1,s:1.2,text:''})];
  var staleBefore=L.bookStale();
  L.refreshStickerArt(p);
  var staleAfter=L.bookStale();
  var artRect=[g.art.photoRect.dx,g.art.photoRect.dy,g.art.photoRect.dw,g.art.photoRect.dh].map(Math.round);
  var base=L.stkBase(p);
  var baseRect=[base.photoRect.dx,base.photoRect.dy,base.photoRect.dw,base.photoRect.dh].map(Math.round);
  var sz=L.stkStageHTML().match(/width="(\\d+)" height="(\\d+)"/);
  return JSON.stringify({
    staleBeforeRefresh:staleBefore, staleAfterRefresh:staleAfter,
    artRect:artRect, stageBaseRect:baseRect,
    rectsEqual: JSON.stringify(artRect)===JSON.stringify(baseRect),
    artSize: g.art.width+'x'+g.art.height,
    stageHtmlSize: sz?sz[1]+'x'+sz[2]:'?',
    stickSigMatches: (g.stick||'')===L.stickerSig(p)
  });
`);
console.log('② 实时刷新与新坐标：'); console.log(JSON.stringify(r2, null, 1));

const r3 = await ev(`
  var L=window.LUMEN, st=L.state;
  var p=st.photos[0];
  /* 面板画布实际画出来的像素 */
  L.renderPanel();
  await new Promise(function(r){ setTimeout(r,120); });
  var cv=document.getElementById('stkStage');
  if(!cv) return JSON.stringify({err:'没有 #stkStage'});
  var rect=L.stkStageRect();
  /* 同一枚贴纸：底片 + 贴纸层（面板走的路） vs 成片（书页走的路） */
  var g=st.generated.find(function(x){return x.photoId===p.id;});
  function hash(c){
    var x=c.getContext('2d'), d=x.getImageData(0,0,c.width,c.height).data, h=0;
    for(var i=0;i<d.length;i+=397){ h=(h*31+d[i])|0; }
    return h;
  }
  return JSON.stringify({
    stageSize: cv.width+'x'+cv.height,
    rectFromStage: [rect.dx,rect.dy,rect.dw,rect.dh].map(Math.round),
    artHash: hash(g.art),
    stageHash: hash(cv),
    cssBox: (function(){ var r=cv.getBoundingClientRect(); return Math.round(r.width)+'x'+Math.round(r.height); })()
  });
`);
console.log('③ 面板画布：'); console.log(JSON.stringify(r3, null, 1));

await b.close();
