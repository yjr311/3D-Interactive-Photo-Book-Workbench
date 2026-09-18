/* 验证 mat 版式的「固定基线」是否真的落地了。
   不靠肉眼：把每一张内页画出来，逐像素找照片包围盒，
   再量「照片上留白 / 照片下留白 / 图注线位置 / 页脚留白」，看是否每页同一套架构。 */
import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%85%89%E5%8C%A3-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9455, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(900);

const out = await b.evaluate(`(async function(){
  function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
  if(state.photos.length<28){ await window.LUMEN.loadEmbedded(true); }
  if(state.generated.length<28){ await window.LUMEN.generate(); }
  for(var i=0;i<200;i++){ await sleep(150); if(state.generated.length>=28) break; }
  state.book.num=true; state.book.layout='mat';
  var L=window.LUMEN, B=L.buildBookPages();
  var pages=B.pages, res=[], captions={};
  pages.forEach(function(pg,pi){
    if(pg.kind!=='content') return;
    var cv=pg.canvas, W=cv.width, H=cv.height;
    var x=cv.getContext('2d');
    var d=x.getImageData(0,0,W,H).data;
    function px(cx,cy){ var o=(cy*W+cx)*4; return [d[o],d[o+1],d[o+2]]; }
    /* 纸色取页角 */
    var paper=px(3,3);
    function isPaper(c){ return Math.abs(c[0]-paper[0])<14 && Math.abs(c[1]-paper[1])<14 && Math.abs(c[2]-paper[2])<14; }
    /* 竖向：逐行统计「非纸像素」数量（跳过页边距区，避免四角渐暗干扰） */
    var x0=Math.round(W*0.14), x1=Math.round(W*0.86), step=Math.max(1,Math.round(W/220));
    var rowNon=[];
    for(var y=0;y<H;y++){
      var c=0;
      for(var xx=x0;xx<x1;xx+=step){ if(!isPaper(px(xx,y))) c++; }
      rowNon.push(c);
    }
    var mx=0; rowNon.forEach(function(v){ if(v>mx) mx=v; });
    var thr=Math.max(6, mx*0.30);
    var top=-1, bot=-1;
    for(var y2=0;y2<H;y2++){ if(rowNon[y2]>=thr){ top=y2; break; } }
    for(var y3=H-1;y3>=0;y3--){ if(rowNon[y3]>=thr){ bot=y3; break; } }
    /* 照片与图注是连着的还是断的？找第一个「连续 12 行以上低于阈值」的位置＝照片下沿 */
    var phBot=bot;
    for(var y4=top;y4<H-1;y4++){
      var run=0, y5=y4;
      while(y5<H && rowNon[y5]<thr){ run++; y5++; }
      if(run>=12){ phBot=y4-1; break; }
    }
    /* 图注细线：图注区里最宽的一条非纸行 */
    var capLine=-1;
    for(var y6=phBot+1;y6<H;y6++){ if(rowNon[y6]>=thr){ capLine=y6; break; } }
    res.push({pi:pi, W:W, H:H, ratio:+(W/H).toFixed(3),
      top:top, phBot:phBot, phH:phBot-top,
      gapUp:top, gapPhotoCap:(capLine<0?-1:capLine-phBot), capLine:capLine,
      gapBottom:(H-1-(capLine<0?bot:capLine)),
      pageH:H, ptR:+(top/H).toFixed(3), capR:+(capLine<0?-1:capLine/H).toFixed(3)});
    var art=L.artOf ? L.artOf : null;
    captions[pi]=1;
  });
  return { pages:res.length, rows:res };
})()`);

console.log('内页数 =', out.pages);
console.log('pi   页宽高    比例   照片上沿  照片下沿 照片高 | 上留白 图注间距 注下留白 | 上沿% 图注线%');
let ratios = new Set();
for (const r of out.rows) {
  ratios.add(r.capR);
  console.log(
    String(r.pi).padEnd(4),
    (r.W + 'x' + r.H).padEnd(10),
    String(r.ratio).padEnd(6),
    String(r.top).padEnd(8), String(r.phBot).padEnd(8), String(r.phH).padEnd(7), '|',
    String(r.gapUp).padEnd(6), String(r.gapPhotoCap).padEnd(8), String(r.gapBottom).padEnd(8), '|',
    String(r.ptR).padEnd(5), String(r.capR)
  );
}
const capYs = out.rows.map(r => r.capR).filter(v => v >= 0);
const mn = Math.min(...capYs), mx = Math.max(...capYs);
console.log('\\n图注线位置（占页高比）：min=' + mn.toFixed(4) + ' max=' + mx.toFixed(4) + ' 跨度=' + (mx - mn).toFixed(4));
console.log(mx - mn < 0.004 ? 'PASS 所有内页的图注落在同一条基线上（架构一致）' : 'FAIL 图注基线不齐');
// 横构图 vs 竖构图：各挑一页看留白分布是否都"像留白"
const portrait = out.rows.filter(r => r.phH > r.phBot * 0.98).length;
console.log('\\n注：phBot≈页高 的页 = 照片几乎填满版心（竖构图）');

await b.close();
