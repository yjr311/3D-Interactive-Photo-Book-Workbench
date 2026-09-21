import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9476, windowSize: '1400,920' });
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

console.log('g1:', JSON.stringify(await ev(`
  var L=window.LUMEN, st=L.state;
  st.photos.forEach(function(p){ p.picked=true; p.stickers=[]; });
  st.book.layout='grid'; st.book.art='plain'; st.book.cap='name';
  st.opts.title=''; st.opts.sub=''; st.opts.corner='';
  var r=L.buildBookPages();
  var d=document.createElement('canvas');
  var out={n:r.pages.length, per:L.perPage('grid'),
    c3: r.pages[3]?String(!!r.pages[3].canvas):'no-page'};
  try{ var pg=r.pages[3]; var cv=pg&&pg.canvas;
    out.hasCv=!!cv; out.wh=cv?[cv.width,cv.height]:null;
    var x=cv.getContext('2d'); out.x=!!x;
    out.px=x.getImageData(0,0,4,4).data.length;
  }catch(e2){ out.throwAt=(e2&&e2.stack)||String(e2); }
  return JSON.stringify(out);
`)));

await b.close();
