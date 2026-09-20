import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'fs';

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsfont';
fs.mkdirSync(OUT, { recursive: true });
const b = await launch({ port: 9541, windowSize: '1850,1100' });
await b.goto(FILE, 3000);
await sleep(600);
async function ev(tag, body) {
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  let o; try { o = JSON.parse(raw); } catch { console.log(tag, 'RAW', String(raw).slice(0, 300)); return null; }
  if (o && o.__err) console.log(tag, '[err]', o.__err);
  return o;
}

const pick = await ev('pick', `
  var L=window.LUMEN;
  var per={};
  L.CAP_CJK.forEach(function(f){ per[f]=L.fontOK(f); });
  return JSON.stringify({capCJK:L.capCJK, handCJK:L.handCJK, cap:FONTS.cap, hand:FONTS.hand,
    serif:FONTS.serif, per:per});
`);
console.log('== 本机可用性探测 ==');
console.log('capCJK =', pick.capCJK, '   handCJK =', pick.handCJK);
console.log('FONTS.cap  =', pick.cap);
console.log('FONTS.hand =', pick.hand);
console.log('逐个候选:', JSON.stringify(pick.per, null, 0));

/* 视觉：同一页，改前(宋体) vs 改后(楷体) —— 只换 cap 里的中文字族 */
const vis = await ev('vis', `
  var L=window.LUMEN, st=L.state;
  await L.loadEmbedded(true);
  st.photos.forEach(function(p,i){ p.picked=(i<2); });
  L.setStep(2); await L.generate();
  for(var i=0;i<200;i++){ await new Promise(function(x){setTimeout(x,120);}); if(st.generated.length>=2) break; }
  var W=880, H=1173;
  st.book.layout='mat'; st.book.cap='note'; st.book.art='tpl';
  st.photos[0].note='拍照的人先笑一个'; st.photos[1].note='';
  var keep=FONTS.cap;
  var out={};
  var variants=[['after', FONTS.cap], ['before', 'Georgia,"Songti SC","SimSun",serif'],
                ['yahei', '"PingFang SC","Microsoft YaHei",Georgia,sans-serif']];
  for(var k=0;k<variants.length;k++){
    FONTS.cap=variants[k][1];
    out[variants[k][0]]=L.renderContent([st.generated[0]],5,W,H,'l').toDataURL('image/png');
  }
  FONTS.cap=keep; st.photos[0].note='';
  return JSON.stringify(out);
`);
for (const k of Object.keys(vis)) {
  const m = /^data:image\/png;base64,([\s\S]+)$/.exec(vis[k] || '');
  if (m) fs.writeFileSync(`${OUT}/AFTER-${k}.png`, Buffer.from(m[1], 'base64'));
  console.log('wrote AFTER-' + k + '.png');
}
await b.close();
