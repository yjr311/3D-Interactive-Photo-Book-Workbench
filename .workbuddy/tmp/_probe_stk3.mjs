import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9473, windowSize: '1400,920' });
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

const grid = await ev(`
  var L=window.LUMEN, st=L.state;
  st.photos.forEach(function(p){ p.picked=true; p.stickers=[]; });
  st.book.layout='grid'; st.book.art='plain'; st.book.cap='name';
  st.opts.title=''; st.opts.sub=''; st.opts.corner='';
  var r=L.buildBookPages();
  var pg=r.pages[3].canvas, cv=pg.canvas, x=cv.getContext('2d');
  var W=cv.width, H=cv.height;
  var gap=W*.030, colW=W-W*.098*2, PT=H*.082, PB=H*.104;
  var cellW=(colW-gap*2)/3, cellH=(H-PT-PB-gap*2)/3;
  function dark(cx,cy,w,h){ var d=x.getImageData(cx,cy,w,h).data, n=0;
    for(var i=0;i<d.length;i+=4){ if(d[i]<225||d[i+1]<225||d[i+2]<225) n++; } return n; }
  var rows=[];
  for(var j=0;j<3;j++){ rows.push([]); for(var i=0;i<3;i++){
    var cx=Math.round(W*.098+i*(cellW+gap)), cy=Math.round(PT+j*(cellH+gap));
    rows[j].push(dark(cx+10,cy+8,Math.round(cellW-20),Math.round(cellW*.6)));
  } }
  var below=dark(20, Math.round(PT+3*(cellH+gap))+4, W-40, 30);
  return JSON.stringify({per:L.perPage('grid'), rows:rows, W:W, H:H, below:below,
    pages:r.pages.length});
`);
console.log('grid:', JSON.stringify(grid));

/* 图注在九宫格里有没有画出来：同一页 cap=name vs cap=none 的像素差 */
const cap = await ev(`
  var L=window.LUMEN, st=L.state;
  function sig(cv){ var x=cv.getContext('2d'); var d=x.getImageData(0,0,cv.width,cv.height).data;
    var h=2166136261; for(var i=0;i<d.length;i+=53){ h^=d[i]; h=Math.imul(h,16777619); } return (h>>>0); }
  st.book.cap='name'; var r1=L.buildBookPages(); var a=sig(r1.pages[3].canvas);
  st.book.cap='none'; var r2=L.buildBookPages(); var c=sig(r2.pages[3].canvas);
  st.book.cap='name';
  return JSON.stringify({a:a, c:c, differ:a!==c});
`);
console.log('cap:', JSON.stringify(cap));

/* 双封面/封底寄语：三档 —— 空 / 短 / 超长（超长必须被收住，不许溢出版心） */
const notes = await ev(`
  var L=window.LUMEN, st=L.state;
  function bounds(cv,y0,y1){ var x=cv.getContext('2d');
    var d=x.getImageData(0,y0,cv.width,Math.max(1,y1-y0)).data;
    var W=cv.width, minX=1e9,maxX=-1,minY=1e9,maxY=-1,n=0;
    for(var j=0;j<y1-y0;j++) for(var i=0;i<W;i++){
      var o=(j*W+i)*4;
      if(d[o]<150&&d[o+1]<150&&d[o+2]<150){ n++; if(i<minX)minX=i; if(i>maxX)maxX=i; if(j<minY)minY=j; if(j>maxY)maxY=j; }
    }
    return {n:n, x0:minX, x1:maxX, y0:minY+y0, y1:maxY+y0};
  }
  st.book.coverNote=''; st.book.backNote='';
  var c0=L.renderCover(880,1320), b0=L.renderBack(880,1320);
  var cb0=bounds(c0,Math.round(1320*.73),Math.round(1320*.83));
  var bb0=bounds(b0,Math.round(1320*.49),Math.round(1320*.66));
  st.book.coverNote='送给 2026 年的我们';
  st.book.backNote='愿你把每一个瞬间都留下来。';
  var c1=L.renderCover(880,1320), b1=L.renderBack(880,1320);
  var cb1=bounds(c1,Math.round(1320*.73),Math.round(1320*.83));
  var bb1=bounds(b1,Math.round(1320*.49),Math.round(1320*.66));
  st.book.backNote='愿你把每一个瞬间都留下来。愿你在很多年以后翻到这一页，还能想起那个下午的风、那杯没喝完的咖啡、和身边那个正在笑的人。';
  var b2=L.renderBack(880,1320);
  var bb2=bounds(b2,Math.round(1320*.47),Math.round(1320*.66));
  st.book.coverNote=''; st.book.backNote='';
  return JSON.stringify({cover:[cb0,cb1], back:[bb0,bb1,bb2], H:1320});
`);
console.log('notes:', JSON.stringify(notes));

await b.close();
