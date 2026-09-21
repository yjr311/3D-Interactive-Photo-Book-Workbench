import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9474, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(900);

async function ev(body) {
  const raw = await b.evaluate(
    `(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const out = JSON.parse(raw);
  if (out && out.__err) console.log('  [page error] ' + out.__err);
  return out;
}

console.log('setup:', JSON.stringify(await ev(`
  await window.LUMEN.loadEmbedded(true);
  var L=window.LUMEN, st=L.state;
  L.setStep(2);
  await L.generate();
  await new Promise(function(r){ setTimeout(r,1200); });
  return JSON.stringify({photos:st.photos.length, gen:st.generated.length,
    pickedGen:st.generated.filter(function(g){return g.picked;}).length});
`)));

console.log('a:', JSON.stringify(await ev(`
  var L=window.LUMEN, st=L.state;
  st.photos.forEach(function(p){ p.picked=true; p.stickers=[]; });
  st.book.layout='grid'; st.book.art='plain'; st.book.cap='name';
  var r=L.buildBookPages();
  return JSON.stringify({per:L.perPage('grid'), n:r.pages.length,
    kinds:r.pages.map(function(p){ return p.kind; }),
    sizes:r.pages.map(function(p){ return p.canvas?[p.canvas.width,p.canvas.height]:null; })});
`)));

console.log('b:', JSON.stringify(await ev(`
  var L=window.LUMEN, st=L.state;
  st.opts.title=''; st.opts.sub=''; st.opts.corner='';
  var r=L.buildBookPages();
  return JSON.stringify({n:r.pages.length, kinds:r.pages.map(function(p){ return p.kind; }),
    has3: !!r.pages[3], c3: r.pages[3]?!!r.pages[3].canvas:false});
`)));

await b.close();
