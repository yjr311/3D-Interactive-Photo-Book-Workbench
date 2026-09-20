import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

/* 第七轮 · 竖版导出与分享长图
   ① 预设决定的是【成片本身的画幅】，不是导出时套白边 → 出片不用再裁
   ② 书页比例与成片画幅解耦：换 9:16 导出预设不能把整本书压成手机屏
   ③ 分享长图是竖版 1080 宽、顶部带书名、底部留裁切安全区
   ④ 页数太多时长图会等比缩小，不会出一张打不开的图
   全部走页面内真实调用与真实像素统计，不 mock。 */
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';

const b = await launch({ port: 9471, windowSize: '1400,920' });
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

const prep = await ev(`
  var L=window.LUMEN, st=L.state;
  await L.loadEmbedded(true);
  st.photos.forEach(function(p,i){ p.picked=(i<6); });
  L.setStep(2);
  await new Promise(function(r){ setTimeout(r,300); });
  return JSON.stringify({n:st.photos.length, presets:L.EXPORT_PRESETS.length,
    pageAspect:L.pageAspect(), ratio:st.spec.ratio, le:st.spec.longEdge, bookRatio:st.book.ratio});
`);
if (prep.__err) { console.log('SETUP FAILED'); await b.close(); process.exit(1); }

/* ---------- ① 预设表本身 ---------- */
const e1 = await ev(`
  var L=window.LUMEN, out=[];
  L.EXPORT_PRESETS.forEach(function(p){
    var R=window.LUMEN; var ab=null;
    var RATIOS={'1:1':[1,1],'4:5':[4,5],'3:4':[3,4],'2:3':[2,3],'9:16':[9,16]};
    ab=RATIOS[p.ratio];
    var w,h;
    if(ab[0]>=ab[1]){ w=p.longEdge; h=Math.round(p.longEdge*ab[1]/ab[0]); }
    else { h=p.longEdge; w=Math.round(p.longEdge*ab[0]/ab[1]); }
    out.push({id:p.id, label:p.label, px:p.px, calc:w+'×'+h, pxN:p.px.replace(/ /g,'')});
  });
  return JSON.stringify({out:out});
`);
chk(e1.out.length === 4, 'E1 内置 4 档发布尺寸', e1.out.map(o => o.label).join(' / '));
chk(e1.out.every(o => o.pxN === o.calc),
  'E2 每档声明的像素和实际算出来的一致（长边 = 竖图高度，宽固定 1080）',
  e1.out.map(o => o.label + '=' + o.calc).join(' · '));
chk(e1.out.every(o => o.calc.split('×')[0] === '1080'),
  'E3 四档宽度都是 1080（能直接发，不用再缩）');

/* ---------- ② 点预设 → 成片真的按这个画幅出图 ---------- */
const e4 = await ev(`
  var L=window.LUMEN, st=L.state;
  function chip(id){ return document.querySelector('.chip[data-export="'+id+'"]'); }
  var out={};
  out.hasChips=document.querySelectorAll('.chip[data-export]').length;
  var before={ratio:st.spec.ratio, le:st.spec.longEdge};
  chip('xhs').click();
  await new Promise(function(r){ setTimeout(r,260); });
  out.ratio=st.spec.ratio; out.le=st.spec.longEdge;
  out.marked=L.exportPresetNow();
  await L.generate();
  for(var i=0;i<100;i++){ await new Promise(function(r){setTimeout(r,120);}); if(st.generated.length===6) break; }
  var cv=st.generated[0].canvas;
  out.canvas=cv.width+'x'+cv.height;
  out.before=before.ratio+'/'+before.le;
  return JSON.stringify(out);
`);
chk(e4.hasChips === 4, 'E4 导出面板渲染出 4 个尺寸可选', 'chips=' + e4.hasChips);
chk(e4.ratio === '3:4' && Number(e4.le) === 1440 && e4.marked === 'xhs',
  'E5 选「小红书竖图」→ 画幅被改成 3:4 / 1440', e4.ratio + ' / ' + e4.le);
chk(e4.canvas === '1080x1440',
  'E6 成片真的出成 1080×1440 —— 不是导出时套白边，出片就能直接发', e4.canvas);

const e5 = await ev(`
  var L=window.LUMEN, st=L.state;
  var chip=document.querySelector('.chip[data-export="story"]');
  chip.click();
  await new Promise(function(r){ setTimeout(r,260); });
  var stale=L.bookStale();
  await L.generate();
  for(var i=0;i<100;i++){ await new Promise(function(r){setTimeout(r,120);}); if(st.generated.length===6) break; }
  var cv=st.generated[0].canvas;
  return JSON.stringify({ratio:st.spec.ratio, le:st.spec.longEdge, canvas:cv.width+'x'+cv.height,
    stale:stale, pageAspect:L.pageAspect(), bookRatio:st.book.ratio});
`);
chk(e5.canvas === '1080x1920', 'E7 选「故事全屏」→ 出 1080×1920', e5.canvas);
chk(e5.stale === true,
  'E8 改尺寸会判「成片已过期」（旧成片还是上一个画幅）', 'stale=' + e5.stale);
chk(e5.pageAspect.join(':') === '3:4' && e5.bookRatio === '3:4',
  'E9 书页比例【不】跟着导出预设变（否则整本书被压成一条手机屏）',
  'pageAspect=' + e5.pageAspect.join(':') + ' bookRatio=' + e5.bookRatio);

const e6 = await ev(`
  var L=window.LUMEN, st=L.state;
  st.book.ratio='1:1';
  var sq=L.pageAspect();
  st.book.ratio='3:4';
  return JSON.stringify({sq:sq, back:L.pageAspect()});
`);
chk(e6.sq.join(':') === '1:1' && e6.back.join(':') === '3:4',
  'E10 书页比例可以单独调（版式里那一档）', e6.sq.join(':') + ' / ' + e6.back.join(':'));

/* ---------- ③ 分享长图 ---------- */
const e7 = await ev(`
  var L=window.LUMEN, st=L.state;
  st.book.ratio='3:4'; st.book.art='tpl'; st.book.layout='mat';
  var s=L.shareSheet();
  if(!s) return JSON.stringify({none:true});
  var pg=L.buildBookPages();
  var kinds={}; pg.pages.forEach(function(p){ kinds[p.kind]=(kinds[p.kind]||0)+1; });
  var x=s.canvas.getContext('2d');
  return JSON.stringify({none:false, CW:s.CW, CH:s.CH, W:s.W, H:s.H, cols:s.cols, k:s.k,
    n:s.list.length, kinds:kinds, total:pg.pages.length,
    shareKinds:(function(){ var o={}; s.list.forEach(function(p){ o[p.kind]=(o[p.kind]||0)+1; }); return o; })(),
    head:s.head, foot:s.foot, pw:s.pw, ph:s.ph,
    portrait:s.CH>s.CW*3,
    skipped:(kinds.endpaper||0)+(kinds.blank||0)});
`);
chk(!e7.none && e7.CW === 1080,
  'E11 分享长图宽度 1080（竖版信息流里的标准宽）', e7.CW + '×' + e7.CH);
chk(e7.portrait, 'E12 长图是竖版（高远大于宽）', e7.CH + ' / ' + e7.CW + ' = ' +
  (e7.CH / e7.CW).toFixed(1) + ' 倍');
chk(e7.shareKinds.endpaper === undefined && e7.shareKinds.blank === undefined
    && e7.kinds.endpaper === 2,
  'E13 环衬页与空白页被剔掉了（它们只是装订填充，留着只会让图更长）',
  '长图里=' + JSON.stringify(e7.shareKinds) + ' 全书=' + JSON.stringify(e7.kinds));
chk(e7.cols === 2 && e7.n === e7.total - e7.skipped,
  'E14 双列排布，页数 = 全书页数 - 被剔掉的填充页',
  e7.n + ' 页 / 全书 ' + e7.total + ' 页 / 剔掉 ' + e7.skipped);

const e8 = await ev(`
  var L=window.LUMEN, s=L.shareSheet();
  var x=s.canvas.getContext('2d');
  /* ① 顶部必须有内容（书名那一块） */
  function inkCount(y0,y1){
    var d=x.getImageData(0,y0,s.CW,y1-y0).data, n=0;
    for(var i=0;i<d.length;i+=4){ if(d[i]<200||d[i+1]<200||d[i+2]<200) n++; }
    return n;
  }
  var headInk=inkCount(0, Math.round(s.head*s.k));
  /* ② 底部安全区必须是空的（小红书会在那里压标题与控件） */
  var footInk=inkCount(Math.round((s.H-s.foot*.92)*s.k), s.CH);
  /* ③ 正文区必须真的画了书页（不是一片空白） */
  var bodyInk=inkCount(Math.round((s.head+s.ph*.20)*s.k), Math.round((s.head+s.ph*.80)*s.k));
  return JSON.stringify({headInk:headInk, footInk:footInk, bodyInk:bodyInk,
    head:s.head, foot:s.foot, CH:s.CH});
`);
chk(e8.headInk > 300, 'E15 长图顶部画了书名/日期（转发出去别人知道这是什么）',
  '页眉墨点=' + e8.headInk);
chk(e8.footInk === 0,
  'E16 底部留出了完全空白的裁切安全区（否则最后一行书页会被平台标题挡住）',
  '安全区墨点=' + e8.footInk + ' / ' + Math.round(e8.foot) + 'px');
chk(e8.bodyInk > 2000, 'E17 长图正文区真的画了书页内容', '墨点=' + e8.bodyInk);

/* ---------- ④ 页数极多时等比缩小 ---------- */
const e9 = await ev(`
  var L=window.LUMEN, st=L.state;
  var r={};
  var backup=st.generated.slice();
  st.book.ratio='3:4';
  /* 先量真实页数的情形：6 张照片的长图应该原尺寸输出，不缩放 */
  var s1=L.shareSheet();
  r.normal={W:s1.W, H:s1.H, CW:s1.CW, CH:s1.CH, k:+s1.k.toFixed(4), n:s1.list.length};
  /* 6 张照片撑不到高度上限，把成片列表复制成 ~60 页，再看缩放下限 */
  var dup=[], i=0;
  while(dup.length<60){ dup.push(backup[i%backup.length]); i++; }
  st.generated=dup;
  /* 再换 9:16 书页比例 → 每页更高 → 整张图必然超上限 */
  st.book.ratio='9:16';
  var s2=L.shareSheet();
  r.tall={W:s2.W, H:s2.H, CW:s2.CW, CH:s2.CH, k:+s2.k.toFixed(4), n:s2.list.length};
  st.book.ratio='3:4';
  st.generated=backup;
  return JSON.stringify(r);
`);
chk(e9.normal.k === 1, 'E18 页数不多时不缩放（保持 1080 宽的原尺寸）',
  'H=' + e9.normal.H + ' k=' + e9.normal.k);
chk(e9.tall.H > 16000 && e9.tall.k < 1 && e9.tall.CH <= 16001 && e9.tall.CW < 1080,
  'E19 页数太多时整体等比缩小到高度上限内，不会出一张打不开的图',
  '理论 H=' + e9.tall.H + ' → 实际 ' + e9.tall.CW + '×' + e9.tall.CH + ' (k=' + e9.tall.k + ', ' + e9.tall.n + ' 页)');

/* ---------- ⑤ 真按钮点得通（不是只有内部函数能用） ---------- */
const e10 = await ev(`
  var L=window.LUMEN, st=L.state;
  await L.generate();
  for(var i=0;i<100;i++){ await new Promise(function(r){setTimeout(r,120);}); if(st.generated.length===6) break; }
  var btn=document.getElementById('exportSheet');
  var had=!!btn;
  btn.click();
  await new Promise(function(r){ setTimeout(r,900); });
  var t=document.getElementById('toast');
  return JSON.stringify({had:had, toast:t?t.textContent:'', canvasBtn:!!document.getElementById('exportCurrent')});
`);
chk(e10.had && /分享长图已导出/.test(e10.toast),
  'E20「导出一张竖版分享长图」按钮点得通，并给出尺寸回执', e10.toast);
chk(e10.canvasBtn, 'E21 单张成片与 ZIP 的导出入口都还在');

const errs = await b.evaluate('JSON.stringify(window.__errs||[])');
console.log('\n--- JS 异常: ' + (errs === '[]' ? 'none' : errs));
console.log('--- 失败项: ' + fail + ' / ' + (pass + fail));
await b.close();
process.exit(fail ? 1 : 0);
