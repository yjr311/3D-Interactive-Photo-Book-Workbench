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
    title:'今日份', sub:'2026 · LUMEN', corner:'NO.01',
    paper:'', ink:'', accent:'#e08a3c', font:'sans'
  },
  generated:[],
  book:{
    title:'光匣', sub:'A COLLECTION OF MOMENTS', author:'LUMEN STUDIO',
    spine:'LUMEN · 2026', cover:'#e8e0d2', paper:'#fffdf8', ink:'#2b2620',
    layout:'mat', num:true, spread:true, cap:'name', speed:2, coverIdx:0
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

  /* 图注：一条短细线 + 一行衬线小字（带字距）。居中在照片正下方。 */
  function caption(cx,y,cw,txt){
    const cap=txt||captionOf(items[0]);
    if(!cap) return;
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
    /* 满版出血：照片铺满整页。书沟一侧渐暗、天地各压一条极淡的边，
       否则跨页打开时两页会在中间「断开」，不像同一本书。 */
    const src=artOf(items[0]);
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
    const src=artOf(items[0]);
    if(src){
      const maxW=colW, maxH=H-PT-PB-W*.115;
      const k=Math.min(maxW/src.width,maxH/src.height);
      const dw=Math.max(1,R(src.width*k)), dh=Math.max(1,R(src.height*k));
      const dx=R(PL+(colW-dw)/2);
      /* 视觉重心：照片整体偏上一点，把余量留给下方图注，页面才不会「下坠」 */
      const dy=R(PT+Math.max(0,(maxH-dh)*.34));
      x.save();
      x.shadowColor='rgba(0,0,0,.20)'; x.shadowBlur=W*.030; x.shadowOffsetY=W*.007;
      x.fillStyle='#fff'; x.fillRect(dx,dy,dw,dh);
      x.restore();
      x.drawImage(src,dx,dy,dw,dh);
      x.save(); x.globalAlpha=.13; x.strokeStyle='#000'; x.lineWidth=Math.max(1,W*.0011);
      x.strokeRect(dx+.5,dy+.5,dw-1,dh-1); x.restore();
      caption(dx+dw/2, dy+dh+W*.070, dw);
    }
  } else if(bk.layout==='two'){
    const gap=W*.058, each=(colW-gap)/2, maxH=H*.585;
    const list=items.slice(0,2);
    list.forEach((im,i)=>{
      const src=artOf(im); if(!src) return;
      const k=Math.min(each/src.width,maxH/src.height);
      const dw=Math.max(1,R(src.width*k)), dh=Math.max(1,R(src.height*k));
      const dx=R(PL+i*(each+gap)+(each-dw)/2);
      const dy=R(PT+W*.020+(maxH-dh)/2);
      x.save();
      x.shadowColor='rgba(0,0,0,.20)'; x.shadowBlur=W*.022; x.shadowOffsetY=W*.006;
      x.fillStyle='#fff'; x.fillRect(dx,dy,dw,dh);
      x.restore();
      x.drawImage(src,dx,dy,dw,dh);
      x.save(); x.globalAlpha=.12; x.strokeStyle='#000'; x.lineWidth=Math.max(1,W*.0011);
      x.strokeRect(dx+.5,dy+.5,dw-1,dh-1); x.restore();
      /* 每半页各有自己的图注，各自对在自己那张图下面 */
      const cap=captionOf(im);
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
    const im=items[0], src=artOf(im);
    if(src){
      const maxW=colW*1.02, maxH=H*.585;
      const k=Math.min(maxW/src.width,maxH/src.height);
      const dw=Math.max(1,R(src.width*k)), dh=Math.max(1,R(src.height*k));
      x.save();
      x.translate(W/2,H*.442); x.rotate(-.032);
      x.shadowColor='rgba(0,0,0,.30)'; x.shadowBlur=W*.028; x.shadowOffsetY=W*.009;
      x.fillStyle='#fff'; x.fillRect(-dw/2-W*.011,-dh/2-W*.011,dw+W*.022,dh+W*.022);
      x.restore();
      x.save();
      x.translate(W/2,H*.442); x.rotate(-.032);
      x.drawImage(src,-dw/2,-dh/2,dw,dh);
      x.restore();
      /* 两条和纸胶带：一上一下，压住照片的对角 */
      x.save(); x.globalAlpha=.44; x.fillStyle='#e9e0cd';
      x.translate(W*.235,H*.132); x.rotate(-.30);
      x.fillRect(-W*.086,-H*.020,W*.172,H*.040);
      x.translate(W*.47,H*.660); x.rotate(.56);
      x.fillRect(-W*.086,-H*.020,W*.172,H*.040);
      x.restore();
      const scap=captionOf(im);
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
function txtHTML(path,val,ph,label){
  return '<div class="field"><label class="lb">'+label+'</label>'+
    '<input type="text" data-k="'+path+'" value="'+String(val==null?'':val).replace(/&/g,'&amp;').replace(/"/g,'&quot;')+'" placeholder="'+(ph||'')+'"></div>';
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
  const stale=want!==state.generated.length;
  let h='';
  h+='<div class="stat"><b>'+picked+'</b><span>张已收入书本 · 约 '+Math.max(1,R(picked/per))+' 页内容 · 全书 '+Math.ceil((picked/per)+2)+' 页</span></div>';
  if(stale){
    h+='<p class="note">素材那边勾选了 '+want+' 张，当前成片是 '+state.generated.length+' 张 —— 点下面按钮按新勾选重出。</p>';
    h+='<button class="btn block sm" id="genBtn3">按当前勾选重新生成</button>';
  }
  h+='<details class="sec" open><summary>版式</summary><div class="sec-body">';
  h+='<div class="field"><label class="lb">每页排布</label>'+segHTML('book.layout',
    [['full','满版出血'],['mat','居中留白'],['two','双图并置'],['sticker','贴纸手账']],b.layout)+'</div>';
  h+='<div class="field"><label class="lb">翻页形态</label>'+segHTML('book.spread',
    [[1,'跨页对开'],[0,'单页阅读']],b.spread?1:0,true)+'</div>';
  h+='<div class="field"><label class="lb">图注来源</label>'+segHTML('book.cap',
    [['name','照片名'],['title','模版标题'],['none','不显示']],b.cap)+'</div>';
  h+='<div class="field"><label class="lb">翻页手感</label>'+segHTML('book.speed',
    [[1,'利落'],[2,'标准'],[3,'舒缓']],b.speed,true)+'</div>';
  h+='<label class="toggle"><input type="checkbox" data-k="book.num" data-bool="1"'+(b.num?' checked':'')+'><span class="sw"></span>显示页码</label>';
  h+='<p class="note">内页用的是<b>干净照片</b>而不是模版成品 —— 模版负责「单张成片」的装饰，书页则按摄影集的方式排版（大幅照片 + 细线图注）。</p>';
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
const DEFAULT_OPTS={title:'今日份',sub:'2026 · LUMEN',corner:'NO.01',paper:'',ink:'',accent:'#e08a3c',font:'sans'};
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
    const art=renderCanvas(p,p.tpl||state.tpl,state.opts,LE);
    const fin=finalize(art);
    const plain=renderPlain(p,LE);
    out.push({id:'g'+i,photoId:p.id,art:art,canvas:fin,plain:plain,tpl:p.tpl||state.tpl,
      thumb:fin.toDataURL('image/jpeg',.72),
      title:state.opts.title||'',sub:state.opts.sub||'',name:p.name,picked:true});
    await tick(0);
  }
  state.generated=out;
  state._coverRank=null;
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
}/* ============================================================
   光匣 LUMEN v2 —— 内置示例照片 / 音效 / canvas 物理翻页引擎
   ============================================================ */

/* ---------- 内置示例照片 ---------- */
function imgFromURL(src){
  return new Promise(function(res){
    const i=new Image(); i.onload=function(){res(i);}; i.onerror=function(){res(null);};
    i.src=src;
  });
}
async function loadEmbedded(replace){
  if(typeof PHOTO_DATA==='undefined'||!PHOTO_DATA.length){ addSamples(); return; }
  if(loadEmbedded._busy) return;
  loadEmbedded._busy=true;
  busyOn('正在载入 <b>'+PHOTO_DATA.length+'</b> 张示例照片…');
  await tick(30);
  if(replace!==false){ state.photos=[]; state.sel=null; state.generated=[]; }
  for(let i=0;i<PHOTO_DATA.length;i++){
    const it=PHOTO_DATA[i];
    const im=await imgFromURL(it.d);
    if(!im) continue;
    const p=makePhoto(im,it.w,it.h,'LUMEN '+it.n);
    p.emb=it.n;
    pushPhoto(p);
    if(i%5===0){ busyOn('正在载入示例照片 <b>'+(i+1)+'/'+PHOTO_DATA.length+'</b>'); await tick(0); }
  }
  busyOff();
  loadEmbedded._busy=false;
  renderRail(); renderPanel(); schedulePreview();
  PERSIST.save();
  const back=state.photos.filter(function(p){ return p._restored; }).length;
  toast('已载入 '+state.photos.length+' 张示例照片'+(back?('（其中 '+back+' 张接回了上次的模版）'):''));
}

/* ---------- 翻页音效（WebAudio 合成，无外部素材） ---------- */
const Sound=(function(){
  let ac=null, on=true;
  function ctx(){
    if(ac) { if(ac.state==='suspended') ac.resume(); return ac; }
    const C=window.AudioContext||window.webkitAudioContext;
    if(!C) return null;
    try{ ac=new C(); }catch(e){ return null; }
    return ac;
  }
  function swish(v){
    if(!on) return;
    const a=ctx(); if(!a) return;
    const dur=.4, sr=a.sampleRate, n=Math.max(1,R(sr*dur));
    const buf=a.createBuffer(1,n,sr), d=buf.getChannelData(0);
    for(let i=0;i<n;i++){
      const t=i/n;
      d[i]=(Math.random()*2-1)*Math.pow(1-t,2.4)*(0.3+0.7*Math.sin(Math.PI*Math.min(1,t*1.5)));
    }
    const src=a.createBufferSource(); src.buffer=buf;
    const bp=a.createBiquadFilter(); bp.type='bandpass'; bp.Q.value=.7;
    const f0=900+Math.random()*300;
    bp.frequency.setValueAtTime(f0,a.currentTime);
    bp.frequency.exponentialRampToValueAtTime(f0*2.4,a.currentTime+dur*.75);
    const g=a.createGain(), vol=.13*clamp(v||1,.25,1.4);
    g.gain.setValueAtTime(.0001,a.currentTime);
    g.gain.exponentialRampToValueAtTime(vol,a.currentTime+.035);
    g.gain.exponentialRampToValueAtTime(.0001,a.currentTime+dur);
    src.connect(bp); bp.connect(g); g.connect(a.destination);
    src.start(a.currentTime);
  }
  return {
    swish:swish,
    isOn:function(){ return on; },
    toggle:function(){ on=!on; if(on) swish(.5); return on; }
  };
})();

/* ---------- 额外书页：环衬 / 扉页 ---------- */
function renderEndpaper(W,H){
  const c=nc(W,H), x=c.getContext('2d'), bk=state.book;
  x.fillStyle=bk.paper; x.fillRect(0,0,W,H);
  /* 环衬：细密的斜纹纸。格子太密会糊成灰，这里把两种方向的纹路疏密拉开，
     再叠一层四角渐暗，读起来才是「一张有图案的纸」。 */
  x.save(); x.globalAlpha=.045; x.strokeStyle=bk.ink; x.lineWidth=Math.max(1,W*.0010);
  const s=W*.030;
  for(let i=-H;i<W+H;i+=s){
    x.beginPath(); x.moveTo(i,0); x.lineTo(i+H,H); x.stroke();
  }
  x.globalAlpha=.032;
  for(let i=-H;i<W+H;i+=s*1.5){
    x.beginPath(); x.moveTo(i,H); x.lineTo(i+H,0); x.stroke();
  }
  x.restore();
  /* 四角渐暗：环衬靠书脊处天然更暗 */
  x.save();
  const vg=x.createRadialGradient(W/2,H*.5,W*.24,W/2,H*.5,W*.86);
  vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,.10)');
  x.fillStyle=vg; x.fillRect(0,0,W,H);
  x.restore();
  grainOver(x,W,H,.05,'overlay');
  x.save();
  x.globalAlpha=.115; x.strokeStyle=bk.ink; x.lineWidth=Math.max(1,W*.0016);
  rr(x,W*.13,H*.105,W*.74,H*.79,W*.005); x.stroke();
  x.restore();
  /* 中央的「匣」印：环衬上唯一的实心元素，压住整页 */
  x.save();
  x.textAlign='center'; x.textBaseline='middle';
  const cs=W*.088;
  x.globalAlpha=.26; x.fillStyle=bk.ink;
  x.font='700 '+R(cs)+'px '+FONTS.serif;
  x.fillText('匣',W/2,H*.452);
  const ls=R(W*.0175);
  x.globalAlpha=.30; x.font=R(ls)+'px '+FONTS.mono;
  tracked(x,'LUMEN',W/2,H*.530,ls*.62,'center');
  x.globalAlpha=.20; x.fillStyle=bk.ink;
  x.fillRect(W/2-W*.062,H*.565,W*.124,Math.max(1,W*.0011));
  const bs=R(W*.0158);
  x.globalAlpha=.28; x.font=R(bs)+'px '+FONTS.sans;
  tracked(x,'光匣 · 照片书',W/2,H*.602,bs*.34,'center');
  x.restore();
  return c;
}
function renderTitlePage(W,H){
  const c=nc(W,H), x=c.getContext('2d'), bk=state.book;
  x.fillStyle=bk.paper; x.fillRect(0,0,W,H);
  grainOver(x,W,H,.05,'overlay');
  const ir=hex2rgb(bk.ink||'#2b2620');
  const soft=function(a){ return 'rgba('+ir[0]+','+ir[1]+','+ir[2]+','+a+')'; };
  x.textAlign='center'; x.textBaseline='alphabetic';
  /* 扉页不加装饰，只用字号与字距建立层级：
     眉题 → 书名 → 细线 → 副题 → 主图 → 署名 */
  x.fillStyle=bk.ink; x.globalAlpha=.36;
  const es=R(W*.0155);
  x.font=R(es)+'px '+FONTS.sans;
  tracked(x,'A COLLECTION OF MOMENTS',W/2,H*.185,es*.30,'center');
  x.globalAlpha=1;
  const ts=fitFont(x,bk.title||'光匣',W*.76,FONTS.serif,H*.115,H*.046,'700');
  x.font='700 '+R(ts)+'px '+FONTS.serif;
  tracked(x,bk.title||'光匣',W/2,H*.285,ts*.08,'center');
  x.save();
  x.globalAlpha=.28; x.fillStyle=soft(1);
  x.fillRect(W/2-W*.062,H*.328,W*.124,Math.max(1,W*.0013));
  x.restore();
  x.globalAlpha=.48;
  const bs=R(W*.0195);
  x.font=R(bs)+'px '+FONTS.sans;
  tracked(x,bk.sub||'',W/2,H*.368,bs*.26,'center');
  const first=coverPhoto();
  const src=first?artOf(first):null;
  if(src){
    /* contain：扉页上的主图同样不裁切 */
    const bx=W*.25, by=H*.448, bw=W*.50, bh=H*.410, P=W*.024;
    const k=Math.min((bw-P*2)/src.width,(bh-P*2)/src.height);
    const ww=Math.max(1,R(src.width*k)), wh=Math.max(1,R(src.height*k));
    const wx=R(bx+(bw-ww)/2), wy=R(by+(bh-wh)/2);
    x.save();
    x.shadowColor='rgba(0,0,0,.26)'; x.shadowBlur=W*.034; x.shadowOffsetY=W*.010;
    x.fillStyle='#fff'; x.fillRect(wx-P,wy-P,ww+P*2,wh+P*2);
    x.restore();
    x.drawImage(src,wx,wy,ww,wh);
    x.save(); x.globalAlpha=.13; x.strokeStyle='#000'; x.lineWidth=Math.max(1,W*.0011);
    x.strokeRect(wx+.5,wy+.5,ww-1,wh-1); x.restore();
  }
  x.save();
  x.globalAlpha=.60; x.fillStyle=bk.ink;
  const as=R(W*.0180);
  x.font=R(as)+'px '+FONTS.serif;
  tracked(x,bk.author||'',W/2,H*.905,as*.22,'center');
  x.globalAlpha=.24; x.fillRect(W/2-W*.036,H*.930,W*.072,Math.max(1,W*.0011));
  x.restore();
  return c;
}

/* ---------- 成书页序 ---------- */
function buildBookPages(){
  const ab=pageAspect();
  const PW=880, PH=Math.max(300,R(PW*ab[1]/ab[0]));
  const picked=state.generated.filter(function(g){ return g.picked; });
  const per=state.book.layout==='two'?2:1;
  const pages=[];
  pages.push({kind:'cover',canvas:renderCover(PW,PH)});
  pages.push({kind:'endpaper',canvas:renderEndpaper(PW,PH)});
  pages.push({kind:'title',canvas:renderTitlePage(PW,PH)});
  /* 跨页时 canvas 索引偶数在右页、奇数在左页（见 BookView.restFor），
     页码要落在书口一侧就必须知道自己是哪一边。 */
  const sideOf=function(){
    if(!state.book.spread) return 'c';
    return (pages.length%2===0)?'r':'l';
  };
  let no=0;
  for(let i=0;i<picked.length;i+=per){
    no++;
    pages.push({kind:'content',no:no,canvas:renderContent(picked.slice(i,i+per),no,PW,PH,sideOf())});
  }
  if(picked.length===0) pages.push({kind:'content',canvas:renderContent([],1,PW,PH,sideOf())});
  if(pages.length%2===1) pages.push({kind:'blank',canvas:renderBlank(PW,PH)});
  pages.push({kind:'endpaper',canvas:renderEndpaper(PW,PH)});
  pages.push({kind:'back',canvas:renderBack(PW,PH)});
  return {pages:pages,ratio:ab[0]/ab[1]};
}
function buildPages(){ return buildBookPages(); }

/* ============================================================
   翻页引擎：真实纸张物理模型（透视投影 + 连续弯曲 + 动态明暗）
   ============================================================ */
const LIGHT=(function(){ const v=[-0.42,-0.34,0.84]; const L=Math.sqrt(v[0]*v[0]+v[1]*v[1]+v[2]*v[2]); return [v[0]/L,v[2]/L]; })();

/* 翻页时长：1 利落 / 2 标准 / 3 舒缓。
   这里的基准只作用于「点击左右半边 / 按钮 / 自动翻页」这种没有速度信息的一翻；
   拖拽松手之后那一翻的时长仍然由手速决定，见 up()。 */
function flipDur(){
  const s=(state.book&&state.book.speed)||2;
  return s===1?520:(s===3?1180:820);
}
function BookView(){
  const el=document.createElement('div');
  el.className='bv';
  el.innerHTML=
    '<div class="bv-stage"><canvas></canvas></div>'+
    '<div class="bv-bar">'+
      '<button class="icb" data-a="prev" title="上一页">&#8249;</button>'+
      '<span class="pg">1 / 1</span>'+
      '<button class="icb" data-a="next" title="下一页">&#8250;</button>'+
      '<span class="sp"></span>'+
      '<button class="icb" data-a="auto" title="自动翻页">&#9654;</button>'+
      '<button class="icb'+(Sound.isOn()?' on':'')+'" data-a="sound" title="翻页音效">&#9834;</button>'+
      '<button class="icb" data-a="full" title="沉浸全屏阅读">&#8663;</button>'+
    '</div>'+
    '<div class="bv-thumbs scroll"></div>'+
    '<div class="bv-hint">拖动书页翻页 · 也可以点击左右半边</div>';
  this.el=el;
  this.stage=$('.bv-stage',el);
  this.cv=$('canvas',el);
  this.ctx=this.cv.getContext('2d');
  this.pg=$('.pg',el);
  this.thumbs=$('.bv-thumbs',el);
  this.hint=$('.bv-hint',el);
  this.fullBtn=$('[data-a="full"]',el);
  this.soundBtn=$('[data-a="sound"]',el);
  this.pages=[]; this.kinds=[]; this.n=0; this.cur=0; this.spread=true; this.ratio=.75;
  this.cornerA=0; this.cornerSide='r'; this.cornerOn=false;
  this.pw=380; this.ph=520; this.D=1200; this.N=96;
  this.off=0; this.offT=0;
  this.live=null; this.drag=null; this.anim=null; this.queue=[];
  this.tilt={x:0,y:0}; this.tiltT={x:0,y:0};
  this.raf=0; this.autoTimer=null; this._intro=false;
  this.cw=0; this.ch=0; this.dpr=1; this.spineX=0; this.top=0; this.cy=0;
  this.bowBoost=0;
  this.filterOK=(function(){
    const c=document.createElement('canvas').getContext('2d');
    c.filter='blur(2px)'; return c.filter!=='none';
  })();
  this.bind();
}
BookView.prototype.sheetFront=function(i){ return this.pages[this.spread?2*i:i]||null; };
BookView.prototype.sheetBack=function(i){ return this.pages[this.spread?2*i+1:i+1]||null; };
BookView.prototype.restFor=function(c){
  return this.spread?{l:2*c-1,r:2*c}:{l:-1,r:c};
};
BookView.prototype.underFor=function(i){
  return this.spread?{l:2*i-1,r:2*i+2}:{l:-1,r:i+1};
};
BookView.prototype.bind=function(){
  const self=this;
  this.cv.addEventListener('pointerdown',function(e){ self.down(e); });
  window.addEventListener('pointermove',function(e){ self.move(e); });
  window.addEventListener('pointerup',function(e){ self.up(e); });
  window.addEventListener('pointercancel',function(e){ self.up(e); });
  this.el.addEventListener('click',function(e){
    const b=e.target.closest('[data-a]');
    if(!b) return;
    const a=b.dataset.a;
    if(a==='prev') self.prev();
    else if(a==='next') self.next();
    else if(a==='auto') self.toggleAuto();
    else if(a==='sound'){ const o=Sound.toggle(); b.classList.toggle('on',o); toast(o?'翻页音效已开启':'翻页音效已关闭'); }
    else if(a==='full') openReader();
  });
  this.thumbs.addEventListener('click',function(e){
    const b=e.target.closest('button');
    if(b) self.go(+b.dataset.i);
  });
  this.stage.addEventListener('pointermove',function(e){
    if(self.drag) return;
    const r=self.stage.getBoundingClientRect();
    if(!r.width) return;
    const rx=(e.clientX-r.left)/r.width, ry=(e.clientY-r.top)/r.height;
    self.tiltT={x:(0.5-ry)*2.6,y:(rx-0.5)*4.4};
    const local=self.localX(e.clientX);
    self.el.classList.toggle('half-l',local<self.spineX);
    self.el.classList.toggle('half-r',local>=self.spineX);
    /* 悬停到「外下角」→ 把那一角掀起来一点点。
       真实的书在翻之前，人会把页角捏起来；有这个反馈，页面才不像一张贴图。
       判定必须同时满足「贴近书口那一侧的竖直边」和「页面下缘」，否则
       鼠标随便划过去都在掀角，反而更像故障。 */
    const py=(e.clientY-r.top)*(self.ch/Math.max(1,r.height));
    const nearBottom=py>self.top+self.ph*.82;
    if(nearBottom){
      const right=local>=self.spineX;
      const d=right?(self.spineX+self.pw-local):(local-(self.spineX-self.pw));
      if(d<self.pw*.16){ self.cornerOn=true; self.cornerSide=right?'r':'l'; }
      else self.cornerOn=false;
    } else self.cornerOn=false;
    self.kick();
  });
  this.stage.addEventListener('pointerleave',function(){
    self.tiltT={x:0,y:0}; self.cornerOn=false; self.kick();
  });
};
/* 每一页的「材质」：cover/back/endpaper 是硬纸板，其余是普通纸。
   翻页时两种材质的运动完全不同（见 drawSheet），所以必须记下 kind。 */
BookView.prototype.kindAt=function(k){
  if(k<0||!this.kinds||k>=this.kinds.length) return null;
  return this.kinds[k];
};
BookView.prototype.sheetHard=function(i){
  const a=this.kindAt(this.indexFront(i)), b=this.kindAt(this.indexBack(i));
  const hard=function(k){ return k==='cover'||k==='back'||k==='endpaper'; };
  return hard(a)||hard(b);
};
BookView.prototype.indexFront=function(i){ return this.spread?2*i:i; };
BookView.prototype.indexBack=function(i){ return this.spread?2*i+1:i+1; };
BookView.prototype.setPages=function(pages,ratio,spread,keepCur){
  const old=this.cur;
  this.kinds=(pages||[]).map(function(p){ return (p&&p.kind)||'content'; });
  this.pages=(pages||[]).map(function(p){ return (p&&p.canvas)?p.canvas:(p||null); });
  this.ratio=ratio||.75; this.spread=!!spread;
  this.anim=null; this.live=null; this.queue=[]; this.bowBoost=0;
  this.cornerA=0; this.cornerOn=false;
  this.n=Math.max(1,this.spread?Math.ceil(this.pages.length/2):Math.max(1,this.pages.length-1));
  this.cur=keepCur?clamp(old,0,this.n):0;
  this.buildThumbs(); this.layout();
  this.hint.classList.remove('off');
  this.syncUI();
};
BookView.prototype.buildThumbs=function(){
  let h='';
  for(let i=0;i<this.n;i++) h+='<button data-i="'+i+'">'+(i+1)+'</button>';
  this.thumbs.innerHTML=h;
};
BookView.prototype.syncUI=function(){
  const t=$$('button',this.thumbs);
  for(let i=0;i<t.length;i++) t[i].classList.toggle('on',i===this.cur);
  const total=this.pages.length;
  let s;
  if(this.spread){
    const a=2*this.cur;
    if(a>=total) s='—';
    else s=(a+1)+'–'+(Math.min(a+2,total));
  } else {
    s=String(Math.min(this.cur+1,total));
  }
  this.pg.textContent=s+' / '+total;
  if(this.cur>0) this.hint.classList.add('off');
};
BookView.prototype.layout=function(){
  const r=this.stage.getBoundingClientRect();
  if(!r.width||!r.height) return;
  this.dpr=Math.min(2,window.devicePixelRatio||1);
  this.cw=r.width; this.ch=r.height;
  this.cv.width=Math.max(1,R(this.cw*this.dpr));
  this.cv.height=Math.max(1,R(this.ch*this.dpr));
  this.cv.style.width=R(this.cw)+'px';
  this.cv.style.height=R(this.ch)+'px';
  const padX=this.spread?30:16, padTop=18, padBot=12;
  let ph=Math.max(160,(this.ch-padTop-padBot)/1.04);
  let pw=ph*this.ratio;
  const availW=Math.max(200,this.cw-padX*2);
  const tot=this.spread?pw*2:pw;
  if(tot>availW){ const k=availW/tot; pw*=k; ph*=k; }
  this.pw=pw; this.ph=ph;
  this.D=Math.max(300,pw*1.05);
  this.N=clamp(R(pw/2.6),72,190);
  this.top=padTop+ph*.085;
  this.offT=this.targetOff();
  if(!this.anim&&!this.live) this.off=this.offT;
  this.draw();
};
BookView.prototype.targetOff=function(){
  if(!this.spread) return -this.pw*.5;
  let open=this.cur>0?1:0;
  const m=this.anim||this.live;
  if(m&&m.dir==='fwd'&&m.i===0) open=m.p;
  else if(m&&m.dir==='back'&&m.i===0) open=m.p;
  return -this.pw*.5*(1-open);
};
BookView.prototype.kick=function(){
  if(this.raf||!this.cw) return;
  const self=this;
  this.raf=requestAnimationFrame(function(t){ self.step(t); });
};
BookView.prototype.step=function(ts){
  this.raf=0;
  let active=false;
  const now=Math.max(typeof ts==='number'&&ts>0?ts:0,performance.now());
  if(this.anim){
    const a=this.anim;
    const t=clamp((now-a.t0)/a.dur,0,1);
    /* 抬手快、落下慢的长尾。3 次方时纸到末尾还剩明显速度，「啪」地一下就停住；
       4 次方以上变成「先一口气翻过去、然后慢慢压到纸面上」，重量感就出来了。
       硬纸板反过来：它是刚体靠惯性匀速转，尾巴不该这么长，否则像慢动作。 */
    const e=1-Math.pow(1-t,this.sheetHard(a.i)?3.0:4.2);
    a.p=a.p0+(a.p1-a.p0)*e;
    if(t>=1){
      this.cur=clamp(this.cur+(a.dir==='fwd'?1:-1),0,this.n);
      this.anim=null;
      this.bowBoost=0;
      this.syncUI();
      if(this.queue.length){
        const d=this.queue.shift();
        this.flipOne(d,{dur:this.queue.length?Math.round(flipDur()*.44):Math.round(flipDur()*.86)});
        active=!!this.anim;
      }
    } else active=true;
  }
  const oT=this.targetOff();
  if(Math.abs(oT-this.off)>.4){ this.off+=(oT-this.off)*.17; active=true; }
  else if(this.off!==oT){ this.off=oT; active=true; }
  /* 折角：翻页/拖拽进行中不允许掀角，否则会和正在动的纸打架 */
  const cT=(this.cornerOn&&!this.anim&&!this.drag&&this.pages.length)?1:0;
  if(Math.abs(cT-this.cornerA)>.003){ this.cornerA+=(cT-this.cornerA)*.20; active=true; }
  else if(this.cornerA!==cT){ this.cornerA=cT; active=true; }
  const k=.18;
  if(Math.abs(this.tiltT.x-this.tilt.x)>.015||Math.abs(this.tiltT.y-this.tilt.y)>.015){
    this.tilt.x+=(this.tiltT.x-this.tilt.x)*k;
    this.tilt.y+=(this.tiltT.y-this.tilt.y)*k;
    this.cv.style.transform='perspective(2600px) rotateX('+this.tilt.x.toFixed(2)+'deg) rotateY('+this.tilt.y.toFixed(2)+'deg)';
    active=true;
  }
  this.draw();
  if(active) this.kick();
};
BookView.prototype.localX=function(clientX){
  const r=this.cv.getBoundingClientRect();
  if(!r.width) return 0;
  return (clientX-r.left)*(this.cw/r.width);
};
/* ---------- 绘制 ---------- */
BookView.prototype.draw=function(){
  const ctx=this.ctx;
  if(!this.cw){ this.layout(); return; }
  ctx.setTransform(this.dpr,0,0,this.dpr,0,0);
  ctx.clearRect(0,0,this.cw,this.ch);
  if(!this.pages.length) return;
  const pw=this.pw, ph=this.ph;
  const spineX=this.cw/2+this.off;
  const top=this.top, cy=top+ph/2;
  this.spineX=spineX; this.cy=cy;
  const spread=this.spread;
  const moving=this.anim?{i:this.anim.i,p:this.anim.p,dir:this.anim.dir}
                        :(this.live?{i:this.live.i,p:this.live.p,dir:this.live.dir}:null);
  const under=moving?this.underFor(moving.i):this.restFor(this.cur);
  if(!spread){
    ctx.save();
    ctx.beginPath(); ctx.rect(spineX,top-14,pw,ph+28); ctx.clip();
  }
  /* 桌面投影：椭圆径向渐变，天然柔边（不依赖 ctx.filter，任何环境一致） */
  ctx.save();
  const cxs=spread?spineX:(spineX+pw*.5);
  const ehw=spread?pw*.98:pw*.60, ehh=Math.min(52,Math.max(16,ph*.075));
  ctx.translate(cxs,top+ph+ehh*.30);
  ctx.scale(ehw,ehh);
  const eg=ctx.createRadialGradient(0,0,.05,0,0,1);
  eg.addColorStop(0,'rgba(0,0,0,.46)');
  eg.addColorStop(.52,'rgba(0,0,0,.24)');
  eg.addColorStop(.78,'rgba(0,0,0,.07)');
  eg.addColorStop(1,'rgba(0,0,0,0)');
  ctx.fillStyle=eg;
  ctx.beginPath(); ctx.arc(0,0,1,0,6.2832); ctx.fill();
  ctx.restore();
  /* 下层页面 */
  if(under.l>=0) this.flatPage(ctx,under.l,spineX-pw,top,pw,ph,'l');
  if(under.r>=0&&under.r<this.pages.length) this.flatPage(ctx,under.r,spineX,top,pw,ph,'r');
  /* 纸垛厚度 */
  if(spread){
    if(this.cur>0) this.edgeStack(ctx,spineX-pw,top,ph,'l',Math.min(this.cur,9));
    const rem=this.n-1-this.cur;
    if(rem>0) this.edgeStack(ctx,spineX+pw,top,ph,'r',Math.min(rem,9));
  }
  /* 翻动中的纸张 */
  if(moving) this.drawSheet(ctx,moving.i,moving.p);
  /* 书脊阴影：压在整本书之上（含翻动纸）；纸被抬起时减弱，避免和纸影叠成硬色带。
     ⚠ 这道影的物理前提是「两侧都有纸、中间才是书沟」：
     · 合着书（cur=0）只有封面、单独的封底同理 —— 都不存在书沟，
       再画就是「封面还没打开，左边怎么已经有痕迹了」；
     · 封面翻开的那一翻，纸正落到左边，必须同步长出来，
       否则落地瞬间阴影才出现，看着就是「咯噔」一下。
     所以强度取两侧存在度的 **min**（gut），宽度也随它从书脊向外长。 */
  if(spread){
    const lf=clamp(this._lastLift||0,0,1), a=1-.5*lf;
    const SW=58;
    const hasStaticL=under.l>=0||this.cur>0;
    const mq=moving?clamp(moving.dir==='back'?1-moving.p:moving.p,0,1):-1;
    let lIn=hasStaticL?1:(mq<0?0:clamp((mq-.50)/.42,0,1));
    lIn=lIn*lIn*(3-2*lIn);                      /* smoothstep：不出现硬边 */
    const hasR=(under.r>=0&&under.r<this.pages.length)||(this.n-1-this.cur)>0;
    const gut=Math.min(lIn,hasR?1:0);           /* 书沟存在度：缺任一侧就是 0 */
    if(gut>.02){
      const SWg=SW*(.45+.55*gut);               /* 影随书沟一起长出来 */
      const x0=spineX-SWg*lIn, x1=hasR?spineX+SWg:spineX;
      if(x1-x0>1.5){
        const g=ctx.createLinearGradient(x0,0,x1,0);
        const put=function(abs,al){                   /* 按绝对位置放色标，越界自动丢弃 */
          const o=(abs-x0)/(x1-x0);
          if(o<0||o>1.0001) return;
          g.addColorStop(clamp(o,0,1),'rgba(0,0,0,'+(al*gut).toFixed(3)+')');
        };
        put(spineX-SWg,0);            put(spineX-SWg*.48,.085*a);
        put(spineX-SWg*.20,.175*a);   put(spineX,.235*a);
        put(spineX+SWg*.20,.175*a);   put(spineX+SWg*.48,.085*a);
        put(spineX+SWg,0);
        ctx.save(); ctx.fillStyle=g;
        ctx.fillRect(x0,top,x1-x0,ph);
        ctx.restore();
      }
    }
  }
  /* 页面四边极轻的暗角，让纸张有厚度感 */
  if(spread){
    ctx.save(); ctx.globalAlpha=.5;
    ctx.fillStyle='rgba(0,0,0,.18)';
    if(under.l>=0) ctx.fillRect(spineX-pw,top+ph-2.5,pw,2.5);
    if(under.r>=0) ctx.fillRect(spineX,top+ph-2.5,pw,2.5);
    ctx.restore();
  }
  /* 折角画在最上层（它压着纸垛和书脊影） */
  this.drawFold(ctx);
  if(!spread) ctx.restore();
};
/* ---------- 悬停折角 ----------
   真实的书在翻页之前，人会先用指尖把页角捏起来。这里就把那一角画成掀起的
   一小片：翻开的是纸的**背面**（所以偏亮、没有图），露出的是下面那一页
   （所以偏暗、靠近折痕更暗）。有这一下，页面才从「一张图」变成「一叠纸」。 */
BookView.prototype.drawFold=function(ctx){
  const a=clamp(this.cornerA,0,1);
  if(a<.02) return;
  const pw=this.pw, ph=this.ph, top=this.top;
  const right=this.spread?(this.cornerSide!=='l'):true;
  const px=right?this.spineX+pw:this.spineX;
  const py=top+ph;
  const dx=right?-1:1;
  const f=pw*.118*a;
  if(f<2) return;
  const e=.92*a;
  const x0=right?px-f:px, w2=f*2;
  ctx.save();
  /* ① 折痕内侧：露出的下层纸 —— 整体压暗，越靠折痕越暗 */
  ctx.beginPath();
  ctx.moveTo(px+dx*f,py); ctx.lineTo(px,py-f); ctx.lineTo(px,py); ctx.closePath();
  ctx.clip();
  ctx.fillStyle='rgba(0,0,0,'+(.10*e).toFixed(3)+')';
  ctx.fillRect(x0,py-f,w2,w2);
  const g1=ctx.createLinearGradient(px+dx*f,py,px,py-f);
  g1.addColorStop(0,'rgba(0,0,0,0)');
  g1.addColorStop(1,'rgba(0,0,0,'+(.22*e).toFixed(3)+')');
  ctx.fillStyle=g1; ctx.fillRect(x0,py-f,w2,w2);
  ctx.restore();
  /* ② 掀起的那一片：纸的背面，偏亮，带一点投影 */
  ctx.save();
  ctx.shadowColor='rgba(0,0,0,'+(.34*e).toFixed(3)+')';
  ctx.shadowBlur=pw*.026;
  ctx.shadowOffsetX=dx*pw*.007; ctx.shadowOffsetY=pw*.008;
  ctx.beginPath();
  ctx.moveTo(px+dx*f,py); ctx.lineTo(px,py-f); ctx.lineTo(px+dx*f,py-f); ctx.closePath();
  /* 纸的背面：靠折痕那侧偏灰（背光），外沿更亮，这样它才不是一块死白 */
  const g2=ctx.createLinearGradient(px+dx*f,py,px,py-f);
  g2.addColorStop(0,'rgba(228,223,212,'+(.80*e).toFixed(3)+')');
  g2.addColorStop(1,'rgba(255,255,255,'+(.96*e).toFixed(3)+')');
  ctx.fillStyle=g2; ctx.fill();
  ctx.restore();
  /* ③ 折痕：一条很淡的暗线，把「掀起的一片」和「露出的下面」分开 */
  ctx.save();
  ctx.globalAlpha=.30*e;
  ctx.strokeStyle='rgba(0,0,0,.6)'; ctx.lineWidth=1;
  ctx.beginPath(); ctx.moveTo(px+dx*f,py); ctx.lineTo(px,py-f); ctx.stroke();
  ctx.restore();
};
BookView.prototype.flatPage=function(ctx,k,x,y,w,h,side){
  const src=this.pages[k];
  const bk=state.book;
  if(!src){
    ctx.fillStyle=bk.paper||'#fffdf8';
    ctx.fillRect(x,y,w,h);
  } else {
    ctx.drawImage(src,x,y,w,h);
  }
  /* 书脊阴影统一在 drawSheet 之后统一画，避免纸面副本出现接缝 */
};
BookView.prototype.edgeStack=function(ctx,x,top,ph,side,n){
  ctx.save();
  for(let i=0;i<n;i++){
    const d=(i+1)*1.7;
    const a=.16*(1-i/(n+2));
    ctx.fillStyle='rgba(233,227,214,'+a.toFixed(3)+')';
    ctx.fillRect(side==='l'?x-d:x+d-1.1,top+2+i*.5,1.6,ph-4-i);
    ctx.fillStyle='rgba(0,0,0,'+(a*.8).toFixed(3)+')';
    ctx.fillRect(side==='l'?x-d-1:x+d+d-1.4,top+2+i*.5,1,ph-4-i);
  }
  ctx.restore();
};
/* ---------- 翻页：普通纸 vs 硬纸板 ----------
   **普通内页 = 剥离式卷曲。** 纸不是刚体：翻页时书脊一侧几乎还贴在纸上，
   只有自由边被提起、卷曲、最后落下。把「纸面切线角」写成
     A(t) = π·q·[(1−lam) + lam·t^0.7]：
     · q=0 → 全页平贴在右页；q=1 → lam 自动归零，全页 A=π，平整落在左页
     · 中间态 → 书脊一侧角度滞后、自由边领先，纸面呈现自然的卷曲
   再把沿纸面积分出的「离桌高度」投影到屏幕上，纸就真正“立”了起来。

   ⚠ lam 的幅度是这一轮调得最狠的手感参数（对标 StPageFlip 之后）：
     旧值 0.94 意味着书脊侧滞后 94% —— 纸被卷成一卷，中段几乎看不到纸面，
     只剩一道弯曲，读起来发软、像橡胶。真实的一页纸翻过去的途中是**接近平面**
     的，只在书脊处有一道弯曲；只有快速甩动时才会因空气阻力明显鼓起来。所以：
       · 常态 lam≈0.34（一道轻微的 bow），甩动时按 bowBoost 加到 ~0.6（鼓起来）
       · 硬纸板 lam≈0.10 —— 基本就是刚体平板

   **硬纸板 = 刚体绕书脊旋转。** 封面不是一张纸，它绕书脊这根竖轴转动，像一扇门：
   自由边在水平面里扫过，屏幕上表现为投影宽度 W·cos(πq) 由满→零→满，
   而**离桌高度几乎不变** —— 所以投影系数 KZ 从 0.46 降到 0.12。
   板有厚度：厚度面只在侧立时才露出来，屏幕上恰是「板厚 × |sin(πq)|」宽的一条，
   90° 前后出现、两端归零。这一条细边就是「这本书是精装」的全部说服力。 */
BookView.prototype.drawSheet=function(ctx,i,p){
  const W=this.pw, H=this.ph, cy=this.cy, sx0=this.spineX, top=this.top;
  const mv=this.anim||this.live;
  const dir=(mv&&mv.dir)||'fwd';
  const isBack=(dir==='back');
  const m=isBack?-1:1;                       /* back 时自由边朝左 */
  const q=clamp(isBack?1-p:p,0,1);           /* 0=贴合本侧  1=完全翻到另一侧 */
  const hard=this.sheetHard(i);              /* 封面/封底/环衬 → 硬纸板 */
  /* 角度相位：纸转到 90° 时在屏幕上必然接近一条线（投影跨度只剩页宽的 1/6），
     这一瞬间本身是对的，但**停留太久**就会读成「图片突然没了、只剩一条空白纸」。
     用一个两端不动、中间变陡的映射重排时间：q=0/1 仍严格映到 0/1，
     于是首尾的平放状态与落地连续性完全不受影响，只是让「立起来」那段快速掠过。 */
  const qw=(function(x){
    const u=clamp(x,0,1)*2-1, a=Math.abs(u);
    if(a<1e-9) return .5;
    return .5+.5*(u>0?1:-1)*Math.pow(a,.55);
  })(q);
  const pageF=this.sheetFront(i), pageB=this.sheetBack(i);
  const N=this.N, du=W/N;
  const warm=(this.bowBoost||0);             /* 快速拖动时鼓得更明显 */
  const qL=clamp(.86-warm*.18,.55,.92);      /* 自由边落到左页的那个时刻 */
  const A1=Math.min(1,qw/qL);                /* 自由边的转角比例 */
  /* 书脊侧的滞后量。两端必须归零：平放时与 flatPage 的贴图严丝合缝，
     落地时不会因为这一点点角度差而「跳」一下。 */
  const lamMax=(hard?.10:.34)*(1+warm*1.05);
  const lam=lamMax*(1-Math.pow(qw,4.5));
  const A0=A1*(1-lam);
  const tc=clamp(1-(qw-qL)/(1-qL),0,1);      /* 落页点（纸面弧长坐标）：1→0 */
  const AN=new Float64Array(N+1);
  for(let k=0;k<=N;k++){
    const t=k/N;
    if(tc>1e-6&&t<tc) AN[k]=Math.PI*(A0+(A1-A0)*Math.pow(t/tc,.70));
    else AN[k]=Math.PI*A1;
  }
  const XX=new Float64Array(N+1), RAWH=new Float64Array(N+1);
  for(let k=0;k<N;k++){
    const aa=(AN[k]+AN[k+1])*.5;
    XX[k+1]=XX[k]+du*Math.cos(aa);
    RAWH[k+1]=RAWH[k]+du*Math.sin(aa);
  }
  /* 抬升高度：以落页点为地面基准，落页点之后直接归零，
     于是纸是真的“铺”到左页上，而不是整张悬在半空。 */
  const sm=function(t){ t=clamp(t,0,1); return t*t*(3-2*t); };
  /* 高度 → 屏幕位移的投影系数。硬纸板绕竖轴转、自由边基本不升高，所以小得多 */
  const KZ=hard?.12:.46*(1-.30*q);
  const ZZ=new Float64Array(N+1);
  if(tc<1-1e-6){
    const hc=RAWH[Math.max(0,Math.min(N,Math.round(tc*N)))];
    for(let k=0;k<=N;k++){
      const t=k/N;
      ZZ[k]= t>=tc ? 0 : Math.max(0,RAWH[k]-hc*sm(t/tc));
    }
  } else {
    for(let k=0;k<=N;k++) ZZ[k]=RAWH[k];
  }
  const sxp=new Float64Array(N+1), dy=new Float64Array(N+1);
  for(let k=0;k<=N;k++){ sxp[k]=sx0+m*XX[k]; dy[k]=-ZZ[k]*KZ; }
  const yT=function(k){ return cy-H/2+dy[k]; };
  const yB=function(k){ return cy+H/2+dy[k]; };
  /* 投影跨度 → 纸有多「侧立」。
     纸转到接近 90° 时，屏幕上看到的其实已经不是纸面而是**纸的切边**，
     切边是受光的、应当发亮；如果照样按纸面公式压暗，中间那几帧就只剩一条灰糊，
     看起来就像「图没了」。所以侧立时把着色收敛掉，配合纸边高光，
     让这一瞬间读成「一张亮着的纸正在翻过去」。 */
  let spanMin=1e9, spanMax=-1e9;
  for(let k=0;k<=N;k++){ if(sxp[k]<spanMin)spanMin=sxp[k]; if(sxp[k]>spanMax)spanMax=sxp[k]; }
  const spanN=clamp((spanMax-spanMin)/(W*.34),0,1);
  const faceLight=.30+.70*spanN;
  /* ---- 1. 纸影：跟随纸形 · 按离页间隙加权 · 多层微偏移定向柔化 ----
     ① 只在纸真正离开下层纸之后才开始投；
     ② 偏移量按该处与下层纸的间隙加权——贴着书脊处间隙≈0，影≈0；
        自由边抬得最高，影最宽最柔（真实阴影的半分影随距离变宽）；
     ③ 用多层同形微偏移叠加代替模糊，边缘天然平滑，且不依赖 ctx.filter。 */
  let kLift=-1;
  for(let k=0;k<=N;k++){ if(AN[k]>.10){ kLift=k; break; } }
  const liftN=clamp(ZZ[N]/(W*.42),0,1);
  this._lastLift=liftN;
  const pr=Math.pow(Math.sin(Math.PI*clamp(qw,0,1)),.9)*liftN;
  if(kLift>=0&&pr>.012){
    /* 硬纸板投的影更实、更短 —— 刚体的影不像纸那样糊成一片 */
    const A=(hard?.46:.32)*pr;
    const S=W*(hard?.024:.034)+W*(hard?.042:.058)*liftN;
    const ox=.60*S, oy=.80*S;                  /* 光自左上：影落向右下 */
    const LAY=10, aL=1-Math.pow(1-A,1/LAY);
    const span=Math.max(1,N-kLift);
    const wgt=function(k){ return Math.pow(clamp((k-kLift)/span,0,1),.85); };
    ctx.save();
    ctx.beginPath(); ctx.rect(sx0-W-4,top-44,W*2+8,H+88); ctx.clip();
    ctx.fillStyle='rgba(7,7,8,'+aL.toFixed(4)+')';
    for(let j=1;j<=LAY;j++){
      const t=j/LAY;
      ctx.beginPath();
      for(let k=kLift;k<=N;k++){
        const w=wgt(k), px=sxp[k]+ox*t*w, py=yT(k)+oy*t*w;
        if(k===kLift) ctx.moveTo(px,py); else ctx.lineTo(px,py);
      }
      for(let k=N;k>=kLift;k--){
        const w=wgt(k);
        ctx.lineTo(sxp[k]+ox*t*w,yB(k)+oy*t*w);
      }
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  /* ---- 2. 剪影：底色 + 裁剪 ---- */
  const paper=state.book.paper||'#fffdf8';
  ctx.beginPath();
  for(let k=0;k<=N;k++){ if(k===0) ctx.moveTo(sxp[k],yT(k)); else ctx.lineTo(sxp[k],yT(k)); }
  for(let k=N;k>=0;k--) ctx.lineTo(sxp[k],yB(k));
  ctx.closePath();
  ctx.save();
  ctx.fillStyle=paper; ctx.fill();
  ctx.clip();
  /* ---- 3. 内容条带 ----
     每条带把源图上 sw 宽的一条压进屏幕上 |w| 宽的一条（|w| = 该处 cosA·du）。
     两侧要外扩一点避免相邻条之间露缝，但**外扩量必须按条宽成比例**：
     用固定像素外扩（比如 0.6px）时，纸接近侧立的那些帧 |w| 只有 0.5px，
     源切片会被撑到自身宽度的三倍以上 —— 相当于对整页做极限降采样，
     内容被平均成一片纸色，看起来就是「翻到一半图直接没了」。
     按比例给外扩，采样密度才恰好等于几何压缩比，内容保住。 */
  for(let k=0;k<N;k++){
    const xA=sxp[k], xB=sxp[k+1], w=xB-xA, aw=Math.abs(w);
    if(aw<.05) continue;
    const nm=(AN[k]+AN[k+1])/2;
    const isFront=(Math.cos(nm)*m)>0;
    const src=isFront?pageF:pageB;
    const mir=!isFront;
    const y0=(yT(k)+yT(k+1))/2, hh=H;
    const ov=Math.min(.55,aw*.34);
    const drawL=Math.min(xA,xB)-ov, drawW=aw+2*ov;
    if(!src){ ctx.fillStyle=paper; ctx.fillRect(drawL,y0,drawW,hh); continue; }
    const S=src.width, SH=src.height, sw=S/N;
    const grow=(ov/aw)*sw;
    const srcA=(mir?S-(k+1)*sw:k*sw)-grow;
    ctx.drawImage(src, srcA, 0, sw+2*grow, SH, drawL, y0, drawW, hh);
  }
  /* ---- 4. 连续着色（在折返点处分段，保证 x 单调）----
     关键约束：纸「平放」时（A=0 贴在右页、A=π 落在左页）必须**完全没有**明暗差。
     否则纸落下的那一刻，绘制从 drawSheet 交接到 flatPage（直接贴原图），
     亮度会突然跳一档 —— 这就是落地瞬间「白一下」的来源。
     ⚠ 不能简单减常数：原公式在端部有个非单调的小鼓包（A=0 时 .082，A≈0.4 时反而 .030），
     减常数会把中前段压成负数、被 clamp 成 0，翻动中的纸就整个「消失」了。
     所以乘一个两端收敛的窗，中段暗度原样保留。 */
  const W0=.42;                                  /* 窗宽（弧度）：刚好抹掉端部鼓包 */
  const winOf=function(A){
    const a=Math.min(A,Math.PI-A);               /* 到最近「平放端」的角距 */
    const t=clamp(a/W0,0,1);
    return t*t*(3-2*t);
  };
  let kr=N;
  for(let k=0;k<=N;k++){ if(Math.cos(AN[k])*m<0){ kr=k; break; } }
  const darkOf=function(k){
    const kk=clamp(k,0,N), A=AN[kk];
    const nz=Math.cos(A), bend=1-Math.abs(nz);
    const nl=clamp(.4205*Math.sin(A)+.841*Math.abs(nz),0,1);
    let d=.90*Math.pow(clamp(1-nl,0,1),1.30)*winOf(A);
    d+=.16*Math.max(0,1-(kk/N)/.10)*bend;      /* 书脊侧的折痕 */
    return clamp(d*faceLight,0,.72);           /* 侧立时收敛：见 faceLight */
  };
  const shade=function(k0,k1){
    if(k1-k0<1) return;
    const xA=sxp[k0], xB=sxp[k1];
    if(Math.abs(xB-xA)<1.2) return;
    const g=ctx.createLinearGradient(xA,0,xB,0);
    for(let k=k0;k<=k1;k++) g.addColorStop(clamp((sxp[k]-xA)/(xB-xA),0,1),'rgba(8,7,6,'+darkOf(k).toFixed(3)+')');
    ctx.fillStyle=g;
    ctx.fillRect(Math.min(xA,xB)-1,Math.min(yT(k0),yT(k1))-2,Math.abs(xB-xA)+2,H+Math.abs(dy[k1]-dy[k0])+6);
  };
  shade(0,kr); shade(kr,N);
  ctx.restore();
  /* ---- 5. 硬纸板的厚度面 ----
     精装书的封面是一块板，不是一张纸。板绕竖轴转，只有侧立时才看得见它的切边：
     屏幕上宽度恰好是「板厚 × |sin(角度)|」—— 90° 前后最宽、两端自然归零，
     所以平放时它不出现，落地时也不会突然消失。
     这一条 10px 左右的边，就是「精装 vs 平装」在翻页过程中的全部证据。 */
  if(hard){
    const th=W*.024*Math.abs(Math.sin(Math.PI*q));
    if(th>.9){
      const xe=sxp[N], yt=yT(N), yb=yB(N);
      const eDir=(q<=.5?1:-1)*m;                 /* 朝远离书脊的一侧长出去 */
      const x0=eDir>0?xe:xe-th;
      ctx.save();
      ctx.fillStyle=state.book.paper||'#fffdf8';
      ctx.fillRect(x0,yt,th,yb-yt);
      /* 板芯比封面暗，最外侧再压一条深线把轮廓收住 */
      ctx.fillStyle='rgba(0,0,0,.17)'; ctx.fillRect(x0,yt,th,yb-yt);
      ctx.fillStyle='rgba(0,0,0,.26)';
      ctx.fillRect(eDir>0?x0+th-1.2:x0,yt,1.2,yb-yt);
      ctx.fillStyle='rgba(255,255,255,.20)';
      ctx.fillRect(eDir>0?x0:x0+th-1.0,yt,1.0,yb-yt);
      ctx.restore();
    }
  }
  /* ---- 6. 纸边高光 ----
     只在纸被抬起、边缘真正受光时才画；平放（q→0 / q→1）时收敛到 0，
     否则落地瞬间这条亮边会突然消失，同样是一下「闪白」。 */
  const hgl=clamp(liftN*1.5,0,1);
  if(hgl>.01){
    ctx.save();
    ctx.globalAlpha=(hard?.34:.55)*hgl;
    ctx.lineWidth=hard?1.4:1.1;
    ctx.strokeStyle='rgba(255,253,246,.6)';
    ctx.beginPath();
    for(let k=0;k<=N;k++){ if(k===0) ctx.moveTo(sxp[k],yT(k)); else ctx.lineTo(sxp[k],yT(k)); }
    for(let k=N;k>=0;k--) ctx.lineTo(sxp[k],yB(k));
    ctx.closePath();
    ctx.stroke();
    ctx.restore();
  }
};
/* ---------- 交互 ---------- */
BookView.prototype.next=function(){ if(this.cur<this.n){ this.flipOne('fwd',{}); } else if(this.autoTimer){ this.cur=0; this.syncUI(); this.draw(); } };
BookView.prototype.prev=function(){ if(this.cur>0) this.flipOne('back',{}); };
BookView.prototype.go=function(i){
  i=clamp(i,0,this.n);
  if(i===this.cur||this.anim) return;
  this.stopAuto();
  this.queue=[];
  const start=this.cur, dirs=[];
  if(i>start){ for(let k=start;k<i;k++) dirs.push('fwd'); }
  else { for(let k=start-1;k>=i;k--) dirs.push('back'); }
  if(!dirs.length) return;
  const first=dirs.shift();
  this.queue=dirs;
  this.flipOne(first,{dur:dirs.length?Math.round(flipDur()*.42):Math.round(flipDur()*.90)});
};
BookView.prototype.flipOne=function(dir,o){
  o=o||{};
  const i=dir==='fwd'?this.cur:this.cur-1;
  if(i<0||i>=this.n) return false;
  const p0=dir==='fwd'?0:1, p1=dir==='fwd'?1:0;
  const dur=o.dur||flipDur();
  this.anim={i:i,dir:dir,p0:p0,p1:p1,p:p0,t0:performance.now()+(o.delay||0),dur:dur};
  this.live=null;
  this.kick();
  return true;
};
BookView.prototype.down=function(e){
  if(!this.pages.length) return;
  if(e.pointerType==='mouse'&&e.button!==0) return;
  if(this.anim) return;
  const local=this.localX(e.clientX);
  const right=local>=this.spineX;
  let dir=null,i=0;
  if(right){ if(this.cur<this.n){ dir='fwd'; i=this.cur; } }
  else { if(this.cur>0){ dir='back'; i=this.cur-1; } }
  if(!dir) return;
  this.stopAuto();
  this.queue=[];
  const p0=dir==='fwd'?0:1;
  this.drag={i:i,dir:dir,x0:e.clientX,p0:p0,p:p0,v:0,t0:performance.now(),moved:0};
  this.live={i:i,dir:dir,p:p0};
  this.bowBoost=0;
  this.el.classList.add('dragging');
  this.hint.classList.add('off');
  try{ this.cv.setPointerCapture(e.pointerId); }catch(err){}
  this.kick();
};
BookView.prototype.move=function(e){
  if(!this.drag) return;
  const d=this.drag, now=performance.now();
  const dx=e.clientX-d.x0;
  if(Math.abs(dx)>d.moved) d.moved=Math.abs(dx);
  const span=this.pw*1.72;
  let p=clamp(d.p0-dx/span,0,1);
  const dt=Math.max(1,now-d.t0);
  d.v=(dx/d.t0v0===undefined?0:0);
  if(!d.last){ d.last={t:now,x:e.clientX}; }
  const idle=now-d.last.t;
  if(idle>18){ d.v=(e.clientX-d.last.x)/idle; d.last={t:now,x:e.clientX}; }
  d.p=p; this.live.p=p;
  this.bowBoost=Math.min(.5,Math.abs(d.v)*.09);
  this.kick();
};
BookView.prototype.up=function(e){
  if(!this.drag) return;
  const d=this.drag; this.drag=null;
  this.el.classList.remove('dragging');
  try{ this.cv.releasePointerCapture&&this.cv.releasePointerCapture(e.pointerId); }catch(err){}
  const p=this.live?this.live.p:d.p0;
  const v=d.v||0;
  if(d.moved<7){ /* 点击 */
    this.live=null;
    if(d.dir==='fwd') this.next(); else this.prev();
    return;
  }
  const sign=d.dir==='fwd'?-1:1;
  let commit;
  if(Math.abs(v)>1.5) commit=(Math.sign(v)===sign);
  else commit=d.dir==='fwd'?p>.34:p<.66;
  const p1=commit?(d.dir==='fwd'?1:0):(d.dir==='fwd'?0:1);
  const dur=Math.max(260,Math.round(240+520*Math.abs(p1-p)));
  this.live=null;
  this.queue=[];
  if(commit&&d.dir==='fwd'&&Math.abs(v)>3.0) this.queue.push('fwd');
  if(commit&&d.dir==='fwd'&&Math.abs(v)>5.4) this.queue.push('fwd');
  if(commit&&d.dir==='back'&&Math.abs(v)>3.0) this.queue.push('back');
  if(commit) Sound.swish(clamp(.5+Math.abs(v)/5,.4,1.3));
  this.anim={i:d.i,dir:d.dir,p0:p,p1:p1,p:p,t0:performance.now(),dur:dur};
  this.bowBoost=0;
  this.kick();
};
BookView.prototype.toggleAuto=function(){
  const self=this;
  if(this.autoTimer){ this.stopAuto(); return; }
  const btn=$('[data-a="auto"]',this.el);
  if(btn) btn.classList.add('on');
  this.autoTimer=setInterval(function(){
    if(self.cur>=self.n){ self.cur=0; self.syncUI(); self.draw(); }
    else self.next();
  },3000);
  toast('自动翻页已开启');
};
BookView.prototype.stopAuto=function(){
  if(this.autoTimer){
    clearInterval(this.autoTimer); this.autoTimer=null;
    const btn=$('[data-a="auto"]',this.el);
    if(btn) btn.classList.remove('on');
  }
};
BookView.prototype.introOpen=function(){
  if(this._intro||!this.spread||this.cur!==0) return;
  this._intro=true;
  const self=this;
  setTimeout(function(){
    if(!self.el.isConnected) return;
    self.flipOne('fwd',{dur:1000});
  },560);
};
const BV=new BookView();

/* ============================================================
   界面渲染
   ============================================================ */
function renderRail(){
  const n=state.photos.length;
  const picked=state.photos.filter(function(p){ return p.picked; }).length;
  $('#photoCount').textContent=n;
  const pc=$('#pickCount');
  if(pc) pc.textContent=n?(picked+' / '+n+' 张入册'):'—';
  syncGenBtn();
  const grid=$('#railGrid');
  if(!n){
    grid.innerHTML='<div class="rail-empty"><b>还没有素材</b>'+
      '<span>把照片拖进这里、或按 Ctrl+V 粘贴；也可以用右上角「示例照片」先跑一遍完整流程。</span></div>';
    return;
  }
  grid.innerHTML=state.photos.map(function(p){
    const t=TPL[p.tpl]?TPL[p.tpl].name:'未分配';
    return '<div class="rthumb'+(p.id===state.sel?' on':'')+(p.picked?'':' off')+'" data-id="'+p.id+'">'+
      '<img src="'+p.thumb+'" alt="">'+
      '<span class="pick'+(p.picked?' on':'')+'" data-pick="'+p.id+'" role="checkbox" tabindex="0"'+
        ' aria-checked="'+(p.picked?'true':'false')+'"'+
        ' title="'+(p.picked?'已入册，点击移出':'未入册，点击加入')+'">'+(p.picked?'✓':'')+'</span>'+
      '<span class="rot" data-rot="'+p.id+'" title="旋转 90°">&#8635;</span>'+
      '<span class="x" data-del="'+p.id+'" title="移除">&#10005;</span>'+
      '<span class="tplb" title="这张照片用的模版：'+t+'">'+t+'</span>'+
      '<span class="rt">'+p.name+'</span></div>';
  }).join('');
}
function schedulePreview(){
  clearTimeout(schedulePreview._t);
  schedulePreview._t=setTimeout(function(){ renderPreview(); renderDock(); },80);
}
/* ---------- 模版预览视口：拖动平移 · 滚轮/Ctrl+滚轮缩放 · 双击复位 ---------- */
const PV={zoom:1,tx:0,ty:0,fit:1,ar:.75,nom:1000,photo:'',zk:0,zt:0};
const PV_MAX=5, PV_MIN=.4;
function pvBox(){
  const w=$('#pvWrap'); if(!w) return null;
  const r=w.getBoundingClientRect();
  return (r.width>4&&r.height>4)?r:null;
}
function pvNom(ar){
  const a=ar||PV.ar||.75, n=PV.nom;
  return a>=1?{W:n,H:n/a}:{W:n*a,H:n};
}
function pvPad(box){ return clamp(Math.min(box.width,box.height)*.018,8,26); }
function pvApply(){
  const box=pvBox(), inner=$('#pvInner');
  if(!box||!inner) return;
  const s=pvNom();
  inner.style.width=R(s.W)+'px'; inner.style.height=R(s.H)+'px';
  const pad=pvPad(box);
  const fit=Math.min((box.width-pad*2)/s.W,(box.height-pad*2)/s.H);
  PV.fit=fit;
  const sc=fit*PV.zoom, hw=s.W*sc/2, hh=s.H*sc/2;
  const rx=Math.max(box.width*.24,hw-box.width*.28), ry=Math.max(box.height*.24,hh-box.height*.28);
  PV.tx=clamp(PV.tx,-rx,rx); PV.ty=clamp(PV.ty,-ry,ry);
  inner.style.transform='translate(-50%,-50%) translate('+R(PV.tx)+'px,'+R(PV.ty)+'px) scale('+sc.toFixed(4)+')';
  const zv=$('#pvZoomVal'); if(zv) zv.textContent=R(PV.zoom*100)+'%';
  const zi=$('#pvZoomIn'), zo=$('#pvZoomOut');
  if(zi) zi.disabled=PV.zoom>=PV_MAX-1e-6;
  if(zo) zo.disabled=PV.zoom<=PV_MIN+1e-6;
}
function pvEdge(){
  const box=pvBox()||{width:900,height:620}, s=pvNom(), pad=pvPad(box);
  const fit=Math.min((box.width-pad*2)/s.W,(box.height-pad*2)/s.H);
  const need=Math.max(s.W,s.H)*fit*PV.zoom*(window.devicePixelRatio||1);
  return clamp(R(need/60)*60,600,3000);
}
function pvHud(txt){
  const el=$('#pvZoom'); if(!el) return;
  el.textContent=txt; el.classList.add('on');
  clearTimeout(PV.zk); PV.zk=setTimeout(function(){ el.classList.remove('on'); },960);
}
function pvRerender(){
  clearTimeout(PV.zt);
  PV.zt=setTimeout(function(){ if(state.step!==2&&$('#pvWrap')) renderPreview(); },220);
}
function pvZoomAt(nz,cx,cy){
  const box=pvBox(); if(!box) return;
  const z=clamp(nz,PV_MIN,PV_MAX);
  if(Math.abs(z-PV.zoom)<1e-4) return;
  if(cx==null) cx=box.width/2;
  if(cy==null) cy=box.height/2;
  const ox=cx-box.width/2, oy=cy-box.height/2, k=z/PV.zoom;
  PV.tx=ox+(PV.tx-ox)*k; PV.ty=oy+(PV.ty-oy)*k;
  PV.zoom=z; pvApply();
  pvHud(R(PV.zoom*100)+'%');
  pvRerender();
}
function pvReset(){
  PV.zoom=1; PV.tx=0; PV.ty=0; pvApply();
  pvHud('已适应窗口'); pvRerender();
}
function bindPV(){
  const wrap=$('#pvWrap');
  let drag=null;
  wrap.addEventListener('pointerdown',function(e){
    if(e.target.closest('.pv-tools')) return;
    drag={x:e.clientX,y:e.clientY,tx:PV.tx,ty:PV.ty,id:e.pointerId};
    wrap.classList.add('grabbing');
    try{ wrap.setPointerCapture(e.pointerId); }catch(err){}
  });
  wrap.addEventListener('pointermove',function(e){
    if(!drag||e.pointerId!==drag.id) return;
    PV.tx=drag.tx+(e.clientX-drag.x); PV.ty=drag.ty+(e.clientY-drag.y);
    pvApply();
  });
  const end=function(){ if(drag){ drag=null; wrap.classList.remove('grabbing'); } };
  wrap.addEventListener('pointerup',end);
  wrap.addEventListener('pointercancel',end);
  wrap.addEventListener('wheel',function(e){
    e.preventDefault();
    const r=wrap.getBoundingClientRect();
    const m=e.deltaMode===1?18:(e.deltaMode===2?400:1);
    pvZoomAt(PV.zoom*Math.exp(-e.deltaY*m*.0016),e.clientX-r.left,e.clientY-r.top);
  },{passive:false});
  wrap.addEventListener('dblclick',function(e){
    if(e.target.closest('.pv-tools')) return;
    pvReset();
  });
  wrap.addEventListener('keydown',function(e){
    const k=e.key;
    if(k==='+'||k==='='){ pvZoomAt(PV.zoom*1.2); e.preventDefault(); }
    else if(k==='-'||k==='_'){ pvZoomAt(PV.zoom/1.2); e.preventDefault(); }
    else if(k==='0'){ pvReset(); e.preventDefault(); }
    else if(k.indexOf('Arrow')===0){
      const st=e.shiftKey?64:26;
      if(k==='ArrowLeft') PV.tx-=st; else if(k==='ArrowRight') PV.tx+=st;
      else if(k==='ArrowUp') PV.ty-=st; else PV.ty+=st;
      pvApply(); e.preventDefault();
    }
  });
  $('#pvZoomIn').addEventListener('click',function(){ pvZoomAt(PV.zoom*1.25); });
  $('#pvZoomOut').addEventListener('click',function(){ pvZoomAt(PV.zoom/1.25); });
  $('#pvFit').addEventListener('click',pvReset);
}
function renderPreview(){
  if(state.step===2){ renderBookStage(); return; }
  const body=$('#stageBody');
  const p=state.photos.find(function(q){ return q.id===state.sel; })||state.photos[0];
  if(!p){
    body.innerHTML='<div class="empty"><div class="big">&#9635;</div><h3>先从一张照片开始</h3>'+
      '<p>整条流程是：<b>导入照片 → 给每张照片挑模版 → 勾选要入册的照片 → 生成成片</b>。<br>'+
      '现在还没有素材，选一种开始方式：</p>'+
      '<div class="empty-acts">'+
        '<button class="btn primary" id="emptyDemo" type="button">载入 28 张示例照片</button>'+
        '<button class="btn" id="emptyImport" type="button">导入我的照片</button>'+
      '</div>'+
      '<p class="fine">也可以直接把图片拖进来，或在页面里按 Ctrl+V 粘贴。</p></div>';
    $('#stageNote').textContent='';
    return;
  }
  if(!$('#pvWrap')){
    body.innerHTML=
      '<div class="pv-wrap" id="pvWrap" tabindex="0" aria-label="模版预览：拖动平移，滚轮或 Ctrl+滚轮缩放，双击复位">'+
        '<div class="pv-inner" id="pvInner"><canvas id="previewCv"></canvas></div>'+
        '<div class="pv-tools">'+
          '<button type="button" id="pvZoomOut" title="缩小">&#8722;</button>'+
          '<span class="pv-z" id="pvZoomVal">100%</span>'+
          '<button type="button" id="pvZoomIn" title="放大">&#43;</button>'+
          '<button type="button" class="pv-fit" id="pvFit" title="适应窗口">适应</button>'+
        '</div>'+
        '<div class="pv-zoom" id="pvZoom"></div>'+
      '</div>';
    bindPV();
  }
  if(PV.photo!==p.id){ PV.photo=p.id; PV.zoom=1; PV.tx=0; PV.ty=0; }
  const tplKey=(TPL[p.tpl]?p.tpl:state.tpl);
  const cv=$('#previewCv');
  const out=renderCanvas(p,tplKey,state.opts,pvEdge());
  cv.width=out.width; cv.height=out.height;
  cv.getContext('2d').drawImage(out,0,0);
  PV.ar=out.width/out.height;
  pvApply();
  $('#stageNote').textContent=out.width+' × '+out.height+' px   ·   '+TPL[tplKey].name+'   ·   '+p.name+
    (p.picked?'':'   ·   （未入册，不会进入成片）');
}
function renderDock(){
  const bar=$('#tplbar'), strip=$('#strip');
  const applyAllBtn=$('#tplApplyAll');
  if(state.step===2){
    bar.style.display='none'; strip.style.display='block';
    if(applyAllBtn) applyAllBtn.style.display='none';
    $('#dockLabel').textContent='3D 选片条';
    $('#dockTip').textContent='拖动 / 滚轮浏览 · 点击居中照片切换收录';
    renderStrip(); return;
  }
  if(applyAllBtn) applyAllBtn.style.display='';
  bar.style.display='flex'; strip.style.display='none';
  $('#dockLabel').textContent='模版胶片带';
  const cur=selPhoto();
  $('#dockTip').textContent=cur
    ? ('当前编辑「'+cur.name+'」· 点模版记到这张照片 · 共 '+Object.keys(TPL).length+' 套')
    : (state.photos.length
        ? ('共 '+Object.keys(TPL).length+' 套模版 · 导入照片后可逐张分配')
        : ('共 '+Object.keys(TPL).length+' 套模版 · 下面是示例图效果，导入照片后可逐张分配'));
  const keys=Object.keys(TPL);
  bar.innerHTML=keys.map(function(k){
    var on=(k===state.tpl);
    return '<div class="tplcard'+(on?' on':'')+'" role="button" tabindex="0" aria-pressed="'+(on?'true':'false')+
      '" data-tpl="'+k+'" title="'+TPL[k].name+' —— 点一下记到当前照片">'+
      '<span class="tp-th"><canvas></canvas><span class="tp-nm">'+TPL[k].name+'</span></span></div>';
  }).join('');
  const p=state.photos.find(function(q){ return q.id===state.sel; })||state.photos[0]||demoPhoto();
  const cards=$$('.tplcard',bar);
  /* 按卡片实际宽度渲染，缩放胶片也保持清晰 */
  const c0=cards[0];
  const cw=c0?c0.getBoundingClientRect().width:86;
  const edge=clamp(R(cw*(window.devicePixelRatio||1)*1.4),150,420);
  cards.forEach(function(card){
    const cv=$('canvas',card);
    const out=renderCanvas(p,card.dataset.tpl,state.opts,edge);
    cv.width=out.width; cv.height=out.height;
    cv.getContext('2d').drawImage(out,0,0);
  });
}
/* 还没有素材时，胶片带用一张内置示例图演示各模版，而不是留一排空框 */
let DEMO_PHOTO=null;
function demoPhoto(){
  if(!DEMO_PHOTO){
    const c=makeSample(1);
    DEMO_PHOTO={id:'demo',el:c,w:c.width,h:c.height,name:'示例',tpl:'polaroid',picked:true,rot:0,zoom:1,ox:0,oy:0};
  }
  return DEMO_PHOTO;
}
/* ---------- 3D 选片条：rAF 弹簧落位 + 惯性 + 滚轮 / 键盘 ---------- */
const STRIP={pos:0,vel:0,target:0,acc:0,drag:null,moved:false,raf:0,lt:0,sup:0};
function stripItems(){ return state.generated||[]; }
function stripMax(){ return Math.max(0,stripItems().length-1); }
function stripMetrics(){
  const el=$('#strip');
  const h=Math.max(54,Math.round(Math.min(el?(el.clientHeight-22):118,146)));
  const w=Math.max(42,Math.round(h*.78));
  return {w:w,h:h,step:w+24};
}
function stripNavText(){
  const it=stripItems();
  $('#stripNav').textContent=it.length
    ? ('已选 '+it.filter(function(g){ return g.picked; }).length+' / '+it.length+
       ' 张 · 拖动或滚轮浏览 · 点两侧照片居中，点居中照片切换收录')
    : '';
}
function stripArrows(){
  const p=$('#stripPrev'), x=$('#stripNext'), n=stripItems().length-1;
  if(p) p.disabled=STRIP.pos<=.02;
  if(x) x.disabled=STRIP.pos>=n-.02;
}
function layoutStrip(){
  const m=stripMetrics(), n=stripItems().length;
  const ctr=clamp(R(STRIP.pos),0,Math.max(0,n-1));
  $$('.sitem',$('#stripTrack')).forEach(function(el,i){
    const d=i-STRIP.pos, ad=Math.abs(d);
    el.style.width=m.w+'px'; el.style.height=m.h+'px';
    el.style.marginLeft=(-m.w/2)+'px'; el.style.marginTop=(-m.h/2)+'px';
    el.style.transform='translate3d('+(d*m.step).toFixed(2)+'px,0,'+(-ad*58).toFixed(2)+'px) '+
      'rotateY('+clamp(-d*26,-52,52).toFixed(2)+'deg) scale('+(1-Math.min(ad,6)*.058).toFixed(4)+')';
    el.style.opacity=String(ad>5.8?0:clamp(1-(ad-4)*.75,0,1).toFixed(3));
    el.style.zIndex=String(200-R(ad*2));
    el.classList.toggle('ctr',i===ctr);
  });
  stripArrows();
}
function stripStop(){ cancelAnimationFrame(STRIP.raf); STRIP.raf=0; STRIP.vel=0; }
function stripSettle(target,keepV){
  STRIP.target=clamp(target,0,stripMax());
  if(!keepV) STRIP.vel=0;
  if(STRIP.raf) return;
  const tick=function(){
    STRIP.vel=(STRIP.vel+(STRIP.target-STRIP.pos)*.20)*.60;
    STRIP.pos+=STRIP.vel;
    if(Math.abs(STRIP.target-STRIP.pos)<.0015&&Math.abs(STRIP.vel)<.0015){
      STRIP.pos=STRIP.target; STRIP.vel=0; STRIP.raf=0;
      layoutStrip(); return;
    }
    layoutStrip();
    STRIP.raf=requestAnimationFrame(tick);
  };
  STRIP.raf=requestAnimationFrame(tick);
}
function stripStep(d){ stripStop(); stripSettle(R(STRIP.pos)+d); }
function stripToggle(i){
  const g=state.generated[i];
  if(!g) return;
  g.picked=!g.picked;
  const el=$$('.sitem',$('#stripTrack'))[i];
  if(el) el.classList.toggle('pick',g.picked);
  stripNavText();
  renderPanel();
  scheduleBook(false);
}
function renderStrip(){
  const track=$('#stripTrack');
  const items=stripItems();
  if(!items.length){
    track.dataset.n='';
    track.innerHTML='<div style="position:absolute;inset:0;display:flex;align-items:center;'+
      'justify-content:center;color:var(--faint);font-size:12.5px">还没有成片 · 先点右上角「生成成片」</div>';
    $('#stripNav').textContent=''; stripArrows(); return;
  }
  if(track.dataset.n!==String(items.length)){
    track.dataset.n=String(items.length);
    track.innerHTML=items.map(function(g,i){
      return '<div class="sitem'+(g.picked?' pick':'')+'" data-i="'+i+'">'+
        '<img src="'+g.thumb+'" alt="" draggable="false">'+
        '<span class="no">'+pad2(i+1)+'</span>'+
        '<span class="chk">&#10003;</span></div>';
    }).join('');
    STRIP.pos=0; STRIP.vel=0;
  } else {
    $$('.sitem',track).forEach(function(el,i){ el.classList.toggle('pick',items[i].picked); });
  }
  STRIP.pos=clamp(STRIP.pos,0,Math.max(0,items.length-1));
  layoutStrip();
  stripNavText();
}
function renderStage(){
  if(state.step===2) renderBookStage(); else renderPreview();
}
function renderBookStage(){
  const body=$('#stageBody');
  if(!state.generated.length){
    if(body.contains(BV.el)) body.removeChild(BV.el);
    body.innerHTML='<div class="empty"><div class="big">&#9636;</div><h3>还没有成片</h3>'+
      '<p>点右上角「生成成片」，把当前模版批量渲染成照片书。</p></div>';
    $('#stageNote').textContent='';
    return;
  }
  if(!body.contains(BV.el)){ body.innerHTML=''; body.appendChild(BV.el); }
  $('#stageNote').textContent='拖动书页翻页 · 点左右半边或 ← → 键 · ⛶ 沉浸全屏阅读';
  scheduleBook();
}
let bookTimer=null;
function scheduleBook(animateIntro){
  clearTimeout(bookTimer);
  bookTimer=setTimeout(function(){
    if(!state.generated.length) return;
    const r=buildBookPages();
    BV.setPages(r.pages,r.ratio,!!state.book.spread,true);
    $('#readerTitle').textContent=(state.book.title||'光匣')+' · 沉浸阅读';
    if(animateIntro) BV.introOpen();
  },40);
}
function setStep(n){
  state.step=n;
  $$('#steps button').forEach(function(b){ b.classList.toggle('on',+b.dataset.step===n); });
  document.body.classList.toggle('bookmode',n===2);
  if(n!==2&&BV.el.parentNode) BV.el.parentNode.removeChild(BV.el);
  renderPanel(); renderDock(); renderStage(); syncGenBtn();
}
/* ---------- 阅读器 ---------- */
function openReader(){
  if(!state.generated.length){ toast('请先「生成成片」'); return; }
  const r=$('#reader');
  $('#readerTitle').textContent=(state.book.title||'光匣')+' · 沉浸阅读';
  r.appendChild(BV.el);
  BV.fullBtn.style.display='none';
  r.classList.add('on');
  requestAnimationFrame(function(){ BV.layout(); BV.kick(); });
}
function closeReader(){
  const r=$('#reader');
  if(!r.classList.contains('on')) return;
  r.classList.remove('on');
  BV.fullBtn.style.display='';
  const body=$('#stageBody');
  if(body) body.appendChild(BV.el);
  requestAnimationFrame(function(){ BV.layout(); BV.kick(); });
}
/* ---------- 生成按钮：把「会生成几张」直接写在按钮上 ---------- */
let genBusy=false;
function syncGenBtn(){
  const btn=$('#genBtn'); if(!btn||genBusy) return;
  const pk=state.photos.filter(function(p){ return p.picked; }).length;
  btn.textContent=pk?('生成成片 · '+pk+' 张'):'生成成片';
  btn.disabled=!pk;
  btn.title=pk?('渲染这 '+pk+' 张入册照片，每张用它自己的模版'):'先导入照片并勾选要入册的';
}
function busyOn(t){ $('#busyText').innerHTML=t; $('#busy').classList.add('on'); }
function busyOff(){ $('#busy').classList.remove('on'); }

/* ---------- 生成（带进度） ---------- */
function makeThumb(src){
  const k=Math.min(260/Math.max(src.width,src.height),1);
  const c=document.createElement('canvas');
  c.width=Math.max(1,R(src.width*k)); c.height=Math.max(1,R(src.height*k));
  c.getContext('2d').drawImage(src,0,0,c.width,c.height);
  return c.toDataURL('image/jpeg',.72);
}
async function generate(){
  if(!state.photos.length){ toast('先导入一些照片'); return; }
  const list=state.photos.filter(function(p){ return p.picked; });
  if(!list.length){ toast('还没有勾选要入册的照片'); return; }
  const btn=$('#genBtn');
  genBusy=true;
  btn.disabled=true; btn.textContent='渲染中…';
  busyOn('正在渲染 <b>'+list.length+'</b> 张成片…');
  await tick(40);
  const t0=performance.now();
  const LE=state.spec.longEdge, out=[];
  for(let i=0;i<list.length;i++){
    const p=list[i];
    /* 每张照片用它自己被分配的那套模版 */
    const art=renderCanvas(p,p.tpl||state.tpl,state.opts,LE);
    const fin=finalize(art);
    /* plain：不带模版外壳的干净照片，书本内页与封面都用它。
       没有这一步，28 页会整整齐齐地套 28 个同款宝丽来白框。 */
    const plain=renderPlain(p,LE);
    out.push({id:'g'+i,photoId:p.id,art:art,canvas:fin,plain:plain,tpl:p.tpl||state.tpl,
      thumb:makeThumb(fin),title:state.opts.title||'',sub:state.opts.sub||'',name:p.name,picked:true});
    if(i%3===0){ busyOn('正在渲染 <b>'+(i+1)+'/'+list.length+'</b> 张成片…'); await tick(0); }
  }
  state.generated=out;
  state._coverRank=null;   /* 封面打分缓存作废（新一批成片了） */
  busyOff();
  genBusy=false; btn.disabled=false; syncGenBtn();
  toast('已生成 '+out.length+' 张成片 · 用时 '+R(performance.now()-t0)+' ms');
  if(state.step!==2){ BV._intro=false; setStep(2); scheduleBook(true); }
  else { renderPanel(); renderDock(); scheduleBook(false); }
}

/* ============================================================
   事件与启动
   ============================================================ */
function onChange(path){
  if(path.indexOf('spec.')===0||path.indexOf('adj.')===0||path.indexOf('opts.')===0) schedulePreview();
  /* 翻页速度只影响动画参数，不需要重排整本书的页面（那是几十张 canvas 的重绘） */
  if(path==='book.speed'){ PERSIST.save(); return; }
  if(path.indexOf('book.')===0){ scheduleBook(false); renderDock(); }
  PERSIST.save();
}
$('#panel').addEventListener('click',function(e){
  const seg=e.target.closest('.seg button');
  if(seg){
    const wrap=seg.parentElement;
    $$('button',wrap).forEach(function(b){ b.classList.toggle('on',b===seg); });
    let v=seg.dataset.v;
    if(v==='1') v=1; else if(v==='0') v=0;
    if(wrap.dataset.k==='book.spread') v=!!v;
    setPath(wrap.dataset.k,v);
    renderPanel(); renderDock(); renderStage();
    PERSIST.save();
    return;
  }
  const chip=e.target.closest('.chip[data-preset]');
  if(chip){
    state.preset=chip.dataset.preset;
    const v=PRESETS[state.preset].v;
    Object.keys(v).forEach(function(k){ state.adj[k]=v[k]; });
    renderPanel(); schedulePreview(); PERSIST.save();
    toast('已套用「'+PRESETS[state.preset].label+'」调色'); return;
  }
  const id=e.target.id;
  if(id==='resetAdj'){
    Object.keys(PRESETS.original.v).forEach(function(k){ state.adj[k]=PRESETS.original.v[k]; });
    state.preset='original'; renderPanel(); schedulePreview(); PERSIST.save(); toast('调色已重置');
  } else if(id==='resetOpts'){
    Object.keys(DEFAULT_OPTS).forEach(function(k){ state.opts[k]=DEFAULT_OPTS[k]; });
    renderPanel(); schedulePreview(); PERSIST.save(); toast('模版文字已恢复默认');
  } else if(id==='clearPrefs'){
    PERSIST.clear();
    state.photos.forEach(function(p){ p.tpl=state.tpl; p.picked=true; });
    renderRail(); renderPanel(); renderDock(); schedulePreview();
    toast('已清除本机保存的偏好与模版分配');
  } else if(id==='genBtn2'){ generate(); }
  else if(id==='genBtn3'){ generate(); }
  else if(id==='coverNext'){
    const rank=coverRank();
    if(rank.length<2){ toast('至少两张入册照片才能换封面'); return; }
    state.book.coverIdx=((state.book.coverIdx||0)+1)%rank.length;
    renderPanel(); scheduleBook(false); PERSIST.save();
    const g=rank[state.book.coverIdx];
    toast('封面主图换成「'+(g.name||'—')+'」'+(state.book.coverIdx===0?'（最佳）':''));
  }
  else if(id==='tplApplyAll2'){ if(state.photos.length) assignTpl(state.tpl,'all'); else toast('还没有素材'); }
  else if(id==='goStep2'){ setStep(2); }
  else if(id==='exportZip'){ exportZip(); }
  else if(id==='exportSheet'){ exportSheet(); }
  else if(id==='exportCurrent'){ exportCurrent(); }
});
$('#panel').addEventListener('input',function(e){
  const el=e.target, path=el.dataset.k;
  if(!path) return;
  if(el.dataset.bool){ setPath(path,el.checked); if(path.indexOf('book.')===0) scheduleBook(false); return; }
  setPath(path,el.value);
  const lb=$('.val[data-for="'+path+'"]',el.parentElement);
  if(lb&&el.type==='range'){
    const step=parseFloat(el.step||'1');
    const dec=step<0.1?2:(step<1?1:0);
    lb.textContent=(+el.value).toFixed(dec)+(el.dataset.suffix||'');
  }
  onChange(path);
});
$('#railGrid').addEventListener('click',function(e){
  const pk=e.target.closest('[data-pick]');
  if(pk){
    const p=state.photos.find(function(q){ return q.id===pk.dataset.pick; });
    if(p){ p.picked=!p.picked; renderRail(); renderPanel(); PERSIST.save();
      toast(p.picked?('「'+p.name+'」已加入成片'):('「'+p.name+'」已移出成片')); }
    return;
  }
  const del=e.target.closest('[data-del]');
  if(del){
    const id=del.dataset.del;
    state.photos=state.photos.filter(function(p){ return p.id!==id; });
    if(state.sel===id) state.sel=state.photos.length?state.photos[0].id:null;
    syncTplFromSel(); renderRail(); schedulePreview(); PERSIST.save(); return;
  }
  const rot=e.target.closest('[data-rot]');
  if(rot){
    const id=rot.dataset.rot;
    const p=state.photos.find(function(q){ return q.id===id; });
    if(p){ p.rot=(p.rot+90)%360; p._cache=null; renderRail(); schedulePreview(); }
    return;
  }
  const th=e.target.closest('.rthumb');
  if(th){
    state.sel=th.dataset.id;
    syncTplFromSel();                     /* 胶片带高亮跟着这张照片的模版走 */
    renderRail(); renderPanel(); renderDock(); schedulePreview();
  }
});
/* 切换选中照片时，让「当前模版」= 这张照片自己的模版 */
function syncTplFromSel(){
  const p=selPhoto();
  if(p&&TPL[p.tpl]) state.tpl=p.tpl;
}
/* 入册：全选 / 全不选 */
function railPickAll(on){
  if(!state.photos.length){ toast('还没有素材'); return; }
  state.photos.forEach(function(p){ p.picked=on; });
  renderRail(); renderPanel(); PERSIST.save();
  toast(on?('已把全部 '+state.photos.length+' 张加入成片'):'已全部移出成片');
}
$('#pickAll').addEventListener('click',function(){ railPickAll(true); });
$('#pickNone').addEventListener('click',function(){ railPickAll(false); });
/* 胶片带：把当前模版一次铺给所有照片 */
$('#tplApplyAll').addEventListener('click',function(){
  if(!state.photos.length){ toast('还没有素材'); return; }
  assignTpl(state.tpl,'all');
});
/* 首屏空状态的引导按钮（内容是动态注入的，所以用事件委托） */
$('#stageBody').addEventListener('click',function(e){
  if(e.target.closest('#emptyDemo')){ loadEmbedded(true); }
  else if(e.target.closest('#emptyImport')){ $('#fileInput').click(); }
});
function dockHud(txt){
  let el=$('#dockHud');
  if(!el){
    el=document.createElement('div');
    el.id='dockHud'; el.className='dock-hud';
    $('.dock-inner').appendChild(el);
  }
  el.textContent=txt; el.classList.add('on');
  clearTimeout(dockHud._t);
  dockHud._t=setTimeout(function(){ el.classList.remove('on'); },900);
}
/* ---------- 胶片带：点击切换 · 拖拽平移 + 惯性 · 滚轮横向滚动 · Ctrl+滚轮缩放卡片 ---------- */
const TPLBAR={w:0,moved:false,raf:0,rt:0,sup:0};
/* 命中卡片。注意：若容器在 pointerdown 时捕获了指针，浏览器会把 click 整体重定向到
   容器（e.target 变成容器，卡片自己的监听器也不触发），closest 会落空。
   所以这里保留坐标兜底，双保险。 */
function tplHit(e){
  let card=(e.target&&e.target.closest)?e.target.closest('.tplcard'):null;
  if(!card&&e.clientX){
    const el=document.elementFromPoint(e.clientX,e.clientY);
    card=(el&&el.closest)?el.closest('.tplcard'):null;
  }
  return card;
}
/* 选中的照片 —— 胶片带上的每一次点击，都是把模版「记到这张照片上」 */
function selPhoto(){ return state.photos.find(function(q){ return q.id===state.sel; })||null; }
function assignTpl(key,scope){
  if(!TPL[key]) return;
  state.tpl=key;
  const list=scope==='all'?state.photos:(function(){ const p=selPhoto(); return p?[p]:[]; })();
  list.forEach(function(p){ p.tpl=key; p._tplCache=null; });
  $$('.tplcard').forEach(function(c){
    const on=(c.dataset.tpl===key);
    c.classList.toggle('on',on);
    c.setAttribute('aria-pressed',on?'true':'false');
  });
  renderRail(); renderPanel(); renderPreview();
  PERSIST.save();
  if(scope==='all') toast('已把「'+TPL[key].name+'」应用到全部 '+list.length+' 张照片');
  else if(list.length) toast('已把「'+TPL[key].name+'」记到「'+list[0].name+'」');
  else toast('默认模版已切换为「'+TPL[key].name+'」');
}
$('#tplbar').addEventListener('click',function(e){
  if(performance.now()<TPLBAR.sup) return;      /* 刚拖拽完，忽略紧随其后的 click */
  const card=tplHit(e);
  if(!card) return;
  if(card.dataset.tpl===state.tpl&&selPhoto()&&selPhoto().tpl===state.tpl) return;
  assignTpl(card.dataset.tpl,'sel');
});
$('#tplbar').addEventListener('keydown',function(e){
  if(e.key!=='Enter'&&e.key!==' ') return;
  const card=tplHit(e);
  if(!card) return;
  e.preventDefault();
  card.click();
});
(function(){
  const bar=$('#tplbar');
  let d=null, vel=0;
  function setTplW(px){
    const w=clamp(R(px),54,190);
    if(w===TPLBAR.w) return;
    TPLBAR.w=w;
    bar.style.setProperty('--tplW',w+'px');
    dockHud('胶片宽 '+w+'px');
    clearTimeout(TPLBAR.rt);
    TPLBAR.rt=setTimeout(function(){                 /* 尺寸稳定后再按新尺寸重渲染，保持清晰 */
      if(state.step===2) return;
      const sl=bar.scrollLeft;
      renderDock();
      bar.scrollLeft=sl;
    },280);
  }
  bar.addEventListener('pointerdown',function(e){
    if(e.button!==0) return;
    cancelAnimationFrame(TPLBAR.raf);
    vel=0;
    /* 关键：此处【不】调用 setPointerCapture。一旦在 pointerdown 捕获，
       click 会被重定向到 bar，卡片就点不动了。捕获推迟到真正拖动时再做。 */
    d={x:e.clientX,y:e.clientY,id:e.pointerId};
  });
  bar.addEventListener('pointermove',function(e){
    if(!d||e.pointerId!==d.id) return;
    const dx=e.clientX-d.x;
    if(!TPLBAR.moved){
      if(Math.abs(dx)<=4&&Math.abs(e.clientY-d.y)<=4) return;   /* 手抖不算拖动 */
      TPLBAR.moved=true;
      bar.classList.add('grabbing');
      try{ bar.setPointerCapture(d.id); }catch(err){}
    }
    const nl=bar.scrollLeft-dx;
    vel=bar.scrollLeft-nl;
    bar.scrollLeft=nl;
  });
  const up=function(e){
    if(!d) return;
    if(e&&e.pointerId!=null&&e.pointerId!==d.id) return;
    const moved=TPLBAR.moved;
    d=null; bar.classList.remove('grabbing');
    TPLBAR.moved=false;
    if(!moved) return;
    TPLBAR.sup=performance.now()+70;      /* 拖动结束后短暂屏蔽 click，避免误切换模版 */
    let v=vel;
    const glide=function(){
      v*=.90;
      if(Math.abs(v)<.7){ TPLBAR.raf=0; return; }
      bar.scrollLeft-=v;
      TPLBAR.raf=requestAnimationFrame(glide);
    };
    if(Math.abs(v)>.8) TPLBAR.raf=requestAnimationFrame(glide);
  };
  bar.addEventListener('pointerup',up);
  bar.addEventListener('pointercancel',up);
  window.addEventListener('pointerup',up);   /* 兜底：拖出容器外松手也能收尾 */
  bar.addEventListener('wheel',function(e){
    if(e.ctrlKey||e.metaKey){
      e.preventDefault();
      const card=bar.firstElementChild;
      const cur=TPLBAR.w||((card&&card.getBoundingClientRect().width)||86);
      setTplW(cur-e.deltaY*.5);
      return;
    }
    const dy=e.deltaY!==0?e.deltaY:e.deltaX;
    if(!dy) return;
    e.preventDefault();
    cancelAnimationFrame(TPLBAR.raf);
    bar.scrollLeft+=dy*(e.deltaMode===1?18:1);
  },{passive:false});
})();
/* ---------- 选片条交互 ---------- */
(function(){
  const strip=$('#strip'), track=$('#stripTrack');
  /* 同胶片带的理由：指针捕获会把 click 重定向到容器，这里用坐标兜底命中 */
  function sitemHit(e){
    let it=(e.target&&e.target.closest)?e.target.closest('.sitem'):null;
    if(!it&&e.clientX){
      const el=document.elementFromPoint(e.clientX,e.clientY);
      it=(el&&el.closest)?el.closest('.sitem'):null;
    }
    return it;
  }
  strip.addEventListener('pointerdown',function(e){
    if(e.target.closest('.strip-arrow')) return;
    if(!stripItems().length) return;
    stripStop();
    STRIP.moved=false; STRIP.lt=performance.now();
    /* 此处不捕获指针，保证普通点击的 click 仍落在 .sitem 上 */
    STRIP.drag={x0:e.clientX,y0:e.clientY,pos0:STRIP.pos,id:e.pointerId};
  });
  strip.addEventListener('pointermove',function(e){
    if(!STRIP.drag||e.pointerId!==STRIP.drag.id) return;
    const dx=e.clientX-STRIP.drag.x0;
    if(!STRIP.moved){
      if(Math.abs(dx)<=4&&Math.abs(e.clientY-STRIP.drag.y0)<=4) return;
      STRIP.moved=true;
      strip.classList.add('grabbing');
      try{ strip.setPointerCapture(e.pointerId); }catch(err){}
    }
    const m=stripMetrics();
    const np=clamp(STRIP.drag.pos0-dx/m.step,-.35,stripMax()+.35);
    const now=performance.now(), dt=Math.max(8,now-STRIP.lt);
    STRIP.vel=STRIP.vel*.55+((np-STRIP.pos)/(dt/16.7))*.45;
    STRIP.lt=now; STRIP.pos=np;
    layoutStrip();
  });
  const up=function(e){
    if(!STRIP.drag) return;
    if(e&&e.pointerId!=null&&e.pointerId!==STRIP.drag.id) return;
    STRIP.drag=null;
    strip.classList.remove('grabbing');
    const moved=STRIP.moved;
    STRIP.moved=false;
    if(!moved){ STRIP.vel=0; return; }
    STRIP.sup=performance.now()+70;      /* 拖动结束后短暂屏蔽 click，避免误切换收录 */
    /* 把拖拽末速外推后落到最近的整数格，再交给弹簧收敛（不出现回弹/悬停） */
    stripSettle(R(STRIP.pos+STRIP.vel*6),true);
  };
  strip.addEventListener('pointerup',up);
  strip.addEventListener('pointercancel',up);
  window.addEventListener('pointerup',up);   /* 兜底：拖出容器外松手也能收尾 */
  strip.addEventListener('wheel',function(e){
    e.preventDefault();
    const dy=Math.abs(e.deltaY)>Math.abs(e.deltaX)?e.deltaY:e.deltaX;
    if(!dy) return;
    if(STRIP.drag) return;
    STRIP.acc+=dy;
    const th=e.deltaMode===1?1:34;
    if(Math.abs(STRIP.acc)>=th){
      const k=STRIP.acc>0?1:-1;
      STRIP.acc=0;
      stripStep(k);
    }
  },{passive:false});
  strip.addEventListener('keydown',function(e){
    if(e.key==='ArrowLeft'){ stripStep(-1); e.preventDefault(); }
    else if(e.key==='ArrowRight'){ stripStep(1); e.preventDefault(); }
    else if(e.key==='Home'){ stripStop(); stripSettle(0); e.preventDefault(); }
    else if(e.key==='End'){ stripStop(); stripSettle(stripMax()); e.preventDefault(); }
    else if(e.key==='Enter'||e.key===' '){ stripToggle(R(STRIP.pos)); e.preventDefault(); }
  });
  track.addEventListener('click',function(e){
    if(performance.now()<STRIP.sup) return;
    const it=sitemHit(e);
    if(!it) return;
    const i=+it.dataset.i;
    if(i===R(STRIP.pos)) stripToggle(i);
    else stripStep(i-R(STRIP.pos));
  });
  $('#stripPrev').addEventListener('click',function(){ stripStep(-1); });
  $('#stripNext').addEventListener('click',function(){ stripStep(1); });
})();
$('#steps').addEventListener('click',function(e){
  const b=e.target.closest('button');
  if(b) setStep(+b.dataset.step);
});
$('#demoBtn').addEventListener('click',function(){ loadEmbedded(true); });
$('#genBtn').addEventListener('click',function(){ generate(); });
$('#readerClose').addEventListener('click',closeReader);
$('#dropzone').addEventListener('click',function(){ $('#fileInput').click(); });
$('#fileInput').addEventListener('change',function(e){ addFiles(e.target.files); e.target.value=''; });
$('#soundBtn').addEventListener('click',function(){
  const o=Sound.toggle();
  this.classList.toggle('on',o);
  if(BV.soundBtn) BV.soundBtn.classList.toggle('on',o);
  toast(o?'翻页音效已开启':'翻页音效已关闭');
});
$('#themeBtn').addEventListener('click',function(){
  const cur=document.documentElement.getAttribute('data-theme');
  document.documentElement.setAttribute('data-theme',cur==='dark'?'light':'dark');
  PERSIST.save();
});
['dragenter','dragover'].forEach(function(ev){
  window.addEventListener(ev,function(e){ e.preventDefault(); $('#dropzone').classList.add('hot'); });
});
['dragleave','drop'].forEach(function(ev){
  window.addEventListener(ev,function(e){
    e.preventDefault();
    if(ev==='drop'&&e.dataTransfer) addFiles(e.dataTransfer.files);
    $('#dropzone').classList.remove('hot');
  });
});
window.addEventListener('paste',function(e){
  if(!e.clipboardData) return;
  const items=e.clipboardData.items||[], files=[];
  for(let i=0;i<items.length;i++){ if(items[i].kind==='file'){ const f=items[i].getAsFile(); if(f) files.push(f); } }
  if(files.length) addFiles(files);
});
window.addEventListener('keydown',function(e){
  const tg=e.target;
  if(tg&&(tg.tagName==='INPUT'||tg.tagName==='TEXTAREA'||tg.tagName==='SELECT')) return;
  const reading=$('#reader').classList.contains('on');
  if(e.key==='Escape'){ if(reading) closeReader(); return; }
  if(state.step!==2&&!reading) return;
  if(e.key==='ArrowRight'){ BV.next(); e.preventDefault(); }
  else if(e.key==='ArrowLeft'){ BV.prev(); e.preventDefault(); }
  else if(e.key===' '){ BV.next(); e.preventDefault(); }
});
let rzTimer=null;
window.addEventListener('resize',function(){
  clearTimeout(rzTimer);
  rzTimer=setTimeout(function(){
    BV.layout(); BV.kick();
    if(state.step===2){ if($('#stripTrack').dataset.n) renderStrip(); }
    else { renderDock(); renderPreview(); }
  },140);
});
/* ------------------------------------------------------------
   启动
   刻意【不】自动载入示例照片：首屏保持空白，由用户自己选
   「载入 28 张示例照片」还是「导入我的照片」。
   然后把上次保存的模版分配与各项设置接回来。
   ------------------------------------------------------------ */
const savedPrefs=PERSIST.restore();
if(savedPrefs&&savedPrefs.theme){
  document.documentElement.setAttribute('data-theme',savedPrefs.theme);
}
renderRail();
renderPanel();
renderDock();
renderStage();
setStep(0);
window.addEventListener('unhandledrejection',function(e){
  const m=(e.reason&&(e.reason.message||e.reason))||'未知错误';
  busyOff();
  genBusy=false;
  const btn=$('#genBtn'); if(btn){ btn.disabled=false; syncGenBtn(); }
  toast('出错了：'+m);
});
window.LUMEN={state:state,BV:BV,generate:generate,buildBookPages:buildBookPages,
  loadEmbedded:loadEmbedded,BookView:BookView,Sound:Sound,
  PERSIST:PERSIST,selPhoto:selPhoto,assignTpl:assignTpl,railPickAll:railPickAll,
  syncGenBtn:syncGenBtn,setStep:setStep,renderRail:renderRail,renderPanel:renderPanel,
  renderDock:renderDock,TPL:TPL,PRESETS:PRESETS,
  openReader:openReader,closeReader:closeReader,flipDur:flipDur};
