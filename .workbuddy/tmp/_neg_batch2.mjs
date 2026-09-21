import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

/* 第十三轮 · 第二批「能玩」：贴纸/手写/戳 · 氛围音效 · 九宫格小卡页 ·
   日期戳/票根 · 双封面寄语。

   这个套件的规矩（和前面九个一样）：
   ① 断言必须打在「设置 → 渲染 → 产物像素」这条链的**末端**。
      只查 state 字段等于在测"我写的赋值语句" —— 上一轮就是靠这条才发现
      贴纸根本没进 ZIP。所以下面每一组都有像素证据。
   ② 每个断言都要有**反面对照**。"贴纸让像素变了"必须配上"去掉贴纸就变回去"，
      否则一张本来就不同的画布也能让它通过。
   ③ 贴纸的坐标是归一化的，所以"换个画幅还落在同一处"是它唯一的价值主张，
      必须真的拿两个画幅比。 */
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/_before.html';

const b = await launch({ port: 9491, windowSize: '1400,920' });
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
/* 页面里常用的小工具：画布指纹 / 墨迹包围盒。注入一次，后面到处用。 */
const TOOLS = `
  window.__t = window.__t || {};
  window.__t.hash = function(cv){
    var x=cv.getContext('2d'); var d=x.getImageData(0,0,cv.width,cv.height).data;
    var h=2166136261; for(var i=0;i<d.length;i+=37){ h^=d[i]; h=Math.imul(h,16777619); } return (h>>>0);
  };
  window.__t.bbox = function(cv,x0,y0,w,h,thr){
    thr=thr||150;
    var x=cv.getContext('2d'); var d=x.getImageData(x0,y0,w,h).data;
    var minX=1e9,maxX=-1,minY=1e9,maxY=-1,n=0;
    for(var j=0;j<h;j++) for(var i=0;i<w;i++){
      var o=(j*w+i)*4;
      if(d[o]<thr&&d[o+1]<thr&&d[o+2]<thr){
        n++; if(i<minX)minX=i; if(i>maxX)maxX=i; if(j<minY)minY=j; if(j>maxY)maxY=j;
      }
    }
    return {n:n,x0:minX+x0,x1:maxX+x0,y0:minY+y0,y1:maxY+y0};
  };
`;

const prep = await ev(`
  ${TOOLS}
  await window.LUMEN.loadEmbedded(true);
  var st=window.LUMEN.state;
  window.LUMEN.setStep(2);
  await window.LUMEN.generate();
  for(var i=0;i<60;i++){ await new Promise(function(r){setTimeout(r,120);});
    if(st.generated.length===st.photos.filter(function(p){return p.picked;}).length) break; }
  return JSON.stringify({n:st.photos.length, gen:st.generated.length,
    cap:st.book.cap, layout:st.book.layout, per:window.LUMEN.perPage(),
    sound:st.sound, max:window.LUMEN.STK_MAX});
`);
if (prep.__err || !prep.gen) { console.log('SETUP FAILED: ' + JSON.stringify(prep)); await b.close(); process.exit(1); }
console.log('  setup: ' + prep.n + ' 张 / 成片 ' + prep.gen + ' · 版式=' + prep.layout +
  ' 每页=' + prep.per + ' 音效=' + prep.sound);

/* ================= A. 贴纸数据层 ================= */
const a1 = await ev(`
  var L=window.LUMEN;
  var bad=L.STK_ORDER.filter(function(k){ return !L.STICKERS[k] || !L.STICKERS[k].name; });
  var texted=L.STK_ORDER.filter(function(k){ return L.STICKERS[k].text; });
  return JSON.stringify({n:L.STK_ORDER.length, bad:bad, texted:texted.length, max:L.STK_MAX});
`);
chk(a1.n === 8 && a1.bad.length === 0,
  'B2-1 八种贴纸都在册，名称齐全', '种类=' + a1.n);
chk(a1.texted === 4,
  'B2-2 其中四种带文字（手写圈/日期戳/纪念日戳/票根）', '带字=' + a1.texted);

const a2 = await ev(`
  var L=window.LUMEN;
  var dirty=[{k:'tape',x:-5,y:9,rot:99,s:0,text:'x'.repeat(80)},
             {k:'不存在的贴纸',x:.5,y:.5},
             {k:'star',x:.5,y:.5}];
  var c=L.stkClean(dirty);
  var seven=[]; for(var i=0;i<9;i++) seven.push({k:'star',x:.5,y:.5});
  return JSON.stringify({n:c.length, k:c.map(function(s){return s.k;}),
    x:c[0].x, y:c[0].y, rot:c[0].rot, s:c[0].s, tlen:c[0].text.length,
    seven:L.stkClean(seven).length,
    sig1:L.stickerSig({stickers:[{k:'tape',x:.5,y:.5,rot:0,s:1,text:''}]}),
    sig2:L.stickerSig({stickers:[{k:'tape',x:.5001,y:.5,rot:0,s:1,text:''}]}),
    sig3:L.stickerSig({stickers:[{k:'tape',x:.62,y:.5,rot:0,s:1,text:''}]}),
    sig4:L.stickerSig({stickers:[{k:'tape',x:.5,y:.5,rot:0,s:1,text:'abc'}]}),
    sigEmpty:L.stickerSig({stickers:[]})});
`);
chk(a2.k.indexOf('不存在的贴纸') < 0,
  'B2-3 不认识的贴纸种类在读回时被丢掉（老存档里改过名也不会崩）', a2.k.join('/'));
chk(a2.x === -.25 && a2.y === 1.25 && a2.rot === 3.2 && a2.s === .35,
  'B2-4 越界的坐标/角度/大小被夹回合法区间',
  ['x=' + a2.x, 'y=' + a2.y, 'rot=' + a2.rot, 's=' + a2.s].join(' '));
chk(a2.tlen === 30, 'B2-5 贴纸文字截断到 30 字（不让一段话撑破画面）', 'len=' + a2.tlen);
chk(a2.seven === 6,
  'B2-6 单张照片最多 6 枚贴纸（第 7 枚起被丢弃）', '写入 9 枚 → 留下 ' + a2.seven);
chk(a2.sig1 === a2.sig2 && a2.sig1 !== a2.sig3 && a2.sig1 !== a2.sig4 && a2.sigEmpty === '',
  'B2-7 贴纸签名：忽略浮点噪声、对位置与文字敏感、没有贴纸时为空串');

/* ================= B. 烧进成片（正反对照） ================= */
const b1 = await ev(`
  var L=window.LUMEN, st=L.state;
  var list=st.photos.filter(function(p){ return p.picked; });
  var okSig=true;
  for(var i=0;i<st.generated.length;i++){
    if(st.generated[i].stick!==L.stickerSig(list[i])){ okSig=false; break; }
  }
  var h={};
  function snap(p){ var c=L.renderPlain(p,520); return window.__t.hash(c); }
  var p0=list[0];
  p0.stickers=[];
  var hNone=snap(p0);
  p0.stickers=[L.stkFix({k:'tape',x:.5,y:.5,s:2,text:''})];
  var hTape=snap(p0);
  p0.stickers=[L.stkFix({k:'heart',x:.5,y:.5,s:2,text:''})];
  var hHeart=snap(p0);
  p0.stickers=[];
  var hBack=snap(p0);
  /* 成片（带模版外壳 + finalize 的白边/圆角）也要有贴纸：
     只测 renderPlain 的话，"书页画面选了干净照片"这条路径过了，
     而 ZIP 里那张模版成品可能根本没贴 —— 两条路都得验。 */
  var art0=L.renderPlain(p0,520);
  var wp=st.photos.filter(function(q){ return q.picked; })[1];
  wp.stickers=[];
  var wNone=window.__t.hash(L.renderPlain(wp,520));
  wp.stickers=[L.stkFix({k:'star',x:.5,y:.5,s:2,text:''})];
  var wSome=window.__t.hash(L.renderPlain(wp,520));
  wp.stickers=[];
  return JSON.stringify({okSig:okSig, hNone:hNone, hTape:hTape, hHeart:hHeart, hBack:hBack,
    wNone:wNone, wSome:wSome, emptySig:L.stickerSig(list[0])});
`);
chk(b1.okSig, 'B2-8 生成时把贴纸签名记进了成片对象（bookStale 靠它判过期）');
chk(b1.hTape !== b1.hNone && b1.hHeart !== b1.hNone && b1.hTape !== b1.hHeart,
  'B2-9 贴上胶带/爱心后「干净照片」的像素真的变了，且两种贴纸互不相同');
chk(b1.hBack === b1.hNone,
  'B2-10 反面对照：把贴纸清零，画面逐像素回到没贴的样子（不是"随便动一下就算过"）');
chk(b1.wSome !== b1.wNone, 'B2-11 换一张照片同样成立（不是只有第一张被画上）');

const b2 = await ev(`
  var L=window.LUMEN, st=L.state;
  await L.generate();
  for(var i=0;i<80;i++){ await new Promise(function(r){setTimeout(r,120);}); if(!L.bookStale()) break; }
  var fresh=!L.bookStale();
  var list=st.photos.filter(function(p){ return p.picked; });
  var p0=list[0], g0=st.generated[0];
  /* 用最终成片 canvas（带白边圆角的那张）比像素 —— 这才是导出 ZIP 里的东西 */
  var h0=window.__t.hash(g0.canvas);
  p0.stickers=[L.stkFix({k:'ticket',x:.5,y:.5,s:1.2,text:'KADA · 入场券'})];
  var staleNow=L.bookStale();
  var sigNow=L.stickerSig(p0);
  await L.generate();
  for(var j=0;j<80;j++){ await new Promise(function(r){setTimeout(r,120);}); if(!L.bookStale()) break; }
  var h1=window.__t.hash(st.generated[0].canvas);
  var sigAfter=st.generated[0].stick;
  var staleAfter=L.bookStale();
  p0.stickers=[];
  await L.generate();
  for(var k=0;k<80;k++){ await new Promise(function(r){setTimeout(r,120);}); if(!L.bookStale()) break; }
  var h2=window.__t.hash(st.generated[0].canvas);
  return JSON.stringify({fresh:fresh, h0:h0, h1:h1, h2:h2, staleNow:staleNow,
    sigNow:sigNow, sigAfter:sigAfter, staleAfter:staleAfter});
`);
chk(b2.fresh, 'B2-12 刚生成完的书不算过期（否则每次导出都会白重出 28 张）');
chk(b2.staleNow, 'B2-13 只加一枚贴纸，「成片已过期」立刻为真 —— 导出因此会先重出');
chk(b2.sigNow === b2.sigAfter && !b2.staleAfter,
  'B2-14 重出之后成片记下的贴纸签名与当前一致，过期解除');
chk(b2.h1 !== b2.h0 && b2.h2 === b2.h0,
  'B2-15 成片像素：贴票根变了、清掉后回到原样（正反对照）',
  [b2.h0, b2.h1, b2.h2].join(' / '));

/* ================= C. 归一化坐标跨画幅 · 八种都要画得出来 ================= */
/* 直接在白底画布上画贴纸，量"非白像素"的包围盒。
   绕开 renderPlain 是有原因的：示例素材本身就是深色抽象渐变，
   用"暗于某阈值"当墨迹会连整张照片一起算进去，于是"贴纸占满全画幅"也能过 ——
   这种假通过比不过还危险。白底上的差异只可能来自贴纸。 */
const c1 = await ev(`
  var L=window.LUMEN;
  function probe(W,H,x,y){
    var c=document.createElement('canvas'); c.width=W; c.height=H;
    var g=c.getContext('2d');
    g.fillStyle='#ffffff'; g.fillRect(0,0,W,H);
    /* ⚠ 第 2 个参数是**照片矩形**（贴纸坐标相对它归一化），不是画布宽高。
       白底探针里"照片"就是整块画布，所以显式写成 {dx:0,dy:0,dw:W,dh:H}。
       以前这里传的是 (W,H) 两个数字 —— 那正是"贴纸锚在画布上"那版 bug 的入口。 */
    L.drawStickers(g,{dx:0,dy:0,dw:W,dh:H},[L.stkFix({k:'heart',x:x,y:y,s:1,text:''})],null);
    var d=g.getImageData(0,0,W,H).data;
    var minX=1e9,maxX=-1,minY=1e9,maxY=-1,n=0;
    for(var j=0;j<H;j++) for(var i=0;i<W;i++){
      var o=(j*W+i)*4;
      if(d[o]<230||d[o+1]<230||d[o+2]<230){
        n++; if(i<minX)minX=i; if(i>maxX)maxX=i; if(j<minY)minY=j; if(j>maxY)maxY=j;
      }
    }
    return {w:W,h:H,n:n,nx:(minX+maxX)/2/W, ny:(minY+maxY)/2/H,
      rw:(maxX-minX)/Math.min(W,H), rh:(maxY-minY)/Math.min(W,H)};
  }
  var sizes=[[1600,1200],[900,1600],[1024,1024],[700,480],[520,780]];
  return JSON.stringify({out:sizes.map(function(s){ return probe(s[0],s[1],.74,.26); })});
`);
const cx = c1.out.map(o => o.nx), cy = c1.out.map(o => o.ny);
const rw = c1.out.map(o => o.rw), rh = c1.out.map(o => o.rh);
const spread = a => Math.max(...a) - Math.min(...a);
chk(spread(cx) < .03 && spread(cy) < .03,
  'B2-16 同一枚贴纸在五种画幅上落点一致（归一化坐标真的是比例量，不是像素量）',
  'x ' + cx.map(v => v.toFixed(3)).join('/') + ' · y ' + cy.map(v => v.toFixed(3)).join('/'));
chk(spread(rw) < .08 && spread(rh) < .08,
  'B2-17 贴纸的视觉大小按短边缩放，跨画幅比例稳定（不会在方图里突然变大）',
  '宽占短边 ' + rw.map(v => (v * 100).toFixed(1) + '%').join('/'));

const c2 = await ev(`
  var L=window.LUMEN;
  /* 八种一个一个画，量非白像素；再八种一起画一次。
     最后那条是回归：stkAnniv 曾经把全局取整函数 R 用局部同名变量盖掉，
     于是纪念日戳一画就抛 TypeError —— 而选择器那边的异常被 try/catch 吞了，
     只在按钮上表现为"这一枚是空白的"。 */
  function probe(list){
    var W=900,H=700;
    var c=document.createElement('canvas'); c.width=W; c.height=H;
    var g=c.getContext('2d');
    g.fillStyle='#ffffff'; g.fillRect(0,0,W,H);
    L.drawStickers(g,{dx:0,dy:0,dw:W,dh:H},list,null);
    var d=g.getImageData(0,0,W,H).data, n=0;
    for(var i=0;i<d.length;i+=4){ if(d[i]<230||d[i+1]<230||d[i+2]<230) n++; }
    return n;
  }
  /* 文字的出厂值和"加贴纸"那一处一致（把 dflt 显式写进数据）——
     不写的话这里画的是空文字，量的就不是用户真正会看到的那个样子。 */
  var res=[], threw='';
  L.STK_ORDER.forEach(function(k){
    var one=0;
    try{ one=probe([L.stkFix({k:k,x:.5,y:.5,s:2.2,text:String((L.STICKERS[k]||{}).dflt||'')})]); }
    catch(e){ threw=k+': '+String(e&&e.message||e); }
    res.push({k:k,n:one});
  });
  var all=0;
  try{
    all=probe(L.STK_ORDER.map(function(k){
      return L.stkFix({k:k,x:.12+0.11*L.STK_ORDER.indexOf(k),y:.5,s:1.5,
        text:String((L.STICKERS[k]||{}).dflt||'')}); }));
  }catch(e){ threw='八合一: '+String(e&&e.message||e); }
  return JSON.stringify({res:res, all:all, threw:threw});
`);
const blank = c2.res.filter(r => r.n < 200);
chk(c2.threw === '' && blank.length === 0,
  'B2-18 八种贴纸每一种都真的画出东西了（漏一种，用户点到它就是"没反应"）',
  c2.threw || c2.res.map(r => r.k + ':' + r.n).join(' '));
chk(c2.all > 3000,
  'B2-19 八种同屏共存也不抛错（回归：纪念日戳曾因局部变量遮蔽了全局 R 而必崩）',
  '同屏非白像素=' + c2.all);

/* 端到端：贴纸在**书页**上看得见（完整走一遍「贴 → 重出 → 书页」）
   ⚠ 两个坑都在这一条上踩过：
   ① 书页排的是 state.generated（成片对象）里 picked 的，不是 state.photos ——
      改照片的 picked 对页序毫无影响，"一页一张"怎么设都还是 28 页。
   ② 书页用的是**生成那一刻**烘好的画布（im.plain / im.art），
      贴完不重出的话书页当然不变 —— 这不是 bug，正是"过期 → 重出"那条链路。
      所以断言必须包含 generate()，否则测的其实是"贴纸能不能立刻进书页"这个伪命题。 */
const c4 = await ev(`
  var L=window.LUMEN, st=L.state;
  function pageHash(){ var r=L.buildBookPages();
    var cc=r.pages.filter(function(p){ return p.kind==='content'; });
    return window.__t.hash(cc[0].canvas); }
  async function shot(){
    await L.generate();
    for(var i=0;i<80;i++){ await new Promise(function(r){ setTimeout(r,120); });
      if(!L.bookStale()) break; }
    return pageHash();
  }
  st.generated.forEach(function(g,i){ g.picked=(i<1); });
  st.photos.forEach(function(p){ p.stickers=[]; });
  st.book.layout='full';
  var out={};
  for(var ai=0;ai<2;ai++){
    var art=ai?'tpl':'plain';
    st.book.art=art;
    st.photos[0].stickers=[];
    var h0=await shot();
    st.photos[0].stickers=[L.stkFix({k:'tape',x:.5,y:.28,s:1.8,text:''})];
    var h1=await shot();
    var staleSeen=L.bookStale();
    st.photos[0].stickers=[];
    var h2=await shot();
    out[art]={h0:h0,h1:h1,h2:h2, changed:h1!==h0, restored:h2===h0, staleSeen:staleSeen};
  }
  st.book.art='tpl';
  st.generated.forEach(function(g){ g.picked=true; });
  await L.generate();
  for(var j=0;j<80;j++){ await new Promise(function(r){ setTimeout(r,120); }); if(!L.bookStale()) break; }
  return JSON.stringify(out);
`);
chk(c4.plain.changed && c4.plain.restored && !c4.plain.staleSeen,
  'B2-20 书页画面选「干净照片」：贴纸经「重出成片」进了书页，去掉后又逐像素还原');
chk(c4.tpl.changed && c4.tpl.restored && !c4.tpl.staleSeen,
  'B2-21 书页画面选「模版成品」时同样成立（两条路都要验，否则总有一条是漏的）');

/* 日期戳必须解出真日期，不能把 {date} 原样画上去 */
const c3 = await ev(`
  var L=window.LUMEN, st=L.state;
  var p=st.photos.filter(function(q){ return q.picked; })[0];
  /* 两种来源都要能交代：
     ① 通过界面加贴纸 → 数据里已经写着 {date}（见 app.js 的加贴纸那一处）；
     ② 数据里压根没有 text 字段（= 从没设过）→ 由 stkText 退回出厂值。 */
  var viaUI=L.stkFix({k:'stamp',x:.5,y:.5,s:2.2,text:String(L.STICKERS.stamp.dflt)});
  var viaOld=L.stkFix({k:'stamp',x:.5,y:.5,s:2.2});
  var noText=Object.assign({},viaOld); delete noText.text;
  var txt=L.stkText(noText);
  var resolved=L.resolveTokens(txt,p);
  /* 反面对照：手打一句常量，验证它**不**被替换（用户想要的字就是那个字），
     以及**空串**就是空串（不能被出厂值顶回来）。 */
  var s2=L.stkFix({k:'stamp',x:.5,y:.5,s:2.2,text:'2026.01.01'});
  var s3=L.stkFix({k:'stamp',x:.5,y:.5,s:2.2,text:''});
  return JSON.stringify({uiTxt:L.stkText(viaUI), txt:txt, resolved:resolved,
    looks:/^\\d{4}[-.]\\d{2}[-.]\\d{2}$/.test(resolved),
    plain:L.resolveTokens(L.stkText(s2),p), empty:L.stkText(s3)});
`);
chk(c3.uiTxt === '{date}' && c3.txt === '{date}',
  'B2-22 日期戳的出厂值就是 {date}（界面上贴出来的、以及老数据没写 text 的）');
chk(c3.looks && c3.resolved.indexOf('{') < 0,
  'B2-23 到了画面上它是真日期，不是字面 {date}', c3.resolved);
chk(c3.plain === '2026.01.01',
  'B2-24 反面对照：手打的日期原样画上去，不会被当成占位符');
chk(c3.empty === '',
  'B2-25 反面对照：空串就是空串（删光文字后不会被出厂值顶回来）');

/* ================= D. 面板与交互 ================= */
const d1 = await ev(`
  var L=window.LUMEN, st=L.state;
  var s=document.querySelector('#panel');
  var btns=s.querySelectorAll('.stks .stk[data-stk-add]');
  var nonblank=0, dims=[], pcts=[];
  Array.prototype.forEach.call(btns,function(bt){
    var cv=bt.querySelector('canvas'); if(!cv) return;
    var x=cv.getContext('2d'); var d=x.getImageData(0,0,cv.width,cv.height).data;
    /* 小样底色是一块中性中间调（见 stkPalette 的 chip），所以"画了没有"
       要数**与底色不同**的像素。数 alpha>0 是没用的：底色已经把整块画布填满，
       八个都会"有内容"。和纸胶带当初正是铺在纸色底上、看起来像个空盒子 ——
       这一条就是为它写的。 */
    var n=0, tot=cv.width*cv.height;
    for(var i=0;i<d.length;i+=4){
      if(Math.abs(d[i]-185)>12||Math.abs(d[i+1]-178)>12||Math.abs(d[i+2]-166)>12) n++;
    }
    var pct=Math.round(n/tot*100);
    pcts.push(pct);
    if(pct>=5) nonblank++;
    dims.push(cv.width+'x'+cv.height);
  });
  return JSON.stringify({btns:btns.length, nonblank:nonblank, pcts:pcts, dims:dims.slice(0,2),
    stage:!!s.querySelector('#stkStage'),
    stageWH:(function(){ var c=s.querySelector('#stkStage'); return c?[c.width,c.height]:null; })(),
    /* ⚠ 量**CSS 盒子**而不是 canvas 的 width/height 属性：画布属性现在等于成片
       的真实像素（最长 1280），"会不会把滑杆顶出屏幕"是 CSS 那层管的
       （.stkstage canvas 的 max-height）。属性与样式分家之后，
       断言必须指着真正决定布局的那个数。 */
    stageCss:(function(){ var c=s.querySelector('#stkStage');
      if(!c) return null; var r=c.getBoundingClientRect();
      return [Math.round(r.width),Math.round(r.height)]; })(),
    snd:!!s.querySelector('input[data-snd]'),
    cover:!!s.querySelector('input[data-k="book.coverNote"]'),
    back:!!s.querySelector('input[data-k="book.backNote"]'),
    grid:!!s.querySelector('.seg[data-k="book.layout"] button[data-v="grid"]')});
`);
chk(d1.btns === 8 && d1.nonblank === 8,
  'B2-26 面板上八枚贴纸小样都是真画出来的（不是空白按钮，也不是只有名字）',
  d1.btns + ' 枚 / 有内容 ' + d1.nonblank + ' 枚 · 覆盖率 ' + d1.pcts.join(',') + '%');
chk(d1.stage && d1.stageCss && d1.stageCss[1] <= 280,
  'B2-27 贴纸画布存在，且**显示**高度压在 280px 以内（不然滑杆被顶出屏幕）',
  d1.stageCss ? (d1.stageCss.join('×') + ' 显示 / ' + (d1.stageWH || []).join('×') + ' 像素')
              : '—');
chk(d1.snd && d1.cover && d1.back && d1.grid,
  'B2-28 面板上新增项齐全：音效开关 / 封面寄语 / 封底寄语 / 九宫格版式');

const d2 = await ev(`
  var L=window.LUMEN, st=L.state;
  st._stkIdx=0; L.renderPanel();
  var s=document.querySelector('#panel');
  var c0=L.stkCur(), n0=L.stickOf(c0.p).length;
  s.querySelector('.stks .stk[data-stk-add="star"]').click();
  await new Promise(function(r){ setTimeout(r,260); });
  var c=L.stkCur();
  /* ⚠ 这两个数必须**点完立刻**取。放在 return 里取的话，
     下面那段"点到上限"的循环已经跑完了，n1 会等于上限而不是 1 ——
     我第一次就是这么写的，于是"贴了一枚"被读成"贴了六枚"。 */
  var n1=L.stickOf(c.p).length;
  var caps=document.querySelectorAll('#panel .stklist .si').length;
  var selOn=document.querySelectorAll('#panel .stklist .si.on').length;
  var tries=0;
  for(var i=0;i<9;i++){
    var bt=document.querySelector('#panel .stks .stk[data-stk-add="heart"]');
    if(!bt) break;
    bt.click(); tries++;
    await new Promise(function(r){ setTimeout(r,90); });
  }
  var capped=L.stickOf(c.p).length;
  L.paintStkStage();
  return JSON.stringify({n0:n0, n1:n1, caps:caps, selOn:selOn,
    capped:capped, max:L.STK_MAX, kind:L.stickOf(c.p)[0].k,
    stageAlive:!!document.querySelector('#stkStage')});
`);
chk(d2.n1 === d2.n0 + 1 && d2.kind === 'star',
  'B2-29 点一枚贴纸就贴到当前这张上，并且新贴的那一枚变成"选中"',
  d2.n0 + ' → ' + d2.n1 + ' 枚');
chk(d2.caps === 1 && d2.selOn === 1,
  'B2-30 这张照片上已有贴纸会列成胶囊，且恰好一枚处于选中态');
chk(d2.capped === d2.max,
  'B2-31 一路点到上限就停住（不会超过 ' + d2.max + ' 枚把照片糊死）', '最终 ' + d2.capped + ' 枚');
chk(d2.stageAlive, 'B2-32 反复重渲染面板后贴纸画布仍在（画布是每次重建的，绑定不能挂在元素上）');

const d3 = await ev(`
  var L=window.LUMEN, st=L.state;
  var s=document.querySelector('#panel');
  s.querySelector('#stkDel').click();
  await new Promise(function(r){ setTimeout(r,200); });
  var afterDel=L.stickOf(L.stkCur().p).length;
  document.querySelector('#panel .stklist .si').click();
  await new Promise(function(r){ setTimeout(r,200); });
  var sel=st._stkSel;
  var sl=document.querySelector('#panel input[data-stk="x"]');
  var v0=sl.value;
  sl.value=String(Math.min(1,parseFloat(v0)+.2));
  sl.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(function(r){ setTimeout(r,200); });
  var s2=L.stickOf(L.stkCur().p)[sel];
  var readout=document.querySelector('#panel [data-stkval="x"]').textContent;
  var selOn=document.querySelectorAll('#panel .stklist .si.on')[0];
  var selIdx=selOn?parseInt(selOn.dataset.stkSel,10):-1;
  return JSON.stringify({afterDel:afterDel, sel:sel, v:parseFloat(v0), s2x:s2.x,
    readout:readout, selIdx:selIdx});
`);
chk(d3.afterDel === d2.max - 1, 'B2-33 「删掉这一枚」真的少一枚', d2.max + ' → ' + d3.afterDel);
chk(Math.abs(d3.s2x - (d3.v + .2)) < 1e-6 && d3.readout === d3.s2x.toFixed(2),
  'B2-34 拖滑杆改的是选中那一枚的数据，读数同步刷新（两处格式不会漂移）',
  'x=' + d3.s2x.toFixed(2) + ' 读数=' + d3.readout);
chk(d3.selIdx === d3.sel,
  'B2-35 点胶囊切换选中，滑杆跟着调的是新选中的那一枚', '选中 #' + d3.selIdx);

const d4 = await ev(`
  var L=window.LUMEN, st=L.state;
  var s=document.querySelector('#panel');
  var cv=s.querySelector('#stkStage');
  /* 面板可滚动，元素可能在视口外 —— 不 scrollIntoView 的话真实鼠标会点空 */
  cv.scrollIntoView({block:'center'});
  await new Promise(function(r){ setTimeout(r,300); });
  var r=cv.getBoundingClientRect();
  /* 面板画布画的是**成片**（含模版），照片在画布里只占一块矩形。
     手指想落在归一化 (.u,.v)，就得先把那块矩形算进去（两步换算）：
       客户端 px →（÷ 显示尺寸 × 画布 px）画布 px →（− 矩形原点）÷ 矩形尺寸 归一化
     老写法直接按"画布比例"点，等于把"画布"当成"照片" ——
     模版一内缩，手指和贴纸就分家了（用户报的第二个问题）。 */
  var rc=L.stkStageRect();
  function at(u,v){
    return {x:r.left+(rc.dx+u*rc.dw)/cv.width*r.width,
            y:r.top +(rc.dy+v*rc.dh)/cv.height*r.height};
  }
  var p=L.stkCur().p, before={x:L.stickOf(p)[st._stkSel].x, y:L.stickOf(p)[st._stkSel].y};
  function pd(t,pt){ cv.dispatchEvent(new PointerEvent(t,{bubbles:true,clientX:pt.x,clientY:pt.y,pointerId:7})); }
  pd('pointerdown', at(.78,.22));
  await new Promise(function(r2){ setTimeout(r2,150); });
  pd('pointermove', at(.18,.82));
  await new Promise(function(r2){ setTimeout(r2,150); });
  pd('pointerup', at(.18,.82));
  await new Promise(function(r2){ setTimeout(r2,260); });
  var sN=L.stickOf(p)[st._stkSel];
  var slx=document.querySelector('#panel input[data-stk="x"]');
  var sly=document.querySelector('#panel input[data-stk="y"]');
  return JSON.stringify({before:before, after:{x:sN.x,y:sN.y},
    slx:parseFloat(slx.value), sly:parseFloat(sly.value), box:[r.width,r.height],
    rect:[Math.round(rc.dx),Math.round(rc.dy),Math.round(rc.dw),Math.round(rc.dh)]});
`);
chk(Math.abs(d4.after.x - .18) < .06 && Math.abs(d4.after.y - .82) < .06,
  'B2-36 在画布上点/拖，贴纸挪到手指下（按「照片矩形」两步换算，不是按画布比例）',
  JSON.stringify(d4.after) + ' · 照片矩形 ' + d4.rect.join(','));
chk(Math.abs(d4.slx - d4.after.x) <= 0.011 && Math.abs(d4.sly - d4.after.y) <= 0.011,
  'B2-37 用画布挪完，下面两根滑杆跟着走（否则用户以为滑杆坏了）',
  '滑杆 ' + d4.slx.toFixed(2) + '/' + d4.sly.toFixed(2));

/* ===== 第十四轮修复：用户看出来的两个问题 =====
   ① 「添加甚至修改后，需要手动点击生成照片才有」
   ② 「贴纸修改的位置，在已有的照片显示那不同模版显示，对不上」

   两条其实是同一个根因：**贴纸锚在"画布"上，而不是锚在"照片"上**。
   "照片在画布里占哪一块"（内缩多少、被 cover 裁掉多少）只有渲染那一刻才知道，
   锚在画布上就必然：面板（照片铺满画布）与书页（模版把照片缩进版心）两处错位。

   所以这一组断言钉四件事，一件都不能省：
     · 坐标系本身：给定矩形，落点与大小只认矩形（白底 + 人造矩形，可证伪）
     · 真模版的矩形**确实互不相同** —— 这是"旧画法必然错"的证据，不是"理论上可能错"
     · 面板画布与成片走的是同一块矩形、同一份像素（所见即所得）
     · 「改完立刻生效」，并且配一条反向对照（不刷新就不变） */
const v1 = await ev(`
  var L=window.LUMEN;
  ${TOOLS}
  var W=800,H=800;
  function ink(rc){
    var c=document.createElement('canvas'); c.width=W; c.height=H;
    var g=c.getContext('2d');
    g.fillStyle='#fff'; g.fillRect(0,0,W,H);
    L.drawStickers(g,rc,[L.stkFix({k:'heart',x:.5,y:.5,s:1.6,text:''})],null);
    return window.__t.bbox(c,0,0,W,H,235);
  }
  function into(rc){
    var bb=ink(rc);
    var S=Math.min(rc.dw,rc.dh)*.20*1.6;       /* 贴纸基准尺寸 = 矩形短边 × 0.20 × s */
    var acx=rc.dx+.5*rc.dw, acy=rc.dy+.5*rc.dh;
    return {name:rc.name, n:bb.n, S:+S.toFixed(1),
      du:+(((bb.x0+bb.x1)/2-acx)/S).toFixed(4),   /* 墨迹中心相对锚点的偏移，按 S 归一化 */
      dv:+(((bb.y0+bb.y1)/2-acy)/S).toFixed(4),
      w:+((bb.x1-bb.x0)/S).toFixed(4), h:+((bb.y1-bb.y0)/S).toFixed(4)};
  }
  /* 三块"现实中模版真的会给出"的矩形：小内缩、大内缩 + 偏移、超出画布（cover 裁切） */
  var rects=[{name:'inset',   dx:80,  dy:60,  dw:600, dh:500},
             {name:'offset',  dx:300, dy:200, dw:400, dh:600},
             {name:'overflow',dx:-150,dy:-120,dw:900, dh:1000}];
  /* 纯平移对照：同一块矩形整体挪 (137,221) 像素，墨迹中心必须一模一样地挪同样多。
     为什么要这条：心形的墨**天生**比锚点低 0.086·S（字形本身不对称，见 _probe_glyph），
     所以"绝对居中"不是判定锚点的好标准（会把好代码判死），
     "矩形挪多少、墨迹就挪多少"才是 —— 它不依赖字形是否居中，又能把锚点公式钉死。 */
  var a={dx:80,dy:60,dw:600,dh:500}, b2={dx:80+137,dy:60+221,dw:600,dh:500};
  var ia=ink(a), ib=ink(b2);
  var sh={dx:+(((ib.x0+ib.x1)-(ia.x0+ia.x1))/2).toFixed(2),
          dy:+(((ib.y0+ib.y1)-(ia.y0+ia.y1))/2).toFixed(2)};
  return JSON.stringify({out:rects.map(into), shift:sh});
`);
const v1u = v1.out.map(o => o.du), v1v = v1.out.map(o => o.dv);
const v1w = v1.out.map(o => o.w), v1h = v1.out.map(o => o.h);
chk(v1.out.every(o => o.n > 200) && spread(v1u) < .01 && spread(v1v) < .01,
  'B2-38 贴纸的落点只认「照片矩形」：三块位置尺寸完全不同的矩形，墨迹中心相对锚点的偏移完全一致（按 S 归一化）',
  v1.out.map(o => o.name + ' du=' + o.du + ' dv=' + o.dv).join(' · '));
chk(v1.out.every(o => Math.abs(o.du) < .02),
  'B2-39 水平方向是真的落在矩形正中（心形左右对称，所以这条可以要求绝对居中；竖直方向天生偏心 0.086·S）',
  'du ' + v1u.join('/'));
chk(Math.abs(v1.shift.dx - 137) < 1 && Math.abs(v1.shift.dy - 221) < 1,
  'B2-40 纯平移对照：矩形整体挪 (137,221)，墨迹中心跟着挪 (137,221) —— 不靠"字形居中"也能把锚点公式钉死',
  JSON.stringify(v1.shift));
chk(spread(v1w) < .02 && spread(v1h) < .02,
  'B2-41 贴纸的大小也认「照片矩形」的短边（不是画布短边）—— 内缩小的模版里它跟着缩小，占短边的比例不变',
  '占矩形短边 宽 ' + v1w.map(v => (v * 100).toFixed(1) + '%').join('/') +
  ' · 高 ' + v1h.map(v => (v * 100).toFixed(1) + '%').join('/'));

const v2 = await ev(`
  var L=window.LUMEN, st=L.state;
  var p=st.photos[0], out={};
  ['magazine','polaroid','film'].forEach(function(k){
    if(!L.TPL[k]) return;
    var cv=L.renderCanvas(p,k,L.optsFor(p),st.spec.longEdge,true);
    var rc=cv.photoRect;
    out[k]={size:cv.width+'x'+cv.height,
      rect:[Math.round(rc.dx),Math.round(rc.dy),Math.round(rc.dw),Math.round(rc.dh)],
      fx:+((rc.dx/cv.width)*100).toFixed(1), fy:+((rc.dy/cv.height)*100).toFixed(1)};
  });
  return JSON.stringify(out);
`);
const v2k = Object.keys(v2).filter(k => k !== '__err');
const v2sig = v2k.map(k => v2[k].fx + ',' + v2[k].fy + ',' + v2[k].rect[2] + ',' + v2[k].rect[3]);
chk(v2k.length >= 3 && new Set(v2sig).size >= 3,
  'B2-42 不同模版把照片画在**不同**位置（这就是旧画法必然错位的证据，不是"理论上可能错"）',
  v2k.map(k => k + ' ' + v2[k].fx + '%/' + v2[k].fy + '% ' + v2[k].rect.join(',')).join(' · '));

const v3 = await ev(`
  var L=window.LUMEN, st=L.state;
  var p=st.photos[0];
  p.stickers=[L.stkFix({k:'heart',x:.5,y:.5,rot:0,s:1.4,text:''})];
  L.refreshStickerArt(p);
  st._stkIdx=0; st._stkSel=0;
  L.renderPanel();
  await new Promise(function(r){ setTimeout(r,300); });
  var cv=document.getElementById('stkStage');
  var g=st.generated.find(function(x){ return x.photoId===p.id; });
  var rect=L.stkStageRect(), artRect=g.art.photoRect;
  /* 面板画布除了「照片虚线」和「选中环」之外，必须与成片**逐像素相同** ——
     两条路都走 renderCanvas 的同一份输出，这才叫"所见即所得"。
     比"看起来差不多"强的地方在于：它同时钉住了"面板到底画没画模版"。 */
  var a=document.createElement('canvas'); a.width=g.art.width; a.height=g.art.height;
  var ax=a.getContext('2d'); ax.drawImage(g.art,0,0);
  var d1=ax.getImageData(0,0,a.width,a.height).data;
  var d2=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data;
  var diff=0,total=0,maxd=0;
  var S=Math.min(rect.dw,rect.dh)*.20*1.4;
  var acx=rect.dx+.5*rect.dw, acy=rect.dy+.5*rect.dh;
  for(var i=0;i<d1.length;i+=4){
    var j=i/4, px=j%cv.width, py=Math.floor(j/cv.width);
    if(Math.abs(px-rect.dx)<5||Math.abs(px-(rect.dx+rect.dw))<5||
       Math.abs(py-rect.dy)<5||Math.abs(py-(rect.dy+rect.dh))<5) continue;   /* 照片虚线 */
    if(Math.abs(px-acx)<S*1.7&&Math.abs(py-acy)<S*1.7) continue;             /* 选中环 */
    total++;
    var dd=Math.abs(d1[i]-d2[i])+Math.abs(d1[i+1]-d2[i+1])+Math.abs(d1[i+2]-d2[i+2]);
    if(dd>maxd) maxd=dd;
    if(dd>8) diff++;
  }
  return JSON.stringify({sameRect:rect.dx===artRect.dx&&rect.dy===artRect.dy&&
      rect.dw===artRect.dw&&rect.dh===artRect.dh,
    rect:[Math.round(rect.dx),Math.round(rect.dy),Math.round(rect.dw),Math.round(rect.dh)],
    stage:cv.width+'x'+cv.height, art:g.art.width+'x'+g.art.height,
    total:total, diff:diff, maxd:maxd});
`);
chk(v3.sameRect && v3.stage === v3.art,
  'B2-43 面板画布 = 这张照片的成片（同一尺寸、同一块「照片矩形」）',
  v3.stage + ' === ' + v3.art + ' · rect ' + v3.rect.join(','));
chk(v3.diff === 0 && v3.maxd <= 4,
  'B2-44 面板画布与成片**逐像素相同**（只差那道照片虚线和选中环）—— 预览里真的是带模版的照片',
  '掩掉虚线/环后 ' + v3.total + ' px，超过阈值的 ' + v3.diff + '，最大差 ' + v3.maxd);

/* —— 「改完立刻生效」：全程不点「生成成片」 ——
   ⚠ 检测器不能用 buildBookPages()：它每次新建约 40 张 880×1173 的画布，
   每 30ms 轮一次就能把主线程堵住 600ms 以上（实测 616/684ms），
   于是量到的"延迟"是**检测器的病**，不是产品的（一度把它误判成产品慢）。
   改用 BV.pages —— 那是阅读器**此刻真在显示**的那几页：
   既廉价（只哈希，不重排），证据也更硬（证明屏幕上换了，
   而不只是"再排一遍会不一样"）。 */
const DETECT = `
  /* 阅读器**此刻真在显示**的那几页：BV.pages 是画布数组、BV.kinds 是它们的类型
     （setPages 里就是这么存的，见 app.js）。取第一个内容页。
     不按 .no 找是因为画布上没带页码 —— 而"内容页的像素变了"已经够了。
     找不到就返回 null，让断言**报错**而不是假通过。 */
  function pageHash(){
    var ps=L.BV.pages||[], ks=L.BV.kinds||[];
    for(var i=0;i<ps.length;i++){ if(ks[i]==='content'&&ps[i]) return window.__t.hash(ps[i]); }
    return null;
  }
`;
const v4 = await ev(`
  var L=window.LUMEN, st=L.state;
  ${TOOLS}
  ${DETECT}
  var p=st.photos[0];
  st._stkIdx=0; st._stkSel=0;
  p.stickers=[];
  L.refreshStickerArt(p);
  var h0=pageHash();
  if(h0===null) return JSON.stringify({err:'阅读器里找不到内容页（检测器失效，不能让断言假通过）'});
  /* 别的照片的成片引用与像素留个底：用来证明"只重出了这一张" */
  var other=st.generated[1];
  var otherHash=window.__t.hash(other.art), otherRef=other.art;
  /* 里程碑：①这张照片的成片被换掉 ②书页拿到新页。用页面内时间戳量，
     不受轮询间隔与排版风暴影响。 */
  var g=st.generated.find(function(x){ return x.photoId===p.id; });
  var AR0=g.art, tArt=null, tSet=null, base=performance.now();
  var origSet=L.BV.setPages;
  L.BV.setPages=function(){ if(tSet===null) tSet=performance.now()-base; return origSet.apply(this,arguments); };
  (function beat(){ if(tArt===null && g.art!==AR0) tArt=performance.now()-base;
    if(performance.now()-base<2600) requestAnimationFrame(beat); })();
  var t0=performance.now();
  p.stickers=[L.stkFix({k:'ticket',x:.5,y:.5,rot:0,s:1.6,text:'KADA · 入场券'})];
  L.scheduleArt(p);                       /* 只改数据 + 安排重出，没有任何点击 */
  var ms=0, changed=false;
  while(ms<2600){
    await new Promise(function(r){ setTimeout(r,30); });
    ms=performance.now()-t0;
    if(pageHash()!==h0){ changed=true; break; }
  }
  var staleNow=L.bookStale();
  var otherUntouched=(other.art===otherRef)&&(window.__t.hash(other.art)===otherHash);
  L.BV.setPages=origSet;
  /* 反向对照：同样改数据，但**不安排刷新**（=修复之前的行为）→ 书页必须纹丝不动，
     连"这张成片被换掉"的检测器都不该响。没有这一条，"书页变了"有可能只是
     别的东西顺手把它重排了，而"够快"有可能只是检测器本来就没在测刷新。 */
  L.refreshStickerArt(p);
  var h1=pageHash(), AR1=g.art;
  p.stickers=[];
  await new Promise(function(r){ setTimeout(r,500); });
  var stillOld=(pageHash()===h1), artStill=(g.art===AR1);
  p.stickers=[L.stkFix({k:'heart',x:.5,y:.5,rot:0,s:1.4,text:''})];
  L.refreshStickerArt(p);
  return JSON.stringify({changed:changed, ms:Math.round(ms), staleNow:staleNow,
    tArt:tArt===null?null:Math.round(tArt), tSet:tSet===null?null:Math.round(tSet),
    otherUntouched:otherUntouched, stillOld:stillOld, artStill:artStill});
`);
chk(v4.changed, 'B2-45 贴上贴纸后**不点生成**，书页自己就变了（用户报的"要手动点生成"已修）',
  v4.ms + ' ms 内');
chk(v4.tArt !== null && v4.tArt < 500 && v4.tSet !== null && v4.tSet < 900,
  'B2-46 而且够快：换掉这张成片 / 书页拿到新页都在一秒内（页面内时间戳，不受轮询与排版影响）',
  '成片 ' + v4.tArt + 'ms · 书页 ' + v4.tSet + 'ms（去抖 120+40ms 计在内）');
chk(v4.staleNow === false,
  'B2-47 改完 bookStale() 立刻为假 —— 面板不会再亮「成片已过期」，导出也不会白重出 28 张');
chk(v4.otherUntouched,
  'B2-48 只重出**这一张**：别的照片的成片对象与像素一个都没动（不是偷偷全量 generate）');
chk(v4.stillOld,
  'B2-49 反向对照：只改数据、不安排刷新时书页纹丝不动（证明上一条的"变了"确实是刷新带来的）');
chk(v4.artStill,
  'B2-50 反向对照的另一半：不安排刷新时，"这张成片被换掉"的检测器也不响（证明它测的是刷新，不是时间）');

const v5 = await ev(`
  var L=window.LUMEN, st=L.state;
  ${TOOLS}
  ${DETECT}
  var p=st.photos[0];
  st._stkIdx=0; st._stkSel=0;
  p.stickers=[L.stkFix({k:'heart',x:.5,y:.5,rot:0,s:1.6,text:''})];
  L.scheduleArt(p);                    /* 先把"有贴纸"这一版排进书页，再量删除 */
  await new Promise(function(r){ setTimeout(r,600); });
  L.renderPanel();                     /* 让 #panel 里那颗「清空这一张」确实在 */
  await new Promise(function(r){ setTimeout(r,200); });
  var h0=pageHash();
  if(h0===null) return JSON.stringify({err:'阅读器里找不到内容页（检测器失效）'});
  var btn=document.querySelector('#panel #stkClr');
  if(!btn) return JSON.stringify({err:'没找到「清空这一张」'});
  btn.click();                          /* 真实按钮：删贴纸也要立刻生效 */
  var ms=0, changed=false, t0=performance.now();
  while(ms<2600){
    await new Promise(function(r){ setTimeout(r,30); });
    ms=performance.now()-t0;
    if(pageHash()!==h0){ changed=true; break; }
  }
  return JSON.stringify({changed:changed, ms:Math.round(ms), left:L.stickOf(p).length});
`);
chk(v5.changed && v5.left === 0,
  'B2-51 删光贴纸同样立刻反映到书页（删除也是"改了"的一种）', v5.ms + ' ms');

const d5 = await ev(`
  var L=window.LUMEN, st=L.state;
  var s=document.querySelector('#panel');
  function curName(){ return L.stkCur().p.name; }
  var n0=curName();
  s.querySelector('#stkFwd').click();
  await new Promise(function(r){ setTimeout(r,220); });
  var n1=curName(), selReset=st._stkSel;
  document.querySelector('#panel #stkBack').click();
  await new Promise(function(r){ setTimeout(r,220); });
  var n2=curName();
  /* 清空这一张 */
  var c=L.stkCur();
  c.p.stickers=[L.stkFix({k:'star',x:.5,y:.5,s:1,text:''}),L.stkFix({k:'heart',x:.4,y:.4,s:1,text:''})];
  L.renderPanel();
  await new Promise(function(r){ setTimeout(r,160); });
  var hasClr=!!document.querySelector('#panel #stkClr');
  document.querySelector('#panel #stkClr').click();
  await new Promise(function(r){ setTimeout(r,220); });
  var left=L.stickOf(L.stkCur().p).length;
  return JSON.stringify({n0:n0, n1:n1, n2:n2, selReset:selReset, left:left, hasClr:hasClr});
`);
chk(d5.n1 !== d5.n0 && d5.n2 === d5.n0,
  'B2-52 上一张 / 下一张切的是照片，且能切回来', [d5.n0, d5.n1, d5.n2].join(' → '));
chk(d5.selReset === 0, 'B2-53 换照片后"选中第几枚"重置（上一张的第 3 枚对新照片没有意义）');
chk(d5.left === 0, 'B2-54 「清空这一张」把当前照片的贴纸清干净');

const d6 = await ev(`
  var L=window.LUMEN, st=L.state;
  var s=document.querySelector('#panel');
  var c=L.stkCur();
  c.p.stickers=[L.stkFix({k:'doodle',x:.5,y:.5,s:1.6,text:'好喜欢这天'})];
  L.renderPanel();
  await new Promise(function(r){ setTimeout(r,200); });
  var inp=document.querySelector('#panel input[data-stk-text]');
  /* 在白底上画、量非白像素的宽度。**不能**在照片上量"暗像素"——
     示例素材本身就是深色渐变，包围盒永远是整张画布，
     于是"圈变宽了"和"圈一点没变"会量出同一个数（这个假通过真的发生过）。 */
  function doodleBox(txt){
    var W=900,H=700;
    var cv=document.createElement('canvas'); cv.width=W; cv.height=H;
    var g=cv.getContext('2d');
    g.fillStyle='#ffffff'; g.fillRect(0,0,W,H);
    /* 贴纸锚在「照片矩形」上（第十四轮），人造白底画布就是"照片铺满"的情形 */
    L.drawStickers(g,{dx:0,dy:0,dw:W,dh:H},[L.stkFix({k:'doodle',x:.5,y:.5,s:1.6,text:txt})],c.p);
    var d=g.getImageData(0,0,W,H).data;
    var minX=1e9,maxX=-1,n=0;
    for(var j=0;j<H;j++) for(var i=0;i<W;i++){
      var o=(j*W+i)*4;
      if(d[o]<230||d[o+1]<230||d[o+2]<230){ n++; if(i<minX)minX=i; if(i>maxX)maxX=i; }
    }
    return {n:n, w:maxX-minX};
  }
  var b1=doodleBox('好喜欢');
  var b2=doodleBox('好喜欢这一天呀');
  inp.value='好喜欢这一天呀';
  inp.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(function(r){ setTimeout(r,240); });
  var live=doodleBox('好喜欢这一天呀');
  var same=inp===document.querySelector('#panel input[data-stk-text]');
  /* 清空：用户把字删光是**主动**要一句都不写。
     以前 stkText 把空串当成"没设过"、退回默认值，于是删光了屏幕上那串字还在 ——
     而且他再没有任何办法把它去掉。这条就是这个坑的反面。 */
  var bEmpty0=doodleBox('');
  inp.value='';
  inp.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(function(r){ setTimeout(r,240); });
  var sNow=L.stickOf(c.p)[st._stkSel||0];
  var bEmpty=doodleBox(L.stkText(sNow));
  var rawText=sNow.text;
  c.p.stickers=[];
  return JSON.stringify({b1:b1, b2:b2, live:live, same:same, text:inp.value,
    bEmpty0:bEmpty0, bEmpty:bEmpty, rawText:rawText});
`);
/* 只比宽度。不拿"非白像素数"当第二个条件：字数多时 fitFont 会把字号缩小，
   于是字更多、墨点反而更少 —— 那是个会随机翻脸的假条件。 */
chk(d6.b2.w > d6.b1.w + 20,
  'B2-55 手写圈上的字越多，圈越宽（不是固定框）',
  d6.b1.w + 'px → ' + d6.b2.w + 'px（墨点 ' + d6.b1.n + ' → ' + d6.b2.n + '）');
chk(d6.live.w === d6.b2.w,
  'B2-56 改完文字后画面立刻跟上（输入事件真的重画了贴纸层，不只是改了数据）');
chk(d6.same, 'B2-57 输入文字时面板不会被重渲染（输入框不能失焦，打一个字光标就飞走）');
chk(d6.rawText === '',
  'B2-58 清空文字框 = 数据里真的存着空串（不回退成默认值）', 'text=' + JSON.stringify(d6.rawText));
chk(d6.bEmpty.w < d6.b1.w * .55 && d6.bEmpty.n < d6.b1.n,
  'B2-59 清空之后画面上真的没有字了（只剩一个小小的空手绘圈，墨点也更少）',
  d6.b1.w + 'px/' + d6.b1.n + ' 点（有字）→ ' + d6.bEmpty.w + 'px/' + d6.bEmpty.n + ' 点（无字）');

/* 反面对照：刚贴上来的日期戳，文字框里显示的必须就是它会画的那串 {date}，
   而且数据里存的是 dflt 而不是空串 —— 不然"没设过"和"清空"又混在一起了。 */
const d6b = await ev(`
  var L=window.LUMEN, st=L.state;
  var c=L.stkCur();
  c.p.stickers=[];
  L.renderPanel();
  await new Promise(function(r){ setTimeout(r,200); });
  document.querySelector('#panel .stks .stk[data-stk-add="stamp"]').click();
  await new Promise(function(r){ setTimeout(r,260); });
  var s=L.stickOf(L.stkCur().p)[0];
  var inp=document.querySelector('#panel input[data-stk-text]');
  var shown=inp?inp.value:null;
  var res={raw:s.text, shown:shown, txt:L.stkText(s),
    resolved:L.resolveTokens(L.stkText(s), L.stkCur().p)};
  L.stickOf(L.stkCur().p).splice(0,99);
  L.renderPanel();
  return JSON.stringify(res);
`);
chk(d6b.raw === '{date}' && d6b.shown === '{date}' && d6b.txt === '{date}',
  'B2-60 新贴的日期戳：数据 / 输入框 / 实际绘制三处都是同一个出厂值',
  JSON.stringify([d6b.raw, d6b.shown]));
chk(/^\d{4}/.test(d6b.resolved) && d6b.resolved.indexOf('{') < 0,
  'B2-61 而这个出厂值到了画面上就是真日期', d6b.resolved);

/* 两个文字类贴纸在同一张照片上互不干扰 */
const d6c = await ev(`
  var L=window.LUMEN, st=L.state;
  var c=L.stkCur();
  c.p.stickers=[L.stkFix({k:'doodle',x:.3,y:.4,s:1.4,text:'好喜欢这天'}),
                L.stkFix({k:'stamp',x:.7,y:.7,s:1.2,text:'{date}'})];
  L.renderPanel();
  await new Promise(function(r){ setTimeout(r,200); });
  /* 选中第 2 枚（戳），把它的字改成常量，第 1 枚（圈）不能被牵连 */
  var si=document.querySelectorAll('#panel .stklist .si')[1];
  si.click();
  await new Promise(function(r){ setTimeout(r,220); });
  var inp=document.querySelector('#panel input[data-stk-text]');
  var before=inp.value;
  inp.value='2026.01.01';
  inp.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(function(r){ setTimeout(r,240); });
  var arr=L.stickOf(c.p);
  var res={before:before, a:arr[0].text, b:arr[1].text, sel:st._stkSel};
  c.p.stickers=[];
  L.renderPanel();
  return JSON.stringify(res);
`);
chk(d6c.before === '{date}' && d6c.b === '2026.01.01' && d6c.a === '好喜欢这天',
  'B2-62 改第二枚贴纸的文字，第一枚的文字不受影响（改的是"选中那一枚"）',
  JSON.stringify([d6c.a, d6c.b]));

/* 存档 */
const d7 = await ev(`
  var L=window.LUMEN, st=L.state;
  st.book.coverNote='送给 2026 年的我们';
  st.book.backNote='愿你把每一个瞬间都留下来。';
  st.sound=false;
  var p=st.photos.filter(function(q){ return q.picked; })[0];
  p.stickers=[L.stkFix({k:'tape',x:.31,y:.27,s:1.4,text:''}),
              L.stkFix({k:'stamp',x:.7,y:.8,s:1.1,text:''})];
  var name=p.name;
  L.PERSIST.save();
  await new Promise(function(r){ setTimeout(r,520); });
  var raw=JSON.parse(localStorage.getItem(L.PERSIST.KEY)||'{}');
  return JSON.stringify({key:L.PERSIST.KEY, sound:raw.sound,
    cover:raw.book&&raw.book.coverNote, back:raw.book&&raw.book.backNote,
    n:(raw.assign&&raw.assign[name]&&raw.assign[name].stickers||[]).length,
    name:name});
`);
chk(d7.n === 2 && d7.key === 'lumen.prefs.v1',
  'B2-63 贴纸按照片名存进本机存档（同一张照片下次打开还贴着）',
  d7.name + ' → ' + d7.n + ' 枚');
chk(d7.sound === false && d7.cover === '送给 2026 年的我们' && !!d7.back,
  'B2-64 音效开关与双封面寄语一起进了存档');

/* 重新载入一次，验证真的读得回来 */
await b.goto(FILE, 2600);
await sleep(900);
const d8 = await ev(`
  ${TOOLS}
  await window.LUMEN.loadEmbedded(true);
  var L=window.LUMEN, st=L.state;
  await new Promise(function(r){ setTimeout(r,300); });
  var p=st.photos.filter(function(q){ return q.picked; })[0];
  var hit=st.photos.find(function(q){ return L.stickOf(q).length===2; });
  return JSON.stringify({sound:st.sound, cover:st.book.coverNote,
    stick:st.photos.reduce(function(n,q){ return n+L.stickOf(q).length; },0),
    hit:!!hit, x:hit?L.stickOf(hit)[0].x:null, back:!!st.book.backNote});
`);
chk(d8.stick === 2 && d8.hit && Math.abs(d8.x - .31) < 1e-6,
  'B2-65 刷新页面后贴纸连着位置一起回来了（不是只存了"有贴纸"这件事）',
  d8.stick + ' 枚');
chk(d8.sound === false && d8.cover === '送给 2026 年的我们' && d8.back,
  'B2-66 刷新后音效开关与寄语也在');

/* ================= E. 氛围音效 ================= */
const e1 = await ev(`
  var L=window.LUMEN, st=L.state;
  /* 上面刚刷新过页面，现在停在第 1 步（选片），面板里根本没有音效开关 ——
     不先回到第 2 步的话，下面取到的 cb 是 null，
     而报错会落在"读 checked"上，看起来像功能坏了，其实是没换页。 */
  if(!st.generated.length) await L.generate();
  for(var w=0;w<80;w++){ await new Promise(function(r){setTimeout(r,120);}); if(st.generated.length) break; }
  L.setStep(2);
  st.sound=true; L.renderPanel();
  await new Promise(function(r){ setTimeout(r,200); });
  var cb=document.querySelector('#panel input[data-snd]');
  var on0=cb.checked, api0=L.Sound.isOn();
  cb.checked=false; cb.dispatchEvent(new Event('input',{bubbles:true}));
  await new Promise(function(r){ setTimeout(r,160); });
  var offState=st.sound, api1=L.Sound.isOn();
  var topOff=document.querySelector('[data-a="sound"]').classList.contains('on');
  /* 关着的时候三声都不能抛错 —— 音频是装饰，绝不许打断交互 */
  var threw='';
  try{ L.Sound.swish(1); L.Sound.land(); L.Sound.pop(); }catch(e){ threw=String(e); }
  var top=document.querySelector('[data-a="sound"]');
  top.click();
  await new Promise(function(r){ setTimeout(r,160); });
  var back=st.sound;
  var cbNow=document.querySelector('#panel input[data-snd]');
  return JSON.stringify({on0:on0, api0:api0, offState:offState, api1:api1,
    topOff:topOff, threw:threw, back:back, cbNow:cbNow?cbNow.checked:null});
`);
chk(e1.on0 && e1.api0 && e1.offState === false && e1.api1 === false,
  'B2-67 面板开关真的改到了 state.sound，Sound.isOn() 跟着变');
chk(e1.topOff === false, 'B2-68 关掉之后顶栏那颗 ♪ 也灭了（两个开关是同一件事）');
chk(e1.threw === '', 'B2-69 关掉音效时三声调用都不抛错（不能因为静音就点不动）', e1.threw);
chk(e1.back === true && e1.cbNow === true,
  'B2-70 从顶栏打开，面板里的开关同步勾上（两处不会各说各话）');

/* ================= F. 九宫格小卡页 ================= */
const f1 = await ev(`
  var L=window.LUMEN, st=L.state;
  /* 书页排的是 state.generated 里 picked 的那些 —— 只改 photos 的 picked
     对页序没有影响，那样会量到"1 页、九格全空"，看起来像九宫格坏了。 */
  st.generated.forEach(function(g){ g.picked=true; });
  st.photos.forEach(function(p){ p.stickers=[]; });
  st.book.layout='grid'; st.book.art='plain'; st.book.cap='name';
  st.book.ratio='3:4';
  var n=st.generated.filter(function(g){ return g.picked; }).length;
  var r=L.buildBookPages();
  var content=r.pages.filter(function(p){ return p.kind==='content'; });
  var want=Math.ceil(n/9);
  var cv=content[0].canvas, x=cv.getContext('2d');
  var W=cv.width, H=cv.height;
  var PL=W*.098, PT=H*.082, PB=H*.104, colW=W-PL*2, gap=W*.030;
  var cellW=(colW-gap*2)/3, cellH=(H-PT-PB-gap*2)/3;
  function dark(x0,y0,w,h){
    var d=x.getImageData(Math.round(x0),Math.round(y0),Math.round(w),Math.round(h)).data,n=0;
    for(var i=0;i<d.length;i+=4){ if(d[i]<228||d[i+1]<228||d[i+2]<228) n++; }
    return n;
  }
  var grid=[];
  for(var j=0;j<3;j++){ var row=[];
    for(var i=0;i<3;i++){
      row.push(dark(PL+i*(cellW+gap)+10, PT+j*(cellH+gap)+8, cellW-20, cellW*.55));
    }
    grid.push(row);
  }
  /* 第四行必须是空的 —— 第一版把 R(i/3) 当成地板除，
     第 9 张被推到第四行（跑出版心），且"9 格里有 8 格有照片"很难一眼看出来。 */
  var row4=dark(PL+10, PT+3*(cellH+gap), cellW*3, 24);
  var cell8=grid[2][2];
  return JSON.stringify({per:L.perPage('grid'), pages:content.length, want:want,
    grid:grid, row4:row4, cell8:cell8, W:W, H:H});
`);
chk(f1.per === 9 && f1.pages === f1.want,
  'B2-71 九宫格每页 9 张，页数与 perPage 的推算一致（28 张 → 4 页）',
  f1.pages + ' 页 / 期望 ' + f1.want);
const flat = f1.grid.flat();
chk(flat.every(v => v > 300),
  'B2-72 一页九格**每一格**都有照片（不是 8 格）',
  flat.map(v => v > 300 ? '·' : '×').join(''));
chk(f1.row4 < 300,
  'B2-73 反面对照：第四行是空的 —— 第 9 格在第三行，没有跑到版心外面去', 'row4=' + f1.row4);

const f2 = await ev(`
  var L=window.LUMEN, st=L.state;
  function sig(){ var r=L.buildBookPages();
    return window.__t.hash(r.pages.filter(function(p){ return p.kind==='content'; })[0].canvas); }
  st.book.cap='name'; var a=sig();
  st.book.cap='none'; var b=sig();
  /* 用户自己写的那句话也得进得去九宫格 —— 只验"有图注 vs 没图注"是不够的，
     那只能证明"画了点什么"，证明不了"画的是他写的那句"。 */
  st.book.cap='note'; var c1=sig();
  st.photos[0].note='海边的下午'; var c2=sig();
  var per=[];
  ['full','two','sticker','grid'].forEach(function(k){ per.push([k,L.perPage(k)]); });
  st.photos[0].note='';
  return JSON.stringify({a:a, b:b, differ:a!==b, c1:c1, c2:c2, noteDiffer:c1!==c2, per:per});
`);
chk(f2.differ,
  'B2-74 九宫格里图注仍然画得出来（版式换了，用户写的那句话不能消失）');
chk(f2.noteDiffer,
  'B2-75 而且画的就是用户写的那句话（同一版式下，有文案 vs 没文案像素不同）');
chk(JSON.stringify(f2.per) === JSON.stringify([['full',1],['two',2],['sticker',1],['grid',9]]),
  'B2-76 perPage 是唯一的一处推算：full/two/sticker/grid → 1/2/1/9',
  JSON.stringify(f2.per));

const f3 = await ev(`
  var L=window.LUMEN;
  var bad=[];
  L.SKIN_ORDER.forEach(function(id){
    var s=L.SKINS[id], rec=s.rec||{};
    var used=[rec.layout].concat(rec.alts||[]);
    if(used.indexOf('grid')>=0) bad.push(id);
  });
  var m=L.MAT_ORDER.length;
  return JSON.stringify({bad:bad, layouts:L.LAYOUTS.map(function(a){ return a[0]; }),
    matCount:m});
`);
chk(f3.bad.length === 0,
  'B2-77 九宫格刻意不进任何「一键成书」的推荐版式（28 张排成 4 页是接触印相表，不是照片书）',
  '皮肤数=' + f3.bad.length + ' 处命中');
chk(f3.layouts.indexOf('grid') >= 0 && f3.layouts.length === 5,
  'B2-78 但它确实在「每页排布」的选项里（用户主动能挑到，只是不让"一键"替他决定）',
  f3.layouts.join('/'));

/* ================= G. 双封面寄语 =================
   量法：**差分量测 + 取最上面那一段连续带**。
   · 不能用"暗于某阈值的都算墨"：纸面自带材料纹理，条形码也是一片黑，
     阈值法会把它们全算成寄语，于是位置量不准、还会随材料变化而翻脸。
   · 也不能只做差分：封底的条形码是用 Math.random 画的（每渲染一次都不一样），
     差分图里会多出一大片"条形码"的影子，把寄语的包围盒一直撑到页脚。
     所以先差分、再取第一段连续带（允许 ≤6 行的缝隙）。 */
const g1 = await ev(`
  var L=window.LUMEN, st=L.state;
  var hw=880, hh=1320;
  function band(a,bq){
    var xa=a.getContext('2d').getImageData(0,0,a.width,a.height).data;
    var xb=bq.getContext('2d').getImageData(0,0,bq.width,bq.height).data;
    var W=a.width, H=a.height;
    var rows=new Array(H); for(var i=0;i<H;i++) rows[i]=0;
    var n=0;
    for(var p=0;p<W*H;p++){
      var o=p*4;
      if(Math.abs(xa[o]-xb[o])>10||Math.abs(xa[o+1]-xb[o+1])>10||Math.abs(xa[o+2]-xb[o+2])>10){
        n++; rows[(p-(p%W))/W]++;
      }
    }
    var y0=-1,y1=-1,gap=0;
    /* 允许的"行间空隙"要按页面高度取（3% 高 ≈ 39px）。
       一开始写的是 6px，而三行寄语的基线间距是 33px、字形之间会留 ~13 行空白，
       于是第一段带在第 1 行就断了 —— 量出来"长寄语还是一条 19px 高的单行"，
       差点被当成"没有换行"去改渲染代码。真正的换行间隔远小于
       寄语与条形码之间的空档（那里有 130+ 行），这个阈值两边都分得开。 */
    var MAXGAP=Math.max(6,Math.round(H*.03));
    for(var y=0;y<H;y++){
      if(rows[y]>0){ if(y0<0) y0=y; y1=y; gap=0; }
      else if(y0>=0){ gap++; if(gap>MAXGAP) break; }
    }
    if(y0<0) return {n:n,y0:-1,y1:-1,h:0,x0:-1,x1:-1};
    /* 只在这一带里找左右边界 */
    var minX=1e9,maxX=-1,bn=0;
    for(var yy=y0;yy<=y1;yy++) for(var xx=0;xx<W;xx++){
      var q=(yy*W+xx)*4;
      if(Math.abs(xa[q]-xb[q])>10||Math.abs(xa[q+1]-xb[q+1])>10||Math.abs(xa[q+2]-xb[q+2])>10){
        bn++; if(xx<minX)minX=xx; if(xx>maxX)maxX=xx;
      }
    }
    return {n:bn,total:n,y0:y0,y1:y1,h:y1-y0,x0:minX,x1:maxX};
  }
  st.book.coverNote=''; st.book.backNote='';
  var cb0=L.renderCover(hw,hh), bb0=L.renderBack(hw,hh);
  /* 反面对照一：封面不带随机元素，同样的设置渲染两次应当逐像素相同 ——
     有了这一条，"封面像素变了"才只能归因于寄语。 */
  var cbAgain=band(cb0,L.renderCover(hw,hh));
  /* 反面对照二：封底带随机条形码，两次渲染必然有差异 ——
     这正是上面必须取"第一段连续带"的原因。 */
  var bbAgain=band(bb0,L.renderBack(hw,hh));
  st.book.coverNote='送给 2026 年的我们';
  var cov=band(cb0,L.renderCover(hw,hh));
  st.book.backNote='愿你把每一个瞬间都留下来。';
  var one=band(bb0,L.renderBack(hw,hh));
  st.book.backNote='愿你把每一个瞬间都留下来。愿你在很多年以后翻到这一页，还能想起那个下午的风、那杯没喝完的咖啡、和身边那个正在笑的人，还有当时没说出口的那句谢谢。';
  var many=band(bb0,L.renderBack(hw,hh));
  st.book.coverNote=''; st.book.backNote='';
  return JSON.stringify({covAgain:cbAgain, backAgainH:bbAgain.h, backAgainTotal:bbAgain.total,
    cov:cov, one:one, many:many,
    barcodeTop:Math.round(hh*.700-hh*.026), hh:hh, hw:hw,
    /* 封面的**内容中轴**不是 W/2：左边有一条 W*.078 的书脊，
       面心被推到 (W+sw)/2 + W*.010 —— 寄语、书名、署名都排在这条轴上。
       拿 440 去比，量到的就是"设计本来就是这样"的偏移，不是错。 */
    coverAxis:Math.round((hw+hw*.078)/2+hw*.010)});
`);
chk(g1.covAgain.n === 0,
  'B2-79 反面对照：封面本身是确定性的 —— 同一设置渲染两次逐像素相同',
  '差异像素=' + g1.covAgain.n);
chk(g1.cov.n > 500 && g1.cov.y0 > g1.hh * .75 && g1.cov.y1 < g1.hh * .80,
  'B2-80 封面寄语画在主图与署名之间那块空白里',
  'y ' + g1.cov.y0 + '..' + g1.cov.y1 + '（页面高 ' + g1.hh + '）');
chk(Math.abs((g1.cov.x0 + g1.cov.x1) / 2 - g1.coverAxis) < 12,
  'B2-81 寄语居中 —— 对的是封面的内容中轴（书脊占了一条，不是 W/2）',
  '中心 x=' + ((g1.cov.x0 + g1.cov.x1) / 2).toFixed(0) + ' / 中轴 ' + g1.coverAxis);
chk(g1.backAgainH > 0,
  'B2-82 反面对照：封底重复渲染**会有**差异（条形码是随机的），所以量法必须取第一段带',
  '重复渲染差异高 ' + g1.backAgainH + 'px');
chk(g1.one.n > 100 && g1.one.y0 > g1.hh * .50 && g1.one.y1 < g1.barcodeTop,
  'B2-83 一句封底寄语落在 END OF VOLUME 之下、条形码上方',
  'y ' + g1.one.y0 + '..' + g1.one.y1 + ' < 条形码卡上沿 ' + g1.barcodeTop);
chk(g1.many.y1 < g1.barcodeTop,
  'B2-84 超长封底寄语被收在 3 行内，末行仍不压到条形码',
  '末行 y=' + g1.many.y1 + ' < ' + g1.barcodeTop);
chk(g1.many.h > g1.one.h * 1.5,
  'B2-85 长寄语真的排成了多行（不是被截成一行了事）',
  g1.one.h + 'px → ' + g1.many.h + 'px');
chk(g1.many.x1 - g1.many.x0 <= g1.hw * .80,
  'B2-86 三行的宽度都收在版心内（不贴到纸边）',
  (g1.many.x1 - g1.many.x0) + 'px / ' + g1.hw);

/* ================= H. 真实鼠标（CDP Input 域，不是合成事件） ================= */
/* 先把面板滚到贴纸那一段。面板是可滚动的，元素很可能在视口外 ——
   那样 getBoundingClientRect 给的是屏幕外的坐标，真实鼠标会点在空气上，
   而合成 click() 照样能过。这正是"合成事件全绿、真机点不动"的来源。 */
await ev(`
  var L=window.LUMEN, st=L.state;
  st.photos.forEach(function(p){ p.stickers=[]; });
  L.setStep(2); L.renderPanel();
  await new Promise(function(r){ setTimeout(r,400); });
  var s=document.querySelector('#panel .sec .stks')||document.querySelector('#panel .stks');
  if(s) s.scrollIntoView({block:'center'});
  await new Promise(function(r){ setTimeout(r,360); });
  return JSON.stringify({ok:1});
`);
const hBtn = await b.center('#panel .stks .stk[data-stk-add="heart"]');
chk(!!hBtn && hBtn.y > 0 && hBtn.y < 920,
  'B2-87 真实鼠标点击贴纸按钮前，按钮确实在视口里（滚到位了）',
  hBtn ? ('y=' + hBtn.y) : '找不到按钮');
if (hBtn) {
  await b.mouse('mouseMoved', hBtn.x, hBtn.y);
  await b.mouse('mousePressed', hBtn.x, hBtn.y);
  await b.mouse('mouseReleased', hBtn.x, hBtn.y);
  await sleep(460);
  const h2 = await ev(`
    var L=window.LUMEN;
    var c=L.stkCur();
    return JSON.stringify({n:L.stickOf(c.p).length, k:(L.stickOf(c.p)[0]||{}).k});
  `);
  chk(h2.n === 1 && h2.k === 'heart',
    'B2-88 真实鼠标点一枚贴纸就贴上去了（不是只有合成 click() 能用）',
    h2.n + ' 枚 ' + h2.k);

  /* 真实鼠标在贴纸画布上点一下 —— 画布会随面板重渲染被重建，
     所以这里必须重新取坐标，不能复用上一次的。 */
  const h3 = await ev(`
    var cv=document.querySelector('#stkStage');
    if(!cv) return JSON.stringify({err:'没有画布'});
    cv.scrollIntoView({block:'center'});
    await new Promise(function(r){ setTimeout(r,320); });
    var r=cv.getBoundingClientRect();
    return JSON.stringify({x:r.left+r.width*.70, y:r.top+r.height*.30, w:r.width, h:r.height});
  `);
  if (h3.err) {
    chk(false, 'B2-89 真实鼠标在贴纸画布上落点', h3.err);
  } else {
    const px = Math.round(h3.x), py = Math.round(h3.y);
    await b.mouse('mouseMoved', px, py);
    await b.mouse('mousePressed', px, py);
    await b.mouse('mouseReleased', px, py);
    await sleep(440);
    const h4 = await ev(`
      var L=window.LUMEN, st=L.state;
      var s=L.stickOf(L.stkCur().p)[st._stkSel||0];
      var slx=document.querySelector('#panel input[data-stk="x"]');
      return JSON.stringify({x:s.x, y:s.y, slx:slx?parseFloat(slx.value):null});
    `);
    chk(Math.abs(h4.x - .70) < .07 && Math.abs(h4.y - .30) < .07,
      'B2-90 真实鼠标点画布，贴纸挪到那个位置', '落点 ' + h4.x.toFixed(2) + '/' + h4.y.toFixed(2));
    chk(h4.slx != null && Math.abs(h4.slx - h4.x) <= 0.011,
      /* 容差取滑杆的步长（step=0.01），不是 1e-6：range 控件会把 value 吸附到最近的档，
         所以"滑杆 0.70 / 数据 0.6999"是正常现象，用 1e-6 比会把它报成失败。 */
      'B2-91 真实鼠标挪完之后滑杆也同步（容差=滑杆步长）',
      '滑杆 x=' + h4.slx + ' 数据 x=' + h4.x.toFixed(4));
  }
}

/* ========== I. 「照片矩形」是贴纸坐标系的地基（第十五轮 · 牛皮纸拖不动） ==========
   用户报：「这个牛皮纸，插入的贴纸无法往右以及往下拖拽」。

   根因**不在贴纸代码里**，而在一个中间量 —— 「照片矩形」：
   牛皮纸模版是 `translate(W/2,H*.45); rotate(-.028)` **之后**才 `c.paint(-pw/2,-ph/2,…)` 的，
   于是 drawFit 返回的矩形是**调用点的局部坐标**（改前实测 dx=-345.6、dy=-460.8，
   矩形有 3/4 落在画布外，中心正好压在画布左上角）。
   它却被当成「画布像素」用 → 拖拽换算 (px-rc.dx)/dw 得到**负数** → clamp(0,1) 夹回 0
   → 往右/往下**纹丝不动**，只有左上方向能拖。用户的症状一字不差。

   这一节钉的不变量是：「**照片矩形必须永远是画布坐标**」。
   关键：必须对**全部 11 个模版**成立，而不是"我盯着牛皮纸看了一眼"。
   上一轮就是只看了一眼，漏掉两个同源缺陷（下面两条的值都是 _iso_rect.mjs 实测的）：
     ① 双色 —— 它压根不调 c.paint（自己 makeDuotone + drawImage），没人申报，
        矩形退化成"整块画布" 0,0,960,1280，贴纸锚在画布中心而不是照片中心（偏 90px）；
     ② 九宫格 —— 它画 9 格，"面积最大者胜"用严格 `>`；九格的面积在**最后几位**上
        互不相同但差 <1e-6 px²，于是"比前者大亿分之几"的格子胜出，赢家由**舍入**决定：
        把 1e-6 容差拿掉，赢家就从 352.6,184 跳到 623.7,455（实测）。
        ⚠ 注意它**不是**"跑一次一个样"—— 同一份代码里连渲 12 次是同值的。
   —— 单看牛皮纸这两条都发现不了，只有"对每个模版都量一遍"才能把它们逼出来。 */

const R1 = await ev(`
  var L=window.LUMEN, st=L.state, p=st.photos[0];
  var out=[];
  Object.keys(L.TPL).forEach(function(k){
    var seen=[], cv=null, rc=null;
    for(var i=0;i<3;i++){
      cv=L.renderCanvas(p,k,L.optsFor(p),st.spec.longEdge,true);
      rc=cv.photoRect||null;
      if(!rc) return out.push({k:k,missing:true});
      seen.push([rc.dx,rc.dy,rc.dw,rc.dh]);
    }
    var W=cv.width, H=cv.height;
    /* 判据：矩形必须落在画布内。这条近乎废话 —— 但它恰好就是根因，
       而且对 11 个模版一视同仁，不依赖"我知道该看牛皮纸"。 */
    var inside = rc.dw>1 && rc.dh>1 &&
                 rc.dx>=-1 && rc.dy>=-1 &&
                 rc.dx+rc.dw<=W+1 && rc.dy+rc.dh<=H+1;
    /* 连渲 3 次必须逐字段（按位）相同。这条抓的是"重排一次书页纹理就闪一下"那类
       不确定来源（程序贴图误用 Math.random、或按渲染次序累加状态）。
       ⚠ 它**抓不到**九宫格那个平局 —— 平局在同一份代码里是确定的（实测改前连渲 12 次同值），
          只是赢家由 <1e-6 的舍入差决定。那一条由 B2-96 的定值断言负责。 */
    var same = seen.every(function(v){
      return v[0]===seen[0][0]&&v[1]===seen[0][1]&&v[2]===seen[0][2]&&v[3]===seen[0][3];
    });
    out.push({k:k, W:W, H:H, inside:inside, same:same,
      rc:[+rc.dx.toFixed(1),+rc.dy.toFixed(1),+rc.dw.toFixed(1),+rc.dh.toFixed(1)]});
  });
  /* 反面对照：把牛皮纸**改前**那个矩形喂给同一个判据，它必须被判为不合格。
     不做这一步的话，"全部合格"也可能只是判据压根抓不住东西。 */
  var old={dx:-345.6,dy:-460.8,dw:691.2,dh:921.6}, W0=960, H0=1280;
  var oldPassed = old.dx>=-1 && old.dy>=-1 && old.dx+old.dw<=W0+1 && old.dy+old.dh<=H0+1;
  return JSON.stringify({n:Object.keys(L.TPL).length, out:out, oldPassed:oldPassed});
`);
const rlist = (R1.out || []).filter(function(o){ return !o.missing; });
const rbad = rlist.filter(function(o){ return !o.inside; });
chk(rlist.length === R1.n && rbad.length === 0,
  'B2-92 全部 ' + R1.n + ' 个模版：照片矩形都落在画布内（矩形是"画布坐标"而不是"局部坐标"）',
  rbad.length ? ('越界：' + rbad.map(function(o){ return o.k + '=' + o.rc.join(','); }).join(' | '))
              : rlist.map(function(o){ return o.k + '=' + o.rc[2] + 'x' + o.rc[3]; }).join(' '));
chk(R1.oldPassed === false,
  'B2-93 反面对照：改前牛皮纸那个矩形（-345.6/-460.8）过不了同一条判据',
  '判据对旧值返回 ' + R1.oldPassed);
const rnondet = rlist.filter(function(o){ return !o.same; });
chk(rnondet.length === 0,
  'B2-94 连渲 3 次，11 个模版的矩形逐位相同（抓"重排一次就闪一下"那类不确定来源）',
  rnondet.length ? ('不稳定：' + rnondet.map(function(o){ return o.k; }).join(',')) : '11/11 稳定');

const duotone = rlist.filter(function(o){ return o.k === 'duotone'; })[0];
chk(!!duotone && duotone.inside && duotone.rc[2] < duotone.W * .95 && duotone.rc[3] < duotone.H * .80,
  'B2-95 双色：矩形是它自己申报的那个框，不是"整块画布"（改前是 0,0,960,1280，锚点偏 90px）',
  duotone ? ('rect=' + duotone.rc.join(',') + '  画布=' + duotone.W + 'x' + duotone.H) : '缺 duotone');

const g9 = rlist.filter(function(o){ return o.k === 'grid9'; })[0];
/* 九宫格的赢家**必须钉死在一个具体值上**，不能只查"是个格子"。
   实测（_iso_rect.mjs，四份产物对照）：把 1e-6 容差拿掉，赢家就从
   col1/row0 跳到 col2/row1 —— 九格的面积在**最后几位**上互不相同，
   但差别小于 1e-6 px²，严格 > 会让"比前者大亿分之几"的那一格胜出：
   赢家由**舍入**决定，不由设计决定。加了容差才变成"先来先得"。
   所以这个值是承重的：它一变动，就说明有人动了那条判据。 */
const G9_X = 352.6, G9_Y = 184, G9_D = 254.7;
chk(!!g9 && g9.inside && g9.same &&
    Math.abs(g9.rc[0] - G9_X) < 1 && Math.abs(g9.rc[1] - G9_Y) < 1 && Math.abs(g9.rc[2] - G9_D) < 1,
  'B2-96 九宫格：锚点钉在同一格（去掉 1e-6 容差它会跳到 623.7,455 —— 赢家不能被舍入决定）',
  g9 ? ('rect=' + g9.rc.join(',') + '  期望≈' + G9_X + ',' + G9_Y + ',' + G9_D) : '缺 grid9');

const post = rlist.filter(function(o){ return o.k === 'postcard'; })[0];
chk(!!post && post.rc[1] >= 0 && post.rc[1] + post.rc[3] <= post.H + 1,
  'B2-97 明信片：cover 溢出的那一圈不算照片（改前上沿 -158.4，贴纸会飘到照片外面）',
  post ? ('上沿 ' + post.rc[1] + '  下沿 ' + (post.rc[1] + post.rc[3]).toFixed(1) + ' / 画布高 ' + post.H) : '缺 postcard');

/* 改前 8 个有毛病的矩形，逐个当**回归基线**钉住 ——
   这些值全部来自 _iso_rect.mjs 的实测（不是推算），所以"一个都不复现"是有牙齿的。
   注意 magazine / film / titlecard 三个模版改前改后就一样（它们本来没病），
   所以这里刻意不放进来：放进来会变成"只要不一样就算过"，反而没意义。 */
const OLD_RECT = {
  kraft:    [-345.6, -460.8, 691.2, 921.6],   /* translate+rotate 之后的**局部坐标**被当画布坐标 */
  postcard: [52.8, -158.4, 854.4, 1139.2],    /* cover 溢出的那一圈被算成照片 */
  neon:     [101.8, 20.5, 756.5, 1008.6],     /* 同上 */
  minimal:  [192, 128, 576, 768],             /* 同上 */
  polaroid: [72, -2.9, 816, 1088],            /* 同上（只溢了 2.9px，几乎看不出来 —— 但也是错的） */
  cinematic:[0, 0, 960, 1280],                /* 同上 */
  duotone:  [0, 0, 960, 1280],                /* 压根不调 c.paint，没人申报 → 退化成整块画布 */
  grid9:    [255.8, 21.8, 407.6, 543.4],      /* 严格 > 的舍入裁决挑了另一格 */
};
const stillOld = [];
Object.keys(OLD_RECT).forEach(function(k){
  const o = rlist.filter(function(q){ return q.k === k; })[0];
  if (!o) { stillOld.push(k + '(缺)'); return; }
  const same = OLD_RECT[k].every(function(v, i){ return Math.abs(v - o.rc[i]) < .05; });
  if (same) stillOld.push(k);
});
chk(stillOld.length === 0,
  'B2-98 改前 8 个有毛病的模版矩形，一个都不复现（越界 / 溢出 / 退化 / 跳格 全消）',
  stillOld.length ? ('仍在旧值：' + stillOld.join(',')) :
    Object.keys(OLD_RECT).map(function(k){
      const o = rlist.filter(function(q){ return q.k === k; })[0];
      return k + ' ' + OLD_RECT[k].join(',') + '→' + o.rc.join(',');
    }).join('  '));

const kr = rlist.filter(function(o){ return o.k === 'kraft'; })[0];
chk(!!kr && kr.inside && Math.abs((kr.rc[0] + kr.rc[2] / 2) - kr.W / 2) < 6
        && Math.abs((kr.rc[1] + kr.rc[3] / 2) - kr.H * .45) < 6,
  'B2-99 牛皮纸：矩形中心回到它的版心（旋转下矩形中心不变，所以这条是精确的）',
  kr ? ('中心 ' + (kr.rc[0] + kr.rc[2] / 2).toFixed(1) + '/' + (kr.rc[1] + kr.rc[3] / 2).toFixed(1)
        + '  期望 ' + (kr.W / 2) + '/' + (kr.H * .45)) : '缺 kraft');

/* ---- 真实鼠标在牛皮纸上四向拖拽：这是用户报的那个操作本身 ---- */
const S1 = await ev(`
  var L=window.LUMEN, st=L.state, p=st.photos[0];
  p.tpl='kraft';   /* 面板认 p.tpl：stkBase 里 tplKey=TPL[p.tpl]?p.tpl:state.tpl */
  p.stickers=[L.stkFix({k:'heart',x:.5,y:.5,rot:0,s:1.2,text:''})];
  L.refreshStickerArt(p);
  st._stkIdx=st.photos.indexOf(p); st._stkSel=0;
  L.setStep(2); L.renderPanel();
  await new Promise(function(r){ setTimeout(r,520); });
  var cv=document.getElementById('stkStage');
  if(!cv) return JSON.stringify({err:'没有 #stkStage'});
  cv.scrollIntoView({block:'center'});
  await new Promise(function(r){ setTimeout(r,340); });
  var box=cv.getBoundingClientRect(), rc=L.stkStageRect();
  return JSON.stringify({rect:[+rc.dx.toFixed(1),+rc.dy.toFixed(1),+rc.dw.toFixed(1),+rc.dh.toFixed(1)],
                         box:[Math.round(box.width),Math.round(box.height)]});
`);
if (S1.err) {
  chk(false, 'B2-100 牛皮纸上真实鼠标四向拖拽', S1.err);
} else {
  /* 每次拖拽前都重新取坐标：面板会在改动后重渲染，#stkStage 会被重建，
     缓存的 box 会失效（点了空气 —— 又是"合成事件全绿、真机点不动"的老坑）。 */
  async function dragOn(u0, v0, u1, v1) {
    const q = await ev(`
      var cv=document.getElementById('stkStage');
      if(!cv) return JSON.stringify({err:'没有画布'});
      cv.scrollIntoView({block:'center'});
      await new Promise(function(r){ setTimeout(r,300); });
      var box=cv.getBoundingClientRect(), rc=window.LUMEN.stkStageRect();
      function at(u,v){ return {x:box.left+(rc.dx+u*rc.dw)/cv.width*box.width,
                               y:box.top +(rc.dy+v*rc.dh)/cv.height*box.height}; }
      return JSON.stringify({a:at(${u0},${v0}), z:at(${u1},${v1})});
    `);
    if (q.err) return q;
    const X = Math.round(q.a.x), Y = Math.round(q.a.y);
    const ZX = Math.round(q.z.x), ZY = Math.round(q.z.y);
    await b.mouse('mouseMoved', X, Y);
    await b.mouse('mousePressed', X, Y);
    /* 一步到位不算拖拽 —— 分步走，而且 buttons 必须显式带 1：
       cdp.mjs 的 mouseMoved 默认 buttons:0，中途会被当成"已经松开了"。 */
    for (let i = 1; i <= 6; i++) {
      await b.mouse('mouseMoved', Math.round(X + (ZX - X) * i / 6), Math.round(Y + (ZY - Y) * i / 6), { buttons: 1 });
      await sleep(16);
    }
    await b.mouse('mouseReleased', ZX, ZY);
    await sleep(340);
    return await ev(`
      var L=window.LUMEN;
      var s=L.stickOf(L.state.photos[0])[0];
      return JSON.stringify({x:s.x, y:s.y});
    `);
  }
  const DRAGS = [['往右', .30, .50, .85, .50], ['往左', .85, .50, .30, .50],
                 ['往下', .50, .30, .50, .85], ['往上', .50, .85, .50, .30],
                 ['右下方', .35, .35, .90, .90]];
  const got = [];
  for (const d of DRAGS) {
    const g = await dragOn(d[1], d[2], d[3], d[4]);
    got.push({name: d[0], tgt: [d[3], d[4]], g: g});
  }
  const miss = got.filter(function(o){
    return o.g.err || Math.abs(o.g.x - o.tgt[0]) > .08 || Math.abs(o.g.y - o.tgt[1]) > .08;
  });
  chk(miss.length === 0,
    'B2-101 牛皮纸：真实鼠标四向拖拽都落在瞄准处（用户报的就是"往右/往下拖不动"）',
    got.map(function(o){ return o.name + ' 瞄' + o.tgt[0] + '/' + o.tgt[1]
      + '→' + (o.g.err ? 'ERR' : o.g.x.toFixed(2) + '/' + o.g.y.toFixed(2)); }).join('  '));
  const onlyRightDown = got.filter(function(o){ return o.name === '往右' || o.name === '往下'; });
  chk(onlyRightDown.every(function(o){
      return !o.g.err && Math.abs(o.g.x - o.tgt[0]) <= .08 && Math.abs(o.g.y - o.tgt[1]) <= .08;
    }),
    'B2-102 单独点出"往右"和"往下"这两条 —— 改前它们一动不动（增量被 clamp 成 0）',
    onlyRightDown.map(function(o){ return o.name + ' 得到 ' + o.g.x.toFixed(2) + '/' + o.g.y.toFixed(2); }).join('  '));

  /* 贴纸在面板画布上被画在哪儿 —— 这是"拖不动"最直观的后果：
     改前 (.5,.5) 落点算出来是画布 x=-1.1（**贴在画布左边缘外面**，等于看不见），
     因为 rc.dx=-345.6 + .5*691.2 ≈ 0。这条断言就是"贴纸得在画布上"。 */
  const drawn = await ev(`
    var L=window.LUMEN, cv=document.getElementById('stkStage');
    var rc=L.stkStageRect(), s=L.stickOf(L.state.photos[0])[0];
    return JSON.stringify({px:rc.dx+s.x*rc.dw, py:rc.dy+s.y*rc.dh, W:cv.width, H:cv.height});`);
  chk(drawn.px > 1 && drawn.px < drawn.W - 1 && drawn.py > 1 && drawn.py < drawn.H - 1,
    'B2-103 面板上那枚贴纸真的画在画布上（改前它是画在 x=-1.1，贴在画布外面）',
    '落点 ' + drawn.px.toFixed(1) + ',' + drawn.py.toFixed(1) + '  画布 ' + drawn.W + 'x' + drawn.H);
}

console.log('');
console.log('合计 PASS ' + pass + ' / FAIL ' + fail);
await b.close();
process.exit(fail ? 1 : 0);
