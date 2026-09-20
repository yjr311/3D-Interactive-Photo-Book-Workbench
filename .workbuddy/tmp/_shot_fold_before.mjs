import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'fs';

/* 运行时把旧版 drawFold（px 少一个 -pw）注入回去，复现用户报的「折角跑到书沟上」。
   与 _shot_fold.mjs 只差注入这一步，其余几何/悬停完全一致。 */
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsfold';
const SRC = JSON.parse(fs.readFileSync('C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/_fold_src.json', 'utf8'));
fs.mkdirSync(OUT, { recursive: true });
const b = await launch({ port: 9576, windowSize: '1500,950' });
await b.goto(FILE, 3000);
await sleep(700);

async function ev(tag, body) {
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  let o; try { o = JSON.parse(raw); } catch { console.log(tag, 'RAW', String(raw).slice(0, 300)); return null; }
  if (o && o.__err) console.log(tag, '[err]', o.__err);
  return o;
}

const info = await ev('setup', `
  var L=window.LUMEN, st=L.state;
  await L.loadEmbedded(true);
  st.photos.forEach(function(p,i){ p.picked=(i<6); });
  L.setStep(2); await L.generate();
  for(var i=0;i<200;i++){ await new Promise(function(x){setTimeout(x,120);}); if(st.generated.length===6) break; }
  L.renderPanel(); L.setStep(0); L.setStep(2);
  await new Promise(function(x){setTimeout(x,2200);});
  L.BV.go(3);
  await new Promise(function(x){setTimeout(x,2600);});
  /* 注入旧版 */
  L.BV.drawFold = eval('(' + ${JSON.stringify(SRC.buggy)} + ')');
  L.BV.draw();
  var r=L.BV.cv.getBoundingClientRect();
  return JSON.stringify({rect:{l:r.left,t:r.top,w:r.width,h:r.height},
    spread:L.BV.spread, spineX:L.BV.spineX, pw:L.BV.pw, ph:L.BV.ph,
    top:L.BV.top, cw:L.BV.cw, ch:L.BV.ch, dpr:L.BV.dpr, cur:L.BV.cur});
`);
if (!info) { await b.close(); process.exit(1); }
const R = info.rect;
const leftEdge  = R.l + (info.spineX - info.pw);
const gutter    = R.l + info.spineX;
const rightEdge = R.l + (info.spineX + info.pw);
const pageBottom = R.t + Math.min(info.top + info.ph, R.h);
const bottomY   = pageBottom - 14;
console.log('几何:', JSON.stringify(info));
console.log('屏坐标: 左页左边=' + Math.round(leftEdge) + ' 书沟=' + Math.round(gutter) +
  ' 右页右边=' + Math.round(rightEdge) + ' 页下缘=' + Math.round(pageBottom));

await b.mouse('mouseMoved', R.l + R.w / 2, R.t + 30);
await sleep(1200);
await b.screenshot(OUT + '/before-00-无悬停.png');
await b.mouse('mouseMoved', leftEdge + 7, bottomY);
await sleep(1000);
let s1 = await ev('L', 'var B=window.LUMEN.BV; return JSON.stringify({on:B.cornerOn,side:B.cornerSide,a:B.cornerA});');
console.log('  [改前 hover左] 折角态=', JSON.stringify(s1));
await b.screenshot(OUT + '/before-01-悬停左页左下角.png');
await b.mouse('mouseMoved', rightEdge - 7, bottomY);
await sleep(1000);
await b.screenshot(OUT + '/before-02-悬停右页右下角.png');
await b.mouse('mouseMoved', R.l + R.w / 2, R.t + 30);
await sleep(600);
await b.close();
