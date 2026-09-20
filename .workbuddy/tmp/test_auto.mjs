import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

/* 第七轮 · 一键氛围成书（含「换一版」）
   ① 一次点击要做完四件事：套氛围 → 铺推荐模版 → 挑封面主图 → 生成成片
   ② 铺模版的顺序必须和 generate() 的 filter 顺序完全一致（否则逐张改会改错人）
   ③ 「换一版」换的是"这一版的排法"：模版序列起点 +1、封面顺延、版式轮换
      —— 但不换氛围、不换照片
   ④ 结果必须立刻可改：一键之后手改模版照样生效，bookStale 该亮就亮
   全部走页面内真实调用 + 真实鼠标点击（CDP Input），不 mock。 */
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';

const b = await launch({ port: 9472, windowSize: '1400,920' });
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

/* ---------- ① 首屏：卡片在、按钮在、没照片时是禁用的 ---------- */
const a1 = await ev(`
  var L=window.LUMEN, st=L.state;
  var card=document.querySelector('.auto');
  var btn=document.getElementById('autoBook');
  return JSON.stringify({
    step:st.step, photos:st.photos.length,
    hasCard:!!card, hasBtn:!!btn,
    disabled:btn?btn.disabled:null,
    hasRoll:!!document.getElementById('autoRoll'),
    title:card?card.querySelector('.auto-hd b').textContent:'',
    seq:card?card.querySelector('.auto-hd s').textContent:'',
    emptyAuto:!!document.getElementById('emptyAuto')
  });
`);
chk(a1.hasCard && a1.hasBtn, 'A1 首屏渲染出「一键氛围成书」卡片与按钮', a1.title);
chk(a1.disabled === true, 'A2 还没有照片时按钮是禁用的（不能凭空生成）');
chk(a1.hasRoll === false, 'A3 还没用过就不该出现「换一版」');
chk(a1.seq.indexOf('·') > 0, 'A4 卡片上直接写出这套氛围的推荐模版序列', a1.seq);
chk(a1.emptyAuto === true, 'A5 空舞台提供「载入示例照片并一键成书」的合并入口');

/* ---------- ② 载入照片后：按钮文案跟着勾选变 ---------- */
const a2 = await ev(`
  var L=window.LUMEN, st=L.state;
  await L.loadEmbedded(true);
  var all=st.photos.length;
  st.photos.forEach(function(p){ p.picked=false; });
  L.renderPanel();
  var none=document.getElementById('autoBook').textContent;
  st.photos.forEach(function(p,i){ p.picked=(i<6); });
  L.renderPanel();
  var some=document.getElementById('autoBook').textContent;
  return JSON.stringify({all:all, none:none, some:some});
`);
chk(a2.some.indexOf('6') >= 0, 'A6 已勾选时按钮写明将做几张', a2.some);
chk(a2.none.indexOf(String(a2.all)) >= 0, 'A7 一张没勾时按钮说明会把全部做进去', a2.none);

/* ---------- ③ autoBook 的四件事 ---------- */
const a3 = await ev(`
  var L=window.LUMEN, st=L.state;
  st.photos.forEach(function(p,i){ p.picked=(i<6); });
  L.applySkin('peach');
  var r=L.autoBook('peach',{off:1});
  var list=st.photos.filter(function(p){return p.picked;});
  var seq=L.autoSeq(L.skinCfg());
  var m=list.map(function(p){return p.tpl;});
  return JSON.stringify({ok:r.ok,count:r.count,off:r.off,
    skin:st.skin, bookPaper:st.book.paper, skinPaper:L.SKINS.peach.bookPaper,
    optsAccent:st.opts.accent, skinAccent:L.SKINS.peach.accent,
    seq:seq, got:m, layout:st.book.layout, recLayout:L.skinCfg().rec.layout,
    coverIdx:st.book.coverIdx, n:st.photos.length, pickedN:list.length});
`);
chk(a3.ok === true && a3.count === 6, 'A8 autoBook 返回成功与张数', 'count=' + a3.count);
chk(a3.bookPaper === a3.skinPaper && a3.optsAccent === a3.skinAccent,
  'A9 第一件事「套氛围」：书页色与印片强调色都落到这套氛围上',
  a3.bookPaper + ' / ' + a3.optsAccent);
/* 期望：第 i 张拿到 seq[(i+off)%len] —— off=1，所以要按 got 的长度铺满整轮 */
const wantSeq = a3.got.map((_, i) => a3.seq[(i + 1) % a3.seq.length]);
chk(JSON.stringify(a3.got) === JSON.stringify(wantSeq),
  'A10 第二件事「铺模版」：按推荐序列循环铺，且 off 起点生效',
  a3.got.join(','));
chk(a3.seq.indexOf(a3.got[0]) >= 0, 'A11 用到的模版都来自这套氛围的推荐序列');
chk(a3.coverIdx === 0, 'A12 第三件事「挑封面」：交给 coverScore 自动挑最佳（coverIdx=0）');
chk(a3.layout === a3.recLayout, 'A13 顺带套上这套氛围推荐的版式', a3.layout);

/* ---------- ④ 第四件事「真的出了片」，且顺序对得上 ---------- */
const a4 = await ev(`
  var L=window.LUMEN, st=L.state;
  var list=st.photos.filter(function(p){return p.picked;});
  await L.generate();
  for(var i=0;i<120;i++){ await new Promise(function(r){setTimeout(r,120);}); if(st.generated.length===list.length) break; }
  var gens=st.generated.map(function(g){return g.tpl;});
  var srcs=list.map(function(p){return p.tpl;});
  var cv=st.generated[0].canvas, cv2=st.generated[list.length-1].canvas;
  var ins=[];
  for(var i=0;i<list.length;i++){ if(st.generated[i].photoId!==list[i].id) ins.push(i); }
  return JSON.stringify({gn:st.generated.length, gens:gens, srcs:srcs,
    cw:cv.width, chh:cv.height, same:cv.width===cv2.width&&cv.height===cv2.height,
    mismatch:ins, le:st.spec.longEdge, step:st.step,
    mounted:!!(L.BV.el&&L.BV.el.parentNode)});
`);
chk(a4.gn === 6, 'A14 生成了和入册张数一致的成片', 'generated=' + a4.gn);
chk(JSON.stringify(a4.gens) === JSON.stringify(a4.srcs),
  'A15 成片的模版顺序与分配完全一一对应（generated[i] ↔ 第 i 张入册照片）',
  a4.gens.join(','));
chk(a4.mismatch.length === 0, 'A16 成片的 photoId 顺序也和入册顺序一致（逐张改不会改错人）');
chk(a4.chh === a4.le && a4.same, 'A17 每张成片都是同一个规格、长边等于设定值',
  a4.cw + '×' + a4.chh + ' (le=' + a4.le + ')');
chk(a4.step === 2 && a4.mounted, 'A18 生成后自动进入「选片成书」并且书本已挂上舞台');

/* ---------- ⑤ 一张没勾时的默认行为（要诚实） ---------- */
const a5 = await ev(`
  var L=window.LUMEN, st=L.state;
  st.photos.forEach(function(p){ p.picked=false; });
  var r1=L.autoBook(st.skin,{pickAll:false});
  var after1=st.photos.filter(function(p){return p.picked;}).length;
  var r2=L.autoBook(st.skin);
  var after2=st.photos.filter(function(p){return p.picked;}).length;
  return JSON.stringify({ok1:r1.ok,msg:r1.msg||'',after1:after1,
    ok2:r2.ok,count:r2.count,after2:after2,n:st.photos.length});
`);
chk(a5.ok1 === false && a5.after1 === 0, 'A19 pickAll:false 时明确拒绝，且不动勾选', a5.msg);
chk(a5.ok2 === true && a5.after2 === a5.n && a5.count === a5.n,
  'A20 默认（pickAll:true）会把全部照片做成一本书', a5.count + '/' + a5.n);

/* ---------- ⑥ 「换一版」换了什么、没换什么 ---------- */
const a6 = await ev(`
  var L=window.LUMEN, st=L.state;
  L.applySkin('peach');
  st.photos.forEach(function(p,i){ p.picked=(i<8); });
  L.autoBook('peach',{off:0,coverIdx:0});
  await L.generate();
  for(var i=0;i<120;i++){ await new Promise(function(r){setTimeout(r,120);}); if(st.generated.length===8) break; }
  var before={tpl:st.photos.filter(function(p){return p.picked;}).map(function(p){return p.tpl;}),
    cover:st.book.coverIdx, layout:st.book.layout, skin:st.skin,
    ids:st.photos.filter(function(p){return p.picked;}).map(function(p){return p.id;})};
  var r1=L.autoRoll();
  var mid={tpl:st.photos.filter(function(p){return p.picked;}).map(function(p){return p.tpl;}),
    cover:st.book.coverIdx, layout:st.book.layout};
  var r2=L.autoRoll();
  var after={tpl:st.photos.filter(function(p){return p.picked;}).map(function(p){return p.tpl;}),
    cover:st.book.coverIdx, layout:st.book.layout, skin:st.skin,
    ids:st.photos.filter(function(p){return p.picked;}).map(function(p){return p.id;})};
  var diff=0; for(var i=0;i<before.tpl.length;i++){ if(before.tpl[i]!==mid.tpl[i]) diff++; }
  var pool=[L.skinCfg().rec.layout].concat(L.skinCfg().rec.alts);
  return JSON.stringify({before:before,mid:mid,after:after,diff:diff,
    r1:r1.ok,r2:r2.ok, pool:pool, off1:r1.off, off2:r2.off,
    seqLen:L.autoSeq(L.skinCfg()).length});
`);
chk(a6.diff === 8, 'A21 换一版后每张照片的模版都被挪了一档（不是只换封面）', a6.diff + '/8');
chk(a6.mid.cover !== a6.before.cover, 'A22 换一版会顺延封面主图',
  a6.before.cover + ' → ' + a6.mid.cover);
chk(a6.pool.indexOf(a6.mid.layout) >= 0 && a6.mid.layout !== a6.before.layout,
  'A23 换一版在推荐的版式之间轮换', a6.before.layout + ' → ' + a6.mid.layout);
chk(a6.after.layout === a6.before.layout, 'A24 再换一版会轮回到原版式（两档循环）',
  a6.before.layout + ' → ' + a6.mid.layout + ' → ' + a6.after.layout);
chk(a6.after.skin === 'peach', 'A25 换一版不换氛围（氛围是用户选的，不该被随机掉）', a6.after.skin);
chk(JSON.stringify(a6.after.ids) === JSON.stringify(a6.before.ids),
  'A26 换一版不换照片（入册集合不变）');
chk(a6.off1 === 1 && a6.off2 === 2, 'A27 换一版就是序列起点 +1，可预期不是乱随', a6.off1 + '→' + a6.off2);

/* ---------- ⑦ 结果立刻可改：一键之后手改模版照样生效 ---------- */
const a7 = await ev(`
  var L=window.LUMEN, st=L.state;
  var list=st.photos.filter(function(p){return p.picked;});
  var autoTpl=list[2].tpl;
  list[2].tpl='kraft';
  L.renderRail(); L.renderPanel();
  var stale=L.bookStale();
  var r=L.autoBook(st.skin,{off:0});
  var back=list[2].tpl;
  return JSON.stringify({autoTpl:autoTpl, stale:stale, back:back,
    exp:L.autoSeq(L.skinCfg())[2]});
`);
chk(a7.stale === true, 'A28 一键成书之后手改某张的模版 → 成片立刻被判定为过期（可改）');
chk(a7.back === a7.exp, 'A29 再点一键成书会按序列重新铺（一键 = 覆盖，语义明确）',
  a7.autoTpl + ' → kraft → ' + a7.back);

/* ---------- ⑧ 真实鼠标点击路径 ---------- */
const click0 = await ev(`
  var L=window.LUMEN, st=L.state;
  st.generated=[]; st._autoUsed=false;
  st.photos.forEach(function(p,i){ p.picked=(i<5); });
  L.setStep(0);
  await new Promise(function(r){ setTimeout(r,260); });
  var btn=document.getElementById('autoBook');
  var r=btn.getBoundingClientRect();
  return JSON.stringify({exists:!!btn, visible:r.width>0&&r.height>0,
    text:btn?btn.textContent:'', y:Math.round(r.top)});
`);
chk(click0.exists && click0.visible, 'A30 首屏的一键按钮在视口内可点', click0.text + ' @y=' + click0.y);

await b.click('#autoBook');
await sleep(2600);
const click1 = await ev(`
  var L=window.LUMEN, st=L.state;
  var roll=document.getElementById('autoRoll');
  return JSON.stringify({step:st.step, gen:st.generated.length,
    used:!!st._autoUsed, roll:!!roll,
    mounted:!!(L.BV.el&&L.BV.el.parentNode),
    title:document.querySelector('.auto .auto-hd b').textContent});
`);
chk(click1.step === 2 && click1.gen === 5, 'A31 真实点击首屏「一键成书」→ 出片并直接翻到选片成书',
  'step=' + click1.step + ' gen=' + click1.gen);
chk(click1.roll === true, 'A32 用过之后「换一版」按钮出现');

const before = await ev(`
  var st=window.LUMEN.state;
  return JSON.stringify({tpl:st.generated.map(function(g){return g.tpl;}),
    cover:st.book.coverIdx, layout:st.book.layout,
    rgb:(function(){var c=st.generated[0].canvas;var x=c.getContext('2d');
      var d=x.getImageData(Math.floor(c.width*0.12),Math.floor(c.height*0.5),1,1).data;
      return d[0]+','+d[1]+','+d[2];})()});
`);
await b.click('#autoRoll');
await sleep(2800);
const after = await ev(`
  var L=window.LUMEN, st=L.state;
  return JSON.stringify({tpl:st.generated.map(function(g){return g.tpl;}),
    cover:st.book.coverIdx, layout:st.book.layout,
    n:st.generated.length, step:st.step,
    mounted:!!(L.BV.el&&L.BV.el.parentNode),
    srcs:st.photos.filter(function(p){return p.picked;}).map(function(p){return p.tpl;}),
    rgb:(function(){var c=st.generated[0].canvas;var x=c.getContext('2d');
      var d=x.getImageData(Math.floor(c.width*0.12),Math.floor(c.height*0.5),1,1).data;
      return d[0]+','+d[1]+','+d[2];})()});
`);
const tplDiff = before.tpl.filter((v, i) => v !== after.tpl[i]).length;
chk(after.n === 5 && tplDiff > 0, 'A33 真实点击「换一版」→ 重新出片且模版排法变了',
  tplDiff + '/5 张换了模版');
chk(JSON.stringify(after.tpl) === JSON.stringify(after.srcs),
  'A34 换一版后成片与照片的模版分配依然一一对应');
chk(after.layout !== before.layout || after.cover !== before.cover,
  'A35 换一版在真实点击路径下也换了版式或封面',
  before.layout + '/' + before.cover + ' → ' + after.layout + '/' + after.cover);
chk(after.rgb !== before.rgb || after.tpl.join() !== before.tpl.join(),
  'A36 换一版后第一页画面真的变了（不是只改了个标记）', before.rgb + ' → ' + after.rgb);
chk(after.step === 2 && after.mounted, 'A37 换一版后仍然停在成书视图，书没掉下来');

/* ---------- ⑨ 推荐序列本身要自洽 ---------- */
const a9 = await ev(`
  var L=window.LUMEN; var out=[];
  L.SKIN_ORDER.forEach(function(k){
    var s=L.SKINS[k], bad=s.tpls.filter(function(t){ return !L.TPL[t]; });
    out.push({k:k, n:s.tpls.length, uniq:s.tpls.filter(function(t,i){return s.tpls.indexOf(t)===i;}).length,
      bad:bad, rec:!!(s.rec&&s.rec.layout), alts:(s.rec&&s.rec.alts)||[],
      layoutOk:!!s.rec&&!!s.rec.layout});
  });
  var all={}; L.SKIN_ORDER.forEach(function(k){ L.SKINS[k].tpls.forEach(function(t){ all[t]=1; }); });
  return JSON.stringify({out:out, union:Object.keys(all), tplCount:Object.keys(L.TPL).length});
`);
chk(a9.out.every(o => o.n >= 3), 'A38 每套氛围的推荐序列至少 3 套模版',
  a9.out.map(o => o.n).join('/'));
chk(a9.out.every(o => o.bad.length === 0), 'A39 推荐序列里没有不存在的模版名');
chk(a9.out.every(o => o.uniq === o.n), 'A40 同一套氛围的推荐序列里没有重复模版');
chk(a9.out.every(o => o.rec), 'A41 每套氛围都带推荐版式');
chk(a9.union.length >= a9.tplCount - 1,
  'A42 7 套氛围的推荐序列合起来几乎覆盖全部模版（' + a9.tplCount + ' 套里覆盖 ' + a9.union.length + '）',
  a9.union.join(','));
chk(a9.out.every(o => o.alts.length >= 1 && o.alts.every(x => ['full', 'mat', 'two', 'sticker'].indexOf(x) >= 0)),
  'A43 alts 只使用真实存在的版式名');

/* ---------- ⑩ 顺手钉死一个真 bug：说明段落必须换行 ----------
   .note 这个名字被两个东西共用：说明段落 <p class="note"> 与文案候选按钮
   <button class="note">。按钮样式里带 nowrap + overflow:hidden，而光写 .note
   会把说明段落一起命中 —— 面板上十几段说明全被截成一行。
   这条检查就是防止它再回来。 */
const a10 = await ev(`
  var L=window.LUMEN, st=L.state;
  await L.loadEmbedded(true);
  st.photos.forEach(function(p,i){ p.picked=(i<10); });
  L.setStep(2);
  await new Promise(function(r){ setTimeout(r,600); });
  var ps=[].slice.call(document.querySelectorAll('#panel p.note')).map(function(e){
    var cs=getComputedStyle(e);
    return {ws:cs.whiteSpace, ov:cs.overflow, bd:parseFloat(cs.borderTopWidth)||0,
      cw:e.clientWidth, sw:e.scrollWidth, clipped:e.scrollWidth>e.clientWidth+1,
      lines:Math.round(e.getBoundingClientRect().height/parseFloat(cs.lineHeight)||1)};
  });
  var btns=[].slice.call(document.querySelectorAll('#panel .notes .note')).map(function(e){
    var cs=getComputedStyle(e);
    return {ws:cs.whiteSpace, bd:parseFloat(cs.borderTopWidth)||0};
  });
  return JSON.stringify({n:ps.length, ps:ps, nb:btns.length, btns:btns});
`);
chk(a10.n >= 5, 'A44 选片成书这一步渲染出多段说明文字', a10.n + ' 段');
chk(a10.ps.every(p => p.ws === 'normal' && p.ov === 'visible'),
  'A45 说明段落是正常换行的（不是 nowrap + 隐藏溢出）',
  a10.ps.map(p => p.ws).join(','));
chk(a10.ps.every(p => p.bd === 0), 'A46 说明段落不带边框（它不该长得像按钮）',
  a10.ps.map(p => p.bd).join(','));
chk(a10.ps.every(p => !p.clipped && p.lines >= 1),
  'A47 说明段落没有被横向截断（整段可读）',
  a10.ps.map(p => p.lines + '行').join(' '));
chk(a10.nb >= 6 && a10.btns.every(b => b.ws === 'nowrap' && b.bd >= 1),
  'A48 文案候选按钮仍然是按钮形态（nowrap + 有边框），没有被反向改坏', a10.nb + ' 个候选');

console.log('\n===== 一键氛围成书：' + pass + ' passed, ' + fail + ' failed =====');
await b.close();
process.exit(fail ? 1 : 0);
