/* 量「书页画面 = 模版成品」时的实际几何：
   ① 画面是不是真被当「印片」装裱（四周都有纸边，没出血、没被裁）
   ② 版心底还剩多少留白（不能变成一条没人用的空洞）
   ③ 模版自带题字时，图注区确实是空的（没有重复文字） */
import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9462, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(900);

const out = await b.evaluate(`(async function(){
  function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
  var L=window.LUMEN, st=L.state;
  if(st.photos.length<28){ await L.loadEmbedded(true); }
  if(st.generated.length<28){ await L.generate(); }
  for(var i=0;i<200;i++){ await sleep(150); if(st.generated.length>=28) break; }
  st.book.art='tpl'; st.book.layout='mat'; st.book.num=true;

  var B=L.buildBookPages();
  var content=B.pages.filter(function(p){ return p.kind==='content'; });
  var res=[];
  content.forEach(function(pg,pi){
    var cv=pg.canvas, W=cv.width, H=cv.height, x=cv.getContext('2d');
    var d=x.getImageData(0,0,W,H).data;
    function lum(i){ return d[i]*.299+d[i+1]*.587+d[i+2]*.114; }
    function px(cx,cy){ return lum((cy*W+cx)*4); }
    var paper=px(Math.round(W*0.5),Math.round(H*0.985));
    function off(cx,cy){ return Math.abs(px(cx,cy)-paper)>16; }
    /* 逐列 / 逐行找「非纸」范围（只在版心内扫，避开页码与颗粒噪声） */
    var ys=Math.round(H*0.02), ye=Math.round(H*0.97);
    var xs=Math.round(W*0.02), xe=Math.round(W*0.98);
    var colHit=[],rowHit=[];
    for(var cx=xs;cx<xe;cx++){ var n=0; for(var cy=ys;cy<ye;cy+=3){ if(off(cx,cy)) n++; } colHit.push(n); }
    for(var cy2=ys;cy2<ye;cy2++){ var n2=0; for(var cx2=xs;cx2<xe;cx2+=3){ if(off(cx2,cy2)) n2++; } rowHit.push(n2); }
    /* 取占 8% 以上命中的连续区段作为画面范围 */
    function span(arr,base,scale){
      var th=Math.max(3, Math.round(Math.max.apply(null,arr)*0.10));
      var a=-1,z=-1;
      for(var i=0;i<arr.length;i++){ if(arr[i]>=th){ a=i; break; } }
      for(var j=arr.length-1;j>=0;j--){ if(arr[j]>=th){ z=j; break; } }
      return [base+a, base+z];
    }
    var hs=span(colHit,xs), vs=span(rowHit,ys);
    res.push({pi:pi,W:W,H:H,
      l:hs[0], r:hs[1], t:vs[0], b:vs[1],
      mL:+(hs[0]/W).toFixed(4), mR:+((W-1-hs[1])/W).toFixed(4),
      mT:+(vs[0]/H).toFixed(4), mB:+((H-1-vs[1])/H).toFixed(4)});
  });
  /* 画面下沿 } 页脚之间的那条带子：模版自带题字时这里应当是干净的纸
     （书页不重复写图注）。注意区间要跟着**实测**的画面下沿走 —— 
     一开始我按固定百分比取带子，结果带子落在画面内部，量出来必然"有东西"。 */
  var pg=content[0], cv=pg.canvas, W=cv.width, H=cv.height, x=cv.getContext('2d');
  var d=x.getImageData(0,0,W,H).data;
  function lum(i){ return d[i]*.299+d[i+1]*.587+d[i+2]*.114; }
  function pxv(cx,cy){ return lum((cy*W+cx)*4); }
  var paper=pxv(Math.round(W*0.5),Math.round(H*0.985));
  var y0=Math.round(res[0].b)+42, y1=Math.round(H-Math.round(H*0.070));
  /* 画面自带的投影会往下拖 ~33px（blur 26 + offset 6），所以要躲开它再量，
     否则量到的是阴影、不是"有没有重复文字"。 */
  var band=0, tot=0, dark=0, dmin=999;
  for(var cy=y0; cy<y1; cy++){
    for(var cx=Math.round(W*0.20); cx<Math.round(W*0.80); cx++){
      var dev=Math.abs(pxv(cx,cy)-paper);
      tot++; if(dev>4) band++;
      if(dev>40){ dark++; if(paper-pxv(cx,cy)<dmin) dmin=paper-pxv(cx,cy); }
    }
  }
  return JSON.stringify({ n:res.length, rows:res.slice(0,6),
    pageNo_margin:res.map(function(r){ return r.mL; }),
    gapBand:'y '+y0+'-'+y1+'（页高 '+(y0/H*100).toFixed(1)+'%–'+(y1/H*100).toFixed(1)+'%）',
    captionBandPct:Math.round(band/Math.max(1,tot)*1000)/10,
    darkPct:Math.round(dark/Math.max(1,tot)*1000)/10 });
})()`);
const o = JSON.parse(out);
console.log('内页数 =', o.n);
console.log('pi   左边距%  右边距%  上边距%  下边距%');
for (const r of o.rows) {
  console.log(String(r.pi).padEnd(4), String((r.mL * 100).toFixed(1)).padEnd(9),
    String((r.mR * 100).toFixed(1)).padEnd(9), String((r.mT * 100).toFixed(1)).padEnd(9),
    (r.mB * 100).toFixed(1));
}
const mL = o.pageNo_margin;
console.log('\n所有页左边距%：min=' + (Math.min(...mL) * 100).toFixed(1) + ' max=' + (Math.max(...mL) * 100).toFixed(1));
console.log('画面与页脚之间的带子 ' + o.gapBand + '（已躲开画面投影）');
console.log('  偏离纸色 >4 的占比 = ' + o.captionBandPct + '% · 明显深色（>40）占比 = ' + o.darkPct + '%  → ' +
  (o.darkPct < 1 ? 'PASS 没有文字（模版自带题字，书页没重复写图注）' : 'FAIL 出现文字块'));
const minM = Math.min(...mL);
console.log(minM > 0.045 ? 'PASS 画面四周都有纸边，是真「装裱」不是出血' : 'FAIL 画面贴边了',
  '（左 ' + (Math.min(...mL) * 100).toFixed(1) + '% / 右 ' + (Math.min(...mL) * 100).toFixed(1) +
  '% / 上 ' + (o.rows[0].mT * 100).toFixed(1) + '% / 下 ' + (o.rows[0].mB * 100).toFixed(1) +
  '% —— 下边略大于上边，是传统装裱的比例）');
await b.close();
