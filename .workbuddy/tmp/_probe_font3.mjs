import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'fs';

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsfont';
fs.mkdirSync(OUT, { recursive: true });
const log = (...a) => { console.log(...a); };

const CANDS = [
  ['A-current', 'Georgia,"Songti SC","SimSun",serif'],
  ['B-kaiti', 'Georgia,"Kaiti SC","STKaiti","KaiTi","Songti SC","SimSun",serif'],
  ['C-fangsong', 'Georgia,"Songti SC","FangSong","SimSun",serif'],
  ['D-yahei', '"PingFang SC","Microsoft YaHei",Georgia,sans-serif'],
  ['E-dengxian', '"DengXian","Microsoft YaHei",Georgia,sans-serif'],
  ['F-simsun-first', '"Songti SC","SimSun",Georgia,serif'],
];

log('launching...');
const b = await launch({ port: 9521, windowSize: '1400,920' });
log('launched', b.version);
await b.goto(FILE, 3000);
log('loaded');

async function ev(tag, body) {
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  let o;
  try { o = JSON.parse(raw); } catch { log(tag, 'RAW', String(raw).slice(0, 400)); return null; }
  if (o && o.__err) log(tag, '[err]', o.__err);
  return o;
}

const st = await ev('setup', `
  var L=window.LUMEN, st=L.state;
  await L.loadEmbedded(true);
  st.photos.forEach(function(p,i){ p.picked=(i<2); });
  L.setStep(2);
  await L.generate();
  for(var i=0;i<200;i++){ await new Promise(function(x){setTimeout(x,120);}); if(st.generated.length>=2) break; }
  return JSON.stringify({n:st.generated.length, photos:st.photos.length, aspect:JSON.stringify(st.book.ratio||'')});
`);
log('setup ->', JSON.stringify(st));

for (const [name, fam] of CANDS) {
  const r = await ev(name, `
    var L=window.LUMEN, st=L.state;
    var W=880, H=Math.round(880*4/3);
    st.book.layout='mat'; st.book.cap='note';
    st.photos[0].note='拍照的人先笑一个'; st.photos[1].note='';
    var keep=FONTS.serif; FONTS.serif=${JSON.stringify(fam)};
    var cjk=L.renderContent([st.generated[0]],5,W,H,'l').toDataURL('image/png');
    var lat=L.renderContent([st.generated[1]],6,W,H,'r').toDataURL('image/png');
    FONTS.serif=keep; st.photos[0].note='';
    return JSON.stringify({cjk:cjk, lat:lat});
  `);
  if (!r) { log(name, 'FAILED'); continue; }
  for (const k of ['cjk', 'lat']) {
    const m = /^data:image\/png;base64,([\s\S]+)$/.exec(r[k] || '');
    if (m) fs.writeFileSync(`${OUT}/${name}-${k}.png`, Buffer.from(m[1], 'base64'));
  }
  log('wrote', name, '|', fam);
}
await b.close();
log('done');
