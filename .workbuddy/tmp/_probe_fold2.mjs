import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'fs';

/* 复现「悬停折角画错位置」。
   判据不做"找白片"（阈值挑不出那片渐变），改成**同一帧开/关折角的像素差**，
   差的 bbox 就是折角真正落在哪。 */
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsfold';
fs.mkdirSync(OUT, { recursive: true });
const b = await launch({ port: 9573, windowSize: '1500,950' });
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
  return JSON.stringify({spread:L.BV.spread, spineX:L.BV.spineX, pw:L.BV.pw, ph:L.BV.ph,
    top:L.BV.top, cw:L.BV.cw, ch:L.BV.ch, dpr:L.BV.dpr, cur:L.BV.cur});
`);
console.log('几何:', JSON.stringify(info));

const probe = await ev('probe', `
  var L=window.LUMEN, B=L.BV;
  function shot(mode){
    if(mode){ B.cornerOn=true; B.cornerSide=mode; B.cornerA=1; }
    else { B.cornerOn=false; B.cornerA=0; }
    B.draw();
    var x=B.cv.getContext('2d');
    return x.getImageData(0,0,B.cv.width,B.cv.height).data;
  }
  var base=shot(null);
  var out={};
  ['l','r'].forEach(function(mode){
    var d=shot(mode);
    var minX=1e9,maxX=-1,minY=1e9,maxY=-1,n=0;
    var W=B.cv.width;
    for(var i=0;i<d.length;i+=4){
      var t=Math.abs(d[i]-base[i])+Math.abs(d[i+1]-base[i+1])+Math.abs(d[i+2]-base[i+2]);
      if(t>10){ n++; var p=i/4, xx=p%W, yy=(p-xx)/W;
        if(xx<minX)minX=xx; if(xx>maxX)maxX=xx; if(yy<minY)minY=yy; if(yy>maxY)maxY=yy; }
    }
    out[mode]={n:n,minX:minX,maxX:maxX,minY:minY,maxY:maxY};
  });
  B.cornerOn=false; B.cornerA=0; B.draw();
  return JSON.stringify({out:out, spineX:B.spineX, pw:B.pw, top:B.top, ph:B.ph, dpr:B.dpr, spread:B.spread});
`);
if (probe) {
  const s = probe.dpr;
  const L = Math.round((probe.spineX - probe.pw) * s);
  const G = Math.round(probe.spineX * s);
  const R = Math.round((probe.spineX + probe.pw) * s);
  const B = Math.round((probe.top + probe.ph) * s);
  console.log(`\n画布坐标：左页左边=${L}  书沟=${G}  右页右边=${R}  页下缘=${B}`);
  for (const k of ['l', 'r']) {
    const o = probe.out[k];
    const side = k === 'l' ? 'hover 左页（折角该在左页左边=' + L + '）' : 'hover 右页（折角该在右页右边=' + R + '）';
    console.log(`  ${side}`);
    console.log(`     实际落点 x∈[${o.minX},${o.maxX}]  y∈[${o.minY},${o.maxY}]  差异像素=${o.n}`);
  }
}
await b.close();
