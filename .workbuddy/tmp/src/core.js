/* ===== 以下核心引擎（渲染管线 / 模版库 / 面板 / 导出）自 v1 中抽取复用 ===== */
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.prototype.slice.call(r.querySelectorAll(s));
const R=n=>Math.round(n);
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const tick=(ms)=>new Promise(r=>setTimeout(r,ms||24));
const pad2=n=>String(n).padStart(2,'0');

const FONTS={
  hand:'"Segoe Script","Bradley Hand","STXingkai","PingFang SC","Microsoft YaHei",cursive',
  sans:'"Helvetica Neue",Helvetica,Arial,"PingFang SC","Microsoft YaHei",sans-serif',
  serif:'Georgia,"Songti SC","SimSun",serif',
  mono:'Consolas,"SFMono-Regular","Courier New",monospace'
};
const RATIOS={'1:1':[1,1],'4:5':[4,5],'3:4':[3,4],'2:3':[2,3],'9:16':[9,16],'3:2':[3,2],'16:9':[16,9],'A4':[210,297]};
const PRESETS={
  original:{label:'原片',c:'#b9b6ad',v:{brightness:1,contrast:1,saturate:1,warmth:0,grain:0,vignette:0,fade:0}},
  cream:{label:'奶油',c:'#f2d5a8',v:{brightness:1.09,contrast:.93,saturate:.9,warmth:.36,grain:.05,vignette:.06,fade:.26}},
  film:{label:'胶片',c:'#c9a06a',v:{brightness:1.02,contrast:1.13,saturate:.87,warmth:.26,grain:.36,vignette:.26,fade:.14}},
  cool:{label:'冷调',c:'#8fb6d8',v:{brightness:1,contrast:1.07,saturate:.95,warmth:-.36,grain:.08,vignette:.12,fade:0}},
  bw:{label:'黑白',c:'#9a9a9a',v:{brightness:1.05,contrast:1.2,saturate:0,warmth:0,grain:.2,vignette:.22,fade:.1}},
  vivid:{label:'浓郁',c:'#e0703c',v:{brightness:1.02,contrast:1.17,saturate:1.38,warmth:.12,grain:0,vignette:.1,fade:0}},
  vintage:{label:'复古',c:'#a9803f',v:{brightness:1.06,contrast:.9,saturate:.74,warmth:.52,grain:.24,vignette:.32,fade:.32}},
  night:{label:'夜色',c:'#4a5f8f',v:{brightness:.9,contrast:1.22,saturate:1.06,warmth:-.16,grain:.26,vignette:.42,fade:0}}
};

const NOISE=(function(){
  const c=document.createElement('canvas'); c.width=c.height=180;
  const x=c.getContext('2d'); const d=x.createImageData(180,180);
  for(let i=0;i<d.data.length;i+=4){
    const v=(Math.random()*255)|0;
    d.data[i]=d.data[i+1]=d.data[i+2]=v;
    d.data[i+3]=(Math.random()*72)|0;
  }
  x.putImageData(d,0,0); return c;
})();

/* 书页画面的出厂值：模版成品。用户逐张挑的模版必须在成书里看得见，
   否则「模版」这个功能等于白做。'plain' = 干净照片（正经摄影集）。 */
const DEFAULT_BOOK_ART='tpl';

const state={
  step:0,
  photos:[],
  sel:null,
  uid:1,
  spec:{
    ratio:'3:4', cw:1200, ch:1600, longEdge:1600, fit:'cover',
    format:'jpeg', quality:.92, borderW:0, borderColor:'#ffffff',
    radius:0, shadow:0
  },
  adj:{brightness:1,contrast:1,saturate:1,warmth:0,grain:0,vignette:0,fade:0},
  preset:'original',
  tpl:'polaroid',
  opts:{
    /* ⚠ 这里用占位符而不是固定文字，是这一版的关键：
       模版文字会按照片解开 —— 否则 28 页会整整齐齐地重复同一句「今日份」，
       那正是「生成的初始图书很丑」的最大来源。可用的占位符见 resolveTokens()。 */
    title:'{name}', sub:'{n} / {total}', corner:'NO.{n}',
    paper:'', ink:'', accent:'#e08a3c', font:'sans'
  },
  generated:[],
  book:{
    title:'光匣', sub:'A COLLECTION OF MOMENTS', author:'LUMEN STUDIO',
    spine:'LUMEN · 2026', cover:'#e8e0d2', paper:'#fffdf8', ink:'#2b2620',
    /* art:'tpl' 模版成品（默认）| 'plain' 干净照片。默认必须是 tpl ——
       否则用户辛苦逐张分配的模版在成书里完全看不见，这个功能就白做了。 */
    layout:'mat', art:DEFAULT_BOOK_ART, num:true, spread:true, cap:'name', speed:2, coverIdx:0
  }
};

function hex2rgb(h){
  h=(h||'#000').replace('#','');
  if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  const n=parseInt(h,16);
  return [(n>>16)&255,(n>>8)&255,n&255];
}
function contrast(hex){
  const c=hex2rgb(hex); const l=c[0]*.299+c[1]*.587+c[2]*.114;
  return l>150?'#2a2620':'#f7f4ef';
}
function rr(ctx,x,y,w,h,r){
  r=Math.max(0,Math.min(r||0,Math.min(w,h)/2));
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
function fitFont(ctx,text,maxW,family,maxSize,minSize,weight){
  let s=maxSize;
  do{
    ctx.font=(weight||'700')+' '+R(s)+'px '+family;
    if(ctx.measureText(text).width<=maxW) break;
    s-=Math.max(1,s*0.035);
  }while(s>(minSize||10));
  return s;
}
function grainOver(ctx,W,H,a,comp){
  ctx.save(); ctx.globalAlpha=a; ctx.globalCompositeOperation=comp||'overlay';
  ctx.fillStyle=ctx.createPattern(NOISE,'repeat');
  ctx.fillRect(0,0,W,H); ctx.restore();
}
function toast(msg){
  const t=$('#toast'); t.textContent=msg; t.classList.add('on');
  clearTimeout(toast._t); toast._t=setTimeout(()=>t.classList.remove('on'),2100);
}
/* ================= 偏好与分配的持久化 =================
   单文件离线运行，localStorage 在 file:// 下并非所有浏览器都放行，
   所以全部包在 try/catch 里；存不下时只影响「关掉再打开还在不在」，
   应用内的选择照样全部记得住（内存里就是同一份数据）。 */
const PERSIST=(function(){
  const KEY='lumen.prefs.v1';
  let ok=false, mem=null, timer=null;
  try{ localStorage.setItem('__lumen_t','1'); localStorage.removeItem('__lumen_t'); ok=true; }
  catch(e){ ok=false; }
  function read(){
    if(mem) return mem;
    if(!ok) return (mem={});
    try{ mem=JSON.parse(localStorage.getItem(KEY)||'{}')||{}; }catch(e){ mem={}; }
    return mem;
  }
  function flush(){
    if(!ok) return false;
    const s=read();
    s.tpl=state.tpl; s.theme=document.documentElement.getAttribute('data-theme')||'dark';
    s.spec=state.spec; s.adj=state.adj; s.preset=state.preset;
    s.opts=state.opts; s.book=state.book;
    s.assign={};
    (state.photos||[]).forEach(function(p){ s.assign[p.name]={tpl:p.tpl,picked:!!p.picked}; });
    try{ localStorage.setItem(KEY,JSON.stringify(s)); return true; }
    catch(e){ ok=false; return false; }
  }
  function save(){ if(!ok) return; clearTimeout(timer); timer=setTimeout(flush,200); }
  function assignFor(name){ if(!name) return null; const s=read(); return (s.assign&&s.assign[name])||null; }
  function restore(){
    const s=read();
    /* 模版文字改成占位符之后，老存档里还是「今日份」那句常量 ——
       不迁移的话，已经用过一版的人升级上来，看到的仍然是 28 页重复同一句话，
       等于这个修复对他不可见。只升级「原封不动等于旧默认值」的字段，
       用户自己改过的文字一律不动。 */
    if(s.opts&&typeof s.opts==='object'){
      if(s.opts.title==='今日份')       s.opts.title=DEFAULT_OPTS.title;
      if(s.opts.sub==='2026 · LUMEN')   s.opts.sub=DEFAULT_OPTS.sub;
      if(s.opts.corner==='NO.01')       s.opts.corner=DEFAULT_OPTS.corner;
    }
    /* 老存档的书本设置里没有「书页画面」，补上默认值（模版成品） */
    if(s.book&&typeof s.book==='object'&&s.book.art==null) s.book.art=DEFAULT_BOOK_ART;
    ['spec','adj','opts','book'].forEach(function(g){
      if(s[g]&&typeof s[g]==='object') Object.keys(s[g]).forEach(function(k){ state[g][k]=s[g][k]; });
    });
    if(s.preset&&PRESETS[s.preset]) state.preset=s.preset;
    if(s.tpl&&TPL[s.tpl]) state.tpl=s.tpl;
    return s;
  }
  function clear(){ try{ localStorage.removeItem(KEY); }catch(e){} mem={}; }
  return {ok:function(){return ok;},save:save,flush:flush,restore:restore,
    assignFor:assignFor,clear:clear,KEY:KEY};
})();

/* ================= 素材 ================= */
function makeSample(i){
  const pals=[
    {a:'#1d2b53',b:'#ff8a5b',c:'#ffd166',d:'#0d1024'},
    {a:'#0f2027',b:'#2c5364',c:'#7fd8d0',d:'#050a0c'},
    {a:'#3a1c71',b:'#d76d77',c:'#ffaf7b',d:'#150a24'},
    {a:'#134e5e',b:'#71b280',c:'#d9f0c0',d:'#0a2420'},
    {a:'#41295a',b:'#2f0743',c:'#f0a6ca',d:'#160526'},
    {a:'#5b3a29',b:'#c98b5e',c:'#f0d9b5',d:'#241309'}
  ];
  const p=pals[i%pals.length], W=1200, H=1600;
  const c=document.createElement('canvas'); c.width=W; c.height=H;
  const x=c.getContext('2d');
  const g=x.createLinearGradient(0,0,0,H*0.74);
  g.addColorStop(0,p.d); g.addColorStop(.44,p.a); g.addColorStop(.78,p.b); g.addColorStop(1,p.c);
  x.fillStyle=g; x.fillRect(0,0,W,H);
  const sx=W*(0.28+0.44*((i*0.31)%1)), sy=H*(0.40+0.14*((i*0.17)%1));
  const rg=x.createRadialGradient(sx,sy,0,sx,sy,W*0.44);
  rg.addColorStop(0,'rgba(255,238,186,.92)');
  rg.addColorStop(.17,'rgba(255,198,124,.5)');
  rg.addColorStop(1,'rgba(255,150,80,0)');
  x.fillStyle=rg; x.fillRect(0,0,W,H);
  x.beginPath(); x.arc(sx,sy,W*0.072,0,7); x.fillStyle='#fff4d4'; x.fill();
  for(let m=0;m<3;m++){
    x.beginPath(); x.moveTo(0,H);
    const base=H*(0.58+m*0.078);
    x.lineTo(0,base);
    const seg=5+m;
    for(let s=0;s<=seg;s++){
      const px=W*s/seg;
      const py=base-(Math.sin(s*1.7+m*2.3+i)*0.5+0.5)*(H*0.13)-(m===0?H*0.02:0);
      x.lineTo(px,py);
    }
    x.lineTo(W,H); x.closePath();
    x.fillStyle=['rgba(12,16,32,.48)','rgba(9,12,26,.7)','rgba(5,7,16,.9)'][m];
    x.fill();
  }
  x.globalAlpha=.2;
  for(let k=0;k<46;k++){
    x.fillStyle='rgba(255,255,255,'+(Math.random()*0.6)+')';
    x.fillRect(W*Math.random()*0.92,H*(0.8+Math.random()*0.18),W*(0.03+Math.random()*0.14),2+Math.random()*3);
  }
  x.globalAlpha=1;
  grainOver(x,W,H,.07,'overlay');
  return c;
}
/* 每张照片各自带模版（tpl）与是否入册（picked）。
   tpl 默认取胶片带上当前选中那一套 —— 「先挑一套，再导入」和「先导入，再逐张改」都成立。 */
function makePhoto(el,w,h,name){
  return {id:'p'+(state.uid++),el:el,w:w,h:h,name:name||'未命名',thumb:'',
    tpl:(TPL[state.tpl]?state.tpl:'polaroid'),picked:true,
    rot:0,zoom:1,ox:0,oy:0,_cache:null,_rot:-1};
}
function pushPhoto(p){
  if(!p.thumb){
    const t=document.createElement('canvas');
    const k=Math.min(300/Math.max(p.w,p.h),1);
    t.width=Math.max(1,R(p.w*k)); t.height=Math.max(1,R(p.h*k));
    t.getContext('2d').drawImage(p.el,0,0,t.width,t.height);
    p.thumb=t.toDataURL('image/jpeg',.7);
  }
  /* 上次给同名照片分配过的模版/入册状态，直接接回来 */
  const a=PERSIST.assignFor(p.name);
  if(a){
    if(a.tpl&&TPL[a.tpl]) p.tpl=a.tpl;
    if(typeof a.picked==='boolean') p.picked=a.picked;
    p._restored=true;
  }
  state.photos.push(p);
  if(state.sel===null) state.sel=p.id;
}
function addSamples(){
  const n=state.photos.length?2:6;
  for(let i=0;i<n;i++) pushPhoto(makePhoto(makeSample(i+state.uid),1200,1600,'示例 0'+(i+1)));
  renderRail(); schedulePreview(); toast('已载入 '+n+' 张示例照片');
}
function addFiles(list){
  const files=Array.prototype.slice.call(list||[]).filter(f=>/^image\//.test(f.type));
  if(!files.length) return;
  let n=0;
  files.forEach(f=>{
    const url=URL.createObjectURL(f);
    const img=new Image();
    img.onload=()=>{
      pushPhoto(makePhoto(img,img.naturalWidth,img.naturalHeight,f.name.replace(/\.[^.]+$/,'')));
      n++; renderRail(); schedulePreview(); PERSIST.save();
      if(n===files.length) toast('已导入 '+n+' 张照片'+(n===1?'':''));
    };
    img.onerror=()=>URL.revokeObjectURL(url);
    img.src=url;
  });
}
function prep(photo){
  if(!photo.rot) return {el:photo.el,w:photo.w,h:photo.h};
  if(photo._rot===photo.rot&&photo._cache) return photo._cache;
  const r=((photo.rot%360)+360)%360;
  const c=document.createElement('canvas');
  if(r%180===0){ c.width=photo.w; c.height=photo.h; }
  else { c.width=photo.h; c.height=photo.w; }
  const x=c.getContext('2d');
  x.translate(c.width/2,c.height/2);
  x.rotate(r*Math.PI/180);
  x.drawImage(photo.el,-photo.w/2,-photo.h/2,photo.w,photo.h);
  photo._cache={el:c,w:c.width,h:c.height}; photo._rot=photo.rot;
  return photo._cache;
}

/* ================= 渲染管线 ================= */
function ratioPair(){
  const s=state.spec;
  if(s.ratio==='custom') return [Math.max(16,s.cw),Math.max(16,s.ch)];
  if(s.ratio==='original'){
    const p=state.photos.find(q=>q.id===state.sel)||state.photos[0];
    if(p){ const d=prep(p); return [d.w,d.h]; }
    return [3,4];
  }
  return RATIOS[s.ratio]||[3,4];
}
function targetSize(photo,longEdge){
  const L=longEdge||state.spec.longEdge;
  let a,b;
  const ab=ratioPair(); a=ab[0]; b=ab[1];
  if(state.spec.ratio==='original'&&photo){ const d=prep(photo); a=d.w; b=d.h; }
  let w,h;
  if(a>=b){ w=L; h=R(L*b/a); } else { h=L; w=R(L*a/b); }
  return {w:Math.max(64,w), h:Math.max(64,h)};
}
function postEffects(ctx,x,y,w,h){
  const a=state.adj;
  if(a.warmth){
    ctx.save(); ctx.globalCompositeOperation='soft-light';
    ctx.globalAlpha=Math.min(.85,Math.abs(a.warmth)*.6);
    ctx.fillStyle=a.warmth>0?'#ff9a3c':'#4a7cff';
    ctx.fillRect(x,y,w,h); ctx.restore();
  }
  if(a.fade){
    ctx.save(); ctx.globalCompositeOperation='lighten';
    ctx.globalAlpha=a.fade*.5; ctx.fillStyle='#3a3a44';
    ctx.fillRect(x,y,w,h); ctx.restore();
  }
  if(a.vignette){
    const g=ctx.createRadialGradient(x+w/2,y+h/2,Math.min(w,h)*.16,x+w/2,y+h/2,Math.max(w,h)*.74);
    g.addColorStop(0,'rgba(0,0,0,0)');
    g.addColorStop(1,'rgba(0,0,0,'+(0.8*a.vignette)+')');
    ctx.fillStyle=g; ctx.fillRect(x,y,w,h);
  }
  if(a.grain){
    ctx.save(); ctx.globalAlpha=a.grain*.4; ctx.globalCompositeOperation='overlay';
    ctx.fillStyle=ctx.createPattern(NOISE,'repeat');
    ctx.fillRect(x,y,w,h); ctx.restore();
  }
}
function drawFit(ctx,photo,x,y,w,h,ov){
  const d=prep(photo);
  const fit=state.spec.fit;
  const zoom=(ov&&ov.zoom!=null?ov.zoom:photo.zoom)||1;
  const ox=(ov&&ov.ox!=null?ov.ox:photo.ox)||0;
  const oy=(ov&&ov.oy!=null?ov.oy:photo.oy)||0;
  ctx.save();
  ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip();
  if(fit==='blurfill'){
    const k2=Math.max(w/d.w,h/d.h)*1.22;
    const dw2=d.w*k2, dh2=d.h*k2;
    ctx.filter='blur('+Math.max(6,w*.035)+'px) saturate(1.3) brightness(.72)';
    ctx.drawImage(d.el,x+(w-dw2)/2,y+(h-dh2)/2,dw2,dh2);
    ctx.filter='none';
  }
  let k;
  if(fit==='contain') k=Math.min(w/d.w,h/d.h)*zoom;
  else k=Math.max(w/d.w,h/d.h)*zoom;
  const dw=d.w*k, dh=d.h*k;
  const dx=x+(w-dw)/2+ox*w*.5;
  const dy=y+(h-dh)/2+oy*h*.5;
  const a=state.adj;
  ctx.filter='brightness('+a.brightness+') contrast('+a.contrast+') saturate('+a.saturate+')';
  ctx.drawImage(d.el,dx,dy,dw,dh);
  ctx.filter='none';
  postEffects(ctx,x,y,w,h);
  ctx.restore();
}
function paintPhoto(ctx,photo,x,y,w,h,r,ov){
  ctx.save();
  if(r>0){ rr(ctx,x,y,w,h,r); ctx.clip(); } else { ctx.beginPath(); ctx.rect(x,y,w,h); ctx.clip(); }
  drawFit(ctx,photo,x,y,w,h,ov);
  ctx.restore();
}
function renderCanvas(photo,tplId,opts,longEdge){
  const sz=targetSize(photo,longEdge);
  const c=document.createElement('canvas'); c.width=sz.w; c.height=sz.h;
  const ctx=c.getContext('2d');
  const W=sz.w, H=sz.h;
  const t=TPL[tplId]||TPL.polaroid;
  const cx={
    ctx:ctx,W:W,H:H,photo:photo,o:opts||{},f:k=>FONTS[k]||FONTS.sans,
    paint:(x,y,w,h,r,ov)=>paintPhoto(ctx,photo,x,y,w,h,r,ov),
    plate:(x,y,w,h,r,color,blur,oy)=>{
      ctx.save();
      ctx.shadowColor=color||'rgba(0,0,0,.3)';
      ctx.shadowBlur=blur||W*.02;
      ctx.shadowOffsetY=oy||0;
      ctx.fillStyle='#ffffff';
      rr(ctx,x,y,w,h,r||0); ctx.fill(); ctx.restore();
    },
    rr:(x,y,w,h,r)=>rr(ctx,x,y,w,h,r),
    grain:(a,comp)=>grainOver(ctx,W,H,a,comp)
  };
  t.draw(cx);
  return c;
}
/* 「干净照片」：只走调色管线（亮度/对比/饱和/暖度/暗角/颗粒），
   不加任何模版外壳（宝丽来白框、杂志大字、贴纸胶带……）。
   ⚠ 书本内页必须用这张，不能用模版成品：
     一本摄影集不会在每一页都套同一个装饰框，更不会让模版自带的那行
     「今日份 / 2026·LUMEN」在 28 页上重复 28 遍 —— 那正是「生成的
     初始图书很丑」的最大来源。模版是「单张成片」的玩法，书本是另一回事。
   画布按照片原始比例出，版式留给 renderContent 去排。 */
function renderPlain(photo,longEdge){
  const d=prep(photo);
  const L=longEdge||state.spec.longEdge;
  const k=Math.min(1,L/Math.max(d.w,d.h));
  const w=Math.max(64,R(d.w*k)), h=Math.max(64,R(d.h*k));
  const c=document.createElement('canvas'); c.width=w; c.height=h;
  const x=c.getContext('2d');
  /* 用 paintPhoto 而不是裸 drawImage：这样缩放/平移（zoom/ox/oy）跟着这张照片走 */
  paintPhoto(x,photo,0,0,w,h,0);
  return c;
}
function finalize(art){
  const s=state.spec;
  const mx=Math.max(art.width,art.height), mn=Math.min(art.width,art.height);
  const r=R(s.radius*mn/100);
  const b=R(s.borderW*mx/100);
  const sh=R(s.shadow*mx/1200);
  if(!r&&!b&&!sh) return art;
  const out=sh*2;
  const c=document.createElement('canvas');
  c.width=art.width+b*2+out*2; c.height=art.height+b*2+out*2;
  const x=c.getContext('2d');
  const X=out+b, Y=out+b;
  if(sh){
    x.save(); x.shadowColor='rgba(0,0,0,.34)';
    x.shadowBlur=sh*1.7; x.shadowOffsetY=sh*.55;
    x.fillStyle='#ffffff'; rr(x,X,Y,art.width,art.height,r); x.fill(); x.restore();
  }
  if(b){
    x.fillStyle=s.borderColor||'#ffffff';
    rr(x,out,out,art.width+b*2,art.height+b*2,r+b*.6); x.fill();
  }
  x.save(); rr(x,X,Y,art.width,art.height,r); x.clip();
  x.drawImage(art,X,Y); x.restore();
  return c;
}
/* ================= 模版库 ================= */
const TPL={
polaroid:{name:'宝丽来',hint:'经典白框 · 手写心情',
  draw(c){
    const ctx=c.ctx,W=c.W,H=c.H,o=c.o,f=c.f;
    ctx.fillStyle=o.paper||'#fdfaf3'; ctx.fillRect(0,0,W,H);
    grainOver(ctx,W,H,.05,'overlay');
    const pad=W*.075, top=H*.068, cap=H*.2;
    const pw=W-pad*2, ph=H-top-cap-W*.03;
    c.plate(pad,top,pw,ph,0,'rgba(0,0,0,.34)',W*.022,W*.008);
    c.paint(pad,top,pw,ph,0);
    ctx.textAlign='center'; ctx.textBaseline='middle';
    ctx.fillStyle=o.ink||'#3a342c';
    ctx.font=R(H*.038)+'px '+f('hand');
    ctx.fillText(o.title||'今日份',W/2,top+ph+cap*.42);
    if(o.sub){
      ctx.fillStyle='rgba(58,52,44,.52)';
      ctx.font=R(H*.019)+'px '+f('sans');
      ctx.fillText(o.sub,W/2,top+ph+cap*.7);
    }
    if(o.corner){
      ctx.textAlign='left'; ctx.fillStyle=o.accent||'#d98d3a';
      ctx.font=R(H*.022)+'px '+f('sans');
      ctx.fillText(o.corner,pad,H*.97);
    }
  }},
film:{name:'胶片',hint:'齿孔 · 编号 · 柯达感',
  draw(c){
    const ctx=c.ctx,W=c.W,H=c.H,o=c.o,f=c.f;
    ctx.fillStyle='#0d0b0a'; ctx.fillRect(0,0,W,H);
    const sx=W*.135, sy=H*.1, sw=W-sx*2, sh=H-sy*2;
    ctx.fillStyle='#181512';
    rr(ctx,sx-W*.012,sy-H*.007,sw+W*.024,sh+H*.014,W*.012); ctx.fill();
    c.paint(sx,sy,sw,sh,0);
    ctx.fillStyle='#221d18';
    const n=13, hw=W*.05, hh=H*.04, gap=(H-hh*1.7)/(n-1);
    for(let i=0;i<n;i++){
      const y=hh*.85+i*gap;
      rr(ctx,W*.05-hw/2,y-hh/2,hw,hh,hw*.32); ctx.fill();
      rr(ctx,W*.95-hw/2,y-hh/2,hw,hh,hw*.32); ctx.fill();
    }
    const acc=o.accent||'#e08a3c';
    ctx.textBaseline='alphabetic';
    ctx.fillStyle=acc; ctx.font='700 '+R(H*.021)+'px '+f('mono'); ctx.textAlign='left';
    ctx.fillText('12A',W*.072,sy+sh+H*.038);
    ctx.save();
    ctx.translate(W*.9,sy+sh+H*.038);
    ctx.rotate(-Math.PI/2);
    ctx.fillStyle='rgba(224,138,60,.78)';
    ctx.fillText('KODAK 400 · 36EXP',0,0);
    ctx.restore();
    if(o.title){
      ctx.textAlign='right'; ctx.fillStyle='rgba(255,255,255,.86)';
      ctx.font=R(H*.021)+'px '+f('sans');
      ctx.fillText(o.title,W*.928,sy+sh+H*.038);
    }
  }},
magazine:{name:'杂志',hint:'封面标题 · 期号 · 条码',
  draw(c){
    const ctx=c.ctx,W=c.W,H=c.H,o=c.o,f=c.f;
    c.paint(0,0,W,H,0);
    let g=ctx.createLinearGradient(0,0,0,H*.5);
    g.addColorStop(0,'rgba(0,0,0,.62)'); g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(0,0,W,H*.5);
    g=ctx.createLinearGradient(0,H*.52,0,H);
    g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop(1,'rgba(0,0,0,.84)');
    ctx.fillStyle=g; ctx.fillRect(0,H*.52,W,H*.48);
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    ctx.fillStyle='#fff'; ctx.font='600 '+R(H*.026)+'px '+f('sans');
    ctx.fillText('ISSUE 07 / 2026',W*.07,H*.085);
    ctx.globalAlpha=.78; ctx.font=R(H*.017)+'px '+f('sans');
    ctx.fillText('VOLUME ONE · LUMEN PRESS',W*.07,H*.115);
    ctx.globalAlpha=1;
    const t=(o.title||'光影记事').split('\n')[0];
    fitFont(ctx,t,W*.86,f('sans'),H*.105,H*.04,'800');
    ctx.fillStyle='#fff'; ctx.fillText(t,W*.07,H*.9);
    ctx.fillStyle=o.accent||'#f0a63c';
    ctx.fillRect(W*.07,H*.925,W*.2,H*.006);
    if(o.sub){
      ctx.fillStyle='rgba(255,255,255,.85)'; ctx.font=R(H*.019)+'px '+f('sans');
      ctx.fillText(o.sub,W*.07,H*.968);
    }
    const bx=W*.78, by=H*.05, bw=W*.15, bh=H*.048;
    ctx.fillStyle='rgba(255,255,255,.92)'; ctx.fillRect(bx,by,bw,bh);
    ctx.fillStyle='#111';
    let px=bx+W*.008;
    while(px<bx+bw-W*.01){
      const w=W*(0.003+Math.random()*0.006);
      ctx.fillRect(px,by+bh*.16,w,bh*.68);
      px+=w+W*(0.004+Math.random()*0.008);
    }
  }},
kraft:{name:'牛皮纸',hint:'胶带 · 手写日期 · 手账感',
  draw(c){
    const ctx=c.ctx,W=c.W,H=c.H,o=c.o,f=c.f;
    ctx.fillStyle=o.paper||'#cbae8b'; ctx.fillRect(0,0,W,H);
    grainOver(ctx,W,H,.16,'overlay');
    const pw=W*.72, ph=H*.6;
    ctx.save();
    ctx.translate(W/2,H*.45); ctx.rotate(-.028);
    c.plate(-pw/2,-ph/2,pw,ph,0,'rgba(0,0,0,.36)',W*.02,0);
    c.paint(-pw/2,-ph/2,pw,ph,0);
    ctx.strokeStyle='rgba(255,255,255,.85)'; ctx.lineWidth=W*.014;
    ctx.strokeRect(-pw/2+W*.007,-ph/2+W*.007,pw-W*.014,ph-W*.014);
    ctx.restore();
    ctx.globalAlpha=.5; ctx.fillStyle='#f7f2e4';
    ctx.save(); ctx.translate(W*.26,H*.145); ctx.rotate(-.36);
    ctx.fillRect(-W*.15,-H*.028,W*.3,H*.056); ctx.restore();
    ctx.save(); ctx.translate(W*.75,H*.765); ctx.rotate(.32);
    ctx.fillRect(-W*.15,-H*.028,W*.3,H*.056); ctx.restore();
    ctx.globalAlpha=1;
    ctx.strokeStyle='rgba(60,45,30,.5)'; ctx.lineWidth=W*.005;
    ctx.beginPath(); ctx.arc(W*.79,H*.885,W*.1,0,7); ctx.stroke();
    ctx.beginPath(); ctx.arc(W*.79,H*.885,W*.076,0,7); ctx.stroke();
    ctx.fillStyle='rgba(60,45,30,.75)'; ctx.textAlign='center';
    ctx.font='700 '+R(H*.019)+'px '+f('mono');
    ctx.fillText('2026.09',W*.79,H*.877);
    ctx.font=R(H*.017)+'px '+f('mono');
    ctx.fillText('LUMEN STUDIO',W*.79,H*.906);
    ctx.textAlign='left'; ctx.fillStyle='#4a3a28';
    ctx.font=R(H*.034)+'px '+f('hand');
    ctx.fillText(o.title||'慢慢生活',W*.1,H*.885);
    if(o.sub){
      ctx.globalAlpha=.72; ctx.font=R(H*.021)+'px '+f('hand');
      ctx.fillText(o.sub,W*.1,H*.928); ctx.globalAlpha=1;
    }
  }},
neon:{name:'霓虹',hint:'发光标题 · 夜色赛博',
  draw(c){
    const ctx=c.ctx,W=c.W,H=c.H,o=c.o,f=c.f;
    ctx.fillStyle=o.paper||'#080a14'; ctx.fillRect(0,0,W,H);
    ctx.fillStyle='rgba(120,160,255,.15)';
    for(let y=H*.03;y<H*.97;y+=H*.035){
      for(let x=W*.04;x<W*.96;x+=W*.05){
        ctx.beginPath(); ctx.arc(x,y,W*.0036,0,7); ctx.fill();
      }
    }
    const pad=W*.09, top=H*.11, pw=W-pad*2, ph=H*.6;
    const acc=o.accent||'#39e6ff', acc2=o.accent2||'#ff4fd8';
    ctx.save();
    ctx.shadowColor=acc; ctx.shadowBlur=W*.05;
    ctx.strokeStyle=acc2; ctx.lineWidth=W*.006;
    rr(ctx,pad,top,pw,ph,W*.03); ctx.stroke();
    ctx.strokeStyle=acc; ctx.lineWidth=W*.0025;
    rr(ctx,pad+W*.016,top+H*.012,pw-W*.032,ph-H*.024,W*.022); ctx.stroke();
    ctx.restore();
    c.paint(pad+W*.016,top+H*.012,pw-W*.032,ph-H*.024,W*.022);
    const t=o.title||'NEON NIGHT';
    ctx.textAlign='center'; ctx.textBaseline='middle';
    fitFont(ctx,t,W*.8,f('sans'),H*.085,H*.03,'800');
    ctx.save();
    ctx.shadowColor=acc; ctx.shadowBlur=H*.055;
    ctx.fillStyle='#f2feff';
    ctx.fillText(t,W/2,top+ph+H*.1);
    ctx.restore();
    if(o.sub){
      ctx.fillStyle='rgba(233,252,255,.58)'; ctx.font=R(H*.02)+'px '+f('mono');
      ctx.fillText(o.sub,W/2,top+ph+H*.157);
    }
  }},
minimal:{name:'极简',hint:'留白 · 极细线 · 小字',
  draw(c){
    const ctx=c.ctx,W=c.W,H=c.H,o=c.o,f=c.f;
    ctx.fillStyle=o.paper||'#ffffff'; ctx.fillRect(0,0,W,H);
    const pad=W*.17;
    const pw=W-pad*2-W*.06, ph=H*.5;
    c.paint(W/2-pw/2,H*.15,pw,ph,0);
    ctx.strokeStyle='rgba(0,0,0,.13)'; ctx.lineWidth=Math.max(1,W*.0014);
    ctx.beginPath(); ctx.moveTo(pad,H*.735); ctx.lineTo(W-pad,H*.735); ctx.stroke();
    ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    ctx.fillStyle='#121212'; ctx.font='300 '+R(H*.032)+'px '+f('sans');
    ctx.fillText(o.title||'静物',W/2,H*.788);
    if(o.sub){
      ctx.fillStyle='rgba(0,0,0,.42)'; ctx.font=R(H*.016)+'px '+f('sans');
      ctx.fillText(o.sub,W/2,H*.828);
    }
    if(o.corner){
      ctx.textAlign='right'; ctx.fillStyle='rgba(0,0,0,.3)';
      ctx.font=R(H*.014)+'px '+f('sans');
      ctx.fillText(o.corner,W-pad,H*.955);
    }
  }},
postcard:{name:'明信片',hint:'邮戳 · 地址线 · 旅行感',
  draw(c){
    const ctx=c.ctx,W=c.W,H=c.H,o=c.o,f=c.f;
    ctx.fillStyle=o.paper||'#fdfaf3'; ctx.fillRect(0,0,W,H);
    grainOver(ctx,W,H,.04,'overlay');
    const m=W*.055;
    ctx.save();
    ctx.shadowColor='rgba(0,0,0,.22)'; ctx.shadowBlur=W*.014; ctx.shadowOffsetY=W*.004;
    c.paint(m,m,W-m*2,H*.56,0);
    ctx.restore();
    ctx.strokeStyle='rgba(0,0,0,.16)'; ctx.lineWidth=Math.max(1,W*.0014);
    ctx.beginPath(); ctx.moveTo(m,H*.69); ctx.lineTo(W-m,H*.69); ctx.stroke();
    ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    ctx.fillStyle='#171512'; ctx.font=R(H*.034)+'px '+f('serif');
    ctx.fillText(o.title||'来自远方',W/2,H*.762);
    if(o.sub){
      ctx.fillStyle='rgba(0,0,0,.45)'; ctx.font=R(H*.018)+'px '+f('sans');
      ctx.fillText(o.sub,W/2,H*.802);
    }
    ctx.strokeStyle='rgba(40,60,90,.32)'; ctx.lineWidth=Math.max(1,W*.0012);
    for(let i=0;i<3;i++){
      const y=H*.862+i*H*.042;
      ctx.beginPath(); ctx.moveTo(m+H*.02,y); ctx.lineTo(W*.64,y); ctx.stroke();
    }
    ctx.save();
    ctx.strokeStyle='rgba(40,60,90,.5)'; ctx.lineWidth=W*.004;
    ctx.beginPath(); ctx.arc(W*.8,H*.888,W*.093,0,7); ctx.stroke();
    ctx.beginPath(); ctx.arc(W*.8,H*.888,W*.073,0,7); ctx.stroke();
    ctx.fillStyle='rgba(40,60,90,.75)'; ctx.textAlign='center';
    ctx.font='700 '+R(H*.017)+'px '+f('mono');
    ctx.fillText('POST',W*.8,H*.88);
    ctx.font=R(H*.014)+'px '+f('mono');
    ctx.fillText('2026',W*.8,H*.908);
    ctx.restore();
    ctx.strokeStyle='rgba(40,60,90,.3)'; ctx.lineWidth=Math.max(1,W*.0012);
    ctx.beginPath(); ctx.moveTo(W*.63,H*.862); ctx.lineTo(W*.8,H*.862); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(W*.63,H*.915); ctx.lineTo(W*.8,H*.915); ctx.stroke();
  }},
duotone:{name:'双色',hint:'套印 · 大字号 · 海报感',
  draw(c){
    const ctx=c.ctx,W=c.W,H=c.H,o=c.o,f=c.f;
    const acc=o.accent||'#ff7a45';
    ctx.fillStyle='#0e121a'; ctx.fillRect(0,0,W,H);
    const m=W*.1;
    const duo=makeDuotone(c.photo,W-m*2,H*.66,acc,'#141d52');
    ctx.drawImage(duo,m,H*.1);
    ctx.save();
    ctx.globalCompositeOperation='screen';
    ctx.fillStyle=acc; ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    fitFont(ctx,o.title||'DUOTONE',W*.86,f('sans'),H*.115,H*.045,'800');
    ctx.fillText(o.title||'DUOTONE',m,H*.925);
    ctx.restore();
    ctx.fillStyle='rgba(255,255,255,.5)'; ctx.textAlign='left';
    ctx.font=R(H*.018)+'px '+f('mono');
    ctx.fillText(o.sub||'TWO-COLOR PRINT · 2026',m,H*.965);
  }},
grid9:{name:'九宫格',hint:'拼贴 · 白缝 · 影集感',
  draw(c){
    const ctx=c.ctx,W=c.W,H=c.H,o=c.o,f=c.f;
    ctx.fillStyle=o.paper||'#f4f1ea'; ctx.fillRect(0,0,W,H);
    grainOver(ctx,W,H,.04,'overlay');
    const m=W*.085, g=W*.017, cell=(W-m*2-g*2)/3;
    const gridH=cell*3+g*2;
    const y0=(H-gridH)/2-H*.045;
    for(let r=0;r<3;r++){
      for(let col=0;col<3;col++){
        const k=r*3+col;
        const z=1+((k*2)%3)*.3;
        const ox=(((k*3)%3)-1)*.16;
        const oy=(r-1)*.14;
        c.paint(m+col*(cell+g),y0+r*(cell+g),cell,cell,0,{zoom:z,ox:ox,oy:oy});
      }
    }
    if(o.title){
      ctx.textAlign='center'; ctx.textBaseline='alphabetic';
      ctx.fillStyle=o.ink||'#2c2820'; ctx.font=R(H*.032)+'px '+f('sans');
      ctx.fillText(o.title,W/2,H*.965);
    }
  }},
cinematic:{name:'宽银幕',hint:'黑边 · 字幕 · 时间码',
  draw(c){
    const ctx=c.ctx,W=c.W,H=c.H,o=c.o,f=c.f;
    ctx.fillStyle='#08090b'; ctx.fillRect(0,0,W,H);
    const bh=H*.135, ph=H-bh*2;
    c.paint(0,bh,W,ph,0);
    ctx.textAlign='left'; ctx.textBaseline='alphabetic';
    ctx.fillStyle='rgba(255,255,255,.48)'; ctx.font=R(H*.026)+'px '+f('mono');
    ctx.fillText('00:'+pad2(((o.title||'S').length*7)%60)+':24',W*.045,bh*.66);
    ctx.textAlign='right';
    ctx.fillText('4K · 24FPS',W*.955,bh*.66);
    ctx.textAlign='center'; ctx.fillStyle=o.accent||'#ffd479';
    ctx.font='600 '+R(H*.028)+'px '+f('mono');
    ctx.fillText(o.title||'SCENE 01',W/2,H-bh*.4);
    if(o.sub){
      ctx.fillStyle='rgba(255,255,255,.45)'; ctx.font=R(H*.019)+'px '+f('sans');
      ctx.fillText(o.sub,W/2,H-bh*.13);
    }
  }},
titlecard:{name:'章节页',hint:'无图 · 大编号 · 分隔线',
  draw(c){
    const ctx=c.ctx,W=c.W,H=c.H,o=c.o,f=c.f;
    ctx.fillStyle=o.paper||'#fffdf8'; ctx.fillRect(0,0,W,H);
    grainOver(ctx,W,H,.04,'overlay');
    ctx.save(); ctx.globalAlpha=.09; c.paint(W*.1,H*.1,W*.8,H*.8,0); ctx.restore();
    ctx.textAlign='center'; ctx.textBaseline='alphabetic';
    ctx.fillStyle=o.ink||'#1c1a17';
    ctx.font='800 '+R(H*.16)+'px '+f('serif');
    ctx.fillText(o.corner||'01',W/2,H*.455);
    ctx.strokeStyle='rgba(28,26,23,.3)'; ctx.lineWidth=Math.max(1,W*.0016);
    ctx.beginPath(); ctx.moveTo(W*.35,H*.53); ctx.lineTo(W*.65,H*.53); ctx.stroke();
    ctx.font=R(H*.052)+'px '+f('serif');
    ctx.fillText(o.title||'第一章',W/2,H*.6);
    if(o.sub){
      ctx.fillStyle='rgba(28,26,23,.5)'; ctx.font=R(H*.02)+'px '+f('sans');
      ctx.fillText(o.sub,W/2,H*.645);
    }
  }}
};
function makeDuotone(photo,w,h,c1,c2){
  const c=document.createElement('canvas');
  c.width=Math.max(1,R(w)); c.height=Math.max(1,R(h));
  const x=c.getContext('2d');
  drawFit(x,photo,0,0,c.width,c.height);
  const d=x.getImageData(0,0,c.width,c.height), p=d.data;
  const A=hex2rgb(c1), B=hex2rgb(c2);
  for(let i=0;i<p.length;i+=4){
    const l=(p[i]*.299+p[i+1]*.587+p[i+2]*.114)/255;
    p[i]=B[0]+(A[0]-B[0])*l;
    p[i+1]=B[1]+(A[1]-B[1])*l;
    p[i+2]=B[2]+(A[2]-B[2])*l;
    p[i+3]=255;
  }
  x.putImageData(d,0,0);
  return c;
}
/* ================= 书本页面渲染 ================= */
function drawCoverTo(ctx,src,x,y,w,h){
  const k=Math.max(w/src.width,h/src.height);
  ctx.drawImage(src,x+(w-src.width*k)/2,y+(h-src.height*k)/2,src.width*k,src.height*k);
}
function pageAspect(){
  const s=state.spec;
  if(s.ratio==='custom') return [Math.max(16,s.cw),Math.max(16,s.ch)];
  if(s.ratio==='original'){ const p=state.photos[0]; if(p){ const d=prep(p); return [d.w,d.h]; } }
  return RATIOS[s.ratio]||[3,4];
}
function nc(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }
/* 手工字距。ctx.letterSpacing 并非所有浏览器都实现，逐个字符画最稳，
   而且能顺便拿到整行宽度好做居中/右对齐。 */
function tracked(ctx,text,x,y,track,align){
  const ch=String(text==null?'':text).split('');
  if(!ch.length) return 0;
  let total=0;
  const ws=[];
  for(let i=0;i<ch.length;i++){ const w=ctx.measureText(ch[i]).width; ws.push(w); total+=w; }
  total+=track*(ch.length-1);
  let px=align==='center'?x-total/2:(align==='right'?x-total:x);
  const old=ctx.textAlign; ctx.textAlign='left';
  for(let i=0;i<ch.length;i++){ ctx.fillText(ch[i],px,y); px+=ws[i]+track; }
  ctx.textAlign=old;
  return total;
}
function renderCover(W,H){
  const c=nc(W,H), x=c.getContext('2d'), bk=state.book;
  const ink=contrast(bk.cover);
  x.fillStyle=bk.cover; x.fillRect(0,0,W,H);
  /* 布纹：两个方向的细斜织纹交叠，封面才像「有材料」而不是一块纯色 */
  x.save(); x.globalAlpha=.040; x.strokeStyle='#000'; x.lineWidth=1;
  for(let i=-H;i<W+H;i+=6){ x.beginPath(); x.moveTo(i,0); x.lineTo(i+H,H); x.stroke(); }
  x.restore();
  x.save(); x.globalAlpha=.030; x.strokeStyle='#fff'; x.lineWidth=1;
  for(let i=0;i<W+H;i+=6){ x.beginPath(); x.moveTo(i,0); x.lineTo(i-H,H); x.stroke(); }
  x.restore();
  grainOver(x,W,H,.085,'overlay');
  /* 书脊：一条更深的带 + 压线。整本书合着的时候，左边这一条就是书背 */
  const sw=W*.078;
  const lg=x.createLinearGradient(0,0,sw,0);
  lg.addColorStop(0,'rgba(0,0,0,.30)');
  lg.addColorStop(.5,'rgba(0,0,0,.14)');
  lg.addColorStop(1,'rgba(0,0,0,.02)');
  x.fillStyle=lg; x.fillRect(0,0,sw,H);
  x.fillStyle='rgba(255,255,255,.15)'; x.fillRect(sw-Math.max(1,W*.0018),0,Math.max(1,W*.0018),H);
  x.fillStyle='rgba(0,0,0,.20)'; x.fillRect(sw*.16,0,Math.max(1,W*.0012),H);
  x.save();
  x.translate(sw*.55,H*.5); x.rotate(-Math.PI/2);
  x.textAlign='center'; x.textBaseline='middle';
  const ss=fitFont(x,bk.spine||'',H*.70,FONTS.sans,W*.023,W*.010,'500');
  x.fillStyle=ink; x.globalAlpha=.84;
  x.font='500 '+R(ss)+'px '+FONTS.sans;
  tracked(x,bk.spine||'',0,0,ss*.30,'center');
  x.restore();
  const cx=(W+sw)/2+W*.010, cw=W-sw-W*.13;
  x.textAlign='center'; x.textBaseline='alphabetic';
  /* 眉题 → 主标题 → 分隔线 → 副题，四段式的中轴排版比原来「标题+副题」稳得多 */
  x.fillStyle=ink; x.globalAlpha=.32;
  const es=R(H*.0148);
  x.font=R(es)+'px '+FONTS.sans;
  tracked(x,'PHOTO BOOK',cx,H*.104,es*1.10,'center');
  x.globalAlpha=1;
  const ts=fitFont(x,bk.title||'光匣',cw,FONTS.serif,H*.100,H*.030,'700');
  x.font='700 '+R(ts)+'px '+FONTS.serif;
  tracked(x,bk.title||'光匣',cx,H*.188,ts*.10,'center');
  x.save(); x.globalAlpha=.30; x.fillStyle=ink;
  x.fillRect(cx-W*.052,H*.222,W*.104,Math.max(1,W*.0013)); x.restore();
  x.globalAlpha=.50;
  const bs=R(H*.0158);
  x.font=R(bs)+'px '+FONTS.sans;
  tracked(x,bk.sub||'',cx,H*.256,bs*.26,'center');
  /* 封面主图：用「干净照片」，不是套了宝丽来白框的模版成品 */
  const first=coverPhoto();
  const src=first?artOf(first):null;
  if(src){
    /* ⚠ 用 contain 而不是 cover：封面的相框是横的，竖构图照片一裁就只剩中间一条脸。
       这里先把相框按照片比例缩到能放下的最大尺寸，再在预留区里居中 ——
       整张照片都在，外圈留一圈白卡纸，反而更像装裱。 */
    const bx=sw+W*.112, by=H*.318, bw=W-bx-W*.100, bh=H*.420;
    const P=W*.026;                                   /* 白卡纸的宽度 */
    const k=Math.min((bw-P*2)/src.width,(bh-P*2)/src.height);
    const ww=Math.max(1,R(src.width*k)), wh=Math.max(1,R(src.height*k));
    const wx=R(bx+(bw-ww)/2), wy=R(by+(bh-wh)/2);
    x.save();
    x.shadowColor='rgba(0,0,0,.42)'; x.shadowBlur=W*.040; x.shadowOffsetY=W*.013;
    x.fillStyle='#fff'; rr(x,wx-P,wy-P,ww+P*2,wh+P*2,W*.004); x.fill();
    x.restore();
    x.drawImage(src,wx,wy,ww,wh);
    x.save(); x.globalAlpha=.15; x.strokeStyle='#000'; x.lineWidth=Math.max(1,W*.0011);
    x.strokeRect(wx+.5,wy+.5,ww-1,wh-1); x.restore();
  }
  x.globalAlpha=.60;
  const as=R(H*.0158);
  x.font=R(as)+'px '+FONTS.sans;
  x.fillStyle=ink;
  tracked(x,bk.author||'',cx,H*.858,as*.32,'center');
  x.save(); x.globalAlpha=.24; x.fillStyle=ink;
  x.fillRect(cx-W*.032,H*.888,W*.064,Math.max(1,W*.0011)); x.restore();
  return c;
}
/* 书页里一律取「干净照片」：见 renderPlain 的注释 */
function artOf(im){ return (im&&(im.plain||im.art))||null; }
/* ---------- 书页画面：模版成品 还是 干净照片 ----------
   上一版为了「好看」，让书页一律用干净照片，结果是：用户逐张分配的模版
   在成书里**完全看不见**，模版功能形同虚设。这一版改回来，但用对的方式：
     · 模版成品不是「原样铺满页面」，而是当一张**装裱好的印片**放进版心
       （四周留出纸边 + 投影），书页的纸感还在；
     · 真正的丑源不是模版本身，而是模版那句**全局同一行文字** ——
       已由 optsFor() 按照片解占位符解决，于是 28 页各有各的题字；
     · 模版自带标题时，书页**不再重复**画一次图注（同一信息出现两次最脏）。
   封面 / 扉页 / 环衬仍走 artOf()（干净照片）：那几页的排版是整套设计的，
   再叠一层模版外壳只会打架。 */
function artMode(){ return state.book.art==='plain'?'plain':'tpl'; }
function plateOf(im){
  if(!im) return null;
  return artMode()==='tpl' ? (im.art||im.plain||null) : (im.plain||im.art||null);
}
/* ---------- 模版文字里的占位符 ----------
   可写 {name} {n} {nn} {total} {tpl}。不认得的原样留下，方便用户看出自己写错了。 */
function ordOf(im){
  if(!im) return 1;
  const g=(state.generated||[]).findIndex(function(q){ return q.photoId===im.id; });
  if(g>=0) return g+1;
  const i=(state.photos||[]).findIndex(function(q){ return q.id===im.id; });
  return i>=0?i+1:1;
}
function totalOf(){
  const picked=(state.photos||[]).filter(function(p){ return p.picked; });
  return picked.length||(state.photos||[]).length||1;
}
function resolveTokens(t,im){
  if(t==null) return '';
  const n=ordOf(im), tot=totalOf();
  return String(t).replace(/\{(name|nn|n|total|tpl)\}/g,function(_,k){
    if(k==='name')  return (im&&im.name)||'';
    if(k==='nn')    return pad2(n);
    if(k==='n')     return String(n);
    if(k==='total') return String(tot);
    if(k==='tpl')   return (TPL[im&&im.tpl]&&TPL[im.tpl].name)||'';
    return _;
  });
}
/* 按照片把模版文字解开，得到这一张成片真正要用的 opts */
function optsFor(im){
  const o=state.opts||{}, out={};
  Object.keys(o).forEach(function(k){ out[k]=o[k]; });
  out.title=resolveTokens(o.title,im);
  out.sub=resolveTokens(o.sub,im);
  out.corner=resolveTokens(o.corner,im);
  return out;
}
/* ---------- 成片过期没有？----------
   模版成品是在 generate() 那一刻烧进画布的。之后用户改了某张照片的模版、
   或者改了模版文字/调色/规格，书里仍然是旧图 —— 不说的话，用户会以为
   「我改了模版怎么没反应」。所以记一个签名，变了就提示重出。 */
function bookSig(){
  return JSON.stringify([state.opts,state.adj,state.spec.ratio,state.spec.longEdge,state.spec.fit]);
}
function bookStale(){
  const list=state.photos.filter(function(p){ return p.picked; });
  if(!list.length) return false;
  if(list.length!==state.generated.length) return true;
  if(state._genSig!==bookSig()) return true;
  for(let i=0;i<list.length;i++){
    const g=state.generated[i];
    if(!g||g.photoId!==list[i].id) return true;
    if((g.tpl||'')!==(list[i].tpl||state.tpl)) return true;
  }
  return false;
}
/* ---------- 封面主图自动挑一张 ----------
   封面是整本书的第一印象，而「取第一张」几乎必然撞上一张虚焦 / 逆光 /
   构图失败的照片 —— 示例素材的第 1 张就是一张大虚焦脸。这里用
   「对比度 + 色彩丰富度 + 相邻行差（清晰度）」在一张 48px 小图上粗打分，
   28 张的总成本可以忽略，但封面立刻从「随手一张」变成「挑过的」。 */
function coverScore(cv){
  const s=48;
  const t=document.createElement('canvas'); t.width=s; t.height=s;
  const x=t.getContext('2d');
  try{ x.drawImage(cv,0,0,s,s); }catch(e){ return 0; }
  let d;
  try{ d=x.getImageData(0,0,s,s).data; }catch(e){ return 0; }
  let n=0,m1=0,m2=0,rich=0,sharp=0,pre=null;
  for(let i=0;i<d.length;i+=4){
    const l=d[i]*.299+d[i+1]*.587+d[i+2]*.114;
    m1+=l; m2+=l*l; n++;
    rich+=Math.max(d[i],d[i+1],d[i+2])-Math.min(d[i],d[i+1],d[i+2]);
    if(pre!==null) sharp+=Math.min(30,Math.abs(l-pre));
    pre=l;
  }
  const mean=m1/Math.max(1,n);
  const sd=Math.sqrt(Math.max(0,m2/Math.max(1,n)-mean*mean));
  /* 过曝 / 过暗都扣分：封面要一张「有中间调」的照片 */
  const ex=Math.max(0,Math.abs(mean-128)-58)/58;
  return sd*1.15+rich/Math.max(1,n)*.55+sharp/Math.max(1,n)*.55-ex*30;
}
/* 打分要读像素，虽然只是 48px 小图也不该在每次重排书页时重算 —— 缓存一份。
   generate() 重新出片时会把它置空。 */
function coverRank(){
  if(state._coverRank) return state._coverRank;
  const list=state.generated.filter(function(g){ return g.picked&&g.plain; });
  if(!list.length) return [];
  const scored=list.map(function(g){ return {g:g,s:coverScore(g.plain)}; });
  scored.sort(function(a,b){ return b.s-a.s; });
  state._coverRank=scored.map(function(o){ return o.g; });
  return state._coverRank;
}
function coverPhoto(){
  const rank=coverRank();
  if(!rank.length) return null;
  const i=clamp(state.book.coverIdx||0,0,rank.length-1);
  return rank[i];
}
function captionOf(im){
  const m=state.book.cap;
  if(m==='none') return '';
  if(m==='name') return im.name||im.title||'';
  return im.title||'';
}
/* 模版成品画面里已经带着自己那行标题了吗？带了的话书页就别再写一遍 ——
   「同一条信息出现两次」是上一轮「初始图书很丑」的主因，比排版问题更致命。 */
function plateHasText(im){
  return artMode()==='tpl' && !!String((im&&im.title)||'').replace(/\s/g,'');
}
function capWillDraw(im){
  if(!captionOf(im)) return false;
  return !plateHasText(im);
}
/* 页码 folio：跨页时左页靠左、右页靠右（都在书口一侧），单页居中 */
function folio(x,W,H,pageNo,side,soft){
  if(!state.book.num) return;
  const s=R(W*.020), y=H-W*.062;
  x.save();
  x.font=R(s)+'px '+FONTS.mono;
  x.fillStyle=soft(.38); x.textBaseline='alphabetic';
  const t=pad2(pageNo);
  if(side==='l'){ x.textAlign='left'; x.fillText(t,W*.084,y); }
  else if(side==='r'){ x.textAlign='right'; x.fillText(t,W-W*.084,y); }
  else { x.textAlign='center'; x.fillText(t,W/2,y); }
  x.restore();
}
/* 内页版式。side: 'l'|'r'|'c' —— 决定书沟在哪一边、页脚页码靠哪一边。
   四套版式都以「照片是主角」为前提：照片尽量放大，留白按视觉重心分配，
   文字只做两件事 —— 一条细线 + 一行图注。 */
function renderContent(items,pageNo,W,H,side){
  const c=nc(W,H), x=c.getContext('2d'), bk=state.book;
  x.fillStyle=bk.paper; x.fillRect(0,0,W,H);
  grainOver(x,W,H,.045,'overlay');
  const ir=hex2rgb(bk.ink||'#2b2620');
  const soft=function(a){ return 'rgba('+ir[0]+','+ir[1]+','+ir[2]+','+a+')'; };
  const PL=W*.098, PR=W*.098, PT=H*.082, PB=H*.104;
  const colW=W-PL-PR;
  if(!items.length) return c;

  /* 图注：一条短细线 + 一行衬线小字（带字距）。居中在照片正下方。
     模版成品自带标题时整段跳过（见 plateHasText）—— 书页保持安静。 */
  function caption(cx,y,cw,txt){
    const im=items[0];
    const cap=txt||captionOf(im);
    if(!cap||plateHasText(im)) return;
    x.save();
    x.textAlign='center'; x.textBaseline='alphabetic';
    const rl=Math.min(cw*.24,W*.125);
    x.globalAlpha=.24; x.fillStyle=soft(1);
    x.fillRect(cx-rl/2,y,rl,Math.max(1,W*.0011));
    x.globalAlpha=.84;
    const cs=R(W*.0255);
    x.font=R(cs)+'px '+FONTS.serif;
    tracked(x,cap,cx,y+cs*1.80,cs*.14,'center');
    x.restore();
  }

  if(bk.layout==='full'){
    /* 满版出血：画面铺满整页。书沟一侧渐暗、天地各压一条极淡的边，
       否则跨页打开时两页会在中间「断开」，不像同一本书。
       模版成品在这个版式下等于「把模版当整页」—— 宽银幕 / 霓虹 / 杂志
       这类自带满版构图的模版就适合这么用。 */
    const src=plateOf(items[0]);
    if(src){
      const k=Math.max(W/src.width,H/src.height);
      x.drawImage(src,(W-src.width*k)/2,(H-src.height*k)/2,src.width*k,src.height*k);
    }
    const gw=W*.15;
    const gsp=x.createLinearGradient(side==='l'?W:0,0,side==='l'?W-gw:gw,0);
    gsp.addColorStop(0,'rgba(0,0,0,.34)'); gsp.addColorStop(1,'rgba(0,0,0,0)');
    x.fillStyle=gsp; x.fillRect(side==='l'?W-gw:0,0,gw,H);
    x.fillStyle='rgba(0,0,0,.10)';
    x.fillRect(0,0,W,H*.022); x.fillRect(0,H-H*.022,W,H*.022);
    folio(x,W,H,pageNo,side,function(a){ return 'rgba(255,255,255,'+(a*1.7).toFixed(3)+')'; });
    return c;
  }

  if(bk.layout==='mat'){
    const src=plateOf(items[0]);
    if(src){
      /* 固定基线：图注落在离版心底边固定高度的位置，画面在「上边距 → 图注上方」
         这个箱体里居中。这样无论照片是竖的还是横的，每页的架构都一致 ——
         横构图的照片下面会出现一段安静的空白，读起来是「留白」而不是
         「图注贴着小图浮在页面中间、底部空一大块」的没排完感。
         模版成品有自己那行题字时书页不画图注，所以箱体一直放到版心底 ——
         不然「留给图注的位」会变成一条没人用的空洞。 */
      const capOn=capWillDraw(items[0]);
      const capY=H-PB-W*.048;                    /* 细线的位置（基线在它下面一点） */
      const boxBot=capOn ? capY-W*.062 : H-PB-W*.024;
      const boxTop=PT, boxH=Math.max(120,boxBot-boxTop);
      const k=Math.min(colW/src.width,boxH/src.height);
      const dw=Math.max(1,R(src.width*k)), dh=Math.max(1,R(src.height*k));
      const dx=R(PL+(colW-dw)/2);
      const dy=R(boxTop+(boxH-dh)*.5);
      x.save();
      x.shadowColor='rgba(0,0,0,.20)'; x.shadowBlur=W*.030; x.shadowOffsetY=W*.007;
      x.fillStyle='#fff'; x.fillRect(dx,dy,dw,dh);
      x.restore();
      x.drawImage(src,dx,dy,dw,dh);
      x.save(); x.globalAlpha=.13; x.strokeStyle='#000'; x.lineWidth=Math.max(1,W*.0011);
      x.strokeRect(dx+.5,dy+.5,dw-1,dh-1); x.restore();
      caption(W/2, capY, Math.min(colW,W*.56));
    }
  } else if(bk.layout==='two'){
    const gap=W*.058, each=(colW-gap)/2;
    const list=items.slice(0,2);
    const topY=PT+W*.020;
    /* 两张都不画图注时（模版成品自带题字），可用高度一直放到版心底，
       否则「留给图注的位」会变成页面下方一条没人用的空洞。 */
    const anyCap=list.some(function(im){ return capWillDraw(im); });
    const boxBot=anyCap ? H-PB-W*.045-W*.020 : H-PB-W*.024;
    const maxH=Math.max(120,boxBot-topY);
    list.forEach((im,i)=>{
      const src=plateOf(im); if(!src) return;
      const k=Math.min(each/src.width,maxH/src.height);
      const dw=Math.max(1,R(src.width*k)), dh=Math.max(1,R(src.height*k));
      const dx=R(PL+i*(each+gap)+(each-dw)/2);
      const dy=R(topY+(maxH-dh)/2);
      x.save();
      x.shadowColor='rgba(0,0,0,.20)'; x.shadowBlur=W*.022; x.shadowOffsetY=W*.006;
      x.fillStyle='#fff'; x.fillRect(dx,dy,dw,dh);
      x.restore();
      x.drawImage(src,dx,dy,dw,dh);
      x.save(); x.globalAlpha=.12; x.strokeStyle='#000'; x.lineWidth=Math.max(1,W*.0011);
      x.strokeRect(dx+.5,dy+.5,dw-1,dh-1); x.restore();
      /* 每半页各有自己的图注，各自对在自己那张图下面（模版带了题字就跳过） */
      const cap=plateHasText(im)?'':captionOf(im);
      if(cap){
        x.save();
        x.textAlign='center'; x.textBaseline='alphabetic';
        x.globalAlpha=.80; x.fillStyle=soft(1);
        const cs=R(W*.0205);
        x.font=R(cs)+'px '+FONTS.serif;
        tracked(x,cap,PL+i*(each+gap)+each/2,H-PB-W*.045,cs*.12,'center');
        x.restore();
      }
    });
  } else if(bk.layout==='sticker'){
    const im=items[0], src=plateOf(im);
    if(src){
      const scap=plateHasText(im)?'':captionOf(im);
      /* 没有图注时把画面略微放大并下移，让上下的气均衡 */
      const maxH=scap?H*.585:H*.630;
      const tcy=scap?H*.442:H*.452;
      const dyS=tcy-H*.442;
      const maxW=colW*1.02;
      const k=Math.min(maxW/src.width,maxH/src.height);
      const dw=Math.max(1,R(src.width*k)), dh=Math.max(1,R(src.height*k));
      x.save();
      x.translate(W/2,tcy); x.rotate(-.032);
      x.shadowColor='rgba(0,0,0,.30)'; x.shadowBlur=W*.028; x.shadowOffsetY=W*.009;
      x.fillStyle='#fff'; x.fillRect(-dw/2-W*.011,-dh/2-W*.011,dw+W*.022,dh+W*.022);
      x.restore();
      x.save();
      x.translate(W/2,tcy); x.rotate(-.032);
      x.drawImage(src,-dw/2,-dh/2,dw,dh);
      x.restore();
      /* 两条和纸胶带：一上一下，压住照片的对角（跟着画面一起平移） */
      x.save(); x.globalAlpha=.44; x.fillStyle='#e9e0cd';
      x.translate(W*.235,H*.132+dyS); x.rotate(-.30);
      x.fillRect(-W*.086,-H*.020,W*.172,H*.040);
      x.translate(W*.47,H*.660+dyS); x.rotate(.56);
      x.fillRect(-W*.086,-H*.020,W*.172,H*.040);
      x.restore();
      if(scap){
        x.save(); x.textAlign='center'; x.textBaseline='alphabetic';
        x.globalAlpha=.88; x.fillStyle=soft(1);
        const cs=R(W*.0290);
        x.font=R(cs)+'px '+FONTS.hand;
        tracked(x,scap,W/2,H-PB-W*.015,cs*.06,'center');
        x.restore();
      }
    }
  }
  folio(x,W,H,pageNo,side,soft);
  return c;
}
function renderBack(W,H){
  const c=nc(W,H), x=c.getContext('2d'), bk=state.book;
  const ir=hex2rgb(bk.ink||'#2b2620');
  const soft=function(a){ return 'rgba('+ir[0]+','+ir[1]+','+ir[2]+','+a+')'; };
  x.fillStyle=bk.paper; x.fillRect(0,0,W,H);
  grainOver(x,W,H,.05,'overlay');
  x.textAlign='center'; x.textBaseline='alphabetic';
  /* 版权页式的收尾：书名 → END OF VOLUME → 细线 → 条形码 → 出版行 */
  const ts=fitFont(x,bk.title||'光匣',W*.72,FONTS.serif,H*.055,H*.026,'600');
  x.fillStyle=bk.ink; x.globalAlpha=.92;
  x.font='600 '+R(ts)+'px '+FONTS.serif;
  tracked(x,bk.title||'光匣',W/2,H*.400,ts*.09,'center');
  x.globalAlpha=.44;
  const es=R(W*.0165);
  x.font=R(es)+'px '+FONTS.sans;
  tracked(x,'END  OF  VOLUME',W/2,H*.446,es*.36,'center');
  x.globalAlpha=.26; x.fillStyle=soft(1);
  x.fillRect(W/2-W*.052,H*.478,W*.104,Math.max(1,W*.0012));
  x.globalAlpha=1;
  /* 条形码：放在一张白卡上，卡的边界让这块「印刷物」有落点 */
  const bw=W*.46, bh=H*.070, bx=(W-bw)/2, y=H*.700;
  x.save();
  x.shadowColor='rgba(0,0,0,.16)'; x.shadowBlur=W*.020; x.shadowOffsetY=W*.005;
  x.fillStyle='#fff'; x.fillRect(bx-W*.022,y-H*.026,bw+W*.044,bh+H*.078);
  x.restore();
  x.fillStyle=soft(.66);
  let px=bx+W*.006;
  while(px<bx+bw-W*.006){
    const w=W*(0.0026+Math.random()*0.0068);
    x.fillRect(px,y,w,bh);
    px+=w+W*(0.0030+Math.random()*0.0088);
  }
  x.fillStyle=soft(.42); x.font=R(W*.0155)+'px '+FONTS.mono;
  x.fillText('LUMEN STUDIO · 2026',W/2,y+bh+W*.036);
  x.fillStyle=soft(.24); x.font=R(W*.0140)+'px '+FONTS.mono;
  x.fillText('PRINTED  FOR  PRIVATE  COLLECTION',W/2,y+bh+W*.072);
  return c;
}
function renderBlank(W,H){
  const c=nc(W,H), x=c.getContext('2d'), bk=state.book;
  x.fillStyle=bk.paper; x.fillRect(0,0,W,H);
  grainOver(x,W,H,.045,'overlay');
  x.fillStyle='rgba(0,0,0,.18)';
  x.beginPath(); x.arc(W/2,H/2,W*.006,0,7); x.fill();
  return c;
}
function segHTML(path,opts,val,wide){
  return '<div class="seg'+(wide?' wide':'')+'" data-k="'+path+'">'+opts.map(function(o){
    return '<button data-v="'+o[0]+'" class="'+(String(o[0])===String(val)?'on':'')+'">'+o[1]+'</button>';
  }).join('')+'</div>';
}
function rngHTML(path,val,min,max,step,label,suffix){
  return '<div class="field"><label class="lb">'+label+
    '<span class="val" data-for="'+path+'">'+val+(suffix||'')+'</span></label>'+
    '<input type="range" data-k="'+path+'" data-suffix="'+(suffix||'')+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+val+'"></div>';
}
function esc(s){
  return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}
function txtHTML(path,val,ph,label){
  return '<div class="field"><label class="lb">'+label+'</label>'+
    '<input type="text" data-k="'+path+'" value="'+esc(val)+'" placeholder="'+(ph||'')+'"></div>';
}
function colHTML(path,val,label){
  return '<div class="field"><label class="lb">'+label+'</label><input type="color" data-k="'+path+'" value="'+val+'"></div>';
}
function panel0(){
  const s=state.spec, a=state.adj;
  const n=state.photos.length, pk=state.photos.filter(function(p){ return p.picked; }).length;
  let h='';
  h+='<div class="stat"><b>'+(n?(pk+' / '+n):'0')+'</b><span>'+
    (n?'张已入册 · 点缩略图左上角圆圈可加入 / 移出':'还没有素材 —— 拖入照片，或用右上角「示例照片」')+'</span></div>';
  h+='<details class="sec" open><summary>画幅与分辨率<span class="hint">'+s.longEdge+' px</span></summary><div class="sec-body">';
  h+='<div class="field"><label class="lb">画幅比例</label>'+segHTML('spec.ratio',
    [['original','原始'],['1:1','1:1'],['4:5','4:5'],['3:4','3:4'],['2:3','2:3'],['9:16','9:16'],['3:2','3:2'],['16:9','16:9'],['A4','A4'],['custom','自定义']],s.ratio)+'</div>';
  if(s.ratio==='custom'){
    h+='<div class="row"><input type="number" data-k="spec.cw" value="'+s.cw+'" min="16" placeholder="宽">'+
       '<input type="number" data-k="spec.ch" value="'+s.ch+'" min="16" placeholder="高"></div>';
  }
  h+=rngHTML('spec.longEdge',s.longEdge,600,4000,50,'长边像素',' px');
  h+='<div class="field"><label class="lb">适配方式</label>'+segHTML('spec.fit',
    [['cover','裁切填满'],['contain','完整留白'],['blurfill','模糊铺底']],s.fit,true)+'</div>';
  h+='</div></details>';

  h+='<details class="sec"><summary>边框与圆角<span class="hint">'+s.borderW+'% / '+s.radius+'%</span></summary><div class="sec-body">';
  h+=rngHTML('spec.borderW',s.borderW,0,10,0.5,'白边宽度','%');
  h+=rngHTML('spec.radius',s.radius,0,14,0.5,'圆角','%');
  h+=rngHTML('spec.shadow',s.shadow,0,24,1,'投影','');
  h+=colHTML('spec.borderColor',s.borderColor,'边框颜色');
  h+='</div></details>';

  h+='<details class="sec"><summary>输出格式<span class="hint">'+s.format.toUpperCase()+'</span></summary><div class="sec-body">';
  h+=segHTML('spec.format',[['jpeg','JPEG'],['png','PNG'],['webp','WEBP']],s.format,true);
  h+=rngHTML('spec.quality',s.quality,0.5,1,0.01,'画质','');
  h+='</div></details>';

  h+='<details class="sec" open><summary>调色<span class="hint">'+PRESETS[state.preset].label+'</span></summary><div class="sec-body">';
  h+='<div class="chips">'+Object.keys(PRESETS).map(function(k){
    return '<div class="chip'+(k===state.preset?' on':'')+'" data-preset="'+k+'"><i style="background:'+PRESETS[k].c+'"></i>'+PRESETS[k].label+'</div>';
  }).join('')+'</div>';
  h+=rngHTML('adj.brightness',a.brightness,0.6,1.6,0.01,'亮度');
  h+=rngHTML('adj.contrast',a.contrast,0.6,1.6,0.01,'对比度');
  h+=rngHTML('adj.saturate',a.saturate,0,2,0.01,'饱和度');
  h+=rngHTML('adj.warmth',a.warmth,-1,1,0.01,'冷暖');
  h+=rngHTML('adj.grain',a.grain,0,1,0.01,'颗粒');
  h+=rngHTML('adj.vignette',a.vignette,0,1,0.01,'暗角');
  h+=rngHTML('adj.fade',a.fade,0,1,0.01,'褪色');
  h+='<button class="btn block sm" id="resetAdj">重置调色</button>';
  h+='</div></details>';

  const canSave=PERSIST.ok();
  h+='<details class="sec"><summary>保存与记忆<span class="hint">'+(canSave?'本机已开启':'当前不可用')+'</span></summary><div class="sec-body">';
  h+='<p class="note">'+(canSave
    ?'你给每张照片挑的模版、勾选的入册照片，以及画幅 / 调色 / 书封等设置，都会记在这台浏览器里，下次打开自动恢复。照片本身不存，重新导入后模版会按文件名接回来。'
    :'这个浏览器不允许本机保存（常见于直接用 file:// 双击打开）。本次编辑全部有效，只是关掉页面后不保留 —— 换成 http 打开即可开启。')+'</p>';
  h+='<button class="btn block sm" id="clearPrefs">清除已保存的偏好与分配</button>';
  h+='</div></details>';
  return h;
}
function panel1(){
  const o=state.opts, t=TPL[state.tpl];
  const cur=(typeof selPhoto==='function')?selPhoto():null;
  const n=state.photos.length, pk=state.photos.filter(function(p){ return p.picked; }).length;
  const used={};
  state.photos.forEach(function(p){ if(p.picked) used[p.tpl||state.tpl]=(used[p.tpl||state.tpl]||0)+1; });
  let h='';
  h+='<div class="stat"><b>'+(n?(pk+' / '+n):'0')+'</b><span>'+
    (cur?('张已入册 · 正在编辑「'+cur.name+'」，它的模版是「'+(TPL[cur.tpl]?TPL[cur.tpl].name:'—')+'」')
        :'张已入册 · 先导入照片再逐张分配模版')+'</span></div>';
  h+='<details class="sec" open><summary>当前模版<span class="hint">'+t.name+'</span></summary><div class="sec-body">';
  h+='<div class="stat"><b>'+t.name+'</b><span>'+t.hint+'</span></div>';
  h+='<button class="btn block sm" id="tplApplyAll2">把「'+t.name+'」应用到全部 '+n+' 张</button>';
  h+=txtHTML('opts.title',o.title,'主标题','主标题');
  h+=txtHTML('opts.sub',o.sub,'副标题 / 日期','副标题');
  h+=txtHTML('opts.corner',o.corner,'角标 / 编号','角标文字');
  h+='<p class="note">文字里可以写占位符，出片时按<b>每一张照片</b>解开 —— '+
     '<code>{name}</code> 照片名 · <code>{n}</code> 序号 · <code>{nn}</code> 两位序号 · '+
     '<code>{total}</code> 入册张数 · <code>{tpl}</code> 模版名。<br>'+
     '默认的 <code>{name}</code> 就是为此：不然 28 张成片会整整齐齐地重复同一句话。</p>';
  const demoP=state.photos.find(function(p){ return p.id===state.sel; })||state.photos[0];
  if(demoP&&o.title&&/\{(name|nn|n|total|tpl)\}/.test(o.title))
    h+='<p class="note">当前选中照片的示例：<b>'+esc(resolveTokens(o.title,demoP))+'</b></p>';
  h+='</div></details>';
  h+='<details class="sec"><summary>模版分配<span class="hint">'+Object.keys(used).length+' 套在用</span></summary><div class="sec-body">';
  if(!n){ h+='<div class="stat"><b>—</b><span>还没有照片</span></div>'; }
  else{
    Object.keys(used).sort(function(x,y){ return used[y]-used[x]; }).forEach(function(k){
      h+='<div class="mrow"><span class="nm">'+(TPL[k]?TPL[k].name:k)+'</span><span class="ct">'+used[k]+' 张</span></div>';
    });
    if(pk<n) h+='<div class="mrow muted"><span class="nm">未入册（不生成）</span><span class="ct">'+(n-pk)+' 张</span></div>';
  }
  h+='<button class="btn block sm" id="goStep2">下一步：选片成书 →</button>';
  h+='</div></details>';
  h+='<details class="sec" open><summary>字体与配色</summary><div class="sec-body">';
  h+='<div class="field"><label class="lb">字体风格</label>'+segHTML('opts.font',
    [['sans','无衬线'],['serif','衬线'],['mono','等宽'],['hand','手写']],o.font,true)+'</div>';
  h+=colHTML('opts.accent',o.accent,'强调色');
  h+=colHTML('opts.paper',o.paper||'#fdfaf3','纸张底色');
  h+=colHTML('opts.ink',o.ink||'#3a342c','墨色');
  h+='<button class="btn block sm" id="resetOpts">恢复模版默认文字</button>';
  h+='</div></details>';
  h+='<details class="sec"><summary>批量<span class="hint">'+n+' 张</span></summary><div class="sec-body">';
  h+='<div class="stat"><b>'+(state.generated.length||0)+'</b><span>张已生成成片</span></div>';
  h+='<button class="btn block sm" id="genBtn2">生成全部成片</button>';
  h+='</div></details>';
  return h;
}
function panel2(){
  const b=state.book;
  const per=b.layout==='two'?2:1;
  const picked=state.generated.filter(function(g){ return g.picked; }).length;
  const want=state.photos.filter(function(p){ return p.picked; }).length;
  const stale=bookStale();
  let h='';
  h+='<div class="stat"><b>'+picked+'</b><span>张已收入书本 · 约 '+Math.max(1,R(picked/per))+' 页内容 · 全书 '+Math.ceil((picked/per)+2)+' 页</span></div>';
  if(stale){
    h+='<p class="note">成片已过期：素材勾选（'+want+' 张 / 现有成片 '+state.generated.length+
       ' 张）、某张照片的模版、或模版文字/调色改过了 —— 书里还是旧画面。点下面按钮重出。</p>';
    h+='<button class="btn block sm" id="genBtn3">按当前设置重新生成</button>';
  }
  h+='<details class="sec" open><summary>版式</summary><div class="sec-body">';
  h+='<div class="field"><label class="lb">书页画面</label>'+segHTML('book.art',
    [['tpl','模版成品'],['plain','干净照片']],b.art)+'</div>';
  h+='<div class="field"><label class="lb">每页排布</label>'+segHTML('book.layout',
    [['full','满版出血'],['mat','居中留白'],['two','双图并置'],['sticker','贴纸手账']],b.layout)+'</div>';
  h+='<div class="field"><label class="lb">翻页形态</label>'+segHTML('book.spread',
    [[1,'跨页对开'],[0,'单页阅读']],b.spread?1:0,true)+'</div>';
  h+='<div class="field"><label class="lb">图注来源</label>'+segHTML('book.cap',
    [['name','照片名'],['title','模版标题'],['none','不显示']],b.cap)+'</div>';
  h+='<div class="field"><label class="lb">翻页手感</label>'+segHTML('book.speed',
    [[1,'利落'],[2,'标准'],[3,'舒缓']],b.speed,true)+'</div>';
  h+='<label class="toggle"><input type="checkbox" data-k="book.num" data-bool="1"'+(b.num?' checked':'')+'><span class="sw"></span>显示页码</label>';
  h+='<p class="note">'+(b.art==='tpl'
    ? '书页用的是<b>模版成品</b> —— 你为每张照片挑的模版会原样装裱进版心（四周留纸边 + 投影），28 页因此各有各的样子。模版自带题字时书页不再重复画图注。'
    : '书页用的是<b>干净照片</b>：只保留调色后的照片、按照片原始比例排，最像一本正经的摄影集。模版只体现在胶片带与单张成片里。')+'</p>';
  h+='</div></details>';
  h+='<details class="sec" open><summary>书封与文字</summary><div class="sec-body">';
  /* 封面主图：默认自动挑一张打分最高的（见 coverScore），也可以手动轮换 */
  const cp=coverPhoto();
  if(cp){
    const rank=coverRank();
    h+='<div class="field"><label class="lb">封面主图<span class="val">'+
       (state.book.coverIdx>0?((state.book.coverIdx+1)+' / '+rank.length):'自动 · 最佳')+
       '</span></label>';
    h+='<div class="mrow"><span class="mini">'+(cp.name||'—')+'</span>'+
       '<button class="btn sm" id="coverNext">换一张</button></div></div>';
  }
  h+=txtHTML('book.title',b.title,'书名','书本标题');
  h+=txtHTML('book.sub',b.sub,'副标题','副标题');
  h+=txtHTML('book.author',b.author,'署名','作者 / 署名');
  h+=txtHTML('book.spine',b.spine,'书脊文字','侧边文字（书脊）');
  h+=colHTML('book.cover',b.cover,'封面底色');
  h+=colHTML('book.paper',b.paper,'内页底色');
  h+=colHTML('book.ink',b.ink,'内页墨色');
  h+='</div></details>';
  h+='<details class="sec" open><summary>导出</summary><div class="sec-body">';
  h+='<button class="btn block sm" id="exportZip">导出全部成片（ZIP）</button>';
  h+='<button class="btn block sm" id="exportSheet">导出书页预览长图</button>';
  h+='<button class="btn block sm" id="exportCurrent">下载当前成片</button>';
  h+='</div></details>';
  return h;
}
function renderPanel(){
  const el=$('#panel');
  el.innerHTML=state.step===0?panel0():(state.step===1?panel1():panel2());
}
/* ================= 交互与业务逻辑 ================= */
/* 模版文字的出厂值。带占位符 —— 每张成片因此有自己的一行字。
   {name} 照片名 / {n} 序号 / {nn} 两位序号 / {total} 入册张数 / {tpl} 模版名 */
const DEFAULT_OPTS={title:'{name}',sub:'{n} / {total}',corner:'NO.{n}',paper:'',ink:'',accent:'#e08a3c',font:'sans'};
const NUMKEYS={'spec.cw':1,'spec.ch':1,'spec.longEdge':1,'spec.quality':1,'spec.borderW':1,'spec.radius':1,
  'spec.shadow':1,'adj.brightness':1,'adj.contrast':1,'adj.saturate':1,'adj.warmth':1,
  'adj.grain':1,'adj.vignette':1,'adj.fade':1};
function setPath(path,val){
  const i=path.indexOf('.');
  const g=path.slice(0,i), k=path.slice(i+1);
  if(NUMKEYS[path]) val=parseFloat(val);
  state[g][k]=val;
}
async function generate(){
  if(!state.photos.length){ toast('先导入一些照片'); return; }
  const list=state.photos.filter(function(p){ return p.picked; });
  if(!list.length){ toast('还没有勾选要入册的照片'); return; }
  const btn=$('#genBtn');
  btn.disabled=true; btn.textContent='渲染中…';
  await tick(40);
  const t0=performance.now();
  const LE=state.spec.longEdge;
  const out=[];
  for(let i=0;i<list.length;i++){
    const p=list[i];
    /* 模版文字按照片解开（{name} / {n} / {total}…），否则每张成片都写着同一句 */
    const mo=optsFor(p);
    const art=renderCanvas(p,p.tpl||state.tpl,mo,LE);
    const fin=finalize(art);
    const plain=renderPlain(p,LE);
    out.push({id:'g'+i,photoId:p.id,art:art,canvas:fin,plain:plain,tpl:p.tpl||state.tpl,
      thumb:fin.toDataURL('image/jpeg',.72),
      title:mo.title||'',sub:mo.sub||'',name:p.name,picked:true});
    await tick(0);
  }
  state.generated=out;
  state._coverRank=null;   /* 封面打分缓存作废（新一批成片了） */
  state._genSig=bookSig(); /* 记下这一批成片对应的设置，之后改了就能判断"过期" */
  btn.disabled=false; btn.textContent='生成成片';
  toast('已生成 '+out.length+' 张成片 · 用时 '+R(performance.now()-t0)+' ms');
  if(state.step!==2) setStep(2);
  else { renderPanel(); renderDock(); scheduleBook(); }
}
/* ---------- 导出 ---------- */
function downloadBlob(blob,name){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob); a.download=name;
  document.body.appendChild(a); a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); a.remove(); },5000);
}
function canvasBlob(cv,format,quality){
  return new Promise(function(res){
    const f='image/'+(format==='jpg'?'jpeg':format);
    if(cv.toBlob) cv.toBlob(function(b){ res(b); },f,quality);
    else res(null);
  });
}
const CRC_TABLE=(function(){
  const t=new Uint32Array(256);
  for(let n=0;n<256;n++){
    let c=n;
    for(let k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);
    t[n]=c>>>0;
  }
  return t;
})();
function crc32(u8){
  let c=0xFFFFFFFF;
  for(let i=0;i<u8.length;i++) c=CRC_TABLE[(c^u8[i])&0xFF]^(c>>>8);
  return (c^0xFFFFFFFF)>>>0;
}
function zipStore(files){
  const enc=new TextEncoder();
  const d=new Date();
  const t=Math.floor((d.getHours()<<11|d.getMinutes()<<5|d.getSeconds()/2))&0xFFFF;
  const dt=Math.floor(((d.getFullYear()-1980)<<9|(d.getMonth()+1)<<5|d.getDate()))&0xFFFF;
  const parts=[], central=[];
  let offset=0, cdSize=0;
  files.forEach(function(f){
    const name=enc.encode(f.name), data=f.data, crc=crc32(data);
    const h=new Uint8Array(30+name.length), v=new DataView(h.buffer);
    v.setUint32(0,0x04034b50,true); v.setUint16(4,20,true); v.setUint16(6,0x0800,true);
    v.setUint16(8,0,true); v.setUint16(10,t,true); v.setUint16(12,dt,true);
    v.setUint32(14,crc,true); v.setUint32(18,data.length,true); v.setUint32(22,data.length,true);
    v.setUint16(26,name.length,true); v.setUint16(28,0,true);
    h.set(name,30);
    parts.push(h); parts.push(data);
    const c=new Uint8Array(46+name.length), cv=new DataView(c.buffer);
    cv.setUint32(0,0x02014b50,true); cv.setUint16(4,20,true); cv.setUint16(6,20,true);
    cv.setUint16(8,0x0800,true); cv.setUint16(10,0,true);
    cv.setUint16(12,t,true); cv.setUint16(14,dt,true);
    cv.setUint32(16,crc,true); cv.setUint32(20,data.length,true); cv.setUint32(24,data.length,true);
    cv.setUint16(28,name.length,true); cv.setUint16(30,0,true); cv.setUint16(32,0,true);
    cv.setUint16(34,0,true); cv.setUint16(36,0,true);
    cv.setUint32(38,0,true); cv.setUint32(42,offset,true);
    c.set(name,46);
    central.push(c);
    offset+=h.length+data.length;
    cdSize+=c.length;
  });
  const end=new Uint8Array(22), ev=new DataView(end.buffer);
  ev.setUint32(0,0x06054b50,true); ev.setUint16(4,0,true); ev.setUint16(6,0,true);
  ev.setUint16(8,files.length,true); ev.setUint16(10,files.length,true);
  ev.setUint32(12,cdSize,true); ev.setUint32(16,offset,true); ev.setUint16(20,0,true);
  return new Blob(parts.concat(central,[end]),{type:'application/zip'});
}
async function exportZip(){
  if(!state.generated.length){ toast('请先点击「生成成片」'); return; }
  toast('正在打包 ZIP…');
  await tick(30);
  const fmt=state.spec.format==='png'?'png':(state.spec.format==='webp'?'webp':'jpeg');
  const ext=fmt==='jpeg'?'jpg':fmt;
  const files=[];
  for(let i=0;i<state.generated.length;i++){
    const g=state.generated[i];
    const blob=await canvasBlob(g.canvas,fmt,state.spec.quality);
    if(!blob) continue;
    const buf=new Uint8Array(await blob.arrayBuffer());
    files.push({name:'lumen/'+pad2(i+1)+'-'+state.tpl+'.'+ext,data:buf});
  }
  files.push({name:'lumen/README.txt',data:new TextEncoder().encode(
    '光匣 LUMEN · 照片书成片\n模版：'+TPL[state.tpl].name+'\n数量：'+files.length+' 张\n生成时间：'+new Date().toLocaleString())});
  downloadBlob(zipStore(files),'光匣-成片-'+Date.now()+'.zip');
  toast('ZIP 已导出 · '+files.length+' 个文件');
}
function exportSheet(){
  const r=buildPages();
  if(!r.pages.length){ toast('还没有书页'); return; }
  const cols=4, pw=380, ph=R(pw/r.ratio), gap=16, pad=26;
  const rows=Math.ceil(r.pages.length/cols);
  const c=document.createElement('canvas');
  c.width=pad*2+cols*pw+(cols-1)*gap;
  c.height=pad*2+rows*ph+(rows-1)*gap;
  const x=c.getContext('2d');
  x.fillStyle='#14161a'; x.fillRect(0,0,c.width,c.height);
  r.pages.forEach(function(p,i){
    const cx=pad+(i%cols)*(pw+gap), cy=pad+Math.floor(i/cols)*(ph+gap);
    x.save();
    x.shadowColor='rgba(0,0,0,.55)'; x.shadowBlur=16; x.shadowOffsetY=6;
    x.fillStyle='#ffffff'; x.fillRect(cx,cy,pw,ph);
    x.restore();
    x.drawImage(p.canvas,cx,cy,pw,ph);
  });
  x.fillStyle='rgba(255,255,255,.62)';
  x.font='600 22px '+FONTS.sans;
  x.textAlign='center';
  x.fillText((state.book.title||'光匣')+'   ·   LUMEN STUDIO   ·   '+r.pages.length+' 页',c.width/2,c.height-pad*0.42);
  c.toBlob(function(b){
    if(b) downloadBlob(b,'光匣-书页预览.png');
    toast('书页预览长图已导出 · '+r.pages.length+' 页');
  },'image/png');
}
async function exportCurrent(){
  const g=state.generated.find(function(q){ return q.photoId===state.sel; })||state.generated[0];
  if(!g){ toast('请先点击「生成成片」'); return; }
  const fmt=state.spec.format==='png'?'png':(state.spec.format==='webp'?'webp':'jpeg');
  const blob=await canvasBlob(g.canvas,fmt,state.spec.quality);
  if(blob) downloadBlob(blob,'光匣-'+state.tpl+'-'+g.canvas.width+'x'+g.canvas.height+'.'+(fmt==='jpeg'?'jpg':fmt));
  toast('当前成片已下载');
}