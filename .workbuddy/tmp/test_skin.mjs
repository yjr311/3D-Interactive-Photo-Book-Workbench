import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

/* 第七轮 · 氛围皮肤
   ① 出厂皮肤 'studio' 的观感必须和加皮肤之前一模一样（默认不能被改坏）
   ② 换氛围要同时改到「模版印片」和「书页/书封」两处，不能只改一边
   ③ 色调归属要正确：霓虹/胶片/宽银幕 不能被套上浅色纸；牛皮纸走自己的棕
   ④ 皮肤真的改变了成片像素，也能触发「成片已过期」
   ⑤ 持久化：换过氛围，刷新后还在
   ⑥ 工作台强调色 / 圆角跟着氛围走，且亮色主题用另一档色值
   全部走页面内真实调用与真实像素统计，不 mock。 */
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';

const b = await launch({ port: 9437, windowSize: '1400,920' });
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

/* ---------- ① 出厂皮肤不能被改坏 ---------- */
const s0 = JSON.parse(await b.evaluate(`JSON.stringify((function(){
  var L=window.LUMEN, st=L.state, sk=L.skinCfg();
  var p=st.photos[0];
  var o=L.optsFor(p);
  return {skin:st.skin, n:L.SKIN_ORDER.length,
    tplPaper:sk.tplPaper, tplInk:sk.tplInk, accent:sk.accent,
    oPaper:o.paper, oInk:o.ink, oAccent:o.accent, oAccent2:o.accent2,
    optPaper:st.opts.paper, optInk:st.opts.ink,
    bookPaper:st.book.paper, bookInk:st.book.ink, bookCover:st.book.cover};
})())`));
chk(s0.skin === 'studio', 'S1 出厂氛围是「原味」', 'skin=' + s0.skin);
chk(s0.n === 7, 'S2 一共 7 套氛围（1 套出厂 + 6 套可选）', 'n=' + s0.n);
chk(s0.tplPaper === '' && s0.tplInk === '' && s0.oPaper === '' && s0.oInk === '',
  'S3 原味的印片纸色/墨色留空 → 模版用自己的出厂色（默认观感不变）',
  'tplPaper="' + s0.tplPaper + '" oPaper="' + s0.oPaper + '"');
chk(s0.oAccent === '#e08a3c' && s0.oAccent2 === '',
  'S4 原味的强调色仍是 #e08a3c；accent2 留空 → 霓虹保持自己的双色',
  'accent=' + s0.oAccent + ' accent2="' + s0.oAccent2 + '"');
chk(s0.bookPaper === '#fffdf8' && s0.bookInk === '#2b2620' && s0.bookCover === '#e8e0d2',
  'S5 原味的书页与书封仍是出厂值',
  s0.bookPaper + ' / ' + s0.bookInk + ' / ' + s0.bookCover);

/* ---------- ② 换氛围要同时改两处 ---------- */
const s1 = JSON.parse(await b.evaluate(`JSON.stringify((function(){
  var L=window.LUMEN, st=L.state;
  L.applySkin('peach');
  var sk=L.skinCfg();
  var p=st.photos[0], o=L.optsFor(p);
  return {skin:st.skin, skPaper:sk.tplPaper, skBookPaper:sk.bookPaper, skCover:sk.cover,
    oPaper:o.paper, oInk:o.ink, oAccent:o.accent, oAccent2:o.accent2,
    bookPaper:st.book.paper, bookInk:st.book.ink, bookCover:st.book.cover};
})())`));
chk(s1.skin === 'peach', 'S6 applySkin 把当前氛围切成蜜桃气泡', 'skin=' + s1.skin);
chk(s1.oPaper === s1.skPaper && s1.oInk !== '',
  'S7 模版印片拿到了蜜桃的纸色与墨色（不是空串 → 真的被派生出来）',
  'oPaper=' + s1.oPaper + ' oInk=' + s1.oInk);
chk(s1.bookPaper === s1.skBookPaper && s1.bookCover === s1.skCover,
  'S8 书页底色与书封一起改了（只改一边就会出现「书页变粉、印片还是米色」的割裂）',
  'book=' + s1.bookPaper + ' / ' + s1.bookCover);
/* 书页纸必须比印片纸深一档，否则「印片裱在纸上」的层次没了，各套氛围也看不出区别。
   原味是刻意留白的例外：它的近白纸正是高级感的来源。 */
const s1b = JSON.parse(await b.evaluate(`JSON.stringify((function(){
  var L=window.LUMEN, out={};
  L.SKIN_ORDER.forEach(function(k){
    var sk=L.SKINS[k];
    function lum(h){ var c=[1,3,5].map(function(i){return parseInt(h.substr(i,2),16);});
      return c[0]*.299+c[1]*.587+c[2]*.114; }
    out[k]= Math.round(lum(sk.bookPaper)) - Math.round(lum(sk.tplPaper||sk.bookPaper));
  });
  L.applySkin('studio');
  return out;
})())`));
const tinted = L => (s1b[L] <= -6);
chk(tinted('peach') && tinted('mist') && tinted('mint') && tinted('cream') && tinted('french') && tinted('sakura'),
  'S8b 六套氛围的书页纸都比印片纸深一档（层次 + 辨识度）', JSON.stringify(s1b));
chk(s1.oAccent === s1.oAccent2 || (s1.oAccent !== '#e08a3c' && s1.oAccent2 !== ''),
  'S9 强调色与次强调色都跟到了蜜桃', 'accent=' + s1.oAccent + ' accent2=' + s1.oAccent2);

/* ---------- ③ 色调归属：暗调模版不能被套上浅色纸 ---------- */
const s2 = JSON.parse(await b.evaluate(`JSON.stringify((function(){
  var L=window.LUMEN, st=L.state;
  L.applySkin('mist');                     /* 雾紫：光明亮、纸色浅 */
  var fake={tpl:'neon',name:'N'};
  var fakeFilm={tpl:'film',name:'F'};
  var fakeKraft={tpl:'kraft',name:'K'};
  var fakePhoto={tpl:'magazine',name:'M'};
  var fakeLight={tpl:'polaroid',name:'P'};
  var o=function(t){ var r=L.optsFor({tpl:t,name:'x'}); return {p:r.paper,i:r.ink,a:r.accent}; };
  return {neon:o('neon'), film:o('film'), kraft:o('kraft'),
    magazine:o('magazine'), polaroid:o('polaroid'),
    toneNeon:L.TPL.neon.tone, toneKraft:L.TPL.kraft.tone, toneMag:L.TPL.magazine.tone,
    skinsHaveTone:L.SKIN_ORDER.every(function(k){ return typeof L.SKINS[k].tplPaper==='string'; })};
})())`));
chk(s2.neon.p === '' && s2.neon.i === '',
  'S10 霓虹（暗调）不被套上浅色纸 —— 否则霓虹变奶油底，美学直接毁掉', 'paper="' + s2.neon.p + '"');
chk(s2.film.p === '' && s2.magazine.p === '',
  'S11 胶片 / 杂志 同样保持自己的暗调',
  'film="' + s2.film.p + '" mag="' + s2.magazine.p + '"');
chk(s2.kraft.p !== s2.polaroid.p && s2.kraft.p !== '',
  'S12 牛皮纸走自己的棕（tplKraft），不跟浅色纸走',
  'kraft=' + s2.kraft.p + ' vs polaroid=' + s2.polaroid.p);
chk(s2.polaroid.p !== '' && s2.polaroid.i !== '',
  'S13 宝丽来（浅色纸）确实拿到了雾紫的纸色', 'paper=' + s2.polaroid.p);
chk(s2.neon.a !== '' && s2.film.a !== '',
  'S14 暗调模版虽然不换纸，但强调色仍然跟着氛围',
  'neon.accent=' + s2.neon.a + ' film.accent=' + s2.film.a);

/* ---------- ④ 皮肤真的改变了成片像素 ---------- */
const raw3 = await b.evaluate(`(async function(){
 try{
  function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
  var L=window.LUMEN, st=L.state;
  function sig(cv){
    var x=cv.getContext('2d');
    var d=x.getImageData(0,0,cv.width,cv.height).data;
    var s=0,n=0;
    for(var i=0;i<d.length;i+=4*97){ s+=d[i]+d[i+1]*3+d[i+2]*7; n++; }
    return Math.round(s/n);
  }
  /* 只留一张照片、固定成宝丽来，保证「差异只能来自氛围」 */
  st.photos.forEach(function(p,i){ p.picked=(i===0); p.tpl='polaroid'; });
  st.opts.title='{name}'; st.opts.sub=''; st.opts.corner='';
  st.book.cap='name';
  await L.generate(); for(var i=0;i<80;i++){ await sleep(120); if(st.generated.length===1) break; }
  L.applySkin('studio');
  await L.generate(); for(var i=0;i<80;i++){ await sleep(120); if(st.generated.length===1) break; }
  var a=sig(st.generated[0].art);
  L.applySkin('sakura');           /* 夜樱：浅色印片 + 深底书 */
  await L.generate(); for(var i=0;i<80;i++){ await sleep(120); if(st.generated.length===1) break; }
  var b2=sig(st.generated[0].art);
  var stale=L.bookStale();         /* 换完氛围、还没重出时应该是「过期」*/
  L.applySkin('studio');
  await L.generate(); for(var i=0;i<80;i++){ await sleep(120); if(st.generated.length===1) break; }
  var a2=sig(st.generated[0].art);
  return JSON.stringify({a:a, b:b2, a2:a2, stale:stale});
 }catch(e){ return JSON.stringify({err:(e&&e.stack)||String(e)}); }
})()`);
const s3 = JSON.parse(raw3);
if (s3.err) { console.log('  [s3 error] ' + s3.err); }
chk(s3.a !== s3.b, 'S15 同一张照片、同一套模版，换氛围后成片像素确实变了',
  '原味=' + s3.a + ' 夜樱=' + s3.b);
chk(s3.a === s3.a2, 'S16 换回原味 → 像素回到原来的值（氛围可逆，不是单向污染）',
  s3.a + ' -> ' + s3.a2);

const s4 = JSON.parse(await b.evaluate(`JSON.stringify((function(){
  var L=window.LUMEN, st=L.state;
  L.applySkin('studio');
  var sig0=L.bookSig();
  L.applySkin('mint');
  var sig1=L.bookSig();
  return {changed:sig0!==sig1, skinInSig:sig1.indexOf('mint')>=0};
})())`));
chk(s4.changed && s4.skinInSig,
  'S17 换氛围会改变成片签名 → 提示「成片已过期」，否则用户看到旧画面又以为没生效');

/* ---------- ⑤ 持久化 ---------- */
await b.evaluate(`(function(){
  window.LUMEN.applySkin('mist');
  window.LUMEN.PERSIST.flush();
  return 1;
})()`);
await b.goto(FILE, 2600);
await sleep(1300);
const s5 = JSON.parse(await b.evaluate(`JSON.stringify((function(){
  var L=window.LUMEN, sk=L.skinCfg(), cs=getComputedStyle(document.documentElement);
  return {skin:L.state.skin, bookPaper:L.state.book.paper,
    cssAccent:cs.getPropertyValue('--accent').trim(), swatch:L.SKINS.mist.ui.dark};
})())`));
chk(s5.skin === 'mist', 'S18 换过氛围，刷新后还在', 'skin=' + s5.skin);
chk(s5.bookPaper === '#f0eafb', 'S19 存档里的书页色也一起接回来了', 'bookPaper=' + s5.bookPaper);
chk(s5.cssAccent === s5.swatch,
  'S20 刷新后工作台的强调色也跟着氛围走（不是只有打开面板时才变）',
  'accent=' + s5.cssAccent);

/* ---------- ⑥ 工作台外观：强调色 + 圆角 + 亮色主题另一档 ---------- */
const s6 = JSON.parse(await b.evaluate(`JSON.stringify((function(){
  var L=window.LUMEN, r=document.documentElement;
  r.setAttribute('data-theme','dark');
  L.applySkin('peach');
  var cs=getComputedStyle(r);
  var darkAcc=cs.getPropertyValue('--accent').trim(), darkR=cs.getPropertyValue('--r').trim();
  r.setAttribute('data-theme','light');
  L.paintSkinChrome(L.skinCfg());
  var cs2=getComputedStyle(r);
  var lightAcc=cs2.getPropertyValue('--accent').trim();
  r.setAttribute('data-theme','dark');
  L.applySkin('studio');
  var cs3=getComputedStyle(r);
  return {darkAcc:darkAcc, lightAcc:lightAcc, wantDark:L.SKINS.peach.ui.dark,
    wantLight:L.SKINS.peach.ui.light, r:darkR, wantR:L.SKINS.peach.radius+'px',
    backAcc:cs3.getPropertyValue('--accent').trim(), wantBack:L.SKINS.studio.ui.dark};
})())`));
chk(s6.darkAcc === s6.wantDark, 'S21 暗色主题下用氛围的暗色档强调色', s6.darkAcc);
chk(s6.lightAcc === s6.wantLight && s6.lightAcc !== s6.darkAcc,
  'S22 亮色主题下换成更深的一档（不能一套色打天下，浅底上会糊）',
  'dark=' + s6.darkAcc + ' light=' + s6.lightAcc);
chk(s6.r === s6.wantR, 'S23 圆角基准跟着氛围走（蜜桃 18px，比原味更软）', 'r=' + s6.r);
chk(s6.backAcc === s6.wantBack, 'S24 换回原味 → 工作台强调色也回到出厂值', s6.backAcc);

/* ---------- ⑦ 皮肤卡片真的渲染出来了，且点得到 ---------- */
const raw7 = await b.evaluate(`(async function(){
 try{
  function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
  var L=window.LUMEN;
  L.setStep(0);
  await sleep(200);
  var cards=document.querySelectorAll('.skin[data-skin]');
  var on=document.querySelectorAll('.skin.on');
  var first=cards[0];
  return JSON.stringify({n:cards.length, on:on.length, onId:on.length?on[0].dataset.skin:'',
    inPanel0:!!document.querySelector('#panel .skins'),
    hasSwatch:!!(first&&first.querySelector('.sw i'))});
 }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); }
})()`);
if (typeof raw7 === 'object') { console.log('  [s7 raw] ' + JSON.stringify(raw7)); }
const s7 = JSON.parse(raw7);
chk(s7.n === 7, 'S25 第一屏就渲染出 7 张氛围卡片', 'n=' + s7.n);
chk(s7.inPanel0 && s7.hasSwatch, 'S26 氛围在第一屏（panel0）里，而且带色块示意');
chk(s7.on === 1 && s7.onId === 'studio',
  'S27 当前氛围有且只有一个被选中', 'on=' + s7.onId);

/* 真实点击一张卡片，走的是页面上真实的事件路径，不是直接调 applySkin */
const s8 = JSON.parse(await b.evaluate(`(async function(){
  function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
  var L=window.LUMEN;
  var card=document.querySelector('.skin[data-skin="mint"]');
  if(!card) return JSON.stringify({err:'no card'});
  card.click();
  await sleep(260);
  var on=document.querySelectorAll('.skin.on');
  var cs=getComputedStyle(document.documentElement);
  return JSON.stringify({skin:L.state.skin, onId:on.length?on[0].dataset.skin:'',
    accent:cs.getPropertyValue('--accent').trim(), want:L.SKINS.mint.ui.dark,
    bookPaper:L.state.book.paper});
})()`));
chk(s8.skin === 'mint' && s8.onId === 'mint',
  'S28 点氛围卡片真的切过去了，选中态也跟着动', 'skin=' + s8.skin);
chk(s8.accent === s8.want, 'S29 点击路径也刷了工作台外观（不只是改 state）', s8.accent);
chk(s8.bookPaper === '#e7f5f0', 'S30 点击路径把书页色也改了', s8.bookPaper);

/* ---------- ⑧ 用户手改过颜色时，氛围不覆盖他；点「跟随氛围」才回来 ---------- */
const raw9 = await b.evaluate(`(async function(){
 try{
  function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
  var L=window.LUMEN, st=L.state;
  /* 「跟随氛围」按钮在模版面板（panel1），先切过去 */
  L.setStep(1);
  await sleep(220);
  L.applySkin('cream');
  /* 模拟用户在颜色选择器里改了印片纸色 */
  st.opts.paper='#123456';
  var kept=L.optsFor({tpl:'polaroid',name:'x'}).paper;
  var btn=document.querySelector('#skinColors');
  var hadBtn=!!btn;
  if(btn) btn.click();
  await sleep(220);
  var back=L.optsFor({tpl:'polaroid',name:'x'}).paper;
  var want=L.SKINS.cream.tplPaper;
  return JSON.stringify({kept:kept, back:back, want:want, hadBtn:hadBtn});
 }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); }
})()`);
if (typeof raw9 === 'object') { console.log('  [s9 raw] ' + JSON.stringify(raw9)); }
const s9 = JSON.parse(raw9);
chk(s9.kept === '#123456',
  'S31 用户手改的印片纸色优先于氛围（改过的色不能被氛围冲掉）', 'kept=' + s9.kept);
chk(s9.hadBtn && s9.back === s9.want,
  'S32 点「跟随氛围」→ 清掉手改值，回到氛围配色', 'back=' + s9.back);

const errs = await b.evaluate('JSON.stringify(window.__errs||[])');
console.log('\n--- JS 异常: ' + (errs === '[]' ? 'none' : errs));
console.log('--- 失败项: ' + fail + ' / ' + (pass + fail));
await b.close();
process.exit(fail ? 1 : 0);
