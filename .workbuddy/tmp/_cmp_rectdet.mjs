/* 验「确定性」这条断言有没有分辨力：改前的九宫格矩形是否会抖。
   检测器自己也要有反向对照 —— 只有能判出"坏"，才证明"全绿"有意义。 */
import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

const CWD = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14';
const FILES = [
  ['改前', 'file:///' + CWD + '/.workbuddy/tmp/_before.html'],
  ['改后', 'file:///' + CWD + '/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html'],
];
const N = 12;

for (const [tag, url] of FILES) {
  const b = await launch({ port: 9533, windowSize: '1440,900' });
  await b.goto(url, 2600);
  await sleep(700);
  async function ev(body) {
    const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
    const o = JSON.parse(raw); if (o.__err) console.log('  [err] ' + o.__err); return o;
  }
  await ev(`await window.LUMEN.loadEmbedded(true); var L=window.LUMEN; L.setStep(2);
    await L.generate();
    for(var i=0;i<80;i++){ await new Promise(function(r){setTimeout(r,120);}); if(!L.bookStale()) break; }
    return JSON.stringify({ok:1});`);

  const r = await ev(`
    var L=window.LUMEN, st=L.state, p=st.photos[0], out={};
    ['grid9','duotone','kraft','postcard'].forEach(function(k){
      var seen={}, order=[];
      for(var i=0;i<${N};i++){
        var cv=L.renderCanvas(p,k,L.optsFor(p),st.spec.longEdge,true);
        var rc=cv.photoRect||{dx:0,dy:0,dw:cv.width,dh:cv.height};
        var key=[rc.dx.toFixed(1),rc.dy.toFixed(1),rc.dw.toFixed(1),rc.dh.toFixed(1)].join(',');
        if(!seen[key]){ seen[key]=0; order.push(key); }
        seen[key]++;
      }
      out[k]={n:order.length, list:order.map(function(kk){ return kk+' x'+seen[kk]; })};
    });
    return JSON.stringify(out);`);

  console.log('');
  console.log('======== ' + tag + '：同一模版连渲 ' + N + ' 次的矩形取值 ========');
  for (const k of Object.keys(r)) {
    const o = r[k];
    console.log('  ' + (o.n === 1 ? '   ' : 'XX ') + k.padEnd(9) + ' ' + o.n + ' 种取值   ' + o.list.join('  |  '));
  }
  await b.close();
}
