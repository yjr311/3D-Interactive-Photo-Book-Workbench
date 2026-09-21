import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9488, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(800);
async function ev(body){
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const o = JSON.parse(raw); if(o.__err) console.log('  [err] '+o.__err); return o;
}
/* 实验矩阵：idle（无心跳） / raf（rAF 心跳） / chained（用 rAF 递推的 setTimeout） */
const r = await ev(`
  var out={};
  function delay(ms){ var t=performance.now();
    return new Promise(function(r){ setTimeout(function(){ r(Math.round(performance.now()-t)); }, ms); }); }
  out.i30=[]; for(var i=0;i<4;i++) out.i30.push(await delay(30));
  out.i120=await delay(120);
  /* 开 rAF 心跳，再量同样的东西 */
  var beating=true;
  function beat(){ if(beating) requestAnimationFrame(beat); }
  requestAnimationFrame(beat);
  await delay(60);
  out.r30=[]; for(var j=0;j<4;j++) out.r30.push(await delay(30));
  out.r120=await delay(120);
  beating=false;
  return JSON.stringify(out);
`);
console.log('rAF 心跳对 setTimeout 的影响: ' + JSON.stringify(r));
await b.close();
