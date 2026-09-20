import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9492, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(900);
async function ev(body) {
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const o = JSON.parse(raw);
  if (o && o.__err) console.log('  [err] ' + o.__err);
  return o;
}

const r = await ev(`
  var L=window.LUMEN, st=L.state;
  await L.loadEmbedded(true);
  st.photos.forEach(function(p,i){ p.picked=(i<2); });
  L.setStep(2);
  await L.generate();
  for(var i=0;i<120;i++){ await new Promise(function(x){setTimeout(x,120);}); if(st.generated.length===2) break; }
  var g=st.generated[0], ph=st.photos[0];
  var W=620,H=820;

  /* 同一页画两次：有文案 / 无文案，看差异像素落在哪里 */
  function diffPage(layout,note){
    var keep=st.book.layout, keepCap=st.book.cap, keepTitle=st.opts.title;
    st.book.layout=layout; st.book.cap='note';
    ph.note=''; var a=L.renderContent([g],3,W,H,'r');
    ph.note=note||''; var c=L.renderContent([g],3,W,H,'r');
    var da=a.getContext('2d').getImageData(0,0,W,H).data;
    var dc=c.getContext('2d').getImageData(0,0,W,H).data;
    var n=0,minX=1e9,maxX=-1,minY=1e9,maxY=-1;
    for(var y=0;y<H;y++) for(var x=0;x<W;x++){
      var o=(y*W+x)*4;
      if(Math.abs(da[o]-dc[o])+Math.abs(da[o+1]-dc[o+1])+Math.abs(da[o+2]-dc[o+2])>12){
        n++; if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y;
      }
    }
    st.book.layout=keep; st.book.cap=keepCap; st.opts.title=keepTitle; ph.note='';
    return {n:n, x:[minX,maxX], y:[minY,maxY], H:H, W:W};
  }

  var out={};
  ['mat','two','sticker','full'].forEach(function(ly){ out[ly]=diffPage(ly,'无题，但很喜欢'); });

  /* 印片自己就写着同一句话时（opts.title 用 {note}）→ 不该重复画 */
  st.book.layout='mat'; ph.note='无题，但很喜欢'; st.opts.title='{note}';
  var same=L.plateHasText(g), draw=L.capWillDraw(g);
  ph.note=''; st.opts.title='{name}';

  /* 出厂默认下这一张该不该画 */
  ph.note='无题，但很喜欢';
  var d2=L.capWillDraw(g);
  ph.note='';

  return JSON.stringify({out:out, sameText_plateHasText:same, sameText_capWillDraw:draw, default_capWillDraw:d2,
    cap:st.book.cap, noteEmptyCap:L.captionOf(g)});
`);
console.log('book.cap =', r.cap, '| 没写文案时图注 =', r.noteEmptyCap);
console.log('出厂默认下写了文案 → capWillDraw =', r.default_capWillDraw);
console.log('印片自己就是那句文案 → plateHasText =', r.sameText_plateHasText, ' capWillDraw =', r.sameText_capWillDraw);
for (const ly of Object.keys(r.out)) {
  const o = r.out[ly];
  console.log(`  layout=${ly.padEnd(8)} 差异像素=${String(o.n).padStart(6)}  范围 x∈[${o.x[0]},${o.x[1]}] y∈[${o.y[0]},${o.y[1]}]  (页面 ${o.W}×${o.H})`);
}
await b.close();
