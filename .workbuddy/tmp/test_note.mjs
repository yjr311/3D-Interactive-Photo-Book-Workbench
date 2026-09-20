import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

/* 第七轮 · 文案库与「每张照片一句话」
   ① 出厂默认就必须让文案看得见（默认 'name' 的话 = 功能白做）
   ② 没写文案时退回照片名 → 对老用户观感零变化
   ③ 占位符 {note} {mood} {date} 能解，且按照片各不不同
   ④ 改文案【不】需要重出成片（否则没人愿意写文案）
   ⑤ 文案按照片名持久化
   ⑥ 长文案不能顶出版心（自动缩字 + 截断）
   ⑦ 书页图注里的 {n} 是照片序号 —— 成片对象 id 是 'g0'，以前会静默全变成 1
   全部走页面内真实调用与真实像素统计，不 mock。 */
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';

const b = await launch({ port: 9461, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(900);

let pass = 0, fail = 0;
function chk(ok, name, extra) {
  if (ok) { pass++; console.log('PASS ' + name + (extra ? '  ' + extra : '')); }
  else { fail++; console.log('FAIL ' + name + (extra ? '  ' + extra : '')); }
}
/* 页面里的 async IIFE 统一走这个壳：自带 try/catch，报错也能看到栈，
   不用在外面猜 JSON.parse 收到的是字符串还是 {__err} 对象。 */
async function ev(body) {
  const raw = await b.evaluate(
    `(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const out = JSON.parse(raw);
  if (out && out.__err) console.log('  [page error] ' + out.__err);
  return out;
}

const prep = await ev(`
  await window.LUMEN.loadEmbedded(true);
  var st=window.LUMEN.state;
  window.LUMEN.setStep(2);
  await window.LUMEN.generate();
  await new Promise(function(r){ setTimeout(r,700); });
  return JSON.stringify({n:st.photos.length, gen:st.generated.length, cap:st.book.cap});
`);
if (prep.__err || !prep.n) { console.log('SETUP FAILED: ' + JSON.stringify(prep)); await b.close(); process.exit(1); }
console.log('  setup: ' + prep.n + ' 张 / 成片 ' + prep.gen + ' / 图注=' + prep.cap);

/* ---------- ① 默认值：文案必须能自动显示出来 ---------- */
chk(prep.cap === 'note',
  'N1 图注默认来源是「一句话」，不是「照片名」', 'cap=' + prep.cap);

const n1 = await ev(`
  var L=window.LUMEN, st=L.state;
  var g=st.generated[0], ph=L.photoOfIm(g);
  var before=L.captionOf(g);
  ph.note='今天的风刚刚好'; ph.mood='heal';
  var after=L.captionOf(g);
  ph.note=''; ph.mood='';
  var back=L.captionOf(g);
  return JSON.stringify({before:before, after:after, back:back, name:ph.name});
`);
chk(n1.before === n1.name && n1.back === n1.name,
  'N2 没写文案时图注退回照片名（老用户观感零变化）', 'caption=' + n1.before);
chk(n1.after === '今天的风刚刚好',
  'N3 写了文案，书页图注立刻变成那句话', 'caption=' + n1.after);

/* ---------- ② 占位符 ---------- */
const n2 = await ev(`
  var L=window.LUMEN, st=L.state;
  function setAll(fn){ st.photos.forEach(function(p,i){ if(p.picked) fn(p,i); }); }
  setAll(function(p,i){
    p.mood=['heal','vivid','sweet','artsy','fun','plain'][i%6];
    p.note='第 {n} / {total} 张 · {mood} · {date}';
  });
  var caps=st.generated.map(function(g){ return L.captionOf(g); });
  var uniq={}; caps.forEach(function(c){ uniq[c]=1; });
  var sample=caps.slice(0,3);
  var okAll=caps.every(function(c){ return c.indexOf('{')<0; });
  setAll(function(p){ p.note=''; p.mood=''; });
  return JSON.stringify({uniq:Object.keys(uniq).length, n:caps.length, sample:sample, okAll:okAll});
`);
chk(n2.okAll, 'N4 {n}/{total}/{mood}/{date} 在图注里全部解得开（不留生占位符）', n2.sample.join(' | '));
chk(n2.uniq === n2.n,
  'N5 同一条带占位符的文案套在全部照片上，每页的图注各不相同', n2.uniq + '/' + n2.n + ' 种');

const n3 = await ev(`
  var L=window.LUMEN, st=L.state;
  var p=st.photos[3];
  p.note='海边的下午'; p.mood='vivid';
  var o=L.optsFor(p);
  var title=window.LUMEN.resolveTokens('{note}', p);
  var mood=window.LUMEN.resolveTokens('{mood}', p);
  var date=window.LUMEN.resolveTokens('{date}', p);
  var g=st.generated.find(function(q){ return q.photoId===p.id; });
  var ordInCapt=L.ordinalOf(g);
  var ordInPhoto=L.ordinalOf(p);
  p.note=''; p.mood='';
  return JSON.stringify({title:title, mood:mood, date:date,
    dateLooks:/^\\d{4}\\.\\d{2}\\.\\d{2}$/.test(date),
    ordInCapt:ordInCapt, ordInPhoto:ordInPhoto, optKeys:Object.keys(o).indexOf('accent2')>=0});
`);
chk(n3.title === '海边的下午' && n3.mood === '元气',
  'N6 {note} / {mood} 在模版文字里也能用', '{note}=' + n3.title + ' {mood}=' + n3.mood);
chk(n3.dateLooks, 'N7 {date} 输出 2026.09.18 这种可读格式', n3.date);
chk(n3.ordInCapt === n3.ordInPhoto,
  'N8 成片对象和照片对象算出的序号一致（成片 id 是 g0，以前这里会静默变成 1）',
  'caption=' + n3.ordInCapt + ' photo=' + n3.ordInPhoto);

/* ---------- ③ 改文案不需要重出成片 ---------- */
const n4 = await ev(`
  var L=window.LUMEN, st=L.state;
  if(!st.generated.length) await L.generate();
  for(var i=0;i<80;i++){ await new Promise(function(r){setTimeout(r,120);}); if(st.generated.length) break; }
  var fresh=!L.bookStale();
  var sig0=L.bookSig();
  st.photos[0].note='改一句试试';
  var sig1=L.bookSig();
  var stale=L.bookStale();
  st.photos[0].note='';
  return JSON.stringify({fresh:fresh, sigSame:sig0===sig1, stale:stale});
`);
chk(n4.fresh && n4.sigSame && !n4.stale,
  'N9 改文案不算「成片过期」—— 文案只画在书页上，不用重出 28 张成片',
  '签名不变=' + n4.sigSame + ' 过期=' + n4.stale);

/* ---------- ④ 长文案不能顶出版心 ---------- */
const n5 = await ev(`
  var L=window.LUMEN, st=L.state;
  st.book.art='plain'; st.book.layout='mat'; st.book.cap='note';
  st.opts.title=''; st.opts.sub=''; st.opts.corner='';
  st.photos[0].note='今天也是被自己可爱到的一天真的非常非常非常开心啊啊啊啊';
  st.photos.forEach(function(p,i){ p.picked=(i===0); });
  var r=L.buildBookPages();
  var pg=r.pages[3].canvas, x=pg.getContext('2d');
  var W=pg.width, H=pg.height;
  var PL=W*.098, PR=W*.098, PB=H*.104;
  var capY=H-PB-W*.048;
  var y0=Math.round(capY-2), y1=Math.round(capY+W*.06);
  var d=x.getImageData(0,y0,W,y1-y0).data;
  var minX=1e9, maxX=-1, ink=0;
  for(var yy=0;yy<y1-y0;yy++){
    for(var xx=0;xx<W;xx++){
      var o=(yy*W+xx)*4;
      /* 纸面是 #fffdf8 级的浅色；暗于 200 就算墨 */
      if(d[o]<200||d[o+1]<200||d[o+2]<200){
        ink++; if(xx<minX) minX=xx; if(xx>maxX) maxX=xx;
      }
    }
  }
  /* 图注带里"有文案 vs 无文案"的实际像素差 —— 这才是"图注真的画出来了"的直接证据。
     只数墨点是不够的：印片本身就带墨、照片也在带里，一块照片就能凑够墨点数，
     于是"根本没画图注"会被误判成通过（这个假通过真的发生过）。 */
  var g0=st.generated[0];
  st.photos[0].note='';
  var pgA=L.renderContent([g0],3,W,H,'r');
  st.photos[0].note='今天也是被自己可爱到的一天真的非常非常非常开心啊啊啊啊';
  var pgC=L.renderContent([g0],3,W,H,'r');
  var dA=pgA.getContext('2d').getImageData(0,y0,W,y1-y0).data;
  var dC=pgC.getContext('2d').getImageData(0,y0,W,y1-y0).data;
  var bd=0, bdMax=0;
  for(var bi=0;bi<dA.length;bi+=4){
    var t=Math.abs(dA[bi]-dC[bi])+Math.abs(dA[bi+1]-dC[bi+1])+Math.abs(dA[bi+2]-dC[bi+2]);
    if(t>12) bd++; if(t>bdMax) bdMax=t;
  }
  /* 再试一句长得离谱的，看它会不会被截断在版心里 */
  st.photos[0].note='一句话可以写得很长很长很长很长很长很长很长很长很长很长很长很长很长';
  var r2=L.buildBookPages();
  var pg2=r2.pages[3].canvas, x2=pg2.getContext('2d');
  var d2=x2.getImageData(0,y0,W,y1-y0).data;
  var maxX2=-1, minX2=1e9;
  for(var yy2=0;yy2<y1-y0;yy2++){
    for(var xx2=0;xx2<W;xx2++){
      var o2=(yy2*W+xx2)*4;
      if(d2[o2]<200||d2[o2+1]<200||d2[o2+2]<200){
        if(xx2<minX2) minX2=xx2; if(xx2>maxX2) maxX2=xx2;
      }
    }
  }
  st.photos[0].note='';
  return JSON.stringify({ink:ink, minX:minX, maxX:maxX, PL:Math.round(PL), PRr:Math.round(W-PR),
    maxX2:maxX2, minX2:minX2, W:W, bd:bd, bdMax:bdMax, layout:st.book.layout, art:st.book.art});
`);
chk(n5.bd > 200, 'N10 图注真的画在书页上了（同页「有文案 vs 无文案」在图注带里有实际像素差，不是只数墨点）',
  '带内差异=' + n5.bd + ' 像素 · 最大通道差=' + n5.bdMax);
chk(n5.maxX <= n5.PRr + 2 && n5.minX >= n5.PL - 2,
  'N11 长文案被自动缩小到版心内（不越界）',
  'x∈[' + n5.minX + ',' + n5.maxX + '] 版心=[' + n5.PL + ',' + n5.PRr + ']');
chk(n5.maxX2 <= n5.PRr + 2 && n5.minX2 >= n5.PL - 2,
  'N12 长到离谱的文案被截断，仍然留在版心里',
  'x∈[' + n5.minX2 + ',' + n5.maxX2 + ']');

/* ---------- ④b 出厂默认组合（art='tpl'）下文案必须真的出现 ----------
   这是用户实际踩的那条路：默认书页画面 =「模版成品」，而模版的那行题字
   出厂内容是 `{name}`（照片名）—— 于是印片"有字"，但和图注**不是同一句话**。
   如果判据写成"印片有字就不画图注"，图注会在任何页面上都不出现：
   用户写了文案、选了文案，书上一个字都没有（用户原话：「选择了怎么显示出来没效果」）。 */
const n5b = await ev(`
  var L=window.LUMEN, st=L.state;
  var keep={art:st.book.art, layout:st.book.layout, cap:st.book.cap};
  st.book.art='tpl'; st.book.layout='mat'; st.book.cap='note';
  var g=st.generated[0], ph=L.photoOfIm(g);
  var W=620,H=820, PB=H*.104;
  var capY=H-PB-W*.048, cs=16;
  var yA=Math.round(capY-cs*0.9), yB=Math.round(capY+cs*2.0);
  function bandDiff(note){
    ph.note=''; var a=L.renderContent([g],3,W,H,'r');
    ph.note=note; var c=L.renderContent([g],3,W,H,'r');
    var da=a.getContext('2d').getImageData(0,yA,W,yB-yA).data;
    var dc=c.getContext('2d').getImageData(0,yA,W,yB-yA).data;
    var n=0;
    for(var i=0;i<da.length;i+=4){
      if(Math.abs(da[i]-dc[i])+Math.abs(da[i+1]-dc[i+1])+Math.abs(da[i+2]-dc[i+2])>12) n++;
    }
    return n;
  }
  /* ① 出厂设置：印片写着照片名，用户写的是另一句话 → 必须画 */
  var keepTitle=st.opts.title;
  var bd=bandDiff('无题，但很喜欢');
  var draw=L.capWillDraw(g);
  var plateTitle=g.title, name=ph.name;
  /* ② 印片自己就写着那句话（opts.title 用 {note}）→ 同一句话，不重复 */
  ph.note='无题，但很喜欢'; st.opts.title='{note}';
  var sameHas=L.plateHasText(g), sameDraw=L.capWillDraw(g);
  /* ③ 图注来源 = 照片名 → 与印片题字同一句话 → 不重复 */
  st.opts.title='{name}'; st.book.cap='name';
  var nameDraw=L.capWillDraw(g);
  st.opts.title=keepTitle; st.book.cap=keep.cap;
  st.book.art=keep.art; st.book.layout=keep.layout; ph.note='';
  return JSON.stringify({bd:bd, draw:draw, plateTitle:plateTitle, name:name,
    sameHas:sameHas, sameDraw:sameDraw, nameDraw:nameDraw, yA:yA, yB:yB});
`);
chk(n5b.draw === true && n5b.bd > 100,
  'N21 出厂默认（书页画面=模版成品、印片题字=照片名）下写文案 → 图注必须真的画出来',
  'capWillDraw=' + n5b.draw + ' 带内差异=' + n5b.bd + ' 像素（印片题字「' + n5b.plateTitle + '」≠ 文案）');
chk(n5b.sameHas === true && n5b.sameDraw === false,
  'N22 印片自己就写着那句话时（模版文字用 {note}）→ 不重复画图注（同一信息不出现两次）');
chk(n5b.nameDraw === false,
  'N23 图注来源选「照片名」时，与印片题字是同一句话 → 正确地不重复');
chk(n5b.bd > 0 && n5b.yB > n5b.yA, 'N24 图注落在版心底部的图注带里（y=' + n5b.yA + '..' + n5b.yB + '）');

/* ---------- ④c 四个版式都得让文案有地方出现 ----------
   「满版出血」原本整段没有画图注的代码路径 —— 用户写了文案、又选了满版，
   那句话在整本书里一个字都不会出现。改版式就看不见自己的文案是不可接受的。 */
const n5c = await ev(`
  var L=window.LUMEN, st=L.state;
  var keep={art:st.book.art, layout:st.book.layout, cap:st.book.cap};
  st.book.art='tpl'; st.book.cap='note';
  var g=st.generated[0], ph=L.photoOfIm(g);
  var W=620,H=820;
  function whole(layout){
    st.book.layout=layout;
    ph.note=''; var a=L.renderContent([g],3,W,H,'r');
    ph.note='无题，但很喜欢'; var c=L.renderContent([g],3,W,H,'r');
    var da=a.getContext('2d').getImageData(0,0,W,H).data;
    var dc=c.getContext('2d').getImageData(0,0,W,H).data;
    var n=0, minY=1e9, maxY=-1;
    for(var y=0;y<H;y++) for(var x=0;x<W;x++){
      var o=(y*W+x)*4;
      if(Math.abs(da[o]-dc[o])+Math.abs(da[o+1]-dc[o+1])+Math.abs(da[o+2]-dc[o+2])>12){
        n++; if(y<minY) minY=y; if(y>maxY) maxY=y;
      }
    }
    return {n:n, minY:minY, maxY:maxY, draw:L.capWillDraw(g)};
  }
  var out={};
  ['mat','two','sticker','full'].forEach(function(ly){ out[ly]=whole(ly); });
  st.book.art=keep.art; st.book.layout=keep.layout; st.book.cap=keep.cap; ph.note='';
  return JSON.stringify({out:out, H:H});
`);
let layoutOK = true;
const layoutDetail = [];
for (const ly of Object.keys(n5c.out)) {
  const o = n5c.out[ly];
  const inLower = o.maxY > n5c.H * 0.60;   // 图注在页面的下半部分
  if (!o.draw || !(o.n > 100) || !inLower) layoutOK = false;
  layoutDetail.push(ly + ':差异' + o.n + ' y≤' + o.maxY);
}
chk(layoutOK, 'N25 四个版式（留白/双联/贴纸/满版出血）下文案都真的画出来了，且落在页面下部',
  layoutDetail.join(' '));

/* ---------- ⑤ 真实点击路径 + 持久化 ---------- */
const n6 = await ev(`
  var L=window.LUMEN, st=L.state;
  L.setStep(2);
  await new Promise(function(r){ setTimeout(r,300); });
  st.photos.forEach(function(p,i){ p.picked=(i<6); });
  st.photos.forEach(function(p){ p.note=''; p.mood=''; });
  L.state._noteIdx=0;
  L.renderPanel();
  await new Promise(function(r){ setTimeout(r,200); });
  var before=L.noteCur();
  var btn=document.querySelector('.note[data-note]');
  var hadBtn=!!btn;
  var txt=btn?btn.dataset.note:'';
  btn.click();
  await new Promise(function(r){ setTimeout(r,260); });
  var after=L.noteCur();
  var moods=document.querySelectorAll('.chip[data-mood]').length;
  var notes=document.querySelectorAll('.note[data-note]').length;
  return JSON.stringify({hadBtn:hadBtn, txt:txt, moods:moods, notes:notes,
    photo:before.p.name, setOn:txt,
    curNote:st.photos[0].note, curMood:st.photos[0].mood,
    jumped:after.i, sameName:after.p.name===before.p.name});
`);
chk(n6.hadBtn && n6.moods === 6 && n6.notes >= 6,
  'N13 文案面板渲染出 6 个心情分组与候选句',
  '心情=' + n6.moods + ' 句子=' + n6.notes);
chk(n6.curNote === n6.setOn && n6.curMood !== '',
  'N14 点一句文案 → 落到当前照片上，并记下心情标签',
  '「' + n6.curNote + '」心情=' + n6.curMood);
chk(n6.jumped === 1 && !n6.sameName,
  'N15 挑完自动跳到下一张（一张一张过不用手点）',
  'idx 0 -> ' + n6.jumped);

const n7 = await ev(`
  var L=window.LUMEN, st=L.state;
  var btn=document.getElementById('noteAll');
  var had=!!btn;
  if(btn) btn.click();
  await new Promise(function(r){ setTimeout(r,260); });
  var picked=st.photos.filter(function(p){ return p.picked; });
  var withNote=picked.filter(function(p){ return !!p.note; }).length;
  var first=picked[0].note;
  L.PERSIST.flush();
  return JSON.stringify({had:had, withNote:withNote, picked:picked.length,
    first:first, name:picked[0].name, mood:picked[0].mood});
`);
chk(n7.had && n7.withNote === n7.picked && n7.withNote > 1,
  'N16「套给全部」把所有入册照片都写上这句',
  n7.withNote + '/' + n7.picked + ' 张');

await b.goto(FILE, 2600);
await sleep(1400);
/* ⚠ 刷新后照片本来就不会自动回来（首屏刻意留空是产品决定），
   所以「文案有没有存住」必须先把照片导回来再看 —— 文案是按照片名存的。 */
const n8 = await ev(`
  var L=window.LUMEN, st=L.state;
  var emptyOnBoot = st.photos.length;
  await L.loadEmbedded(true);
  var p=st.photos.find(function(q){ return q.note; });
  return JSON.stringify({emptyOnBoot:emptyOnBoot,
    name:p?p.name:'', note:p?p.note:'', mood:p?p.mood:'',
    want:${JSON.stringify(n7.first)}, wantName:${JSON.stringify(n7.name)}});
`);
chk(n8.emptyOnBoot === 0,
  'N17 刷新后首屏仍然是空的（照片不会自动加载）', 'boot photos=' + n8.emptyOnBoot);
chk(n8.note === n8.want && n8.mood,
  'N18 重新导入后，文案与心情按照片名接回来', n8.name + ' → 「' + n8.note + '」/' + n8.mood);

const n9 = await ev(`
  var L=window.LUMEN, st=L.state;
  /* 「清空全部」在选片成书面板里，先切过去 */
  L.setStep(2);
  await new Promise(function(r){ setTimeout(r,300); });
  var before=st.photos.filter(function(q){ return q.note; }).length;
  var btn=document.getElementById('noteClear');
  var had=!!btn;
  if(btn) btn.click();
  await new Promise(function(r){ setTimeout(r,300); });
  var after=st.photos.filter(function(q){ return q.note; }).length;
  return JSON.stringify({had:had, before:before, after:after, n:st.photos.length});
`);
chk(n9.had && n9.before > 0 && n9.after === 0,
  'N19「清空全部」真的清干净了', n9.before + ' -> ' + n9.after);

/* ---------- ④d 图注用的到底是哪款中文字 ----------
   这一层以前是"隐形的"：体系里没有 web 字体（单文件 / 离线 / file://），
   中文字族只能从系统里找；浏览器遇到缺字族**不报错**，直接静默降级
   （中文机上多半是黑体）。于是同一份文件、同一行代码，开发机落到宋体、
   用户机落到黑体 —— 用户报的「显示的字体太板正了 …… 还跟右边显示的字体
   不一样」就是这件事：左边中文落到黑体，右边拉丁走 Georgia，一眼两个世界。
   所以图注另起了 cap 字族，并且开机用位图把候选逐个验一遍。
   下面这几项就是让"实际用了哪一款"变成可验证的事实。
   注意 bmp() 只哈希**墨的外框**：同一款字族、不同 baseline 度量会让整幅
   哈希都不同，裁到外框比的才是字形，不是度量。 */
const nf = await ev(`
  var L=window.LUMEN;
  function bmp(text, fam){
    var c=document.createElement('canvas'); c.width=620; c.height=96;
    var x=c.getContext('2d');
    x.fillStyle='#fff'; x.fillRect(0,0,620,96);
    x.fillStyle='#000'; x.font='44px '+fam; x.textBaseline='middle';
    x.fillText(text,10,48);
    var d=x.getImageData(0,0,620,96).data;
    var minX=1e9,maxX=-1,minY=1e9,maxY=-1;
    for(var y=0;y<96;y++) for(var xx=0;xx<620;xx++){
      var o=(y*620+xx)*4;
      if(d[o]<200){ if(xx<minX)minX=xx; if(xx>maxX)maxX=xx; if(y<minY)minY=y; if(y>maxY)maxY=y; }
    }
    if(maxX<0) return 'blank';
    var h=0;
    for(var y2=minY;y2<=maxY;y2++) for(var x2=minX;x2<=maxX;x2++){
      h=(h*31 + d[(y2*620+x2)*4])>>>0;
    }
    return h+':'+(maxX-minX+1)+'x'+(maxY-minY+1);
  }
  var CJK='拍照的人先笑一个';
  return JSON.stringify({
    miss:L.fontOK('__lumen_missing__'),
    capCJK:L.capCJK,
    capOK:L.capCJK?L.fontOK(L.capCJK):false,
    capStack:FONTS.cap, serifStack:FONTS.serif,
    georgia:bmp('Lumen 08','Georgia'),
    capLat:bmp('Lumen 08',FONTS.cap),
    capCJKb:bmp(CJK,FONTS.cap),
    serifCJKb:bmp(CJK,FONTS.serif),
    yaheiCJKb:bmp(CJK,'"PingFang SC","Microsoft YaHei",sans-serif')
  });
`);

chk(nf.miss === false,
  'N26 字族探测能说「没有」（反向对照 —— 恒真的探测等于没探测）',
  '对不存在的字族返回 ' + nf.miss);

chk(!!nf.capCJK && nf.capOK === true,
  'N27 图注的中文字族在这台机器上确实装了（否则浏览器会静默换成黑体）',
  'capCJK=' + (nf.capCJK || '(无 —— 宋/楷/仿宋都没有)') + '  cap=' + nf.capStack);

chk(nf.capCJKb !== nf.yaheiCJKb,
  'N28 图注的中文没有落到黑体（「板正」的来源）',
  'cap=' + nf.capCJKb + '  雅黑=' + nf.yaheiCJKb);

chk(nf.capLat === nf.georgia,
  'N29 图注的拉丁仍然是 Georgia（右页那行「跟右边不一样」的另一半，不能改坏）',
  'cap=' + nf.capLat);

chk(nf.capCJKb !== nf.serifCJKb,
  'N30 图注与标题是两个字族（图注是正文、标题是题字；否则这一层等于没做）',
  'cap=' + nf.capCJKb + '  serif=' + nf.serifCJKb);

const panelTxt = await b.evaluate(`(function(){
  var el=document.querySelector('#panel')||document.body;
  return el.innerText.replace(/\\s+/g,' ');
})()`);
const capLabel = await b.evaluate('String(window.LUMEN.capLabel||"")');
chk(!!nf.capCJK && (String(panelTxt).indexOf(nf.capCJK) >= 0 || (!!capLabel && String(panelTxt).indexOf(capLabel) >= 0)),
  'N31 面板把实际用到的图注字族写出来（不然"落到黑体"对两边都是隐形的）',
  '面板里找 ' + nf.capCJK + ' / ' + capLabel);

/* ---------- ⑥ 老存档迁移 ---------- */
await b.evaluate(`(function(){
  localStorage.setItem('lumen.prefs.v1', JSON.stringify({
    opts:{title:'{name}',sub:'',corner:'',accent:'#e08a3c',font:'sans'},
    book:{title:'光匣',paper:'#fffdf8',ink:'#2b2620',layout:'mat',art:'tpl',
          num:true,spread:true,cap:'name',speed:2,coverIdx:0},
    assign:{}
  }));
  return 1;
})()`);
await b.goto(FILE, 2600);
await sleep(1300);
const n10 = await ev(`
  var L=window.LUMEN;
  return JSON.stringify({cap:L.state.book.cap, skin:L.state.skin});
`);
chk(n10.cap === 'note',
  'N20 老存档里图注还是旧的 name 默认值 → 迁到 note（否则老用户永远看不到文案）',
  'cap=' + n10.cap);

const errs = await b.evaluate('JSON.stringify(window.__errs||[])');
console.log('\n--- JS 异常: ' + (errs === '[]' ? 'none' : errs));
console.log('--- 失败项: ' + fail + ' / ' + (pass + fail));
await b.close();
process.exit(fail ? 1 : 0);
