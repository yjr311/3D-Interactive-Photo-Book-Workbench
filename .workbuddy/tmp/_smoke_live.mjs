import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9532, windowSize: '1440,940' });
await b.goto(FILE, 2500);
await sleep(700);
async function ev(x){
  const raw=await b.evaluate(`(async function(){try{${x}}catch(e){return JSON.stringify({__err:String(e&&e.stack||e)})}})()`);
  const o=JSON.parse(raw); if(o&&o.__err) console.log('  [err] '+o.__err); return o;
}
/* 一个"书页里第 k 页"的像素指纹 */
const PICK = `
  function pageHash(kind,no){
    var r=L.buildBookPages(), pg;
    for(var i=0;i<r.pages.length;i++){
      var q=r.pages[i];
      if(q.kind===kind && (no==null || q.no===no)) pg=q;
    }
    if(!pg) return null;
    var c=pg.canvas;
    var x=c.getContext('2d'), d=x.getImageData(0,0,c.width,c.height).data, h=0;
    for(var i=0;i<d.length;i+=1013){ h=(h*31+d[i])|0; }
    return h;
  }`;

const r = await ev(`
  var L=window.LUMEN, st=L.state;
  await L.loadEmbedded(true);
  await L.generate();
  for(var i=0;i<80;i++){ await new Promise(function(r){setTimeout(r,100);}); if(!L.bookStale()) break; }
  L.setStep(2);
  await new Promise(function(r){setTimeout(r,150);});
  ${PICK}
  /* 第 1 页内容页装的就是第 1 张照片 */
  var p=st.photos[0];
  p.stickers=[];
  L.refreshStickerArt(p);
  var before=pageHash('content',1);
  var t0=performance.now();
  /* —— 模拟用户"贴一枚贴纸"：只改数据 + scheduleArt（不点生成） —— */
  p.stickers=[L.stkFix({k:'heart',x:.5,y:.5,rot:0,s:1.4,text:''})];
  L.scheduleArt(p);
  var waited=0;
  while(waited<1600){
    await new Promise(function(r){setTimeout(r,50);}); waited+=50;
    if(pageHash('content',1)!==before) break;
  }
  var after=pageHash('content',1);
  return JSON.stringify({
    pageChangedWithoutGenerate: after!==before,
    msToBookUpdate: waited,
    bookStaleAfter: L.bookStale()
  });
`);
console.log('① 不点生成，书页是否自己变：', JSON.stringify(r,null,1));

/* 反向对照：把 scheduleArt 换成"只改数据、什么都不刷新"（=旧行为），书页必须不变 */
const r2 = await ev(`
  var L=window.LUMEN, st=L.state;
  ${PICK}
  var p=st.photos[0];
  p.stickers=[];
  L.refreshStickerArt(p);
  var before=pageHash('content',1);
  p.stickers=[L.stkFix({k:'star',x:.5,y:.5,rot:0,s:1.4,text:''})];
  /* 旧行为：只改数据 + 重画面板，不碰成片 */
  L.paintStkStage();
  await new Promise(function(r){setTimeout(r,900);});
  return JSON.stringify({ reversed_pageUnchanged: pageHash('content',1)===before });
`);
console.log('② 反向对照（旧行为）：', JSON.stringify(r2,null,1));
await b.close();
