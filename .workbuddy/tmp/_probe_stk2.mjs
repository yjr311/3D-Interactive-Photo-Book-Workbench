import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9472, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(900);

async function ev(body) {
  const raw = await b.evaluate(
    `(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const out = JSON.parse(raw);
  if (out && out.__err) console.log('  [page error] ' + out.__err);
  return out;
}

await ev(`
  await window.LUMEN.loadEmbedded(true);
  var L=window.LUMEN, st=L.state;
  L.setStep(2);
  await L.generate();
  await new Promise(function(r){ setTimeout(r,900); });
  return JSON.stringify({ok:1});
`);

/* ① 画布上真点一下 → 贴纸挪到那里 */
const place = await ev(`
  var L=window.LUMEN, st=L.state;
  var s=document.querySelector('#panel');
  s.querySelector('.stks .stk[data-stk-add]').click();
  await new Promise(function(r){ setTimeout(r,300); });
  var cv=document.querySelector('#stkStage');
  cv.scrollIntoView({block:'center'});
  await new Promise(function(r){ setTimeout(r,300); });
  var r=cv.getBoundingClientRect();
  var c=L.stkCur(), before={x:L.stickOf(c.p)[0].x, y:L.stickOf(c.p)[0].y};
  function pd(type,x,y){ cv.dispatchEvent(new PointerEvent(type,{bubbles:true,clientX:x,clientY:y,pointerId:1})); }
  pd('pointerdown', r.left+r.width*0.75, r.top+r.height*0.25);
  await new Promise(function(r2){ setTimeout(r2,160); });
  pd('pointermove', r.left+r.width*0.20, r.top+r.height*0.80);
  await new Promise(function(r2){ setTimeout(r2,160); });
  pd('pointerup',   r.left+r.width*0.20, r.top+r.height*0.80);
  await new Promise(function(r2){ setTimeout(r2,220); });
  var after={x:L.stickOf(c.p)[0].x, y:L.stickOf(c.p)[0].y};
  var sel=document.querySelector('#panel [data-stkval="x"]');
  return JSON.stringify({before:before, after:after, box:[r.width,r.height],
    readout: sel?sel.textContent:null, ok:Math.abs(after.x-.20)<.05 && Math.abs(after.y-.80)<.05});
`);
console.log('place:', JSON.stringify(place));

/* ② 滑杆拖一下 —— 面板不许被重渲染（input 必须还在 DOM 里） */
const slider = await ev(`
  var L=window.LUMEN, st=L.state;
  var inp=document.querySelector('#panel input[data-stk="s"]');
  if(!inp) return JSON.stringify({err:'没有大小滑杆'});
  inp.value='2.0';
  inp.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(function(r){ setTimeout(r,200); });
  var again=document.querySelector('#panel input[data-stk="s"]');
  var c=L.stkCur();
  return JSON.stringify({v:L.stickOf(c.p)[0].s, sameNode:again===inp,
    readout:document.querySelector('#panel [data-stkval="s"]').textContent});
`);
console.log('slider:', JSON.stringify(slider));

/* ③ 九宫格：一页要有 9 格、每格都有照片 */
const grid = await ev(`
  var L=window.LUMEN, st=L.state;
  st.photos.forEach(function(p){ p.picked=true; p.stickers=[]; });
  st.book.layout='grid'; st.book.art='plain'; st.book.cap='name';
  st.opts.title=''; st.opts.sub=''; st.opts.corner='';
  var r=L.buildBookPages();
  var pg=r.pages[3], cv=pg.canvas, x=cv.getContext('2d');
  var W=cv.width, H=cv.height;
  function cellInk(cx,cy,w,h){ var d=x.getImageData(cx,cy,w,h).data, n=0;
    for(var i=0;i<d.length;i+=4){ if(d[i]<220||d[i+1]<220||d[i+2]<220) n++; } return n; }
  var gap=W*.030, colW=W-W*.098*2;
  var cellW=(colW-gap*2)/3, cellH=(H-H*.098-H*.104-gap*2)/3;
  var ys=[], xx=[];
  for(var j=0;j<3;j++) for(var i=0;i<3;i++){
    var cx=Math.round(W*.098+i*(cellW+gap)), cy=Math.round(H*.098+j*(cellH+gap));
    var v=cellInk(cx+4,cy+4,Math.round(cellW-8),Math.round(cellH-8));
    if(v>200){ ys.push(j); xx.push(i); }
  }
  return JSON.stringify({per:L.perPage('grid'), filled:ys.length, W:W, H:H,
    pageCount:(function(){ var n=0; for(var k=0;k<r.pages.length;k++){ } return r.pages.length; })(),
    labels:r.pages.map(function(p){ return p.label; }).slice(0,8)});
`);
console.log('grid:', JSON.stringify(grid));

/* ④ 封面寄语 / 封底寄语：设了才画 */
const notes = await ev(`
  var L=window.LUMEN, st=L.state;
  function ink(cv){ var x=cv.getContext('2d'); var d=x.getImageData(0,0,cv.width,cv.height).data, n=0;
    for(var i=0;i<d.length;i+=4){ if(d[i]<170&&d[i+1]<170&&d[i+2]<170) n++; } return n; }
  st.book.coverNote=''; st.book.backNote='';
  await new Promise(function(r){ setTimeout(r,120); });
  var c0=L.renderCover(880,1320), b0=L.renderBack(880,1320);
  var i0=ink(c0), i0b=ink(b0);
  st.book.coverNote='给三年后的我们'; st.book.backNote='愿你把每一个瞬间都留下来。';
  var c1=L.renderCover(880,1320), b1=L.renderBack(880,1320);
  var i1=ink(c1), i1b=ink(b1);
  return JSON.stringify({cover:[i0,i1], back:[i0b,i1b]});
`);
console.log('notes:', JSON.stringify(notes));

await b.close();
