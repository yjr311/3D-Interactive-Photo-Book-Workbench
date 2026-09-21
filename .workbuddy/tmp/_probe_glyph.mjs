import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9493, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(700);
async function ev(body){
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const o = JSON.parse(raw); if(o.__err) console.log('  [err] '+o.__err); return o;
}
const r = await ev(`
  var L=window.LUMEN;
  var W=1000,H=1000, rc={dx:100,dy:100,dw:600,dh:600};
  function probe(k,s){
    var c=document.createElement('canvas'); c.width=W; c.height=H;
    var g=c.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,W,H);
    L.drawStickers(g,rc,[L.stkFix({k:k,x:.5,y:.5,s:s,text:''})],null);
    var d=g.getImageData(0,0,W,H).data;
    var minX=1e9,maxX=-1,minY=1e9,maxY=-1,n=0;
    for(var j=0;j<H;j++) for(var i=0;i<W;i++){ var o=(j*W+i)*4;
      if(d[o]<235&&d[o+1]<235&&d[o+2]<235){ n++; if(i<minX)minX=i; if(i>maxX)maxX=i; if(j<minY)minY=j; if(j>maxY)maxY=j; } }
    var S=Math.min(rc.dw,rc.dh)*0.20*s;
    var acx=rc.dx+.5*rc.dw, acy=rc.dy+.5*rc.dh;
    return {k:k, s:s, n:n, S:+S.toFixed(1),
      du:+(((minX+maxX)/2-acx)/S).toFixed(3), dv:+(((minY+maxY)/2-acy)/S).toFixed(3),
      w:+( (maxX-minX)/S).toFixed(3), h:+((maxY-minY)/S).toFixed(3)};
  }
  var ks=L.STK_LIST?L.STK_LIST.map(function(x){return x.k;}):Object.keys(L.STICKERS||{});
  var out=[];
  ks.forEach(function(k){ if(k==='doodle') return; out.push(probe(k,1.6)); });
  return JSON.stringify({ks:ks, out:out});
`);
console.log(JSON.stringify(r, null, 1));
await b.close();
