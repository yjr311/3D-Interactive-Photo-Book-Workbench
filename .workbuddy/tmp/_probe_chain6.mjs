import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9491, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(800);
async function ev(body){
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const o = JSON.parse(raw); if(o.__err) console.log('  [err] '+o.__err); return o;
}
await ev(`await window.LUMEN.loadEmbedded(true); window.LUMEN.setStep(2); await window.LUMEN.generate();
  var st=window.LUMEN.state;
  for(var i=0;i<80;i++){ await new Promise(function(r){setTimeout(r,120);});
    if(st.generated.length===st.photos.filter(function(p){return p.picked;}).length) break; }
  return JSON.stringify({gen:st.generated.length}); `);
await sleep(900);

const r = await ev(`
  var L=window.LUMEN, st=L.state;
  var p=st.photos[0];
  var g=st.generated.find(function(x){ return x.photoId===p.id; });
  p.stickers=[]; L.refreshStickerArt(p);
  var AR0=g.art;
  /* 采样器：每 1ms 打一次，记录主线程的"心跳"和两个里程碑 */
  var t0=performance.now(), beats=[], last=t0, tArt=null, tSet=null;
  var origSet=L.BV.setPages;
  L.BV.setPages=function(){ if(tSet===null) tSet=performance.now()-t0; return origSet.apply(this,arguments); };
  var iv=setInterval(function(){
    var n=performance.now();
    if(n-last>40) beats.push([Math.round(last-t0), Math.round(n-t0)]);   /* 主线程空档 >40ms */
    last=n;
    if(tArt===null && g.art!==AR0) tArt=n-t0;
    if(n-t0>1700) clearInterval(iv);
  },1);
  p.stickers=[L.stkFix({k:'ticket',x:.5,y:.5,rot:0,s:1.6,text:'KADA'})];
  L.scheduleArt(p);
  /* 与测试同款：一次 setTimeout(30) 之后再检查 */
  var tw=performance.now();
  await new Promise(function(r2){ setTimeout(r2,30); });
  var wait1=Math.round(performance.now()-tw);
  /* 再等一会儿让链条跑完 */
  await new Promise(function(r2){ setTimeout(r2,900); });
  clearInterval(iv);
  L.BV.setPages=origSet;
  return JSON.stringify({wait1:wait1, tArt:tArt===null?null:Math.round(tArt),
    tSet:tSet===null?null:Math.round(tSet), gaps:beats.slice(0,10)});
`);
console.log(JSON.stringify(r, null, 1));
await b.close();
