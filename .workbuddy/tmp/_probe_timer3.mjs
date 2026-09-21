import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9490, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(1500);          /* 先让它静一会儿，进入"被节流"的状态 */
async function ev(body){
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const o = JSON.parse(raw); if(o.__err) console.log('  [err] '+o.__err); return o;
}
console.log('A. 静置后（无 rAF 心跳）: ' + JSON.stringify(await ev(`
  var t=[];
  for(var i=0;i<6;i++){
    var s=performance.now();
    await new Promise(function(r){ setTimeout(r,30); });
    t.push({d:Math.round(performance.now()-s), phase:Math.round(performance.now()%1000)});
  }
  return JSON.stringify(t);
`)));
await sleep(1500);
console.log('B. 带 rAF 心跳: ' + JSON.stringify(await ev(`
  var beat=true; (function f(){ if(beat) requestAnimationFrame(f); })();
  await new Promise(function(r){ setTimeout(r,60); });
  var t=[];
  for(var i=0;i<6;i++){
    var s=performance.now();
    await new Promise(function(r){ setTimeout(r,30); });
    t.push({d:Math.round(performance.now()-s), phase:Math.round(performance.now()%1000)});
  }
  beat=false;
  return JSON.stringify(t);
`)));
console.log('C. 静置后（长任务：连做 300ms 同步忙等，看是否把网格"推走"）: ' + JSON.stringify(await ev(`
  await new Promise(function(r){ setTimeout(r,900); });
  var t=[];
  for(var i=0;i<4;i++){
    var s=performance.now();
    await new Promise(function(r){ setTimeout(r,30); });
    t.push({d:Math.round(performance.now()-s), phase:Math.round(performance.now()%1000)});
  }
  return JSON.stringify(t);
`)));
await b.close();
