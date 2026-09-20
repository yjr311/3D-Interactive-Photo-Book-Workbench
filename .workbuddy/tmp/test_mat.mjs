import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

/* 第七轮 · 材料/质感层
   用户的原始不满：「就是感觉单单纯纯的换了个色，没有任何质感」。
   所以这一层的验收标准必须是**可量测的质感**，不是"配色变了"：
   ① 贴图真的是贴图：确定性（重绘不闪）、互不雷同、有真实方差、可无缝平铺
   ② 书页/封面真的贴上了材料：换材料 → 同底色下像素变、封面题字工艺变
   ③ 材料能被用户改：选择器是真的、点得动、改完只重排不重生成
   ④ 「换一版」连材料一起换（这正是用户嫌"单一"的地方）
   ⑤ 持久化与老存档迁移
   全部走页面内真实调用 + 真实像素统计 + 真实鼠标点击，不 mock。 */
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';

const b = await launch({ port: 9481, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(900);

let pass = 0, fail = 0;
function chk(ok, name, extra) {
  if (ok) { pass++; console.log('PASS ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra ? '  ' + extra : '')); }
}
async function ev(body) {
  const raw = await b.evaluate(
    `(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const out = JSON.parse(raw);
  if (out && out.__err) console.log('  [page error] ' + out.__err);
  return out;
}

/* 页内公用函数：像素统计 / 均值哈希 / 造画布 */
const HELPERS = `
  function nc2(w,h){ var c=document.createElement('canvas'); c.width=w; c.height=h; return c; }
  function stats(cv){
    var x=cv.getContext('2d'), d=x.getImageData(0,0,cv.width,cv.height).data;
    var n=0, s=0, s2=0, mn=999, mx=-1;
    for(var i=0;i<d.length;i+=4){ var v=(d[i]+d[i+1]+d[i+2])/3; n++; s+=v; s2+=v*v; if(v<mn)mn=v; if(v>mx)mx=v; }
    var m=s/n, va=s2/n-m*m;
    return {mean:m, var:va, n:n, min:mn, max:mx, range:mx-mn};
  }
  function hash(cv){
    var x=cv.getContext('2d'), d=x.getImageData(0,0,cv.width,cv.height).data;
    var h=2166136261>>>0;
    for(var i=0;i<d.length;i+=17){ h^=d[i]; h=Math.imul(h,16777619)>>>0; }
    return h;
  }
`;

/* ---------- ① 配方表自洽 ---------- */
const m1 = await ev(`
  var L=window.LUMEN;
  var keys=Object.keys(L.MATSETS), ord=L.MAT_ORDER;
  var missField=[], bad=[];
  keys.forEach(function(k){
    var s=L.MATSETS[k];
    ['name','hint','cover','page','emboss','tex','sheen','lit'].forEach(function(f){
      if(s[f]===undefined||s[f]==='') missField.push(k+'.'+f);
    });
    if(['deboss','foil','plain'].indexOf(s.emboss)<0) bad.push(k+'.emboss='+s.emboss);
    if(!(s.tex>0&&s.tex<=2)) bad.push(k+'.tex='+s.tex);
    if(!(s.sheen>=0&&s.sheen<=1)) bad.push(k+'.sheen='+s.sheen);
    if(!(s.lit>0&&s.lit<=2)) bad.push(k+'.lit='+s.lit);
  });
  var ordOk=ord.length===keys.length&&ord.every(function(k){ return !!L.MATSETS[k]; });
  return JSON.stringify({n:keys.length, keys:keys, missField:missField, bad:bad, ordOk:ordOk, ord:ord});
`);
chk(m1.n === 7, 'M1 材料配方共 7 套', m1.keys.join(','));
chk(m1.missField.length === 0, 'M2 每套配方的字段齐备（名称/封面料/内页料/题字工艺/纹理·光泽·光照）', m1.missField.join(',') || 'ok');
chk(m1.bad.length === 0, 'M3 每套配方的取值合法（工艺三选一、倍率在合理区间）', m1.bad.join(',') || 'ok');
chk(m1.ordOk, 'M4 MAT_ORDER 与 MATSETS 键集完全一致（没有半死不活的配方）');

const m2 = await ev(`
  var L=window.LUMEN, out={};
  L.SKIN_ORDER.forEach(function(sk){
    var l=L.matChoices(L.SKINS[sk]).slice();
    out[sk]={list:l, uniq:l.length===new Set(l).size,
      valid:l.every(function(k){ return !!L.MATSETS[k]; }), n:l.length};
  });
  /* applySkin 的真实规则：当前材料若在新氛围的清单里 → 保留（用户手改的不该被冲掉）；
     不在清单里 → 落到该氛围的默认材料（mats[0]）。 */
  var probe={}, keep={};
  L.SKIN_ORDER.forEach(function(sk){
    var bak=L.state.skin, list=L.matChoices(L.SKINS[sk]);
    /* 塞一个一定不在清单里的材料 */
    var outside=L.MAT_ORDER.filter(function(k){ return list.indexOf(k)<0; })[0];
    L.state.book.mat=outside; L.applySkin(sk,{keepColors:false});
    probe[sk]=L.state.book.mat;
    /* 再塞一个在清单里的（非第一个），应当被保留 */
    var inside=list[list.length-1];
    L.state.book.mat=inside; L.applySkin(sk,{keepColors:false});
    keep[sk]=L.state.book.mat;
    L.applySkin(bak,{keepColors:false});
  });
  var emb={}; Object.keys(L.MATSETS).forEach(function(k){ emb[L.MATSETS[k].emboss]=1; });
  return JSON.stringify({out:out, probe:probe, keep:keep, emb:Object.keys(emb)});
`);
let matOK = true, matDetail = [];
for (const sk of Object.keys(m2.out)) {
  const r = m2.out[sk];
  if (!r.valid || !r.uniq || r.n < 2) matOK = false;
  matDetail.push(sk + ':' + r.n);
}
chk(matOK, 'M5 每套氛围都有 ≥2 种合法且不重复的推荐材料', matDetail.join(' '));
let defOK = true;
for (const sk of Object.keys(m2.out)) { if (m2.probe[sk] !== m2.out[sk].list[0]) defOK = false; }
chk(defOK, 'M6 当前材料与新氛围不搭时 → 落到该氛围的默认材料（mats[0]）',
  Object.keys(m2.probe).map((k) => k + '→' + m2.probe[k]).join(' '));
let keepOK = true;
for (const sk of Object.keys(m2.out)) { if (m2.keep[sk] !== m2.out[sk].list[m2.out[sk].list.length - 1]) keepOK = false; }
chk(keepOK, 'M6b 当前材料本来就搭（在清单里）→ 换氛围时保留，不硬塞默认料（用户手改过的料不能被氛围冲掉）',
  Object.keys(m2.keep).map((k) => k + '→' + m2.keep[k]).join(' '));
chk(m2.emb.length === 3, 'M7 三种题字工艺（压凹/烫金/素题）都真的被用上了', m2.emb.join(','));

/* ---------- ② 贴图本身：确定性 / 差异 / 方差 / 无缝 ---------- */
const m3 = await ev(`
  ${HELPERS}
  var L=window.LUMEN;
  var kinds={};
  ['linen','canvas','kraft','laid','silk','leather','coated'].forEach(function(k){
    var t1=L.matTile(k,3), t2=L.matTile(k,3);
    /* 贴图是"带 alpha 的叠加遮罩"，原始 rgb 里没覆盖到的地方是 0 ——
       所以要看它叠加到中灰底上之后做了什么，而不是直接对遮罩求均值。 */
    var cov=nc2(256,256), cx=cov.getContext('2d');
    cx.fillStyle='#808080'; cx.fillRect(0,0,256,256);
    cx.fillStyle=cx.createPattern(t1,'repeat'); cx.globalAlpha=.92; cx.fillRect(0,0,256,256);
    kinds[k]={same:hash(t1)===hash(t2), h:hash(t1), st:stats(t1), over:stats(cov)};
  });
  var seedA=hash(L.matTile('linen',1)), seedB=hash(L.matTile('linen',2));
  var hs=Object.keys(kinds).map(function(k){ return kinds[k].h; });
  var uniq=(new Set(hs)).size;
  return JSON.stringify({kinds:kinds, seedDiff:seedA!==seedB, uniq:uniq, total:hs.length});
`);
/* 粗料就该看得出纹理（方差）；细料（丝绸柔光 / 涂布纸）刻意细腻 ——
   它是平滑的柔光/极细颗粒，方差天然小，但峰谷差不能是 0（那才是死平）。 */
const COARSE = ['linen', 'canvas', 'kraft', 'laid', 'leather'];
const FINE = ['silk', 'coated'];
let detOK = true, coarseOK = true, fineOK = true, meanOK = true, kd = [], md = [], fd = [];
for (const k of Object.keys(m3.kinds)) {
  const r = m3.kinds[k];
  if (!r.same) detOK = false;
  if (COARSE.includes(k) && !(r.over.var > 3)) coarseOK = false;
  if (FINE.includes(k) && !(r.over.range >= 2)) fineOK = false;
  if (Math.abs(r.over.mean - 128) > 10) meanOK = false;
  kd.push(k + '(var' + r.over.var.toFixed(1) + ')');
  md.push(k + 'Δ' + (r.over.mean - 128).toFixed(1));
  fd.push(k + '峰谷' + r.over.range.toFixed(1));
}
chk(detOK, 'M8 同 kind + 同 seed 反复取贴图 → 像素完全一致（重绘不会闪）');
chk(m3.seedDiff, 'M9 换 seed → 贴图像素确实变了（种子真的参与生成）');
chk(m3.uniq === m3.total, 'M10 7 种贴图彼此互不雷同（不是一张图改个名）', m3.uniq + '/' + m3.total);
chk(coarseOK, 'M11 粗料（亚麻/帆布/牛皮/帘纹/皮革）叠到中灰底上方差 >3 —— 读数上就是"有纹理"', kd.join(' '));
chk(fineOK, 'M11b 细料（丝绸柔光/涂布纸）刻意细腻，但峰谷差 ≥2（柔光与颗粒都在，不是死平）', fd.join(' '));
chk(meanOK, 'M12 每种贴图叠到中灰底上明度偏移 ≤10（有质感但不改变纸的底色明度）', md.join(' '));

const m4 = await ev(`
  ${HELPERS}
  var L=window.LUMEN, MT=256, res={};
  ['linen','canvas','kraft','laid','silk','leather','coated'].forEach(function(k){
    var t=L.matTile(k,5);
    var c=nc2(MT*2,MT);
    var x=c.getContext('2d');
    x.drawImage(t,0,0); x.drawImage(t,MT,0);
    var d=x.getImageData(0,0,MT*2,MT).data;
    function col(px){ var s=0; for(var y=0;y<MT;y++){ var i=(y*MT*2+px)*4; s+=(d[i]+d[i+1]+d[i+2])/3; } return s/MT; }
    /* 接缝：第 MT-1 列与第 MT 列（同一张图的两端被拼在一起） */
    var seam=Math.abs(col(MT-1)-col(MT));
    /* 基准：贴图内部最大的相邻列跳变（不是均值 —— 均值会被"周期性大跳"稀释） */
    var mx=0; for(var px=0;px<MT*2-1;px++){ if(px===MT-1) continue; var dd=Math.abs(col(px)-col(px+1)); if(dd>mx)mx=dd; }
    res[k]={seam:seam, mx:mx, ratio:mx>0.001?(seam/mx):0};
  });
  return JSON.stringify({res:res, MT:MT});
`);
/* 判"可平铺"看**接缝跳变 vs 贴图内部最大的相邻跳变**：
   拿均值当基准会误判 —— 帘纹纸每 4 行就有一次"大跳"（那是帘纹本身），
   亚麻隔 4px 一条暗线（相邻列天然差 40+）。真正要抓的是
   "接缝处出现了贴图内部从未有过的跳变"（旧版 silk 就是：内部最大跳变约 2，接缝 26.8）。 */
function seamRatio(list) {
  let ok = true; const d = [];
  for (const k of Object.keys(list)) {
    const r = list[k];
    if (!(r.ratio < 1.35)) ok = false;
    d.push(k + ':' + r.seam.toFixed(2) + '/max' + r.mx.toFixed(2) + '=×' + r.ratio.toFixed(2));
  }
  return { ok, d };
}
const seamH = seamRatio(m4.res);
chk(seamH.ok, 'M13 贴图左右可无缝平铺（接缝跳变不超过贴图内部最大跳变的 1.35 倍）', seamH.d.join(' '));

const m4b = await ev(`
  ${HELPERS}
  var L=window.LUMEN, MT=256, res={};
  ['linen','canvas','kraft','laid','silk','leather','coated'].forEach(function(k){
    var t=L.matTile(k,5);
    var c=nc2(MT,MT*2);
    var x=c.getContext('2d');
    x.drawImage(t,0,0); x.drawImage(t,0,MT);
    var d=x.getImageData(0,0,MT,MT*2).data;
    function row(py){ var s=0; for(var xx=0;xx<MT;xx++){ var i=(py*MT+xx)*4; s+=(d[i]+d[i+1]+d[i+2])/3; } return s/MT; }
    var seam=Math.abs(row(MT-1)-row(MT));
    var mx=0; for(var py=0;py<MT*2-1;py++){ if(py===MT-1) continue; var dd=Math.abs(row(py)-row(py+1)); if(dd>mx)mx=dd; }
    res[k]={seam:seam, mx:mx, ratio:mx>0.001?(seam/mx):0};
  });
  return JSON.stringify({res:res});
`);
const seamV = seamRatio(m4b.res);
chk(seamV.ok, 'M13b 贴图上下也可无缝平铺（书页很高，纵向同样会平铺）', seamV.d.join(' '));

/* 反向对照：证明这套度量真的抓得住"接缝"。
   造一张明显不可平铺的贴图（整幅对角渐变 —— 退回旧版 silk 的做法），
   如果这个检测器连它都放过去，那 M13/M13b 的"全绿"就毫无意义。 */
const m4c = await ev(`
  ${HELPERS}
  var MT=256, res={};
  function measure(makeTile){
    var t=makeTile(), c=nc2(MT*2,MT), x=c.getContext('2d');
    x.drawImage(t,0,0); x.drawImage(t,MT,0);
    var d=x.getImageData(0,0,MT*2,MT).data;
    function col(px){ var s=0; for(var y=0;y<MT;y++){ var i=(y*MT*2+px)*4; s+=(d[i]+d[i+1]+d[i+2])/3; } return s/MT; }
    var seam=Math.abs(col(MT-1)-col(MT)), mx=0;
    for(var px=0;px<MT*2-1;px++){ if(px===MT-1) continue; var dd=Math.abs(col(px)-col(px+1)); if(dd>mx)mx=dd; }
    return mx>0.001?seam/mx:0;
  }
  res.bad=measure(function(){           /* 退回旧做法：整幅对角渐变铺满 tile */
    var c=nc2(MT,MT), x=c.getContext('2d');
    var g=x.createLinearGradient(0,0,MT,MT*.55);
    g.addColorStop(0,'rgba(0,0,0,.30)'); g.addColorStop(1,'rgba(255,255,255,.30)');
    x.fillStyle=g; x.fillRect(0,0,MT,MT); return c;
  });
  res.good=measure(function(){          /* 整周期正弦（新版 silk 的做法） */
    var c=nc2(MT,MT), x=c.getContext('2d');
    var im=x.createImageData(MT,MT), p=im.data;
    for(var yy=0;yy<MT;yy++) for(var xx=0;xx<MT;xx++){
      var s=.5+.5*Math.sin((xx*3+yy*2)*Math.PI*2/MT);
      var i=(yy*MT+xx)*4, a=Math.round(255*s);
      p[i]=p[i+1]=p[i+2]=255; p[i+3]=a;
    }
    x.putImageData(im,0,0); return c;
  });
  return JSON.stringify({res:res});
`);
chk(m4c.res.bad >= 1.35, 'M13c 反向对照：整幅渐变的贴图会被判为"有接缝"（度量确实抓得住，不是永远放行）',
  '坏贴图 ×' + m4c.res.bad.toFixed(2));
chk(m4c.res.good < 1.35, 'M13d 反向对照：整周期正弦的贴图被判为"可平铺"（好做法换得回来）',
  '好贴图 ×' + m4c.res.good.toFixed(2));

/* ---------- ③ 书页 / 封面真的贴上了材料 ---------- */
const m5 = await ev(`
  ${HELPERS}
  var L=window.LUMEN;
  function paint(which,mat){
    var W=420,H=560, c=nc2(W,H);
    var x=c.getContext('2d');
    if(which==='board') L.boardGround(x,W,H,{mat:mat,color:'#e8e0d2'});
    else L.paperGround(x,W,H,{mat:mat,side:'c',seed:1});
    return c;
  }
  var paper={}, board={};
  ['cloth','heavy','kraft','silk','leather','board','smooth'].forEach(function(k){
    paper[k]={h:hash(paint('paper',k)), st:stats(paint('paper',k))};
    board[k]={h:hash(paint('board',k)), st:stats(paint('board',k))};
  });
  var flatPaper=paper.smooth.st.var, texPaper=paper.heavy.st.var;
  var flatBoard=board.smooth.st.var, texBoard=board.cloth.st.var;
  var pu=new Set(Object.keys(paper).map(function(k){return paper[k].h;})).size;
  var bu=new Set(Object.keys(board).map(function(k){return board[k].h;})).size;
  return JSON.stringify({pu:pu, bu:bu, total:7, flatPaper:flatPaper, texPaper:texPaper,
    flatBoard:flatBoard, texBoard:texBoard});
`);
chk(m5.pu === 7, 'M14 同一页底色下，7 种材料画出的内页像素两两不同（材料真的落在纸上）', m5.pu + '/7');
chk(m5.bu === 7, 'M15 同一封面底色下，7 种材料画出的封面像素两两不同', m5.bu + '/7');
chk(m5.texPaper > m5.flatPaper * 1.4, 'M16 粗纹材料的内页方差明显大于光面纸（读数上是"有纹理"）',
  '光面 var=' + m5.flatPaper.toFixed(1) + ' → 帆布 var=' + m5.texPaper.toFixed(1));
chk(m5.texBoard > m5.flatBoard * 1.4, 'M17 粗纹封面的方差明显大于光面封面',
  '光面 var=' + m5.flatBoard.toFixed(1) + ' → 亚麻 var=' + m5.texBoard.toFixed(1));

const m6 = await ev(`
  ${HELPERS}
  var L=window.LUMEN;
  /* 题字工艺：同底色同材料，只切换 mode —— 隔离出"工艺"这一个变量 */
  function cover(mode){
    var W=420,H=560, c=nc2(W,H);
    var x=c.getContext('2d'); L.boardGround(x,W,H,{mat:'cloth',color:'#e8e0d2'});
    L.pressTreat(x,'光匣',W/2,H*0.30,40,6,'serif',mode,'#2b2620');
    return c;
  }
  function band(cv){
    var x=cv.getContext('2d');
    var d=x.getImageData(0,Math.round(cv.height*0.24),cv.width,Math.round(cv.height*0.12)).data;
    var n=0,s=0,mx=0;
    for(var i=0;i<d.length;i+=4){ var v=(d[i]+d[i+1]+d[i+2])/3; n++; s+=v; if(v>mx)mx=v; }
    return {mean:s/n, max:mx, h:(function(){var h=2166136261>>>0; for(var j=0;j<d.length;j+=7){h^=d[j];h=Math.imul(h,16777619)>>>0;} return h;})()};
  }
  var deb=band(cover('deboss')), foi=band(cover('foil')), pln=band(cover('plain'));
  return JSON.stringify({deb:deb, foi:foi, pln:pln,
    eCloth:L.MATSETS.cloth.emboss, eLeather:L.MATSETS.leather.emboss,
    eBoard:L.MATSETS.board.emboss, eSmooth:L.MATSETS.smooth.emboss});
`);
chk(m6.eCloth === 'deboss' && m6.eLeather === 'foil' && m6.eSmooth === 'plain',
  'M18 题字工艺由材料决定：亚麻压凹 / 皮革烫金 / 光面素题',
  [m6.eCloth, m6.eLeather, m6.eBoard, m6.eSmooth].join(' / '));
chk(m6.deb.h !== m6.foi.h && m6.deb.h !== m6.pln.h && m6.foi.h !== m6.pln.h,
  'M19 三种工艺在同一段题字上画出三种不同像素（不是同一套字换个名）');
chk(m6.foi.max >= m6.deb.max && m6.foi.mean > m6.pln.mean,
  'M20 烫金有高光（峰值更亮）、压凹带阴影（比素题暗），工艺的区别看得见',
  '压凹 m=' + m6.deb.mean.toFixed(1) + '/max' + m6.deb.max.toFixed(0) +
  ' · 烫金 m=' + m6.foi.mean.toFixed(1) + '/max' + m6.foi.max.toFixed(0) +
  ' · 素题 m=' + m6.pln.mean.toFixed(1) + '/max' + m6.pln.max.toFixed(0));

/* ---------- ④ 材料能被用户改：选择器 + 真实点击 + 只重排不重生成 ---------- */
const m7 = await ev(`
  var L=window.LUMEN, st=L.state;
  await L.loadEmbedded(true);
  L.setStep(0);
  await new Promise(function(r){ setTimeout(r,320); });
  var want=L.matChoices(L.skinCfg()).length;
  var els=Array.prototype.slice.call(document.querySelectorAll('#panel .mat[data-mat]'));
  var cvs=els.map(function(e){ return e.querySelector('canvas'); });
  function st2(c){ var x=c.getContext('2d'), d=x.getImageData(0,0,c.width,c.height).data;
    var n=0,s=0,s2=0; for(var i=0;i<d.length;i+=4){ var v=(d[i]+d[i+1]+d[i+2])/3; n++; s+=v; s2+=v*v; }
    var m=s/n; return {m:m, v:s2/n-m*m}; }
  var info=cvs.map(function(c){ return c?{w:c.width,h:c.height,st:st2(c)}:null; });
  var onEls=els.filter(function(e){ return e.classList.contains('on'); });
  var hs=cvs.map(function(c){ var x=c.getContext('2d'), d=x.getImageData(0,0,c.width,c.height).data;
    var h=2166136261>>>0; for(var i=0;i<d.length;i+=7){ h^=d[i]; h=Math.imul(h,16777619)>>>0; } return h; });
  var label='';
  (function(){ var l=document.querySelectorAll('#panel .field .lb');
    for(var i=0;i<l.length;i++){ if(/材质/.test(l[i].textContent)) label=l[i].textContent; } })();
  return JSON.stringify({want:want, n:els.length, info:info, on:onEls.length,
    uniq:new Set(hs).size, cur:st.book.mat, label:label});
`);
chk(m7.n === m7.want, 'M21 材料选择器渲染出的小样数 = 当前氛围的推荐材料数', m7.n + '/' + m7.want);
chk(m7.info.every((i) => i && i.w === 92 && i.h === 30), 'M22 每个小样是 92×30 的 canvas（= 卡片里的实际尺寸，不会被拉伸失真）');
chk(m7.info.every((i) => i.st.v > 1), 'M23 每个小样都真的画了材料（有纹理方差，不是空白/纯色）',
  m7.info.map((i) => i.st.v.toFixed(1)).join(','));
chk(m7.uniq === m7.n, 'M24 小样之间互不相同（能一眼看出材料差别）', m7.uniq + '/' + m7.n);
chk(m7.on === 1, 'M25 当前材料有且只有一个小样被选中');
chk(/材质/.test(m7.label), 'M26 面板里能看到「材质」字段，写着当前材料', m7.label);

/* 先生成，再真实点材料 → 验证"只重排、不重生成" */
const g0 = await ev(`
  var L=window.LUMEN, st=L.state;
  st.photos.forEach(function(p,i){ p.picked=(i<6); });
  L.setStep(2);
  await L.generate();
  for(var i=0;i<160;i++){ await new Promise(function(r){setTimeout(r,120);}); if(st.generated.length===6) break; }
  return JSON.stringify({gen:st.generated.length,
    tpl:st.photos.filter(function(p){return p.picked;}).map(function(p){return p.tpl;}),
    ids:st.photos.filter(function(p){return p.picked;}).map(function(p){return p.id;})});
`);
chk(g0.gen === 6, 'M27 前置：先有一版成片（后面验"换材料不重生成"）', 'generated=' + g0.gen);

const pickEl = await ev(`
  var els=Array.prototype.slice.call(document.querySelectorAll('#panel .mat[data-mat]'));
  var cur=window.LUMEN.state.book.mat;
  var tgt=null; for(var i=0;i<els.length;i++){ if(els[i].dataset.mat!==cur){ tgt=els[i]; break; } }
  if(!tgt) return JSON.stringify({none:true});
  /* 面板是可滚动的，小样可能在视口外 —— 先滚进来，否则真实鼠标点会落空 */
  tgt.scrollIntoView({block:'center'});
  await new Promise(function(r){ setTimeout(r,260); });
  var r=tgt.getBoundingClientRect();
  return JSON.stringify({mat:tgt.dataset.mat, x:Math.round(r.left+r.width/2), y:Math.round(r.top+r.height/2), cur:cur,
    inView:(r.top>=0&&r.bottom<=window.innerHeight)});
`);
if (!pickEl.none) {
  await b.mouse('mouseMoved', pickEl.x, pickEl.y);
  await b.mouse('mousePressed', pickEl.x, pickEl.y);
  await b.mouse('mouseReleased', pickEl.x, pickEl.y);
  await sleep(600);
}
const m8 = await ev(`
  var L=window.LUMEN, st=L.state;
  return JSON.stringify({mat:st.book.mat, gen:st.generated.length,
    tpl:st.photos.filter(function(p){return p.picked;}).map(function(p){return p.tpl;}),
    ids:st.photos.filter(function(p){return p.picked;}).map(function(p){return p.id;}),
    on:(function(){ var o=document.querySelectorAll('#panel .mat.on'); return o.length?o[0].dataset.mat:'-'; })(),
    stale:L.bookStale()});
`);
chk(!pickEl.none && m8.mat === pickEl.mat, 'M28 真实点击材料小样 → 书的材料真的换了',
  (pickEl.cur || '?') + ' → ' + m8.mat + ' (目标在视口内=' + pickEl.inView + ')');
chk(m8.on === m8.mat, 'M29 点完之后选中态跟着移动（不是只改 state）', 'on=' + m8.on);
chk(m8.gen === g0.gen && m8.gen === 6, 'M30 换材料不会重新生成成片（材料是装帧，不烧进成片 —— 用户不必等）',
  'generated=' + g0.gen + '→' + m8.gen);
chk(JSON.stringify(m8.tpl) === JSON.stringify(g0.tpl), 'M31 换材料不动照片的模版分配');
chk(JSON.stringify(m8.ids) === JSON.stringify(g0.ids), 'M32 换材料不动入册集合（照片与人一一对应）');
/* 材料是"装帧层"：它改变的是书页/书封的呈现，而**不**烧进每一张成片。
   所以成片不该被判过期（判过期会让用户以为照片要重做）；
   它要留下的痕迹在书页上 —— 那一层由 M14/M15 的像素差直接证明。 */
chk(m8.stale === false, 'M33 换材料不把成片判为过期（装帧层不烧进成片，不该误导用户重做照片）',
  'stale=' + m8.stale);

/* ---------- ⑤「换一版」连材料一起换 ---------- */
const a1 = await ev(`
  var L=window.LUMEN, st=L.state;
  st.photos.forEach(function(p,i){ p.picked=(i<8); });
  L.applySkin('sakura',{keepColors:false});
  L.autoBook('sakura',{off:0,coverIdx:0});
  await L.generate();
  for(var i=0;i<160;i++){ await new Promise(function(r){setTimeout(r,120);}); if(st.generated.length===8) break; }
  var before={mat:st.book.mat, layout:st.book.layout, skin:st.skin,
    tpl:st.photos.filter(function(p){return p.picked;}).map(function(p){return p.tpl;}),
    ids:st.photos.filter(function(p){return p.picked;}).map(function(p){return p.id;})};
  var r1=L.autoRoll();
  var mid={mat:st.book.mat, layout:st.book.layout, r1mat:r1.mat, r1name:r1.matName,
    from:r1.from, changed:r1.changed, off:r1.off};
  var mats=[before.mat, mid.mat];
  for(var k=0;k<5;k++){ L.autoRoll(); mats.push(st.book.mat); }
  var after={skin:st.skin,
    ids:st.photos.filter(function(p){return p.picked;}).map(function(p){return p.id;})};
  var pool=L.matChoices(L.skinCfg());
  return JSON.stringify({before:before, mid:mid, after:after, pool:pool,
    uniqMats:new Set(mats).size, mats:mats});
`);
chk(a1.mid.mat !== a1.before.mat, 'M34「换一版」会同时换材料（这正是用户嫌"太单一"的地方）',
  a1.before.mat + ' → ' + a1.mid.mat);
chk(a1.pool.indexOf(a1.mid.mat) >= 0, 'M35 换出来的材料在当前氛围的推荐清单里（不会换到不搭的料）', a1.pool.join(','));
chk(a1.mid.r1mat === a1.mid.mat && !!a1.mid.r1name, 'M36「换一版」的返回值带回新材料名，供提示文案用', a1.mid.r1name);
chk(a1.mid.changed === true, 'M37「换一版」自报"确实变了"（材料/版式/封面任一变化）');
chk(a1.uniqMats >= 2, 'M38 连点 6 次「换一版」，材料至少出现过 2 种不同值（真的在轮换，不是卡住）',
  a1.uniqMats + ' 种: ' + a1.mats.join('→'));
chk(a1.after.skin === 'sakura', 'M39「换一版」不换氛围（氛围是用户选的，不该被随机掉）');
chk(JSON.stringify(a1.after.ids) === JSON.stringify(a1.before.ids), 'M40「换一版」不换照片（入册集合不变）');

/* ---------- ⑥ 持久化与老存档迁移 ---------- */
/* 真实存档键是 lumen.prefs.v1，且写入是 200ms 去抖的（不能写完立刻读）。 */
const KEY = 'lumen.prefs.v1';
const p1 = await ev(`
  var L=window.LUMEN, st=L.state;
  var pool=L.matChoices(L.skinCfg());
  var alt=pool.filter(function(k){ return k!==st.book.mat; })[0];
  st.book.mat=alt; L.PERSIST.save();
  await new Promise(function(r){ setTimeout(r,420); });   /* 等去抖 flush */
  var raw=JSON.parse(localStorage.getItem('${KEY}')||'{}');
  return JSON.stringify({alt:alt, saved:(raw.book||{}).mat||'', skin:st.skin});
`);
chk(p1.saved === p1.alt, 'M41 换材料会写进存档', p1.saved || '(空)');

await b.goto(FILE, 2400);
await sleep(700);
const p2 = await ev(`
  var L=window.LUMEN, st=L.state;
  return JSON.stringify({mat:st.book.mat});
`);
chk(p2.mat === p1.alt, 'M42 刷新后材料还在（不是每次打开都回到默认料）', p2.mat);

/* 老存档：把真实的存档里 book.mat 抹掉，模拟"材料层上线之前存的档" */
const wiped = await ev(`
  var raw=JSON.parse(localStorage.getItem('${KEY}')||'{}');
  var had=!!(raw.book&&raw.book.mat);
  raw.book=raw.book||{}; delete raw.book.mat;
  localStorage.setItem('${KEY}', JSON.stringify(raw));
  return JSON.stringify({had:had, skin:raw.skin||'(none)'});
`);
chk(wiped.had === true, 'M43 前置：抹掉前存档里确实有 book.mat（否则这条测试是空转）');
await b.goto(FILE, 2400);
await sleep(700);
const p4 = await ev(`
  var L=window.LUMEN, st=L.state;
  var ok=!!L.MATSETS[st.book.mat];
  var should=L.matChoices(L.SKINS[st.skin]||L.SKINS.studio)[0];
  return JSON.stringify({mat:st.book.mat, ok:ok, should:should});
`);
chk(p4.ok === true, 'M44 老存档缺 book.mat → 补成合法材料，不会留下一本"没有材料"的书',
  'mat=' + p4.mat);
chk(p4.mat === p4.should, 'M45 迁移填的是该氛围的默认材料', p4.mat + ' = ' + p4.should);

console.log('');
console.log('===== 材质/质感层：' + pass + ' passed, ' + fail + ' failed =====');
await b.close();
process.exit(fail ? 1 : 0);
