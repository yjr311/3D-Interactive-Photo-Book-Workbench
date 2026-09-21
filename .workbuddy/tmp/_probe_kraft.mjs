import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9521, windowSize: '1444,940' });
await b.goto(FILE, 2600);
await sleep(800);
async function ev(body){
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const o = JSON.parse(raw); if(o.__err) console.log('  [err] '+o.__err); return o;
}
await ev(`await window.LUMEN.loadEmbedded(true);
  var L=window.LUMEN, st=L.state;
  L.setStep(2); await L.generate();
  for(var i=0;i<80;i++){ await new Promise(function(r){setTimeout(r,120);}); if(!L.bookStale()) break; }
  return JSON.stringify({gen:st.generated.length, tpl:st.tpl}); `);

const r = await ev(`
  var L=window.LUMEN, st=L.state;
  var p=st.photos[0];
  var out=[];
  Object.keys(L.TPL).forEach(function(k){
    var cv=L.renderCanvas(p,k,L.optsFor(p),st.spec.longEdge,true);
    var rc=cv.photoRect;
    out.push({k:k, cv:cv.width+'x'+cv.height,
      rc:[+rc.dx.toFixed(1),+rc.dy.toFixed(1),+rc.dw.toFixed(1),+rc.dh.toFixed(1)],
      bad:(rc.dw<=1||rc.dh<=1||rc.dx<-cv.width*2||rc.dy<-cv.height*2||
           rc.dx+rc.dw>cv.width*3||rc.dy+rc.dh>cv.height*3)});
  });
  return JSON.stringify({le:st.spec.longEdge, out:out});
`);
console.log('longEdge=' + r.le);
for (const o of (r.out || [])) {
  console.log((o.bad ? 'XX ' : '   ') + o.k.padEnd(10) + ' cvs=' + o.cv.padEnd(10) + ' rect=' + o.rc.join(',').padEnd(28));
}
await b.close();
