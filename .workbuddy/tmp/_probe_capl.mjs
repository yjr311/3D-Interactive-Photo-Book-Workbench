/* 细扫：精确定位每张内页「图注细线」的 y，验证是否落在同一条固定基线上。
   上一版探针用「整行非纸计数」找细线，因为细线只有 110px 宽、计数比不过照片行，漏检了。
   这里只扫版心中间 24% 宽（细线就在那儿），并把阈值降到「亮度偏离纸色 > 3」。 */
import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%85%89%E5%8C%A3-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9456, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(900);

const out = await b.evaluate(`(async function(){
  function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
  if(state.photos.length<28){ await window.LUMEN.loadEmbedded(true); }
  if(state.generated.length<28){ await window.LUMEN.generate(); }
  for(var i=0;i<200;i++){ await sleep(150); if(state.generated.length>=28) break; }
  state.book.num=true; state.book.layout='mat';
  var L=window.LUMEN, B=L.buildBookPages(), pages=B.pages, res=[];
  pages.forEach(function(pg,pi){
    if(pg.kind!=='content') return;
    var cv=pg.canvas, W=cv.width, H=cv.height, x=cv.getContext('2d');
    var d=x.getImageData(0,0,W,H).data;
    function px(cx,cy){ var o=(cy*W+cx)*4; return [d[o],d[o+1],d[o+2]]; }
    var paper=px(Math.round(W*0.50),Math.round(H*0.985));   /* 页脚正中，一定是纸 */
    function lum(c){ return (c[0]+c[1]+c[2])/3; }
    var lp=lum(paper);
    /* 只扫中间 24% 宽（图注细线宽度 = min(colW*.24, W*.125) = 110px 且居中） */
    var a=Math.round(W*0.38), z=Math.round(W*0.62);
    /* 先找照片范围（整行计数）以确定「照片以下」从哪里开始 */
    var x0=Math.round(W*0.20), x1=Math.round(W*0.80), st=3, rowNon=[];
    for(var y=0;y<H;y++){
      var c=0; for(var xx=x0;xx<x1;xx+=st){ if(Math.abs(lum(px(xx,y))-lp)>14) c++; }
      rowNon.push(c);
    }
    var mx=0; rowNon.forEach(function(v){ if(v>mx) mx=v; });
    var thr=Math.max(4, mx*0.25);
    var top=-1; for(var y=0;y<H;y++){ if(rowNon[y]>=thr){ top=y; break; } }
    var phBot=-1;
    for(var y=top;y<H-1;y++){
      var run=0,yy=y;
      while(yy<H && rowNon[yy]<thr){ run++; yy++; }
      if(run>=14){ phBot=y-1; break; }
    }
    /* 在图注区（照片以下 ~50px 到页脚上）用极低阈值找细线/文字 */
    var yA=phBot+30, yB=H-Math.round(H*0.085), hits=[];
    for(var y=yA;y<yB;y++){
      var n=0; for(var xx=a;xx<z;xx++){ if(Math.abs(lum(px(xx,y))-lp)>3) n++; }
      if(n>8) hits.push([y,n]);
    }
    res.push({pi:pi, H:H, W:W, phBot:phBot, phUp:top, hits:hits.slice(0,6),
              line:(hits.length?hits[0][0]:-1), nHits:hits.length});
  });
  return res;
})()`);

console.log('pi   phUp phBot | 图注区首个命中行 y  行号/H      命中行数');
const ys = [];
for (const r of out) {
  ys.push(r.line / r.H);
  console.log(
    String(r.pi).padEnd(4),
    String(r.phUp).padEnd(5), String(r.phBot).padEnd(5), '|',
    String(r.line).padEnd(19),
    (r.line / r.H).toFixed(4).padEnd(11),
    r.nHits
  );
}
const mn = Math.min(...ys), mx = Math.max(...ys);
console.log('\n图注细线落点（占页高比）：min=' + mn.toFixed(4) + ' max=' + mx.toFixed(4) + ' 跨度=' + (mx - mn).toFixed(4));
console.log(mx - mn < 0.005 ? 'PASS 所有内页图注落在同一条基线上（架构一致）' : 'FAIL 基线不齐');
/* 与代码里的 capY = H - PB - W*.048 对照（W/H = 0.75） */
console.log('代码预期 capY/H = 1 - 0.104 - 0.048*0.75 = ' + (1 - 0.104 - 0.048 * 0.75).toFixed(4));
await b.close();
