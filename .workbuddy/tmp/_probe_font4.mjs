import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'fs';

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsfont';
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => console.log(...a);

const win = process.argv[2] || '1500,950';
const port = Number(process.argv[3] || 9533);
const tag = process.argv[4] || 'REAL';
const b = await launch({ port, windowSize: win });
log('launched', b.version, 'window', win);
await b.goto(FILE, 3000);
await sleep(600);

async function ev(tagName, body) {
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  let o; try { o = JSON.parse(raw); } catch { log(tagName, 'RAW', String(raw).slice(0, 300)); return null; }
  if (o && o.__err) log(tagName, '[err]', o.__err);
  return o;
}

const info = await ev('setup', `
  var L=window.LUMEN, st=L.state;
  await L.loadEmbedded(true);
  st.photos.forEach(function(p,i){ p.picked=(i<6); });
  L.setStep(2);
  await L.generate();
  for(var i=0;i<200;i++){ await new Promise(function(x){setTimeout(x,120);}); if(st.generated.length===6) break; }
  st.book.art='tpl'; st.book.cap='note'; st.book.layout='mat';
  var notes=['拍照的人先笑一个','没有文案','时间在此处停了一下','就这样，很好','随手拍的一张','嗯，值得留一张'];
  st.photos.forEach(function(p,i){ if(i<6) p.note=notes[i]; });
  L.renderPanel(); L.setStep(0); L.setStep(2);
  await new Promise(function(x){ setTimeout(x,1400); });
  L.BV.go(3);
  await new Promise(function(x){ setTimeout(x,1800); });
  return JSON.stringify({pw:L.BV.pw, ph:L.BV.ph, dpr:L.BV.dpr, cur:L.BV.cur, spread:L.BV.spread,
    layout:st.book.layout, cap:st.book.cap, note:st.photos[0].note});
`);
log('info', JSON.stringify(info));
await sleep(700);
await b.screenshot(OUT + '/' + tag + '-书页.png');
log('wrote', tag + '-书页.png');
await b.close();
log('done');
