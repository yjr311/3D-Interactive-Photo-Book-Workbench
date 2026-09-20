import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9491, windowSize: '1400,920' });
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
  st.photos.forEach(function(p,i){ p.picked=(i<3); });
  /* 给前两张写文案 */
  st.photos[0].note='无题，但很喜欢';
  st.photos[1].note='时间在此处停了一下';
  L.setStep(2);
  await L.generate();
  for(var i=0;i<120;i++){ await new Promise(function(x){setTimeout(x,120);}); if(st.generated.length===3) break; }
  var out=st.generated.map(function(g,i){
    return {
      i:i, tpl:g.tpl, title:g.title, sub:g.sub,
      note:(st.photos[i]||{}).note||'',
      captionOf:L.captionOf(g),
      plateHasText:L.plateHasText(g),
      capWillDraw:L.capWillDraw(g)
    };
  });
  return JSON.stringify({art:st.book.art, cap:st.book.cap, layout:st.book.layout, out:out});
`);
console.log('book.art =', r.art, '| book.cap =', r.cap, '| layout =', r.layout);
for (const o of r.out) {
  console.log(`  成片${o.i} tpl=${o.tpl} title="${o.title}" note="${o.note}" captionOf="${o.captionOf}" plateHasText=${o.plateHasText} capWillDraw=${o.capWillDraw}`);
}
await b.close();
