/* 四个产物，同一张照片、同一批模版，把矩形打出来对齐看。
   目的：把"九宫格矩形到底被哪一处改动动了"钉死，而不是靠推测。

   current   正式产物（CTM 映射 + 求交 + 容差 + declare）
   _tolon    只回退容差
   _nointer  只回退求交
   _before   全部回退（真·改前） */
import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

const CWD = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14';
const BUILDS = [
  ['current ', 'file:///' + CWD + '/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html'],
  ['_tolon  ', 'file:///' + CWD + '/.workbuddy/tmp/_tolon.html'],
  ['_nointer', 'file:///' + CWD + '/.workbuddy/tmp/_nointer.html'],
  ['_before ', 'file:///' + CWD + '/.workbuddy/tmp/_before.html'],
];
const KEYS = ['grid9', 'kraft', 'postcard', 'polaroid', 'neon', 'minimal', 'cinematic', 'duotone'];

/* 启动竞态：上一轮的 Chromium 还没退干净时 launch 会拿不到 ws 地址。
   只对"0 断言"这种特征重试一次，且换端口 —— 头一次就是端口被占。 */
async function launchRetry(port) {
  for (let i = 0; i < 3; i++) {
    try { return await launch({ port: port + i, windowSize: '1440,900' }); }
    catch (e) {
      console.log('  [launch retry ' + (i + 1) + '] ' + String(e.message || e).split('\n')[0]);
      await sleep(1200);
    }
  }
  throw new Error('Chromium 连续三次没起来');
}

const table = {};
for (const [tag, url] of BUILDS) {
  const b = await launchRetry(9541);
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
    ${JSON.stringify(KEYS)}.forEach(function(k){
      var seen={}, order=[];
      for(var i=0;i<6;i++){
        var cv=L.renderCanvas(p,k,L.optsFor(p),st.spec.longEdge,true);
        var rc=cv.photoRect||{dx:0,dy:0,dw:cv.width,dh:cv.height};
        var key=[rc.dx.toFixed(1),rc.dy.toFixed(1),rc.dw.toFixed(1),rc.dh.toFixed(1)].join(',');
        if(!seen[key]){ seen[key]=0; order.push(key); }
        seen[key]++;
      }
      out[k]={n:order.length, list:order.map(function(kk){ return kk+(seen[kk]>1?(' x'+seen[kk]):''); })};
    });
    return JSON.stringify(out);`);
  table[tag] = r;
  await b.close();
  await sleep(900);
}

console.log('');
for (const k of KEYS) {
  console.log('---- ' + k + ' ----');
  for (const [tag] of BUILDS) {
    const o = table[tag][k];
    console.log('  ' + (o.n === 1 ? ' ' : '!') + tag + '  ' + o.n + ' 种   ' + o.list.join('  |  '));
  }
}
