import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

/* 第五轮：书本观感 + 翻页手感
   ① 内页用的是「干净照片」而不是套壳的模版成品
   ② 封面主图是挑过的，而且可以轮换
   ③ 封面/封底/环衬被认定为硬纸板，内容页是普通纸
   ④ 翻页速度设置真的作用到时长上，且不重排书页
   ⑤ 悬停折角会自己淡入淡出
   ⑥ 页码落在书口一侧
   全部走页面内真实调用与真实像素统计，不 mock。

   ⚠ 别在这个脚本里覆盖 window.requestAnimationFrame 之类做追踪 —— 上一版就是
   这么把页面自己的 raf 链打断的：包装后 `oRaf(cb)` 丢了 this，Chrome 直接抛
   Illegal invocation，沉浸阅读器整个打不开，看起来像产品 bug。要取证就在
   被测代码里加钩子，不要去改页面全局。 */
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';

const b = await launch({ port: 9433, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(900);

let pass = 0, fail = 0;
function chk(ok, name, extra) {
  if (ok) { pass++; console.log('PASS ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra ? '  ' + extra : '')); }
}

const prep = await b.evaluate(`(async function(){
  try{
    await window.LUMEN.loadEmbedded(true);
    window.LUMEN.setStep(2);
    await window.LUMEN.generate();
    await new Promise(function(r){ setTimeout(r,700); });
    return 'ok';
  }catch(e){ return 'ERR:'+(e&&e.message||e); }
})()`);
if (prep !== 'ok') { console.log('SETUP FAILED: ' + prep); await b.close(); process.exit(1); }

/* ---------- ① 内页用干净照片 ---------- */
const o1 = JSON.parse(await b.evaluate(`JSON.stringify((function(){
  var L=window.LUMEN, g0=L.state.generated[0];
  var p=L.state.photos.filter(function(q){ return q.id===g0.photoId; })[0];
  return { hasPlain:!!g0.plain,
    plainAsp:+(g0.plain.width/g0.plain.height).toFixed(4),
    srcAsp:+(p.w/p.h).toFixed(4),
    name:g0.name, tpl:g0.tpl, fromArtOf:(L.artOf(g0)===g0.plain) };
})())`));
chk(o1.hasPlain, 'B1 生成时同时产出了「干净照片」plain', 'name=' + o1.name + ' tpl=' + o1.tpl);
chk(Math.abs(o1.plainAsp - o1.srcAsp) < 0.01,
  'B2 plain 按照片原始比例出图（版式留给书页去排）',
  'plain=' + o1.plainAsp.toFixed(3) + ' src=' + o1.srcAsp.toFixed(3));
chk(o1.fromArtOf, 'B3 书页取的是 plain 而不是 art（artOf 优先返回 plain）');

/* art 与 plain 必须是两样东西：模版成品外圈是纸（宝丽来白框），
   干净照片外圈就是照片本身。比「art 和原图比例不同」靠谱 —— 比例可能碰巧相同。 */
const o1b = JSON.parse(await b.evaluate(`JSON.stringify((function(){
  var L=window.LUMEN, list=L.state.generated.filter(function(g){return g.picked&&g.plain;});
  function ringWhite(cv){
    var x=cv.getContext('2d'), W=cv.width, H=cv.height;
    var bw=Math.max(2,Math.round(Math.min(W,H)*0.05));
    var d=x.getImageData(0,0,W,H).data, w=0, n=0;
    for(var y=0;y<H;y+=2) for(var xx=0;xx<W;xx+=2){
      if(xx>=bw&&xx<W-bw&&y>=bw&&y<H-bw) continue;
      var i=(y*W+xx)*4;
      if((d[i]+d[i+1]+d[i+2])/3>238) w++;
      n++;
    }
    return w/Math.max(1,n);
  }
  var better=0, sample=null;
  list.forEach(function(g,i){
    var a=ringWhite(g.art), p=ringWhite(g.plain);
    if(i===0) sample=g.name+' art外圈'+(a*100).toFixed(0)+'% vs plain外圈'+(p*100).toFixed(0)+'%';
    if(a>p+0.02) better++;
  });
  return { better:better, n:list.length, sample:sample };
})())`));
chk(o1b.better / o1b.n >= 0.8,
  'B2b 模版成品外圈是纸、干净照片外圈是照片（art 真的套了壳）',
  o1b.better + '/' + o1b.n + ' 例：' + o1b.sample);

const o2 = JSON.parse(await b.evaluate(`JSON.stringify((function(){
  var L=window.LUMEN, im=L.state.generated.filter(function(x){return x.picked;})[2];
  var page=L.renderContent([im],7,880,1173,'r');
  var d=page.getContext('2d').getImageData(0,0,880,1173).data;
  var white=0,n=0;
  for(var i=0;i<d.length;i+=4){ if((d[i]+d[i+1]+d[i+2])/3>242) white++; n++; }
  var y=Math.round(1173*0.40), run=0, best=0;
  for(var xx=0;xx<880;xx++){
    var q=(y*880+xx)*4, vv=(d[q]+d[q+1]+d[q+2])/3;
    if(vv<236){ run++; if(run>best) best=run; } else run=0;
  }
  return { whitePct:+(white/n*100).toFixed(2), photoCols:best };
})())`));
chk(o2.whitePct < 62, 'B4 mat 内页留白克制（不会满页白框）', '近白占比=' + o2.whitePct + '%');
chk(o2.photoCols > 400, 'B5 照片占满栏宽的大部分', '中线连续非纸色宽=' + o2.photoCols + 'px / 880');

/* ---------- ② 封面主图 ---------- */
const o3 = JSON.parse(await b.evaluate(`JSON.stringify((function(){
  var L=window.LUMEN, rank=L.coverRank(), chosen=L.coverPhoto();
  var scores=rank.map(function(g){ return Math.round(L.coverScore(g.plain)); });
  var firstPicked=L.state.generated.filter(function(g){return g.picked;})[0];
  return { rankLen:rank.length, chosenName:chosen.name, firstPickedName:firstPicked.name,
    top:Math.max.apply(null,scores), chosenScore:Math.round(L.coverScore(chosen.plain)),
    monotone:scores.every(function(v,i){ return i===0||scores[i-1]>=v; }),
    topNames:rank.slice(0,3).map(function(g){return g.name;}) };
})())`));
chk(o3.rankLen > 5, 'B6 封面主图候选覆盖全部入册照片', 'n=' + o3.rankLen);
chk(o3.monotone, 'B7 封面打分从高到低排序', 'top3=' + o3.topNames.join(' / '));
chk(o3.chosenScore === o3.top, 'B8 默认选的是分数最高的那张', o3.chosenName + '=' + o3.chosenScore);
chk(o3.chosenName !== o3.firstPickedName, 'B9 封面没有盲取第一张（示例素材第 1 张是虚焦的）',
  '封面=' + o3.chosenName + ' 第一张=' + o3.firstPickedName);

const t3b = await b.evaluate(`(async function(){
  var L=window.LUMEN, before=L.coverPhoto().name;
  var btn=document.getElementById('coverNext');
  if(!btn) return 'NO_BTN';
  btn.click();
  await new Promise(function(r){ setTimeout(r,500); });
  return before+' -> '+L.coverPhoto().name+' idx='+L.state.book.coverIdx;
})()`);
chk(/->/.test(t3b) && t3b.split(' -> ')[0] !== t3b.split(' -> ')[1].split(' ')[0],
  'B10 「换一张」能真的换掉封面主图', t3b);

/* ---------- ③ 硬纸板 vs 普通纸 ---------- */
const o4 = JSON.parse(await b.evaluate(`JSON.stringify((function(){
  var B=window.LUMEN.BV, n=B.kinds.length;
  return { kinds:[0,1,2,3].map(function(k){return B.kinds[k];}),
    sel:[0,1,2,n-2,n-1].map(function(k){return B.kinds[k];}),
    hard0:B.sheetHard(0), hard1:B.sheetHard(1), hard2:B.sheetHard(2) };
})())`));
chk(o4.hard0 === true, 'B11 封面那一叠被判定为硬纸板', 'kinds[0..3]=' + o4.kinds.join(','));
chk(o4.hard1 === false, 'B12 扉页那一叠不是硬纸板（内容页）');
chk(o4.hard2 === false, 'B13 正文页是普通纸');
chk(o4.sel[3] === 'endpaper' && o4.sel[4] === 'back',
  'B14 页序尾部的材质正确', '首=' + o4.sel.slice(0,3).join(',') + ' 尾=' + o4.sel.slice(3).join(','));

/* ---------- ④ 翻页速度 ---------- */
const o5 = JSON.parse(await b.evaluate(`JSON.stringify((function(){
  var L=window.LUMEN, out={};
  [1,2,3].forEach(function(s){ L.state.book.speed=s; out['s'+s]=L.flipDur(); });
  L.state.book.speed=2;
  return out;
})())`));
chk(o5.s1 < o5.s2 && o5.s2 < o5.s3, 'B15 翻页手感三档时长递增',
  '利落=' + o5.s1 + 'ms 标准=' + o5.s2 + 'ms 舒缓=' + o5.s3 + 'ms');
chk(o5.s2 >= 700 && o5.s2 <= 1000, 'B16 标准档是有重量感的时长，不再是 620ms 的急停', o5.s2 + 'ms');

const t5b = await b.evaluate(`(async function(){
  var before=window.LUMEN.BV.pages[0];
  var seg=document.querySelector('.seg[data-k="book.speed"]');
  if(!seg) return 'NO_SEG';
  var btn=seg.querySelector('button[data-v="3"]');
  if(!btn) return 'NO_BTN';
  btn.click();
  await new Promise(function(r){ setTimeout(r,420); });
  var s=window.LUMEN.state.book.speed;
  return s+'/'+(typeof s)+'/'+(window.LUMEN.BV.pages[0]===before?'pages-kept':'pages-rebuilt');
})()`);
chk(t5b === '3/number/pages-kept',
  'B17 面板改翻页手感立刻生效、存进去是数字、且不重排书页', t5b);

/* ---------- ⑤ 折角提示 ---------- */
const t6 = await b.evaluate(`(async function(){
  var L=window.LUMEN, B=L.BV;
  /* 沉浸阅读是另一个容器，这里走工作区舞台那条路：先把书放回舞台并等布局量到尺寸 */
  L.closeReader();
  L.setStep(2);
  await new Promise(function(r){ setTimeout(r,700); });
  if(!B.cw) B.layout();
  var cw=B.cw;
  B.anim=null; B.drag=null; B.cornerOn=true; B.kick();
  await new Promise(function(r){ setTimeout(r,800); });
  var up=B.cornerA;
  B.cornerOn=false; B.kick();
  await new Promise(function(r){ setTimeout(r,900); });
  return up.toFixed(3)+' -> '+B.cornerA.toFixed(3)+' | cw='+Math.round(cw);
})()`);
const caUp = Number(t6.split(' -> ')[0]);
const caDown = Number(t6.split(' -> ')[1].split(' | ')[0]);
chk(caUp > 0.9, 'B18 悬停外下角时折角淡入', t6);
chk(caDown < 0.05, 'B19 移开后折角淡出', 'cornerA=' + caDown);

/* ---------- ⑥ 版式齐全 ---------- */
const o7 = JSON.parse(await b.evaluate(`JSON.stringify((function(){
  var L=window.LUMEN, out={};
  var picked=L.state.generated.filter(function(g){return g.picked;});
  ['full','mat','two','sticker'].forEach(function(k){
    L.state.book.layout=k;
    try{
      var pg=L.renderContent(picked.slice(0,k==='two'?2:1),3,880,1173,k==='two'?'r':'l');
      var d=pg.getContext('2d').getImageData(0,0,880,1173).data;
      var s=0,n=0; for(var i=0;i<d.length;i+=4*97){ s+=(d[i]+d[i+1]+d[i+2])/3; n++; }
      out[k]=Math.round(s/n);
    }catch(e){ out[k]='ERR:'+e.message; }
  });
  L.state.book.layout='mat';
  return out;
})())`));
const keys = Object.keys(o7);
chk(keys.every(k => typeof o7[k] === 'number'), 'B20 四种版式全部渲染成功', JSON.stringify(o7));
chk(new Set(keys.map(k => o7[k])).size >= 4, 'B21 四种版式画出来的画面互不相同');

/* ---------- ⑦ 页码落在书口一侧 ---------- */
const o8 = JSON.parse(await b.evaluate(`JSON.stringify((function(){
  var L=window.LUMEN, g=L.state.generated.filter(function(x){return x.picked;})[0];
  function ink(cv,left){
    var d=cv.getContext('2d').getImageData(0,Math.round(1173*0.90),880,60).data, s=0,n=0;
    for(var y=0;y<60;y++) for(var x=0;x<880;x++){
      var i=(y*880+x)*4;
      if(left? x<200 : x>680){ s+=255-(d[i]+d[i+1]+d[i+2])/3; n++; }
    }
    return s/Math.max(1,n);
  }
  var pl=L.renderContent([g],5,880,1173,'l'), pr=L.renderContent([g],6,880,1173,'r');
  return { lLeft:+ink(pl,true).toFixed(2), lRight:+ink(pl,false).toFixed(2),
           rLeft:+ink(pr,true).toFixed(2), rRight:+ink(pr,false).toFixed(2) };
})())`));
chk(o8.lLeft > o8.lRight, 'B22 左页的页码在左边（书口侧）', JSON.stringify(o8));
chk(o8.rRight > o8.rLeft, 'B23 右页的页码在右边（书口侧）');

/* ---------- ⑧ 沉浸阅读器真的能打开（回归：改 kick 之后最容易坏的就是它） ---------- */
const t9 = await b.evaluate(`(async function(){
  var L=window.LUMEN, B=L.BV;
  L.openReader();
  await new Promise(function(r){ setTimeout(r,900); });
  return JSON.stringify({ on:document.getElementById('reader').classList.contains('on'),
    cw:Math.round(B.cw),
    parent:(B.el.parentNode?(B.el.parentNode.id||B.el.parentNode.className):'none'),
    /* 采样必须取画布中央：书是居中的，左上角本来就只有 clearRect 后的空白，
       拿那儿当判据只会得到一堆假阴性。 */
    drewPixels:(function(){
      var c=B.cv, x=c.getContext('2d');
      var w=Math.round(c.width*0.5), h=Math.round(c.height*0.5);
      try{
        var d=x.getImageData(Math.round(c.width*0.25),Math.round(c.height*0.25),w,h).data;
        var a=0,tot=0; for(var i=3;i<d.length;i+=4*7){ if(d[i]>8) a++; tot++; }
        return { nonEmpty:a, sampled:tot, pct:Math.round(a/Math.max(1,tot)*100) };
      }catch(e){ return 'ERR:'+e.message; }
    })() });
})()`);
const o9 = JSON.parse(t9);
chk(o9.on && o9.cw > 200, 'B24 沉浸阅读器能打开并量到画布尺寸', 'cw=' + o9.cw + ' parent=' + o9.parent);
chk(o9.drewPixels && o9.drewPixels.pct > 60,
  'B25 阅读器里的书确实画出来了（画布中央不是空白）', JSON.stringify(o9.drewPixels));

/* ---------- ⑨ 书页要装裱模版成品（用户：「模版不会显示在成书那，那我这个模版功能做了干嘛」） ----------
   两条主线：
   ① 书页画面默认取「模版成品」，而且 28 页真的长得不一样 —— 丑的根因从来不是
      用了模版，而是模版那句全局同一行的「今日份」被印了 28 遍。现在文字按照片解占位符。
   ② 图注的抑制条件是「印片里写着**同一句话**」，不是「印片里有字」——
      出厂 opts.title='{name}'，看成片有没有 title 会恒为真，图注就永远不画了。 */
const t10 = await b.evaluate(`(async function(){
  function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
  var L=window.LUMEN, st=L.state;
  if(st.photos.length<28){ await L.loadEmbedded(true); }
  if(st.generated.length<28){ await L.generate(); }
  for(var i=0;i<200;i++){ await sleep(150); if(st.generated.length>=28) break; }

  /* ① 默认画面来源 + 取哪张 canvas */
  var defArt=st.book.art;
  var g=st.generated[0];
  var picked0=L.plateOf(g);

  /* ② 每张成片的题字应当是它自己的照片名（占位符 {name}） */
  var titles=st.generated.map(function(q){ return q.title; });
  var names=st.generated.map(function(q){ return q.name; });
  var sameAsName=titles.filter(function(t,i){ return t===names[i]; }).length;
  var uniqTitles=Object.keys(titles.reduce(function(a,t){ a[t]=1; return a; },{})).length;

  /* ③ 内容页画面哈希：28 页应当互不相同（真去重，不是"看起来不同"） */
  function hashPage(cv){
    var s=56, x=cv.getContext('2d');
    var t=document.createElement('canvas'); t.width=s; t.height=s;
    var y=t.getContext('2d'); y.drawImage(cv,0,0,s,s);
    var d=y.getImageData(0,0,s,s).data, h=2166136261, m1=0;
    for(var i=0;i<d.length;i+=4){ h^=d[i]; h=(h*16777619)>>>0; m1+=d[i]*.299+d[i+1]*.587+d[i+2]*.114; }
    return h+'/'+Math.round(m1);
  }
  var B=L.buildBookPages();
  var content=B.pages.filter(function(p){ return p.kind==='content'; });
  var hashes=content.map(function(p){ return hashPage(p.canvas); });
  var uniqPages=Object.keys(hashes.reduce(function(a,h){ a[h]=1; return a; },{})).length;

  /* ④ 书页图注的抑制条件必须比「内容」而不是比「有没有字」。
     出厂 opts.title='{name}' → 每张成片都带非空 title，
     只看"有没有字"会让图注在任何页面上都不画（用户写了文案书里一个字都没有）。
     正确行为：文案 ≠ 印片题字 → 画；文案 = 印片题字（opts.title 用 {note}）→ 不重复。 */
  var ph=L.photoOfIm(g);
  var kp={layout:st.book.layout, title:st.opts.title, cap:st.book.cap};
  st.book.layout='mat'; st.book.cap='note';
  var Wq=620,Hq=820, PBq=Hq*.104, capYq=Hq-PBq-Wq*.048, csq=16;
  var yAq=Math.round(capYq-csq*0.9), yBq=Math.round(capYq+csq*2.0);
  ph.note=''; var qa=L.renderContent([g],3,Wq,Hq,'r');
  ph.note='无题，但很喜欢'; var qc=L.renderContent([g],3,Wq,Hq,'r');
  var qda=qa.getContext('2d').getImageData(0,yAq,Wq,yBq-yAq).data;
  var qdc=qc.getContext('2d').getImageData(0,yAq,Wq,yBq-yAq).data;
  var capBand=0;
  for(var qi=0;qi<qda.length;qi+=4){
    if(Math.abs(qda[qi]-qdc[qi])+Math.abs(qda[qi+1]-qdc[qi+1])+Math.abs(qda[qi+2]-qdc[qi+2])>12) capBand++;
  }
  var capDraw=L.capWillDraw(g);                        /* 文案≠印片题字 → 要画 */
  st.opts.title='{note}';
  var capSkip=L.plateHasText(g)&&!L.capWillDraw(g);    /* 同一句话 → 不重复 */
  st.opts.title=kp.title; st.book.cap=kp.cap; st.book.layout=kp.layout; ph.note='';

  /* ⑤ 切到「干净照片」后，书页画面真的换了 */
  var before=hashPage(content[0].canvas);
  st.book.art='plain'; L.renderPanel && L.renderPanel();
  var B2=L.buildBookPages();
  var c2=B2.pages.filter(function(p){ return p.kind==='content'; });
  var after=hashPage(c2[0].canvas);
  var plainUsed=(L.plateOf(g)===g.plain);
  var plainIsClean=(L.artOf(g)===g.plain);
  st.book.art='tpl';

  return JSON.stringify({ defArt:defArt, plateIsArt:(picked0===g.art),
    sameAsName:sameAsName, n:titles.length, uniqTitles:uniqTitles,
    sampleTitles:titles.slice(0,3), uniqPages:uniqPages, nPages:content.length,
    capSkip:capSkip, capDraw:capDraw, capBand:capBand, plainUsed:plainUsed, plainIsClean:plainIsClean,
    changed:(before!==after), before:before, after:after,
    resolve:L.resolveTokens('{name} · {nn}/{total} · {tpl}', st.photos[6]) });
})()`);
const o10 = JSON.parse(t10);
chk(o10.defArt === 'tpl', 'B26 书页画面默认是「模版成品」（否则模版功能白做）', 'art=' + o10.defArt);
chk(o10.plateIsArt, 'B27 内容页取的确实是模版成品 canvas 而不是干净照片');
chk(o10.sameAsName === o10.n && o10.uniqTitles === o10.n,
  'B28 模版文字按照片解占位符，28 张成片题字各不相同且等于各自照片名',
  o10.sameAsName + '/' + o10.n + ' 匹配 · ' + o10.uniqTitles + ' 种 · ' + JSON.stringify(o10.sampleTitles));
chk(o10.uniqPages === o10.nPages && o10.nPages >= 20,
  'B29 每一页内容页画面互不相同（不是 28 页同一张）', o10.uniqPages + '/' + o10.nPages + ' 唯一');
chk(o10.capDraw === true && o10.capBand > 100,
  'B30 文案与印片题字不是同一句话 → 书页必须真的画图注（出厂 opts.title={name} 时也是）',
  'capWillDraw=' + o10.capDraw + ' 图注带差异=' + o10.capBand + ' 像素');
chk(o10.capSkip, 'B30b 印片自己就写着那句话（opts.title 用 {note}）→ 不重复画（同一信息不出现两次）');
chk(o10.plainUsed && o10.plainIsClean, 'B31 切到「干净照片」时书页/封面取的是 plain');
chk(o10.changed, 'B32 切换书页画面真的重排了书页（画面像素变了）');
chk(o10.resolve.indexOf('KADA 07') === 0 && o10.resolve.indexOf('07/28') > 0,
  'B33 占位符 {name}/{nn}/{total} 都能解', o10.resolve);

/* ---------- ⑩ 老存档迁移：升级上来的人也必须看到修复 ----------
   老存档里模版文字是常量「今日份」，不迁移的话这批人升级后仍是 28 页重复同一句，
   等于修复对他不可见。只升级"原封不动等于旧默认值"的字段。 */
await b.evaluate(`(function(){
  localStorage.setItem('lumen.prefs.v1', JSON.stringify({
    opts:{title:'今日份',sub:'2026 · LUMEN',corner:'NO.01',accent:'#e08a3c',font:'sans'},
    book:{title:'光匣',paper:'#fffdf8',ink:'#2b2620',layout:'mat',num:true,spread:true,cap:'name',speed:2,coverIdx:0},
    assign:{}
  }));
  return 1;
})()`);
await b.goto(FILE, 2600);
await sleep(1200);
const o11 = JSON.parse(await b.evaluate(`(function(){
  var st=window.LUMEN.state;
  return JSON.stringify({title:st.opts.title, sub:st.opts.sub, corner:st.opts.corner, art:st.book.art});
})()`));
chk(o11.title === '{name}' && o11.corner === 'NO.{n}',
  'B34 老存档里等于旧默认值的模版文字被迁移成占位符', JSON.stringify(o11));
chk(o11.art === 'tpl', 'B35 老存档缺「书页画面」时补上默认值（模版成品）', 'art=' + o11.art);

/* ---------- ⑪ 成片过期要能提示，否则用户改了模版却看到旧图，又会以为功能没生效 ---------- */
const o12 = JSON.parse(await b.evaluate(`(async function(){
  function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
  var L=window.LUMEN, st=L.state;
  if(st.photos.length<28){ await L.loadEmbedded(true); }
  if(st.generated.length<28){ await L.generate(); }
  for(var i=0;i<200;i++){ await sleep(150); if(st.generated.length>=28) break; }
  var fresh=!L.bookStale();
  /* 改一张照片的模版 → 必须判为过期 */
  var old=st.photos[2].tpl;
  st.photos[2].tpl=(old==='film'?'kraft':'film');
  var afterTpl=L.bookStale();
  st.photos[2].tpl=old;
  var backToFresh=!L.bookStale();
  /* 改模版文字 → 也必须判为过期（模版成品是在生成那一刻烧进画布的） */
  st.opts.title='{name} · TEST';
  var afterOpts=L.bookStale();
  st.opts.title=window.LUMEN.DEFAULT_OPTS.title;
  return JSON.stringify({fresh:fresh, afterTpl:afterTpl, backToFresh:backToFresh,
    afterOpts:afterOpts, backAfterUndo:!L.bookStale()});
})()`));
chk(o12.fresh, 'B36 刚生成完，成片是新鲜的（bookStale=false）');
chk(o12.afterTpl && o12.backToFresh,
  'B37 改了某张照片的模版 → 判为过期；改回去 → 恢复新鲜', JSON.stringify(o12));
chk(o12.afterOpts && o12.backAfterUndo,
  'B38 改了模版文字 → 判为过期（书里还是旧画面，得重出）');

/* ---------- ⑫ 改名：老存档里的旧默认品牌值要迁成新名字，用户自己改过的一律不动 ---------- */
await b.evaluate(`(function(){
  localStorage.setItem('lumen.prefs.v1', JSON.stringify({
    opts:{title:'{name}',sub:'{n} / {total}',corner:'NO.{n}',accent:'#e08a3c',font:'sans'},
    book:{title:'光匣',author:'LUMEN STUDIO',spine:'LUMEN · 2026',
          paper:'#fffdf8',ink:'#2b2620',layout:'mat',art:'tpl',
          ratio:'3:4',num:true,spread:true,cap:'note',speed:2,coverIdx:0},
    assign:{}
  }));
  return 1;
})()`);
await b.goto(FILE, 2600);
await sleep(1200);
const o13 = JSON.parse(await b.evaluate(`(function(){
  var st=window.LUMEN.state;
  return JSON.stringify({ot:st.opts.title,bt:st.book.title,ba:st.book.author,bs:st.book.spine,
    alias:typeof window.KADA});
})()`));
chk(o13.bt === '咔哒书' && o13.ba === 'KADA STUDIO' && o13.bs === 'KADA · 2026',
  'B39 老存档里等于旧默认值的书名/署名/书脊 → 迁成新品牌名', JSON.stringify(o13));
chk(o13.ot === '{name}',
  'B39c 印片题字(opts.title)不属于品牌字段，改名不许碰它', 'opts.title=' + o13.ot);
chk(o13.alias === 'object', 'B39a 同时暴露 window.KADA（旧名 LUMEN 保留给老脚本）', 'KADA=' + o13.alias);

/* 用户自己起的书名/署名不能被改名迁移改写 */
await b.evaluate(`(function(){
  var s=JSON.parse(localStorage.getItem('lumen.prefs.v1'));
  s.book.title='我的宝宝相册'; s.book.author='妈妈'; s.book.spine='一本自己的书';
  localStorage.setItem('lumen.prefs.v1', JSON.stringify(s));
  return 1;
})()`);
await b.goto(FILE, 2600);
await sleep(1200);
const o14 = JSON.parse(await b.evaluate(`(function(){
  var st=window.LUMEN.state;
  return JSON.stringify({bt:st.book.title,ba:st.book.author,bs:st.book.spine});
})()`));
chk(o14.bt === '我的宝宝相册' && o14.ba === '妈妈' && o14.bs === '一本自己的书',
  'B39b 用户自己起的书名/署名/书脊不被改名迁移覆盖', JSON.stringify(o14));


const errs = await b.evaluate('JSON.stringify(window.__errs||[])');
console.log('\n--- JS 异常: ' + (errs === '[]' ? 'none' : errs));
console.log('--- 失败项: ' + fail + ' / ' + (pass + fail));
await b.close();
process.exit(fail ? 1 : 0);
