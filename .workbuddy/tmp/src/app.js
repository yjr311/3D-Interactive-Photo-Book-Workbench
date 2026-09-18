/* ============================================================
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
/* ⚠ 这里不能用 `if(this.raf||!this.cw) return;` 直接了事。
   cw 只在 layout() 真的量到尺寸之后才有值，而 draw() 又要求先有 cw 才肯画 ——
   两边互相等，一旦某次 layout 撞上容器还没布局完（比如沉浸阅读的容器刚从
   display:none 切到 flex），raf 链就此断掉，画布永久空白，直到窗口尺寸变化
   才「突然活过来」。所以量不到尺寸时先补一次 layout，还不行就下一帧再试。 */
BookView.prototype.kick=function(tries){
  if(this.raf) return;
  const self=this;
  if(!this.cw){
    this.layout();
    if(!this.cw){
      const n=tries||0;
      if(n>=120) return;                        /* ~2s 还量不到就放弃，等下次显式 layout */
      this.raf=requestAnimationFrame(function(){ self.raf=0; self.kick(n+1); });
      return;
    }
  }
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
  /* 模版文字按照片解开 —— 预览里看到的那行字，就是成片/成书里会有的那行字 */
  const out=renderCanvas(p,tplKey,optsFor(p),pvEdge());
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
    const out=renderCanvas(p,card.dataset.tpl,optsFor(p),edge);
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
    /* 每张照片用它自己被分配的那套模版 + 它自己的那行题字（占位符按照片解开） */
    const mo=optsFor(p);
    const art=renderCanvas(p,p.tpl||state.tpl,mo,LE);
    const fin=finalize(art);
    /* plain：不带模版外壳的干净照片。封面 / 扉页 / 环衬用它，
       想让书页也走干净照片时（book.art='plain'）同样是它。 */
    const plain=renderPlain(p,LE);
    out.push({id:'g'+i,photoId:p.id,art:art,canvas:fin,plain:plain,tpl:p.tpl||state.tpl,
      thumb:makeThumb(fin),title:mo.title||'',sub:mo.sub||'',name:p.name,picked:true});
    if(i%3===0){ busyOn('正在渲染 <b>'+(i+1)+'/'+list.length+'</b> 张成片…'); await tick(0); }
  }
  state.generated=out;
  state._coverRank=null;   /* 封面打分缓存作废（新一批成片了） */
  state._genSig=bookSig(); /* 记下这一批成片对应的设置，之后改了就能判断"过期" */
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
    /* ⚠ data-v 永远是字符串。这里只把 '0'/'1' 转成数字，于是 book.speed='3'
       会以字符串身份存进 state，后面 s===3 判断全部落空、静默退回默认档。
       凡是「取值是一串数字」的分段控件都要在这里显式转型。 */
    if(v==='1') v=1; else if(v==='0') v=0;
    if(wrap.dataset.k==='book.speed') v=parseInt(v,10)||2;
    if(wrap.dataset.k==='book.spread') v=!!v;
    setPath(wrap.dataset.k,v);
    renderPanel(); renderDock();
    /* 翻页手感只是个动画参数：不重排书页（那是几十张 canvas 的重绘）。
       版式/跨页这些才真的改页面内容，必须重排。 */
    if(wrap.dataset.k!=='book.speed') renderStage();
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
  openReader:openReader,closeReader:closeReader,flipDur:flipDur,
  renderPlain:renderPlain,artOf:artOf,coverRank:coverRank,coverPhoto:coverPhoto,
  coverScore:coverScore,renderContent:renderContent,folio:folio,tracked:tracked,
  plateOf:plateOf,artMode:artMode,optsFor:optsFor,resolveTokens:resolveTokens,
  ordinalOf:ordOf,plateHasText:plateHasText,capWillDraw:capWillDraw,DEFAULT_OPTS:DEFAULT_OPTS,
  bookStale:bookStale,bookSig:bookSig};
