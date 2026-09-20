import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'fs';

/* 复现「悬停折角画错位置」：
   把真实鼠标移到左页左下角（外下角）与右页右下角，然后直接读画布像素，
   找那片"掀起的纸背面"（接近纯白的方块）落在哪儿。 */
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsfold';
fs.mkdirSync(OUT, { recursive: true });
const b = await launch({ port: 9571, windowSize: '1500,950' });
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
  await new Promise(function(x){setTimeout(x,1600);});
  L.BV.go(3);
  await new Promise(function(x){setTimeout(x,1600);});
  var r=L.BV.el.querySelector('.bv-stage').getBoundingClientRect();
  return JSON.stringify({spineX:L.BV.spineX, pw:L.BV.pw, ph:L.BV.ph, top:L.BV.top, cw:L.BV.cw, ch:L.BV.ch,
    dpr:L.BV.dpr, rect:{x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height)}});
`);
console.log('几何:', JSON.stringify(info));

/* 在画布坐标里找"掀起的纸背面"：底部那一片接近纯白(r,g,b 都 > 246)的方块 */
async function probe(label, mode) {
  const r = await ev(label, `
    var L=window.LUMEN, B=L.BV;
    var keep=B.cornerSide;
    B.cornerOn=true; B.cornerSide=${JSON.stringify(mode)}; B.cornerA=1;
    B.draw();
    var cv=B.cv, x=cv.getContext('2d');
    var d=x.getImageData(0,0,cv.width,cv.height).data;
    var W=cv.width, H=cv.height, s=B.dpr;
    var minX=1e9,maxX=-1,minY=1e9,maxY=-1,n=0;
    var yTop=Math.round((B.top+B.ph-Math.max(60,B.pw*.118)-8)*s), yBot=Math.round((B.top+B.ph+6)*s);
    for(var y=Math.max(0,yTop); y<Math.min(H,yBot); y++){
      for(var xx=0; xx<W; xx++){
        var o=(y*W+xx)*4;
        if(d[o]>246&&d[o+1]>246&&d[o+2]>244){ n++; if(xx<minX)minX=xx; if(xx>maxX)maxX=xx; if(y<minY)minY=y; if(y>maxY)maxY=y; }
      }
    }
    B.cornerSide=keep; B.cornerOn=false; B.cornerA=0; B.draw();
    return JSON.stringify({n:n, minX:minX, maxX:maxX, minY:minY, maxY:maxY,
      spineX:B.spineX, pw:B.pw, top:B.top, ph:B.ph, dpr:B.dpr});
  `);
  if (!r) return null;
  const s = r.dpr;
  console.log(`  ${label}: 白片 x∈[${r.minX},${r.maxX}] y∈[${r.minY},${r.maxY}] 像素=${r.n}`);
  console.log(`     画布 左页左边=${Math.round((r.spineX - r.pw) * s)} 书沟=${Math.round(r.spineX * s)} 右页右边=${Math.round((r.spineX + r.pw) * s)}`);
  return r;
}

console.log('\n[BEFORE] 折角画在哪：');
await probe('hover-left', 'l');
await probe('hover-right', 'r');
await b.close();
