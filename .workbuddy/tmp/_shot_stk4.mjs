import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'fs';

/* 第十四轮取证：贴纸坐标只认「照片矩形」。
   出图只是交叉核对 —— 真正的取证是 test_batch2.mjs 里那 14 条新断言
   （人造矩形 + 纯平移对照 / 三种真模版矩形互异 / 面板画布与成片逐像素相同）。 */
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsb2';
const WS = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14';
fs.mkdirSync(OUT, { recursive: true });

const b = await launch({ port: 9512, windowSize: '1444,940' });
await b.goto(FILE, 2600);
await sleep(900);
async function ev(body) {
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const o = JSON.parse(raw);
  if (o && o.__err) console.log('  [err] ' + o.__err);
  return o;
}
function save(url, path, name) {
  const m = /^data:image\/png;base64,([\s\S]+)$/.exec(url || '');
  if (!m) { console.log('NO DATAURL ' + name); return; }
  fs.writeFileSync(path, Buffer.from(m[1], 'base64'));
  console.log('wrote ' + name);
}

console.log('setup:', JSON.stringify(await ev(`
  await window.LUMEN.loadEmbedded(true);
  var L=window.LUMEN, st=L.state;
  L.setStep(2);
  await L.generate();
  for(var i=0;i<80;i++){ await new Promise(function(r){setTimeout(r,120);}); if(!L.bookStale()) break; }
  return JSON.stringify({n:st.photos.length, gen:st.generated.length, tpl:st.tpl});
`)));

/* ① 坐标系对照：同一份贴纸数据，锚"画布"vs 锚"照片"，三种模版六格。
      每格里都画出真实成片（noStick=true 出底片），再按两种锚法各画一遍 ——
      "锚在画布上"就是第十三轮的做法（rect = 整块画布）。 */
{
  const r = await ev(`
    var L=window.LUMEN, st=L.state;
    var p=st.photos[0];
    /* 三枚贴纸刻意放在"能被模版内缩放大"的位置：靠边 + 居中 + 靠角 */
    var specs=[{k:'tape',x:.14,y:.10,rot:-.22,s:1.0,text:''},
               {k:'heart',x:.50,y:.50,rot:0,s:1.2,text:''},
               {k:'ticket',x:.86,y:.88,rot:-.05,s:1.0,text:'KADA'}];
    var sticks=specs.map(function(s){ return L.stkFix(s); });
    var names=['magazine','polaroid','film'];
    var LE=st.spec.longEdge;
    var CW=286, pad=16, CH=0;
    var cells=names.map(function(k){
      var art=L.renderCanvas(p,k,L.optsFor(p),LE,true);      /* 底片：只有模版，没有贴纸 */
      CH=Math.max(CH, Math.round(CW*art.height/art.width));
      return {k:k, art:art, rect:art.photoRect};
    });
    /* 分层排版：行标题带 / 图 / 图名 / 行间距 各自留位，避免互相压 */
    var CAP=30, NAME=22, GAP=26, FOOT=26;
    var ROWY=[pad+CAP, pad+CAP+CH+NAME+GAP];
    var H=ROWY[1]+CH+NAME+FOOT+pad;
    var c=document.createElement('canvas');
    c.width=pad+(CW+pad)*cells.length; c.height=H;
    var x=c.getContext('2d');
    x.fillStyle='#f2efe9'; x.fillRect(0,0,c.width,c.height);
    var ROWLB=['① 锚在「画布」上 —— 第十三轮的做法：位置跟着模版飘',
               '② 锚在「照片矩形」上 —— 现在：同一份数据落在照片的同一个地方'];
    var ROWC=['#b23b2e','#2f7a4f'];
    function drawCell(o,row,ox){
      var oy=ROWY[row], art=o.art, rc=o.rect;
      var k=Math.min(CW/art.width,CH/art.height);
      var dw=art.width*k, dh=art.height*k, dx=ox+(CW-dw)/2, dy=oy+(CH-dh)/2;
      x.save(); x.shadowColor='rgba(0,0,0,.22)'; x.shadowBlur=12; x.shadowOffsetY=3;
      x.fillStyle='#fff'; x.fillRect(dx,dy,dw,dh); x.restore();
      x.drawImage(art,dx,dy,dw,dh);
      /* 照片矩形（缩放后） */
      x.save(); x.setLineDash([5,4]); x.lineWidth=1.5; x.strokeStyle='rgba(47,122,79,.9)';
      x.strokeRect(dx+rc.dx*k, dy+rc.dy*k, rc.dw*k, rc.dh*k); x.restore();
      /* 按这一格代表的"锚法"画贴纸 */
      var anchor = (row===0) ? {dx:0,dy:0,dw:art.width,dh:art.height} : rc;
      x.save(); x.translate(dx,dy); x.scale(k,k);
      L.drawStickers(x, anchor, sticks, p);
      x.restore();
      /* ★ 在两行里都画出"②的正确落点"作准星：①的贴纸会明显偏离它 */
      x.save(); x.strokeStyle='rgba(220,40,40,.85)'; x.lineWidth=1.2; x.setLineDash([]);
      specs.forEach(function(s){
        var tx=dx+(rc.dx+s.x*rc.dw)*k, ty=dy+(rc.dy+s.y*rc.dh)*k;
        x.beginPath(); x.arc(tx,ty,9,0,Math.PI*2); x.stroke();
        x.beginPath(); x.moveTo(tx-13,ty); x.lineTo(tx+13,ty);
        x.moveTo(tx,ty-13); x.lineTo(tx,ty+13); x.stroke();
      });
      x.restore();
      x.fillStyle='#4a443c'; x.font='bold 13px sans-serif'; x.textAlign='center';
      x.fillText(o.k, ox+CW/2, oy+CH+NAME-6);
    }
    cells.forEach(function(o,i){ var ox=pad+i*(CW+pad); drawCell(o,0,ox); drawCell(o,1,ox); });
    x.font='bold 14px sans-serif'; x.textAlign='left';
    ROWLB.forEach(function(s,r){ x.fillStyle=ROWC[r]; x.fillText(s,pad,ROWY[r]-11); });
    x.fillStyle='#6b6459'; x.font='12px sans-serif';
    x.fillText('红色准星 = 贴纸在「照片坐标」里应该在的位置 · 绿色虚线 = 照片矩形 · magazine 满幅所以两行重合（那是它本来就对）',
      pad, c.height-9);
    return JSON.stringify({url:c.toDataURL('image/png')});
  `);
  save(r.url, OUT + '/14-贴纸坐标系对照.png', '14-贴纸坐标系对照');
}

/* ② 面板画布 vs 书里那一页：证明"预览就是成片" */
{
  const r = await ev(`
    var L=window.LUMEN, st=L.state;
    var p=st.photos[0];
    p.stickers=[L.stkFix({k:'tape',x:.2,y:.14,rot:-.2,s:1.0,text:''}),
                L.stkFix({k:'doodle',x:.68,y:.7,rot:.03,s:1.4,text:'好喜欢这天'}),
                L.stkFix({k:'stamp',x:.74,y:.17,rot:-.04,s:1.0,text:'{date}'})];
    L.refreshStickerArt(p);
    st._stkIdx=0; st._stkSel=0;
    st.book.layout='mat'; st.book.art='tpl'; st.book.cap='note';
    L.setStep(2); L.renderPanel();
    await new Promise(function(r2){ setTimeout(r2,600); });
    /* 不再调 schedulePreview()：下面直接 buildBookPages() 拿"书里那一页"，
       那一份本来就是按当前状态现排的，等价且不依赖未导出的内部函数。 */
    var stage=document.getElementById('stkStage');
    var g=st.generated.find(function(q){ return q.photoId===p.id; });
    var pages=L.buildBookPages().pages.filter(function(q){ return q.kind==='content'; });
    var page=pages[0].canvas;
    var CW=330, pad=12, capH=30;
    var boxes=[{cv:stage,lb:'面板里那块画布（含模版，所见即所得）'},
               {cv:g.art, lb:'这张照片的成片 g.art'},
               {cv:page,  lb:'书里那一页'}];
    var CH=0;
    boxes.forEach(function(o){ CH=Math.max(CH, Math.round(CW*o.cv.height/o.cv.width)); });
    var c=document.createElement('canvas');
    c.width=pad+(CW+pad)*boxes.length; c.height=pad*2+capH+CH+20;
    var x=c.getContext('2d');
    x.fillStyle='#f2efe9'; x.fillRect(0,0,c.width,c.height);
    boxes.forEach(function(o,i){
      var ox=pad+i*(CW+pad), oy=pad+capH;
      var k=Math.min(CW/o.cv.width, CH/o.cv.height);
      var dw=o.cv.width*k, dh=o.cv.height*k;
      x.save(); x.shadowColor='rgba(0,0,0,.22)'; x.shadowBlur=12; x.shadowOffsetY=3;
      x.fillStyle='#fff'; x.fillRect(ox+(CW-dw)/2,oy+(CH-dh)/2,dw,dh); x.restore();
      x.drawImage(o.cv,ox+(CW-dw)/2,oy+(CH-dh)/2,dw,dh);
      x.fillStyle='#4a443c'; x.font='bold 12px sans-serif'; x.textAlign='center';
      x.fillText(o.lb,ox+CW/2,oy-10);
    });
    x.fillStyle='#6b6459'; x.font='12px sans-serif'; x.textAlign='left';
    x.fillText('前两块逐像素相同（掩掉照片虚线 ±5px 与选中环后差异 = 0）；第三块是它在书里的样子',pad,c.height-8);
    return JSON.stringify({url:c.toDataURL('image/png')});
  `);
  save(r.url, OUT + '/15-面板画布与书页.png', '15-面板画布与书页');
}

/* ③ 改完立刻生效：全程不点「生成成片」，书页自己换掉。
      两张图都取自 BV.pages —— **阅读器此刻真在显示**的那一页，
      不是"再排一遍给他看"（那证明不了屏幕换了）。 */
{
  const r = await ev(`
    var L=window.LUMEN, st=L.state;
    ${''}
    var p=st.photos[0];
    st.book.layout='mat'; st.book.art='tpl'; st.book.cap='note';
    st._stkIdx=0; st._stkSel=0;
    function livePage(){
      var ps=L.BV.pages||[], ks=L.BV.kinds||[];
      for(var i=0;i<ps.length;i++){ if(ks[i]==='content'&&ps[i]) return ps[i]; }
      return null;
    }
    p.stickers=[];
    L.scheduleArt(p);
    await new Promise(function(r){ setTimeout(r,800); });
    var before=livePage();
    /* 产品耗时用**页面内里程碑**量（换掉成片 / 书页拿到新页），
       不用轮询墙钟 —— 轮询粒度与画布分配风暴都会混进去（实测差 2~5 倍）。 */
    var g=st.generated.find(function(q){ return q.photoId===p.id; });
    var AR0=g.art, tArt=null, tSet=null, base=performance.now();
    var origSet=L.BV.setPages;
    L.BV.setPages=function(){ if(tSet===null) tSet=performance.now()-base; return origSet.apply(this,arguments); };
    (function beat(){ if(tArt===null && g.art!==AR0) tArt=performance.now()-base;
      if(performance.now()-base<3000) requestAnimationFrame(beat); })();
    var t0=performance.now();
    p.stickers=[L.stkFix({k:'tape',x:.2,y:.14,rot:-.2,s:1.0,text:''}),
                L.stkFix({k:'doodle',x:.68,y:.7,rot:.03,s:1.4,text:'好喜欢这天'}),
                L.stkFix({k:'ticket',x:.84,y:.84,rot:-.05,s:1.0,text:'KADA · 入场券'})];
    L.scheduleArt(p);                     /* 只有这一行 —— 没有任何点击、没有 generate() */
    var after=null, ms=0;
    while(ms<3000){
      await new Promise(function(r){ setTimeout(r,25); });
      ms=performance.now()-t0;
      var cur=livePage();
      if(cur && cur!==before){ after=cur; break; }
    }
    L.BV.setPages=origSet;
    if(!before||!after) return JSON.stringify({err:'拿不到改前/改后的屏上书页'});
    var CW=330, pad=14, CAP=30;
    var CH=0;
    [before,after].forEach(function(cv){ CH=Math.max(CH, Math.round(CW*cv.height/cv.width)); });
    var c=document.createElement('canvas');
    c.width=pad+(CW+pad)*2+40; c.height=pad+CAP+CH+34;
    var x=c.getContext('2d');
    x.fillStyle='#f2efe9'; x.fillRect(0,0,c.width,c.height);
    var LB=['改之前（0 枚贴纸）','改之后（3 枚贴纸）'];
    [before,after].forEach(function(cv,i){
      var ox=pad+i*(CW+pad+20), oy=pad+CAP;
      var k=Math.min(CW/cv.width, CH/cv.height);
      var dw=cv.width*k, dh=cv.height*k;
      x.save(); x.shadowColor='rgba(0,0,0,.22)'; x.shadowBlur=12; x.shadowOffsetY=3;
      x.fillStyle='#fff'; x.fillRect(ox+(CW-dw)/2,oy+(CH-dh)/2,dw,dh); x.restore();
      x.drawImage(cv,ox+(CW-dw)/2,oy+(CH-dh)/2,dw,dh);
      x.fillStyle='#4a443c'; x.font='bold 12px sans-serif'; x.textAlign='center';
      x.fillText(LB[i],ox+CW/2,oy-10);
    });
    /* 中间那道箭头 */
    var ax=pad+CW+8, ay=pad+CAP+CH/2;
    x.strokeStyle='#2f7a4f'; x.lineWidth=2.5; x.beginPath();
    x.moveTo(ax,ay-14); x.lineTo(ax,ay); x.stroke();
    x.fillStyle='#2f7a4f'; x.font='bold 22px sans-serif'; x.textAlign='center';
    x.fillText('→',ax+14,ay+2);
    x.fillStyle='#6b6459'; x.font='12px sans-serif'; x.textAlign='left';
    x.fillText('只调了 scheduleArt(p)：没点「生成成片」、没整批重出 —— 换掉这张成片 '+
      (tArt===null?'?':Math.round(tArt))+'ms，书页拿到新页 '+(tSet===null?'?':Math.round(tSet))+'ms（含 120ms 刻意去抖）',
      pad,c.height-9);
    p.stickers=[];
    L.scheduleArt(p);
    return JSON.stringify({url:c.toDataURL('image/png'), ms:Math.round(ms),
      tArt:tArt===null?null:Math.round(tArt), tSet:tSet===null?null:Math.round(tSet)});
  `);
  console.log('  改完立刻生效: 里程碑 ' + r.tArt + '/' + r.tSet + 'ms（轮询检测到 ' + r.ms + 'ms）');
  save(r.url, OUT + '/16-改完立刻生效.png', '16-改完立刻生效');
}

/* ④ 面板实况（真实浏览器截图）—— 顺带作为工作区预览图 */
{
  const box = await ev(`
    var L=window.LUMEN, st=L.state;
    var c=L.stkCur();
    c.p.stickers=[L.stkFix({k:'tape',x:.2,y:.14,rot:-.2,s:1.0,text:''}),
                  L.stkFix({k:'doodle',x:.68,y:.7,rot:.03,s:1.4,text:'好喜欢这天'}),
                  L.stkFix({k:'stamp',x:.74,y:.17,rot:-.04,s:1.0,text:'{date}'})];
    st._stkIdx=0; st._stkSel=1;
    L.renderPanel();
    await new Promise(function(r){ setTimeout(r,700); });
    var secs=document.querySelectorAll('#panel details.sec');
    var sec=null;
    for(var i=0;i<secs.length;i++){ if(secs[i].querySelector('.stks')) { sec=secs[i]; break; } }
    if(!sec) return JSON.stringify({err:'找不到贴纸那一段'});
    sec.open=true; sec.scrollIntoView({block:'start'});
    await new Promise(function(r){ setTimeout(r,700); });
    var r=sec.getBoundingClientRect();
    var cv=document.getElementById('stkStage');
    var cb=cv?cv.getBoundingClientRect():null;
    return JSON.stringify({x:Math.round(r.left),y:Math.round(r.top),
      w:Math.round(r.width),h:Math.round(r.height),
      cv:cb?[Math.round(cb.width),Math.round(cb.height)]:null,
      dpr:window.devicePixelRatio||1});
  `);
  console.log('panel box:', JSON.stringify(box));
  await b.screenshot(WS + '/预览-13-贴纸面板-所见即所得.png');
  console.log('wrote 预览-13-贴纸面板-所见即所得');
}

await b.close();
console.log('done');
