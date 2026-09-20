/* ===== 以下核心引擎（渲染管线 / 模版库 / 面板 / 导出）自 v1 中抽取复用 ===== */
'use strict';
const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>Array.prototype.slice.call(r.querySelectorAll(s));
const R=n=>Math.round(n);
const clamp=(v,a,b)=>v<a?a:(v>b?b:v);
const tick=(ms)=>new Promise(r=>setTimeout(r,ms||24));
const pad2=n=>String(n).padStart(2,'0');

/* ================= 字体角色 =================
   四个角色：hand（手写）/ sans（界面）/ serif（标题）/ cap（书页图注）/ mono（数字）。
   serif 是**标题**的字族 —— 封面题字、书名页、版权页，要的是端正；
   cap 是**正文**的字族 —— 书页上那句话，要的是温度和手写气。两者刻意分开。

   为什么 cap 不能直接借 serif：serif 里的中文字族是宋体，宋体在屏幕上
   是"横细竖粗 + 三角收笔"，小字号下有很强的公文/报纸气。用户的原话是
   「显示的字体太板正了，不太好看」。

   为什么这一段要"探测"而不是直接写一串字族名：
   体系里没有 web 字体（单文件 / 离线 / file:// 打开），中文字族只能从系统里找。
   浏览器遇到**不存在的字族不报错**，直接静默降级到默认字体 —— 中文机上
   往往就是黑体/雅黑。于是同一份文件、同一行代码，开发机上落到宋体、
   用户机上落到黑体："我写的是什么"和"用户看到什么"脱钩。
   用户原话的后半句「还跟右边显示的字体不一样」就是这件事
   （右边那页是拉丁文，走 Georgia，反倒是对的）。
   所以开机时用位图把候选逐个验一遍，**挑第一个确实装了的**；
   一个都没有时也说得出口（面板会把实际用的字族写出来）。 */

const CAP_CJK=['Kaiti SC','STKaiti','KaiTi','楷体','Songti SC','STSong','SimSun','宋体','FangSong','仿宋'];
const HAND_CJK=['STXingkai','Kaiti SC','STKaiti','KaiTi','楷体','Songti SC','STSong','SimSun','宋体'];

/* 位图探测：同一个"中文 + 拉丁"样本，用「这个字族」和「一个绝对不存在的字族」
   各画一遍，像素有差才说明它真的在。
   为什么样本要带拉丁：中文字族的 CJK 部分有可能和系统默认中文一模一样
   （有些机器默认就是宋体），这时只看中文会误判成"没装"；中文字族各自的
   拉丁字形差别明显，带上拉丁几乎不会漏判。
   罕见误判（字族的 CJK 与拉丁都恰好等于默认）后果只是**跳过它换下一款**，
   仍然是衬线/楷体，不会退回黑体。 */
const MISSING_FAM='"__lumen_missing__"';
function fontOK(fam){
  if(!fontOK._a){
    fontOK._a=document.createElement('canvas'); fontOK._a.width=96; fontOK._a.height=56;
    fontOK._b=document.createElement('canvas'); fontOK._b.width=96; fontOK._b.height=56;
  }
  const shot=function(c,f){
    const x=c.getContext('2d');
    x.clearRect(0,0,96,56);
    x.fillStyle='#000'; x.font='40px '+f; x.textBaseline='middle';
    x.fillText('宋Lumen',4,28);
    return x.getImageData(0,0,96,56).data;
  };
  const a=shot(fontOK._a,'"'+fam+'"'), b=shot(fontOK._b,MISSING_FAM);
  for(let i=0;i<a.length;i++) if(a[i]!==b[i]) return true;
  return false;
}
function pickCJK(list){
  for(let i=0;i<list.length;i++){ if(fontOK(list[i])) return list[i]; }
  return '';
}
const FONTS={
  sans:'"Helvetica Neue",Helvetica,Arial,"PingFang SC","Microsoft YaHei",sans-serif',
  serif:'Georgia,"Songti SC","STSong","SimSun","宋体",serif',
  mono:'Consolas,"SFMono-Regular","Courier New",monospace'
};
/* capCJK / handCJK 记下实际用到的那一款 —— 面板要把它写出来，
   否则"系统里没这个字族"这件事对用户和我都是隐形的。
   一个候选都验不出来时（罕见：机器上真没有宋/楷/仿宋，或者这个浏览器
   压根不认具名中文字族），不要留给 `serif` 去瞎猜 —— 明确退到界面同一套黑体，
   至少"书里的字"和"界面上的字"是一套，不是某种意外。 */
const capCJK=pickCJK(CAP_CJK), handCJK=pickCJK(HAND_CJK);
/* 面板给用户看的是中文名，不是 "KaiTi" —— 字族名对我们方便，对用户是天书 */
const CJK_LABEL={'Kaiti SC':'楷体','STKaiti':'楷体','KaiTi':'楷体','楷体':'楷体',
  'Songti SC':'宋体','STSong':'宋体','SimSun':'宋体','宋体':'宋体',
  'FangSong':'仿宋','仿宋':'仿宋','STXingkai':'行楷'};
const capLabel=capCJK?(CJK_LABEL[capCJK]||capCJK):'';
FONTS.cap = capCJK ? 'Georgia,"'+capCJK+'",serif'
                   : 'Georgia,"PingFang SC","Microsoft YaHei",sans-serif';
FONTS.hand='"Segoe Script","Bradley Hand"'+(handCJK?',"'+handCJK+'"':'')
          +',"PingFang SC","Microsoft YaHei",cursive';
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

/* ================= 氛围皮肤 =================
   同一套骨架，多种气质。皮肤只给 token，不复制模版 ——
   11 套模版 × 7 套皮肤如果是 77 份配置，改一个色号就要改 11 处，必然烂掉。
   模版从 token 派生自己的色板（见 optsFor 的 tone 分派）。

   字段说明：
     tplPaper/tplInk  给「浅色纸模版」的印片用色。空串 = 让模版用自己手调过的出厂色。
                      studio 一律留空，这样默认观感和以前一模一样。
     tplKraft         给「牛皮纸模版」的纸色（牛皮纸的棕是它的身份，不能跟 tplPaper 走）
     bookPaper/Ink/cover  书页与书封
     accent/accent2   强调色 / 次强调色（accent2 只有霓虹模版在用）
     handRole         'hand' 这个字体角色落到哪个字族。体系里没有 web 字体，
                      所以「换字体」只能是换字族角色，不是引入新字体。
     grain            颗粒强度倍率
     ui               工作台自身的强调色：{dark, light, ink} 三档，
                      保证亮色主题下也有足够对比（不能一套色打天下）
     sw               氛围卡片上的双色示意（纸色|强调色）
     tpls             这套氛围推荐的模版序列。「一键氛围成书」按它循环铺给入册照片，
                      于是 28 张不会整本一个样，又保持同一套气质。
     rec              推荐的版式 {layout,alts}：一键成书用它定 book.layout，
                      「换一版」在 layout 与 alts 之间轮换。
     mats             这套氛围的**材料配方**（封面材料 + 内页材料 + 题字工艺 + 涂层光泽），
                      第一个是默认。氛围不只是色号：换材料才是"换了这本书的装帧"。
                      面板上的「材质」选择与「换一版」都用这个列表。
     foil             烫金用的箔色（只有 emboss:'foil' 的材料会读）。留空 = 用 accent。

   ⚠ 唯一的写入点是 applySkin()。state.opts（模版）与 state.book（书页）
     必须一次性改到位，只改一边就会出现「书页变粉了、模版还是米色」的割裂。 */
const SKINS={
  studio:{name:'原味',hint:'暗房 · 米白纸 · 琥珀光',
    tplPaper:'',tplInk:'',tplKraft:'',
    bookPaper:'#fffdf8',bookInk:'#2b2620',cover:'#e8e0d2',
    accent:'#e08a3c',accent2:'',handRole:'hand',grain:1,radius:14,
    tpls:['polaroid','magazine','film','minimal'],
    rec:{layout:'mat',alts:['full']},
    mats:['cloth','heavy','leather'],foil:'',
    ui:{dark:'#f0a63c',light:'#c0740e',ink:'#1a1206'},sw:['#e8e0d2','#e08a3c']},
  cream:{name:'奶油日记',hint:'暖奶白 · 焦糖字 · 手写日历',
    tplPaper:'#fffaf0',tplInk:'#4a3f33',tplKraft:'#d9c3a4',
    bookPaper:'#f7ecd9',bookInk:'#4a3f33',cover:'#e8d7ba',
    accent:'#c98a52',accent2:'#e8cfa8',handRole:'hand',grain:1.15,radius:16,
    tpls:['polaroid','kraft','postcard','minimal'],
    rec:{layout:'sticker',alts:['mat']},
    mats:['kraft','cloth','smooth'],foil:'',
    ui:{dark:'#d69a56',light:'#a86a2e',ink:'#241a0c'},sw:['#f7ecd9','#c98a52']},
  peach:{name:'蜜桃气泡',hint:'粉白纸 · 蜜桃色 · 软圆角',
    tplPaper:'#fff7f4',tplInk:'#4a3b38',tplKraft:'#eac6b2',
    bookPaper:'#fbe9e4',bookInk:'#4a3b38',cover:'#f2cec4',
    accent:'#ff8f7a',accent2:'#ffd9c9',handRole:'hand',grain:.85,radius:18,
    tpls:['polaroid','postcard','grid9','minimal'],
    rec:{layout:'mat',alts:['sticker']},
    mats:['heavy','smooth','cloth'],foil:'#e0a48c',
    ui:{dark:'#fa8f78',light:'#d9614a',ink:'#3a140c'},sw:['#fbe9e4','#ff8f7a']},
  mist:{name:'雾紫梦境',hint:'雾紫纸 · 衬线字 · 轻雾感',
    tplPaper:'#fbf9ff',tplInk:'#3d3850',tplKraft:'#c9bfdd',
    bookPaper:'#f0eafb',bookInk:'#3d3850',cover:'#dcd2ef',
    accent:'#9b8ad4',accent2:'#d8d0f0',handRole:'serif',grain:.9,radius:16,
    tpls:['minimal','postcard','titlecard','duotone'],
    rec:{layout:'mat',alts:['full']},
    mats:['silk','board','smooth'],foil:'#c3b0ee',
    ui:{dark:'#a996e0',light:'#6f5cb8',ink:'#180f38'},sw:['#f0eafb','#9b8ad4']},
  mint:{name:'薄荷苏打',hint:'薄荷白 · 无衬线 · 干净清爽',
    tplPaper:'#f7fdfb',tplInk:'#2f4741',tplKraft:'#bfd9cd',
    bookPaper:'#e7f5f0',bookInk:'#2f4741',cover:'#c5e0d7',
    accent:'#3fbf9c',accent2:'#c8ede2',handRole:'sans',grain:.8,radius:16,
    tpls:['minimal','grid9','postcard','titlecard'],
    rec:{layout:'full',alts:['mat']},
    mats:['board','heavy','smooth'],foil:'',
    ui:{dark:'#4fc9a6',light:'#1c8a6c',ink:'#04241c'},sw:['#e7f5f0','#3fbf9c']},
  sakura:{name:'夜樱',hint:'深底书 · 浅色印片 · 樱粉字',
    tplPaper:'#f2eaf4',tplInk:'#2a2333',tplKraft:'#c8b6d0',
    bookPaper:'#241f2b',bookInk:'#efe6f2',cover:'#3a2f42',
    accent:'#f28aa8',accent2:'#c98ad4',handRole:'serif',grain:1.1,radius:16,
    tpls:['cinematic','neon','duotone','titlecard'],
    rec:{layout:'full',alts:['mat']},
    mats:['leather','board','silk'],foil:'#e8a7bd',
    ui:{dark:'#f2879f',light:'#c9476a',ink:'#2a0512'},sw:['#3a2f42','#f28aa8']},
  french:{name:'法式午后',hint:'米白纸 · 陶土色 · 老照片',
    tplPaper:'#fdfcf7',tplInk:'#2c2a26',tplKraft:'#d6cdb8',
    bookPaper:'#f4efe1',bookInk:'#2c2a26',cover:'#d8cfba',
    accent:'#c07a5e',accent2:'#dcd2c0',handRole:'serif',grain:1.25,radius:14,
    tpls:['postcard','kraft','film','polaroid'],
    rec:{layout:'mat',alts:['full']},
    mats:['cloth','kraft','smooth'],foil:'#c9a86a',
    ui:{dark:'#c98d6e',light:'#9a5a3c',ink:'#2a1108'},sw:['#f4efe1','#c07a5e']}
};
const SKIN_ORDER=['studio','cream','peach','mist','mint','sakura','french'];
function skinOf(id){ return SKINS[id]||SKINS.studio; }
function skinCfg(){ return skinOf(state.skin); }

/* ================= 文案库 =================
   她缺的常常不是照片，是「配什么字」。按情绪分组，每条都能带占位符 ——
   于是同一句文案套在 8 张照片上会各自不同，不会 8 页重复一句话。
   ⚠ 短句要短：模版的标题行没有自动缩排，太长会溢出（书页图注侧已加自动缩字，
     但模版印片侧只能靠文案本身克制）。这里每条都控制在 14 字以内。 */
const MOODS=[  ['heal','治愈'],['vivid','元气'],['sweet','甜'],['artsy','文艺'],['fun','搞怪'],['plain','正经']
];
const NOTES={
  heal:['今天的风刚刚好','把这一刻收进口袋','慢慢来，也很好','安静地待一会儿',
        '这样的下午值得记住','光落在身上是暖的','有点困，但很满足'],
  vivid:['出门就有好事发生','今天能量满格','冲呀，去做想做的事','笑一个，世界就亮了',
         '今天也是限量版','动起来才像活着','把好心情拍下来'],
  sweet:['和你在一起的第 {n} 天','被偏爱的一天','甜度超标','偷偷记下这件小事',
         '心跳漏了一拍','今天也很喜欢你','想和你再来一次'],
  artsy:['光与影的私人收藏','时间在此处停了一下','第 {n} 个瞬间','无题，但很喜欢',
         '收集光线的人','{date} 的一页','关于这天的一点证据'],
  fun:['我不管我最可爱','装酷失败现场','别问，问就是随手一拍','好看是原装的',
       '今天也是被自己可爱到的一天','拍照的人先笑一个','认真起来会更好看'],
  plain:['{name}','{date} · {name}','NO.{nn}','{n} / {total}','记录于 {date}','{mood}｜{name}']
};
/* ================= 导出预设 =================
   默认的 3:4 / 1600px 是给「书本」用的。她要的是能直接发出去的竖图，
   所以预设直接决定【成片本身的画幅】，而不是导出时再套一层白边
   —— 后者会得到"一张带白边的方图"，等于还要再裁一次，不算能直接发。
   longEdge 都是竖图的长边（即高度）。 */
const EXPORT_PRESETS=[
  {id:'xhs',   label:'小红书竖图', ratio:'3:4', longEdge:1440, px:'1080 × 1440'},
  {id:'story', label:'故事全屏',   ratio:'9:16', longEdge:1920, px:'1080 × 1920'},
  {id:'square',label:'方图',       ratio:'1:1', longEdge:1080, px:'1080 × 1080'},
  {id:'card',  label:'明信片',     ratio:'2:3', longEdge:1620, px:'1080 × 1620'}
];
function exportPresetOf(id){
  for(let i=0;i<EXPORT_PRESETS.length;i++){ if(EXPORT_PRESETS[i].id===id) return EXPORT_PRESETS[i]; }
  return null;
}
/* 当前成片是否正好命中某个预设（面板上用来做「已选中」态） */
function exportPresetNow(){
  for(let i=0;i<EXPORT_PRESETS.length;i++){
    const p=EXPORT_PRESETS[i];
    if(state.spec.ratio===p.ratio&&R(state.spec.longEdge)===p.longEdge) return p.id;
  }
  return '';
}
function moodLabel(k){
  for(let i=0;i<MOODS.length;i++){ if(MOODS[i][0]===k) return MOODS[i][1]; }
  return '';
}
function fmtDate(ms){
  const d=new Date(ms||Date.now());
  return d.getFullYear()+'.'+pad2(d.getMonth()+1)+'.'+pad2(d.getDate());
}

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
  /* 氛围皮肤。'studio' = 出厂原味，观感与加皮肤之前完全一致 */
  skin:'studio',
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
    /* paper/ink 留空 = 由氛围皮肤派生（studio 皮肤派生出来仍是空，模版用出厂色）；
       accent 有值，用户改了就一直是用户的值，直到下一次切换氛围。
       accent2 只有霓虹模版读，空串 = 霓虹用自己的双色。 */
    paper:'', ink:'', accent:'#e08a3c', accent2:'', font:'sans'
  },
  generated:[],
  book:{
    title:'光匣', sub:'A COLLECTION OF MOMENTS', author:'LUMEN STUDIO',
    spine:'LUMEN · 2026', cover:'#e8e0d2', paper:'#fffdf8', ink:'#2b2620',
    /* art:'tpl' 模版成品（默认）| 'plain' 干净照片。默认必须是 tpl ——
       否则用户辛苦逐张分配的模版在成书里完全看不见，这个功能就白做了。
       mat:'cloth' 材料配方（见 MATSETS）。氛围只换色号的时候，书页就是"平涂"——
       用户的原话是"没有质感"，所以材料是独立于色号的一层，可单独换、也可被「换一版」带走。 */
    layout:'mat', art:DEFAULT_BOOK_ART, ratio:'3:4', num:true, spread:true, cap:'note', speed:2, coverIdx:0,
    mat:'cloth'
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
/* 把一个颜色提亮/压暗到 k 倍（k>1 亮、k<1 暗）。烫金渐变要用它从一个强调色
   推出"亮箔 / 暗箔"两端，而不是再写四个色号 —— 用户换氛围时那四个色号就会失配。 */
function shade(hex,k){
  const c=hex2rgb(hex);
  const f=function(v){ return Math.max(0,Math.min(255,R(k>1? v+(255-v)*(k-1) : v*k))); };
  return 'rgb('+f(c[0])+','+f(c[1])+','+f(c[2])+')';
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
  /* 颗粒强度由氛围皮肤统一缩放：奶油 / 法式午后更脏一点，蜜桃 / 薄荷更干净。
     放在这里而不是逐个改模版里的 .05 / .16 常量 —— 那又是 11 处散落。 */
  const g=skinCfg().grain||1;
  ctx.save(); ctx.globalAlpha=a*g; ctx.globalCompositeOperation=comp||'overlay';
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
    s.skin=state.skin;
    s.spec=state.spec; s.adj=state.adj; s.preset=state.preset;
    s.opts=state.opts; s.book=state.book;
    s.assign={};
    (state.photos||[]).forEach(function(p){
      s.assign[p.name]={tpl:p.tpl,picked:!!p.picked,note:p.note||'',mood:p.mood||''};
    });
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
    /* 图注默认值从 'name' 改成 'note'。老存档里的 'name' 无法区分「出厂默认」
       和「用户特意选的」，但 note 在没有文案时会退回照片名，迁过去观感一致，
       而用户一旦写了文案就能立刻看到 —— 不迁的话文案功能对老用户等于不存在。 */
    if(s.book&&typeof s.book==='object'&&s.book.cap==='name') s.book.cap='note';
    /* 书页比例以前是从 spec.ratio 推的，现在独立成 book.ratio。
       老存档没这个字段 —— 拿当时的 spec.ratio 当默认值，书的样子不会变。 */
    if(s.book&&typeof s.book==='object'&&s.book.ratio==null){
      const r=(s.spec&&s.spec.ratio)||'3:4';
      s.book.ratio=RATIOS[r]?r:'3:4';
    }
    /* 老存档没有"材料"这一层。补上当前氛围的默认材料 ——
       同时校验名字是否还在 MATSETS 里，否则以后改个材料名，
       老存档会静默落到兜底材料上（那样"用户看到的书"就和他选的不一样了）。 */
    if(s.book&&typeof s.book==='object'&&!MATSETS[s.book.mat]){
      s.book.mat=matChoices(SKINS[s.skin]||SKINS.studio)[0];
    }
    ['spec','adj','opts','book'].forEach(function(g){
      if(s[g]&&typeof s[g]==='object') Object.keys(s[g]).forEach(function(k){ state[g][k]=s[g][k]; });
    });
    if(s.preset&&PRESETS[s.preset]) state.preset=s.preset;
    if(s.tpl&&TPL[s.tpl]) state.tpl=s.tpl;
    /* 氛围：只把皮肤贴回工作台外观，**不**重写 opts/book ——
       存档里的 opts/book 就是用户当时看到的真实值（可能还被他手改过），
       这里再 applySkin 一次会把它们冲掉。 */
    if(s.skin&&SKINS[s.skin]) applySkin(s.skin,{keepColors:true});
    else paintSkinChrome(SKINS.studio);
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
function makePhoto(el,w,h,name,date){
  return {id:'p'+(state.uid++),el:el,w:w,h:h,name:name||'未命名',thumb:'',
    /* date = 拍摄/文件日期（毫秒）。有它 {date} 才有意义 ——
       默认用今天，导入文件时用文件的修改时间，比"全部显示今天"诚实得多。 */
    date:date||Date.now(),
    tpl:(TPL[state.tpl]?state.tpl:'polaroid'),picked:true,
    note:'',mood:'',
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
    /* 一句话与心情也按照片名接回来 —— 和模版分配同一个自然键，
       重开一次浏览器不用重新写一遍文案。 */
    if(typeof a.note==='string') p.note=a.note;
    if(typeof a.mood==='string') p.mood=a.mood;
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
      pushPhoto(makePhoto(img,img.naturalWidth,img.naturalHeight,
        f.name.replace(/\.[^.]+$/,''),f.lastModified));
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
  /* 'hand' 是「标题手写体」这个角色。体系里没有 web 字体，所以氛围换字体
     只能换角色到哪个字族（原味/奶油/蜜桃→手写，雾紫/夜樱/法式→衬线，薄荷→无衬线）。 */
  const handRole=skinCfg().handRole||'hand';
  const cx={
    ctx:ctx,W:W,H:H,photo:photo,o:opts||{},f:k=>FONTS[(k==='hand'?handRole:k)]||FONTS.sans,
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
polaroid:{tone:'light',name:'宝丽来',hint:'经典白框 · 手写心情',
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
film:{tone:'dark',name:'胶片',hint:'齿孔 · 编号 · 柯达感',
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
magazine:{tone:'photo',name:'杂志',hint:'封面标题 · 期号 · 条码',
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
kraft:{tone:'kraft',name:'牛皮纸',hint:'胶带 · 手写日期 · 手账感',
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
neon:{tone:'dark',name:'霓虹',hint:'发光标题 · 夜色赛博',
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
minimal:{tone:'light',name:'极简',hint:'留白 · 极细线 · 小字',
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
postcard:{tone:'light',name:'明信片',hint:'邮戳 · 地址线 · 旅行感',
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
duotone:{tone:'light',name:'双色',hint:'套印 · 大字号 · 海报感',
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
grid9:{tone:'light',name:'九宫格',hint:'拼贴 · 白缝 · 影集感',
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
cinematic:{tone:'dark',name:'宽银幕',hint:'黑边 · 字幕 · 时间码',
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
titlecard:{tone:'light',name:'章节页',hint:'无图 · 大编号 · 分隔线',
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
/* 书页的纸面比例。刻意和「成片画幅」(spec.ratio) 分开：
   导出预设会把成片改成 9:16 之类的竖图，如果书页跟着走，
   整本书就会被压成一条手机屏 —— 那是两件事。
   老存档没这个字段时，用当时的 spec.ratio 兜底，书的样子不变。 */
function pageAspect(){
  const R=RATIOS[state.book.ratio];
  if(R) return R;
  return RATIOS['3:4'];
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
/* 只量宽度不画 —— 图注要「先量再决定字号」，和 tracked 共用同一套字距算法 */
function trackedW(ctx,text,track){
  const ch=String(text==null?'':text).split('');
  if(!ch.length) return 0;
  let total=0;
  for(let i=0;i<ch.length;i++) total+=ctx.measureText(ch[i]).width;
  return total+track*Math.max(0,ch.length-1);
}
/* =====================================================================
   材质层 —— 把「色号」变成「材料」
   =====================================================================
   用户的原话：「就是单纯换了个色，没什么质感」。这一层就是回答它。

   三级实现，缺任何一层都会退回"平涂"：
     ① 底色     氛围给的纸色 / 布色（skin）
     ② 材质 tile —— 十字织纹 / 长短纤维 / 帘纹 / 皮纹 / 涂布颗粒。
        做成 256px 可平铺 canvas，按 kind+seed 缓存一次，
        之后 createPattern 复用 —— 34 页书页共用一张 tile，不会每页重算噪声。
     ③ 光照     书沟侧压暗、上缘微亮下缘微暗、封面左上打光，
        让纸/布读起来是"被灯照着的实体"而不是一块填色矩形。

   ⚠ 必须确定性：同一 kind+seed 每次渲染像素完全一致。用 rng(seed)，
     **不要** Math.random() —— 否则每次重排书页纸面纹理都会跳，翻页时像在闪。
   ⚠ tile 必须无缝：周期纹理的周期取 256 的约数（4/8/16/32/64），
     随机点状特征一律用 at() 在 ±256 处补画一遍。

   手感参数是怎么定的：
     · 织纹周期 8px（亚麻）/ 16px（帆布）。周期太小在书页缩放后糊成噪点，
       太大就不像织物了；8/16 是"看得出织法又不像网格"的区间。
     · 亮度差控制在 alpha .05–.09 一档。>0.12 会变成明显的条纹壁纸。
     · 每套氛围给 3 种材料（见 SKINS[*].mats）：「换一版」与面板上的材质选择都用它。
   ===================================================================== */
function rng(seed){
  let a=(seed|0)||1;
  return function(){
    a=a+0x6D2B79F5|0;
    let t=Math.imul(a^a>>>15,1|a);
    t=t+Math.imul(t^t>>>7,61|t)^t;
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
const MT=256;
const _matCache={};
function matTile(kind,seed){
  const sd=seed||0, key=kind+'|'+sd;
  if(_matCache[key]) return _matCache[key];
  const c=nc(MT,MT), x=c.getContext('2d');
  const rd=rng(sd*7919+kind.length*613+11);
  /* 跨边界补画：把每个特征在 ±MT 的四个方向各画一遍，接缝处才连得上 */
  const at=function(fn){ fn(0,0); fn(-MT,0); fn(MT,0); fn(0,-MT); fn(0,MT); };
  x.lineCap='round';
  const ln=function(x0,y0,x1,y1,w,col){
    x.strokeStyle=col; x.lineWidth=w;
    x.beginPath(); x.moveTo(x0,y0); x.lineTo(x1,y1); x.stroke();
  };
  const blob=function(px,py,rr2,c0,c1){
    const g=x.createRadialGradient(px,py,0,px,py,rr2);
    g.addColorStop(0,c0); g.addColorStop(1,c1);
    x.fillStyle=g; x.fillRect(px-rr2,py-rr2,rr2*2,rr2*2);
  };
  const grain=function(n,amax,sz){
    for(let k=0;k<n;k++){
      const px=rd()*MT, py=rd()*MT, up=rd()<.5;
      const a=amax*(.35+rd()*.65);
      const col=up?'255,255,255':'0,0,0';
      const w=sz*(.6+rd()*.8);
      at(function(ox,oy){
        x.fillStyle='rgba('+col+','+a.toFixed(3)+')';
        x.fillRect(px+ox,py+oy,w,w);
      });
    }
  };
  const fibers=function(n,len,amax,wid){
    for(let k=0;k<n;k++){
      const fx=rd()*MT, fy=rd()*MT, fl=len*(.4+rd()*.9), ang=(rd()-.5)*1.1;
      const a=amax*(.3+rd()*.7), up=rd()<.55;
      const col=up?'255,255,255':'0,0,0';
      const dx=Math.cos(ang)*fl, dy=Math.sin(ang)*fl;
      at(function(ox,oy){ ln(fx+ox,fy+oy,fx+ox+dx,fy+oy+dy,wid,'rgba('+col+','+a.toFixed(3)+')'); });
    }
  };
  const weave=function(P,lw,a){
    /* 经线成对（暗线 + 亮线），纬线错开半格再成对 —— 这才是"交织"，
       两组同方向的斜线只会读成条纹壁纸（上一版就是这么干的）。
       每条线还带 ±0.7px 的位置抖动：正正好对齐的等距方格会读成"方格纸"，
       真人织的布不会每根都落在同一个格上。抖动按线号算一次，
       所以 ±MT 的补画仍然对齐（平铺不会裂）。 */
    for(let i=0;i<MT;i+=P){
      const j1=a*(1+(rd()-.5)*.55), j2=a*1.35*(1+(rd()-.5)*.55);
      const dx=(rd()-.5)*1.4, dx2=(rd()-.5)*1.4;
      at(function(ox){ ln(i+ox+0.5+dx,0,i+ox+0.5+dx,MT,lw,'rgba(0,0,0,'+j1.toFixed(3)+')'); });
      at(function(ox){ ln(i+ox+P*.5+0.5+dx2,0,i+ox+P*.5+0.5+dx2,MT,lw,'rgba(255,255,255,'+j2.toFixed(3)+')'); });
    }
    for(let i=0;i<MT;i+=P){
      const o=P*.5, j1=a*(1+(rd()-.5)*.55), j2=a*1.35*(1+(rd()-.5)*.55);
      const dy=(rd()-.5)*1.4, dy2=(rd()-.5)*1.4;
      at(function(oy){ ln(0,i+oy+o+.5+dy,MT,i+oy+o+.5+dy,lw,'rgba(0,0,0,'+j1.toFixed(3)+')'); });
      at(function(oy){ ln(0,i+oy+o+P*.5+.5+dy2,MT,i+oy+o+P*.5+.5+dy2,lw,'rgba(255,255,255,'+j2.toFixed(3)+')'); });
    }
  };
  if(kind==='linen'){ weave(8,1.5,.042); fibers(58,7,.042,1.2); }
  else if(kind==='canvas'){ weave(16,2.6,.055); fibers(34,9,.042,1.8); grain(300,.022,1.6); }
  else if(kind==='kraft'){
    /* 牛皮纸的身份是**长纤维**和纸浆分布不匀的云斑，不是格纹。
       纤维要够密够亮，否则在 880px 的封面上读成"一张有点脏的白纸"。 */
    fibers(300,11,.080,1.15);
    for(let k=0;k<10;k++){
      const px=rd()*MT, py=rd()*MT, rr2=26+rd()*40, a=.028+rd()*.020;
      at(function(ox,oy){ blob(px+ox,py+oy,rr2,'rgba(0,0,0,'+a.toFixed(3)+')','rgba(0,0,0,0)'); });
    }
    for(let k=0;k<6;k++){
      const px=rd()*MT, py=rd()*MT, rr2=22+rd()*34, a=.024+rd()*.018;
      at(function(ox,oy){ blob(px+ox,py+oy,rr2,'rgba(255,255,255,'+a.toFixed(3)+')','rgba(255,255,255,0)'); });
    }
    grain(260,.026,1.5);
  }
  else if(kind==='laid'){
    /* 帘纹纸：密帘纹（横向）+ 稀疏链纹（纵向）。这是"手抄纸"的身份证 */
    for(let i=0;i<MT;i+=4){
      const a=.030*(1+(rd()-.5)*.4);
      at(function(oy){ ln(0,i+oy+.5,MT,i+oy+.5,1,'rgba(0,0,0,'+a.toFixed(3)+')'); });
    }
    for(let i=0;i<MT;i+=64){
      const a=.048;
      at(function(ox){ ln(i+ox+.5,0,i+ox+.5,MT,2,'rgba(0,0,0,'+a.toFixed(3)+')'); });
    }
    fibers(60,6,.032,1.1);
  }
  else if(kind==='silk'){
    /* 丝绸的可读性来自"那道柔光"（各向异性的斜向高光），不是纹路。
       柔光必须是**逐像素的整周期正弦**：波数取整数（3 与 2），
       周期正好等于 tile 边长，所以左右上下拼起来天然接得上。
       上一版用 4 条对角渐变铺满整张 tile —— 渐变在边界不连续，
       256px 平铺一次就在书页上留一条竖着的接缝（实测列均值跳变 10.5%），
       而 880px 的书页会平铺它三四次。 */
    grain(2400,.036,1.1);
    fibers(72,15,.020,0.9);
    const img=x.getImageData(0,0,MT,MT), p=img.data;
    for(let yy=0;yy<MT;yy++){
      for(let xx=0;xx<MT;xx++){
        /* 只走**一个方向**的宽波（波数 2 与 1 → 一个周期 ≈ 128px）。
           试过两个方向交叉的正弦：封面上这张 tile 会被叠两遍（第二遍 1.7 倍 + 旋转），
           两个网状波一叠就是摩尔纹，暗封面上一眼看成"菱形格印花布"。
           宽而柔的单向波即使叠两遍也只在明暗上浮动，才是"柔光"。 */
        const w=.5+.5*Math.sin((xx*2+yy*1)*Math.PI*2/MT);
        const sa=.058*(.30+.70*w);
        const i=(yy*MT+xx)*4, da=p[i+3]/255;
        const oa=sa+da*(1-sa);
        p[i]  =Math.round((255*sa+p[i]  *da*(1-sa))/oa);
        p[i+1]=Math.round((255*sa+p[i+1]*da*(1-sa))/oa);
        p[i+2]=Math.round((255*sa+p[i+2]*da*(1-sa))/oa);
        p[i+3]=Math.round(oa*255);
      }
    }
    x.putImageData(img,0,0);
  }
  else if(kind==='leather'){
    /* 皮纹 = 密集的**小**软斑块（pebble grain）。
       上一版 34 块、半径 13–37px —— 那个尺度在 880px 的封面上读成"大块水渍云"，
       不是皮。皮纹的身份是"密而小"：数量提上去、半径压下来，
       再叠一层细密的短折痕（皮面被压出来的纹路）。 */
    for(let k=0;k<130;k++){
      const px=rd()*MT, py=rd()*MT, rr2=6+rd()*11, up=rd()<.5;
      const a=.024+rd()*.032;
      const col=up?'255,255,255':'0,0,0';
      at(function(ox,oy){ blob(px+ox,py+oy,rr2,'rgba('+col+','+a.toFixed(3)+')','rgba('+col+',0)'); });
    }
    fibers(150,4.2,.030,1.0);
    grain(1100,.038,1.2);
  }
  else { /* coated（涂布纸）：干净，只有极细的均匀颗粒与零星斑点 */
    grain(1500,.028,1.0);
    grain(90,.055,1.9);
  }
  _matCache[key]=c;
  return c;
}
/* ================= 材料配方 =================
   一套配方 = 封面材料 + 内页材料 + 封面题字工艺 + 涂层光泽。
   氛围给 3 种（SKINS[*].mats），「换一版」在它们之间轮换 ——
   所以"换一版"换掉的是**整本书的材料与装帧**，不只是模版顺序。 */
const MATSETS={
  cloth:  {name:'亚麻布',hint:'细十字织纹 · 压凹题字',cover:'linen',page:'coated',emboss:'deboss',tex:1.00,sheen:.10,lit:1.00},
  heavy:  {name:'帆布',  hint:'粗织纹 · 厚实',      cover:'canvas',page:'coated',emboss:'deboss',tex:1.10,sheen:.16,lit:1.12},
  kraft:  {name:'牛皮纸',hint:'长纤维 · 云斑',      cover:'kraft', page:'laid',  emboss:'deboss',tex:1.10,sheen:.05,lit:1.00},
  silk:   {name:'丝绸',  hint:'柔光 · 烫金题字',    cover:'silk',  page:'silk',  emboss:'foil',  tex:.95, sheen:.22,lit:.92},
  leather:{name:'皮革',  hint:'细皮纹 · 烫金',      cover:'leather',page:'coated',emboss:'foil', tex:1.15,sheen:.30,lit:1.00},
  board:  {name:'硬壳涂布',hint:'平整 · 烫金',      cover:'coated',page:'coated',emboss:'foil',  tex:.60, sheen:.26,lit:1.18},
  smooth: {name:'光面纸',hint:'几乎无纹 · 素题字',  cover:'coated',page:'coated',emboss:'plain', tex:.35, sheen:.12,lit:.86}
};
const MAT_ORDER=['cloth','heavy','kraft','silk','leather','board','smooth'];
function matSpec(k){
  const key=(k||state.book.mat||'');
  return MATSETS[key]||MATSETS.cloth;
}
/* 当前氛围推荐的三种材料（列表里第一个是默认） */
function matChoices(sk){
  const s=sk||skinCfg();
  const list=(s&&s.mats)||[];
  const ok=list.filter(function(k){ return !!MATSETS[k]; });
  return ok.length?ok:['cloth','smooth'];
}
/* 把材料名翻成"人话"，用于提示文案 */
function matName(k){ return (MATSETS[k]||{}).name||k||'—'; }
/* 一页纸的底：底色 + 材质 + 光照。side 决定书沟在哪一侧（'l'|'r'|'c'） */
function paperGround(x,W,H,opt){
  const o=opt||{}, bk=state.book, m=matSpec(o.mat);
  const kind=o.mat?((MATSETS[o.mat]||{}).page||m.page):m.page;
  x.fillStyle=o.color||bk.paper; x.fillRect(0,0,W,H);
  if(kind&&kind!=='none'){
    const p=x.createPattern(matTile(kind,o.seed||0),'repeat');
    x.save();
    x.globalAlpha=Math.max(0,Math.min(1,(o.tex==null?.92:o.tex)*m.tex));
    x.fillStyle=p; x.fillRect(0,0,W,H);
    x.restore();
  }
  /* 光照：上缘受光、下缘背光。极淡（±5%），但正是它让纸"立起来" */
  const lit=(o.lit==null?1:o.lit)*m.lit;
  const lg=x.createLinearGradient(0,0,0,H);
  lg.addColorStop(0,'rgba(255,255,255,'+(.055*lit).toFixed(3)+')');
  lg.addColorStop(.42,'rgba(255,255,255,0)');
  lg.addColorStop(1,'rgba(0,0,0,'+(.050*lit).toFixed(3)+')');
  x.fillStyle=lg; x.fillRect(0,0,W,H);
  const side=o.side||'c';
  if(side!=='c'){
    const gw=o.gw==null?W*.17:o.gw;
    const g=x.createLinearGradient(side==='l'?W:0,0,side==='l'?W-gw:gw,0);
    g.addColorStop(0,'rgba(0,0,0,'+(.105*lit).toFixed(3)+')');
    g.addColorStop(.5,'rgba(0,0,0,'+(.032*lit).toFixed(3)+')');
    g.addColorStop(1,'rgba(0,0,0,0)');
    x.fillStyle=g; x.fillRect(side==='l'?W-gw:0,0,gw,H);
  }
  pageEdge(x,W,H,opt);
}
/* 纸边：外缘一圈极淡的暗 + 靠书口那一侧一条细亮线。
   没有这一条，书页就是"浮在屏幕上的矩形"；有了它，纸才有厚度。 */
function pageEdge(x,W,H,opt){
  const o=opt||{}, m=matSpec(o.mat);
  const a=.06*(o.lit==null?1:o.lit);
  x.save();
  const gw=Math.max(1,W*.012);
  let g=x.createLinearGradient(0,0,gw,0);
  g.addColorStop(0,'rgba(0,0,0,'+a.toFixed(3)+')'); g.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle=g; x.fillRect(0,0,gw,H);
  g=x.createLinearGradient(W,0,W-gw,0);
  g.addColorStop(0,'rgba(0,0,0,'+a.toFixed(3)+')'); g.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle=g; x.fillRect(W-gw,0,gw,H);
  g=x.createLinearGradient(0,0,0,Math.max(1,H*.008));
  g.addColorStop(0,'rgba(255,255,255,'+(a*.9).toFixed(3)+')'); g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g; x.fillRect(0,0,W,Math.max(1,H*.008));
  g=x.createLinearGradient(0,H,0,H-Math.max(1,H*.010));
  g.addColorStop(0,'rgba(0,0,0,'+(a*1.3).toFixed(3)+')'); g.addColorStop(1,'rgba(0,0,0,0)');
  x.fillStyle=g; x.fillRect(0,H-Math.max(1,H*.010),W,Math.max(1,H*.010));
  x.restore();
}
/* 封面材料：比内页更实。对有"可辨认平铺周期"的粗料（织纹/纤维），
   同一张 tile 再叠一遍（放大 1.7 倍并轻微旋转），把周期搅掉 ——
   单一 tile 直接铺会读成"壁纸重复"。
   细而匀的料（丝绸柔光 / 涂布纸）**不做**第二遍：它们的图案是连续的波，
   叠两遍只会互相干涉出摩尔纹（实测在暗封面上是一眼可见的菱形格）。 */
const MAT_TWO_PASS=['linen','canvas','kraft'];
function boardGround(x,W,H,opt){
  const o=opt||{}, bk=state.book, m=matSpec(o.mat);
  const kind=m.cover;
  x.fillStyle=o.color||bk.cover; x.fillRect(0,0,W,H);
  if(kind&&kind!=='none'){
    const tile=matTile(kind,o.seed||0);
    x.save(); x.globalAlpha=Math.min(1,.85*m.tex); x.fillStyle=x.createPattern(tile,'repeat');
    x.fillRect(0,0,W,H); x.restore();
    if(MAT_TWO_PASS.indexOf(kind)>=0){
      x.save(); x.globalAlpha=Math.min(1,.42*m.tex);
      x.scale(1.7,1.7); x.rotate(.06); x.fillStyle=x.createPattern(tile,'repeat');
      x.fillRect(-W*.2,-H*.2,W*1.4,H*1.4); x.restore();
    }
  }
  /* 漫射光：左上打过来 → 左上微亮、右下微暗。封面立刻有"体" */
  const lit=m.lit;
  let g=x.createLinearGradient(0,0,W,H);
  g.addColorStop(0,'rgba(255,255,255,'+(.075*lit).toFixed(3)+')');
  g.addColorStop(.55,'rgba(255,255,255,0)');
  g.addColorStop(1,'rgba(0,0,0,'+(.085*lit).toFixed(3)+')');
  x.fillStyle=g; x.fillRect(0,0,W,H);
  /* 四角渐暗（板压出来的轻微弧度感） */
  const vg=x.createRadialGradient(W*.42,H*.40,W*.20,W*.5,H*.5,W*1.02);
  vg.addColorStop(0,'rgba(0,0,0,0)'); vg.addColorStop(1,'rgba(0,0,0,'+(.13*lit).toFixed(3)+')');
  x.fillStyle=vg; x.fillRect(0,0,W,H);
  /* 板缘：外缘暗线 + 内侧亮线 = 2mm 硬纸板的厚度 */
  x.save();
  const e=Math.max(1,W*.0022);
  x.fillStyle='rgba(255,255,255,'+(.16*lit).toFixed(3)+')';
  x.fillRect(W-e,0,e,H); x.fillRect(0,H-e,W,e);
  x.fillStyle='rgba(0,0,0,'+(.22*lit).toFixed(3)+')';
  x.fillRect(0,0,e,H); x.fillRect(0,0,W,e);
  x.fillStyle='rgba(0,0,0,'+(.10*lit).toFixed(3)+')';
  x.fillRect(W-e*3.2,0,e*2.2,H); x.fillRect(0,H-e*3.2,W,e*2.2);
  x.restore();
  grainOver(x,W,H,.06,'overlay');
}
/* 封面题字的"工艺"。压凹 / 烫金 / 素题 ——
   这是"书"与"一张印了字的纸"最大的差别，也是这套氛围最容易被感觉到的地方。 */
function pressTreat(x,text,cx,y,size,track,font,mode,inkColor){
  const m=matSpec();
  const how=mode||m.emboss||'deboss';
  const d=Math.max(1,R(size*.040));
  x.save();
  x.textAlign='center'; x.textBaseline='alphabetic';
  x.font='700 '+R(size)+'px '+font;
  if(how==='plain'){
    x.fillStyle=inkColor; tracked(x,text,cx,y,track,'center');
    x.restore(); return;
  }
  /* 凹/凸的通用做法：暗影 + 亮边 + 面色。
     光从左上来 → 凹下去的字，上/左边缘落影，下/右边缘反光（反过来就是凸起）。 */
  x.globalAlpha=.42; x.fillStyle='rgba(0,0,0,.75)';
  tracked(x,text,cx-d,y-d,track,'center');
  x.globalAlpha=.50; x.fillStyle='rgba(255,255,255,.85)';
  tracked(x,text,cx+d*.85,y+d*.85,track,'center');
  x.globalAlpha=1;
  if(how==='foil'){
    const w=trackedW(x,text,track);
    const g=x.createLinearGradient(cx-w/2,y-size,cx+w/2,y+size*.12);
    const f=(skinCfg().foil)||skinCfg().accent||'#c9a86a';
    g.addColorStop(0,shade(f,1.34));
    g.addColorStop(.34,f);
    g.addColorStop(.56,shade(f,.72));
    g.addColorStop(.78,shade(f,1.18));
    g.addColorStop(1,shade(f,.84));
    x.fillStyle=g;
  } else {
    x.fillStyle=inkColor;
  }
  tracked(x,text,cx,y,track,'center');
  if(how==='foil'){
    /* 金箔的高光：沿着字的同一形状再压一薄层，只留一点点 */
    x.globalAlpha=.30; x.fillStyle='rgba(255,255,255,.9)';
    tracked(x,text,cx,y-d*.55,track,'center');
  }
  x.restore();
}
/* 印片涂层：成片装裱到书页上时，压一道很宽的斜向柔光。
   这是"一张实体照片"和"贴上去的一张图"的差别。 */
function plateSheen(x,x0,y0,w,h){
  const m=matSpec();
  if(!m.sheen) return;
  x.save();
  x.beginPath(); x.rect(x0,y0,w,h); x.clip();
  const g=x.createLinearGradient(x0,y0,x0+w*.55,y0+h);
  g.addColorStop(0,'rgba(255,255,255,'+(m.sheen*.12).toFixed(3)+')');
  g.addColorStop(.40,'rgba(255,255,255,0)');
  g.addColorStop(.56,'rgba(255,255,255,'+(m.sheen*.070).toFixed(3)+')');
  g.addColorStop(1,'rgba(255,255,255,0)');
  x.fillStyle=g; x.fillRect(x0,y0,w,h);
  x.restore();
}
function renderCover(W,H){
  const c=nc(W,H), x=c.getContext('2d'), bk=state.book;
  const ink=contrast(bk.cover);
  /* 封面材料交给材质层。上一版这里是两组 45° 斜线 + 一层噪点 ——
     斜线读起来是"条纹壁纸"而不是织物（用户的原话："没有质感"）。
     现在是真十字织纹 / 长纤维云斑 / 皮纹，再叠漫射光与板缘厚度。 */
  boardGround(x,W,H,{});
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
  /* 题字工艺跟着材料走：布面 / 纸面 → 压凹（字陷进材料里）；
     丝绸 / 皮革 / 硬壳 → 烫金。这是封面"质感"最集中的一处 ——
     有工艺的字和直接印上去的字，是两本书。 */
  pressTreat(x,bk.title||'光匣',cx,H*.188,ts,ts*.10,FONTS.serif,null,ink);
  x.save();
  const foilOn=(matSpec().emboss==='foil');
  x.globalAlpha=foilOn?.62:.30;
  x.fillStyle=foilOn?(skinCfg().foil||skinCfg().accent||ink):ink;
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
    plateSheen(x,wx,wy,ww,wh);
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
   可写 {name} {n} {nn} {total} {tpl} {note} {mood} {date}。
   不认得的原样留下，方便用户一眼看出自己写错了哪个。 */
/* im 既可能是「照片对象」也可能是「成片对象」：成片只带 photoId，
   而占位符要取的一句话 / 日期 / 心情都挂在照片上，得回到照片去拿。 */
function photoOfIm(im){
  if(!im) return null;
  if(!im.photoId) return im;
  const list=state.photos||[];
  for(let i=0;i<list.length;i++){ if(list[i].id===im.photoId) return list[i]; }
  return im;
}
function ordOf(im){
  if(!im) return 1;
  /* 成片对象的 id 是 'g0' 这种临时编号，拿它去找照片永远找不到、静默退回 1
     （书页图注里的 {n} 会全变成 1）。统一用 photoId 兜底，两种对象都算得对。 */
  const pid=im.photoId||im.id;
  const g=state.generated||[];
  for(let i=0;i<g.length;i++){ if(g[i].photoId===pid) return i+1; }
  const p=state.photos||[];
  for(let i=0;i<p.length;i++){ if(p[i].id===pid) return i+1; }
  return 1;
}
function totalOf(){
  const picked=(state.photos||[]).filter(function(p){ return p.picked; });
  return picked.length||(state.photos||[]).length||1;
}
function resolveTokens(t,im){
  if(t==null) return '';
  const n=ordOf(im), tot=totalOf(), src=photoOfIm(im)||{};
  return String(t).replace(/\{(name|nn|n|total|tpl|note|mood|date)\}/g,function(_,k){
    if(k==='name')  return (im&&im.name)||src.name||'';
    if(k==='nn')    return pad2(n);
    if(k==='n')     return String(n);
    if(k==='total') return String(tot);
    if(k==='tpl'){
      const id=(im&&im.tpl)||src.tpl;
      return (TPL[id]&&TPL[id].name)||'';
    }
    if(k==='note')  return src.note||'';
    if(k==='mood')  return moodLabel(src.mood);
    if(k==='date')  return fmtDate(src.date);
    return _;
  });
}
/* 按照片把模版文字解开，得到这一张成片真正要用的 opts。
   配色也在这里派生：模版只声明自己属于哪一「色调」，颜色从皮肤取 ——
   这样加一套皮肤不用碰模版，加一套模版也不用碰皮肤。 */
function optsFor(im){
  const o=state.opts||{}, out={};
  Object.keys(o).forEach(function(k){ out[k]=o[k]; });
  out.title=resolveTokens(o.title,im);
  out.sub=resolveTokens(o.sub,im);
  out.corner=resolveTokens(o.corner,im);
  const sk=skinCfg();
  const tone=(TPL[im&&im.tpl]||{}).tone||'light';
  /* 用户手填的永远优先（面板里改过色就不被氛围覆盖）；
     空串 = 交给氛围。studio 皮肤派生出来也是空串，于是模版用出厂色。 */
  out.paper  = o.paper  || (tone==='light'?sk.tplPaper : tone==='kraft'?sk.tplKraft : '');
  out.ink    = o.ink    || (tone==='light'?sk.tplInk   : '');
  out.accent = o.accent || sk.accent;
  out.accent2= o.accent2|| sk.accent2 || '';   /* 都为空 = 霓虹用自己的双色 */
  return out;
}
/* ---------- 氛围皮肤的唯一写入点 ----------
   state.opts（模版印片）和 state.book（书页/书封）必须一起改。
   只改一边 = 「书页变成蜜桃色了，可印片还是米色」的割裂，比不换还难看。 */
function applySkin(id,opt){
  const o=opt||{};
  const key=SKINS[id]?id:'studio';
  state.skin=key;
  const sk=SKINS[key];
  if(!o.keepColors){
    /* 清掉用户对 paper/ink 的手填覆盖 —— 否则换了氛围，印片还是上一套的纸色 */
    state.opts.paper=''; state.opts.ink='';
    state.opts.accent=sk.accent;
    state.opts.accent2=sk.accent2||'';
    state.book.paper=sk.bookPaper;
    state.book.ink=sk.bookInk;
    state.book.cover=sk.cover;
    /* 材料也一起换：氛围 = 色号 + 材料。只换色号就是用户说的"单纯换了个色"。
       已经选过材料的用户手改过一次就一直是他的（与 paper/ink 同样的优先级规则）：
       这里只在"上一套材料的默认值"上跟随，用户自己挑过的就留着。 */
    const list=matChoices(sk);
    if(!o.keepMat&&list.length&&list.indexOf(state.book.mat)<0) state.book.mat=list[0];
  }
  paintSkinChrome(sk);
  return sk;
}
/* 工作台自身的强调色 / 圆角。亮色主题下需要另一档色值，不能一套色打天下。 */
function paintSkinChrome(sk){
  const r=document.documentElement;
  const light=(r.getAttribute('data-theme')==='light');
  const ui=sk.ui||{};
  const acc=light?(ui.light||ui.dark||'#c0740e'):(ui.dark||'#f0a63c');
  const rgb=hex2rgb(acc).join(',');
  r.style.setProperty('--accent',acc);
  r.style.setProperty('--accent-ink',(ui.ink||'#1a1206'));
  r.style.setProperty('--glow','rgba('+rgb+',.14)');
  const base=sk.radius||14;
  r.style.setProperty('--r',base+'px');
  r.style.setProperty('--r2',R(base*.72)+'px');
  r.style.setProperty('--r3',R(base*.57)+'px');
}
/* ---------- 成片过期没有？----------
   模版成品是在 generate() 那一刻烧进画布的。之后用户改了某张照片的模版、
   或者改了模版文字/调色/规格，书里仍然是旧图 —— 不说的话，用户会以为
   「我改了模版怎么没反应」。所以记一个签名，变了就提示重出。 */
function bookSig(){
  return JSON.stringify([state.skin,state.opts,state.adj,state.spec.ratio,state.spec.longEdge,state.spec.fit]);
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
/* ---------- 书页图注取什么 ----------
   'note' = 一句话（没有就退回照片名）—— 这是出厂默认。
   ⚠ 默认必须是 'note' 而不是 'name'：如果默认是「照片名」，用户写了半天文案
     书上却什么都不显示，这个功能就白做了（这一条上一轮已经踩过一次）。
     而 'note' 在没写文案时退回照片名，所以对老用户来说观感没有任何变化。 */
function captionOf(im){
  const m=state.book.cap;
  if(m==='none') return '';
  if(m==='note'){
    const p=photoOfIm(im)||{};
    const t=String(p.note||'').trim();
    /* 没写文案就退回照片名 —— 于是这个新默认对老用户完全无感 */
    return t ? resolveTokens(t,p) : (im.name||im.title||'');
  }
  if(m==='name') return im.name||im.title||'';
  return im.title||'';
}
/* 模版成品画面里已经写着**同一句话**了吗？写着了才跳过书页图注 ——
   「同一条信息出现两次」是书页变脏的主因，要避免的是**重复**，不是"有字就不画"。
   ⚠ 这里必须比**内容**，不能比"有没有字"：成片对象永远带 title
     （opts.title 出厂就是 `{name}`），只看"有没有字"会让 plateHasText 恒为真、
     图注在任何页面上都不画 —— 用户写了文案书里一个字都不出现。
     这个 bug 真的发生过（用户：「选择了怎么显示出来没效果」）。
   于是正确行为变成：印片写着照片名、图注是用户写的一句话 → 两件事，都要画；
   印片自己就写着那句文案（opts.title 用了 {note}）→ 同一句话，不重复。 */
function plateHasText(im){
  if(artMode()!=='tpl') return false;
  const key=function(s){ return String(s==null?'':s).replace(/\s+/g,''); };
  const cap=key(captionOf(im));
  if(!cap) return false;
  const o=optsFor(photoOfIm(im)||im);
  return [o.title,o.sub,o.corner].some(function(t){ return key(t)===cap; });
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
  /* 纸面：底色 + 材料 + 光照。书沟的明暗由 BookView 的中缝阴影负责，
     这里刻意不给书沟侧加渐变（两处叠加会把书沟压成一条黑带）。 */
  paperGround(x,W,H,{side:'c'});
  const ir=hex2rgb(bk.ink||'#2b2620');
  const soft=function(a){ return 'rgba('+ir[0]+','+ir[1]+','+ir[2]+','+a+')'; };
  const PL=W*.098, PR=W*.098, PT=H*.082, PB=H*.104;
  const colW=W-PL-PR;
  if(!items.length) return c;

  /* 图注：一条短细线 + 一行衬线小字（带字距）。居中在照片正下方。
     「印片自己写着同一句话」时整段跳过（见 plateHasText）—— 书页保持安静。
     文案库里的句子长短不齐，用户还可以自己手打，所以四个版式都必须自己缩字：
     光靠固定字号，一句「今天也是被自己可爱到的一天」会直接顶出版心。 */
  /* 把一行图注塞进 cw 宽度：先缩字号，缩到下限还长就截断。
     宁可出现「…」，也不要压到版心外面去。gapK 是字距系数（字距 = 字号 × gapK）。 */
  function fitCap(txt,cw,size0,font,gapK){
    let t=String(txt==null?'':txt), cs=R(size0);
    const floor=cs*.62;
    const wid=function(){ x.font=R(cs)+'px '+font; return trackedW(x,t,cs*gapK); };
    while(cs>floor && wid()>cw){ cs-=1; }
    while(t.length>2 && wid()>cw){ t=t.slice(0,-2)+'…'; }
    return {txt:t,size:cs};
  }
  function caption(cx,y,cw,txt){
    const im=items[0];
    let cap=txt||captionOf(im);
    if(!cap||plateHasText(im)) return;
    const f=fitCap(cap,cw,W*.0255,FONTS.cap,.14);
    x.save();
    x.textAlign='center'; x.textBaseline='alphabetic';
    const rl=Math.min(cw*.24,W*.125);
    x.globalAlpha=.24; x.fillStyle=soft(1);
    x.fillRect(cx-rl/2,y,rl,Math.max(1,W*.0011));
    /* 楷体这一类字比宋体轻（同样的字，笔画覆盖率低约一成），
       .84 会显得发灰，所以图注的墨色比原来抬一点，观感落在原来的"轻"上。 */
    x.globalAlpha=.90;
    x.font=R(f.size)+'px '+FONTS.cap;
    tracked(x,f.txt,cx,y+f.size*1.80,f.size*.14,'center');
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
      /* 满版出血 = 油墨印在同一张纸上。所以材料要**压在墨上面**（很淡就行），
         否则这一页会突然变成一张没有纸感的纯数字图，和别的页脱节。 */
      const mp=(matSpec()).page;
      if(mp&&mp!=='none'){
        x.save(); x.globalAlpha=.30;
        x.fillStyle=x.createPattern(matTile(mp,1),'repeat');
        x.fillRect(0,0,W,H); x.restore();
      }
    }
    const gw=W*.15;
    const gsp=x.createLinearGradient(side==='l'?W:0,0,side==='l'?W-gw:gw,0);
    gsp.addColorStop(0,'rgba(0,0,0,.34)'); gsp.addColorStop(1,'rgba(0,0,0,0)');
    x.fillStyle=gsp; x.fillRect(side==='l'?W-gw:0,0,gw,H);
    x.fillStyle='rgba(0,0,0,.10)';
    x.fillRect(0,0,W,H*.022); x.fillRect(0,H-H*.022,W,H*.022);
    /* 满版出血也必须给图注留位置 —— 否则用户写了文案、又选了满版版式，
       那句话在整本书里一个字都不会出现（"改了看不见"是死罪）。
       画面铺满整页，所以走"画册"的做法：底部压一条柔光带 + 一行白字，
       位置留在页码上方，不跟页码抢同一行。 */
    if(capWillDraw(items[0])){
      const ct=captionOf(items[0]);
      if(ct){
        const f=fitCap(ct,W*.80,W*.0245,FONTS.cap,.13);
        const sc=x.createLinearGradient(0,H*.76,0,H);
        sc.addColorStop(0,'rgba(0,0,0,0)'); sc.addColorStop(1,'rgba(0,0,0,.50)');
        x.fillStyle=sc; x.fillRect(0,H*.76,W,H*.24);
        x.save();
        x.textAlign='center'; x.textBaseline='alphabetic';
        x.shadowColor='rgba(0,0,0,.55)'; x.shadowBlur=W*.012;
        x.fillStyle='rgba(255,255,255,.95)';
        x.font=R(f.size)+'px '+FONTS.cap;
        tracked(x,f.txt,W/2,H-W*.098,f.size*.13,'center');
        x.restore();
      }
    }
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
      plateSheen(x,dx,dy,dw,dh);
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
      plateSheen(x,dx,dy,dw,dh);
      x.save(); x.globalAlpha=.12; x.strokeStyle='#000'; x.lineWidth=Math.max(1,W*.0011);
      x.strokeRect(dx+.5,dy+.5,dw-1,dh-1); x.restore();
      /* 每半页各有自己的图注，各自对在自己那张图下面（印片写了同一句就跳过） */
      const cap=plateHasText(im)?'':captionOf(im);
      if(cap){
        const f=fitCap(cap,each*.94,W*.0205,FONTS.cap,.12);
        x.save();
        x.textAlign='center'; x.textBaseline='alphabetic';
        x.globalAlpha=.86; x.fillStyle=soft(1);
        x.font=R(f.size)+'px '+FONTS.cap;
        tracked(x,f.txt,PL+i*(each+gap)+each/2,H-PB-W*.045,f.size*.12,'center');
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
      plateSheen(x,-dw/2,-dh/2,dw,dh);
      x.restore();
      /* 两条和纸胶带：一上一下，压住照片的对角（跟着画面一起平移） */
      x.save(); x.globalAlpha=.44; x.fillStyle='#e9e0cd';
      x.translate(W*.235,H*.132+dyS); x.rotate(-.30);
      x.fillRect(-W*.086,-H*.020,W*.172,H*.040);
      x.translate(W*.47,H*.660+dyS); x.rotate(.56);
      x.fillRect(-W*.086,-H*.020,W*.172,H*.040);
      x.restore();
      if(scap){
        const f=fitCap(scap,colW*1.06,W*.0290,FONTS.hand,.06);
        x.save(); x.textAlign='center'; x.textBaseline='alphabetic';
        x.globalAlpha=.88; x.fillStyle=soft(1);
        x.font=R(f.size)+'px '+FONTS.hand;
        tracked(x,f.txt,W/2,H-PB-W*.015,f.size*.06,'center');
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
  paperGround(x,W,H,{side:'c'});
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
  paperGround(x,W,H,{side:'c'});
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
/* 氛围选择器。做成卡片而不是分段控件：颜色是这套皮肤最直接的辨识物，
   看色块就知道选哪套，不需要先理解「模版」「色板」是什么概念。 */
function skinHTML(){
  return '<div class="skins">'+SKIN_ORDER.map(function(k){
    const s=SKINS[k], on=(k===state.skin);
    return '<button class="skin'+(on?' on':'')+'" data-skin="'+k+'">'+
      '<span class="sw"><i style="background:'+s.sw[0]+'"></i><i style="background:'+s.sw[1]+'"></i></span>'+
      '<span class="tx"><b>'+s.name+'</b><s>'+s.hint+'</s></span></button>';
  }).join('')+'</div>';
}
/* 材质选择器。氛围 = 色号 + 材料，所以它紧跟在氛围下面，而不是藏到别处。
   每个 chip 里放一张**真的材质小样**（同一套 tile、同一套光照画在 46×30 小画布上）——
   这个功能的全部价值就是"能看见质地"，只写材料名等于没做。 */
function matHTML(){
  const list=matChoices(), cur=state.book.mat;
  /* 位图给到 92×30（≈ 卡片里的实际显示尺寸）—— 按 46 画再横向拉伸会把织纹拉变形，
     那样"小样"就不再等于"换上去的样子"，反而误导。 */
  return '<div class="mats">'+list.map(function(k){
    const m=MATSETS[k], on=(k===cur);
    return '<button class="mat'+(on?' on':'')+'" data-mat="'+k+'" title="'+esc(m.name+' · '+m.hint)+'">'+
      '<canvas class="msw" width="92" height="30"></canvas>'+
      '<span class="mtx"><b>'+m.name+'</b></span></button>';
  }).join('')+'</div>';
}
/* 材质小样。必须画真材料，不能画一个近似色块 —— 否则用户没法预判换上去是什么样。 */
function paintMats(){
  const bk=state.book;
  $$('#panel .mat[data-mat]').forEach(function(b){
    const cv=$('canvas',b); if(!cv) return;
    const x=cv.getContext('2d');
    x.setTransform(1,0,0,1,0,0);
    x.clearRect(0,0,cv.width,cv.height);
    boardGround(x,cv.width,cv.height,{mat:b.dataset.mat,color:bk.cover});
  });
}
/* 文案选择器。做在「选片成书」这一步 —— 用户此刻正盯着照片看，
   给照片配一句话是此刻最自然的事，而不是回到模版面板去。
   面板里自带「上一张 / 下一张」，不依赖外面的选片条：
   第 2 步的 3D 选片条点一下是「收录 / 移出」，并没有"正在编辑哪张"这个概念，
   把文案挂到它身上会变成一个隐形的、点不中的当前项。 */
function noteList(){
  return state.photos.filter(function(p){ return p.picked; });
}
function noteCur(){
  const list=noteList();
  if(!list.length) return null;
  const i=clamp(state._noteIdx||0,0,list.length-1);
  return {p:list[i], i:i, n:list.length};
}
function noteHTML(){
  const list=noteList();
  if(!list.length)
    return '<p class="note">还没有勾选要入册的照片。先在左边把要进书的照片选上，再回来配文案。</p>';
  const c=noteCur(), cur=c.p, mood=state._noteMood||'heal';
  let h='';
  h+='<div class="row"><button class="btn sm" id="notePrev">◀ 上一张</button>'+
     '<button class="btn sm" id="noteNext">下一张 ▶</button></div>';
  h+='<div class="stat"><b>'+(c.i+1)+' / '+c.n+'</b><span>'+esc(cur.name)+
     ' · '+(cur.note?'已配文案':'还没有文案')+'</span></div>';
  h+='<div class="chips">'+MOODS.map(function(m){
    return '<div class="chip'+(m[0]===mood?' on':'')+'" data-mood="'+m[0]+'">'+m[1]+'</div>';
  }).join('')+'</div>';
  h+='<div class="notes">'+(NOTES[mood]||[]).map(function(t){
    const on=(t===cur.note);
    return '<button class="note'+(on?' on':'')+'" data-note="'+esc(t)+'"'+
      ' title="'+esc(resolveTokens(t,cur))+'">'+esc(resolveTokens(t,cur))+'</button>';
  }).join('')+'</div>';
  h+='<div class="field"><label class="lb">或者自己写一句'+
     (cur.mood?('<span class="val">'+moodLabel(cur.mood)+'</span>'):'')+'</label>'+
     '<input type="text" data-note-input="1" value="'+esc(cur.note||'')+
     '" placeholder="支持 {name} {n} {total} {mood} {date}"></div>';
  h+='<p class="note">这句话会成为这本书里这张照片的<b>图注</b>（前提是下面的「图注来源」选<b>一句话</b>）。'+
     '也能写进模版文字：<code>{note}</code> 就是它。挑一句会自动跳到下一张，一张一张过很快。</p>';
  h+='<div class="row"><button class="btn sm" id="noteAll">这句套给全部 '+c.n+' 张</button>'+
     '<button class="btn sm" id="noteClear">清空全部</button></div>';
  return h;
}
/* 「套给全部」要以哪一句为准？
   挑完一句会自动跳到下一张，所以"当前这张"这时候是空的 ——
   只看 noteCur() 的话按钮会莫名其妙地拒绝执行。所以：当前这张有就用它的，
   没有就退回「刚挑的那句」。用户手动写过字也算"当前这张有"。 */
function noteForAll(){
  const c=noteCur();
  if(c&&String(c.p.note||'').trim()) return c.p.note;
  return state._noteLast||'';
}
/* ================= 一键氛围成书 =================
   一条给「表达型 / 记录型」用户的捷径：他们卡住的地方不是不会点，而是
   不愿意为 28 张照片做 28 次决策。一键成书把四件事一次做完 ——
   套氛围 → 按推荐序列铺模版 → 自动挑封面主图 → 直接生成。

   ⚠ 这里没有任何后门：它只是替用户把面板上现有的那几个动作点了一遍。
     点完照样能逐张改模版、换封面、换氛围，也就是「结果立刻可改」。
     所以它不破坏「逐张可控」这个前提，只是把"从 0 到有一本书"的成本
     从几十次点击压到一次。

   ⚠ 铺模版的顺序必须和 generate() 里那个 filter 完全一致 ——
     否则"第 3 张"在成片里对不上 generated[3]，逐张改模版时会改错人。 */
const LAYOUTS=[['full','满版出血'],['mat','居中留白'],['two','双图并置'],['sticker','贴纸手账']];
function layoutLabel(k){
  for(let i=0;i<LAYOUTS.length;i++){ if(LAYOUTS[i][0]===k) return LAYOUTS[i][1]; }
  return k||'';
}
function autoSeq(sk){
  const a=(sk&&sk.tpls)||[];
  return a.length?a:['polaroid','minimal'];
}
/* opt: off 序列起点（「换一版」就是把它 +1）· coverIdx 封面第几张 ·
        pickAll 一张没勾时是否默认全做（默认 true）· layout 是否套推荐版式 */
function autoBook(skinId,opt){
  const o=opt||{};
  if(!state.photos.length) return {ok:false,msg:'先导入一些照片'};
  let list=state.photos.filter(function(p){ return p.picked; });
  if(!list.length){
    if(o.pickAll===false) return {ok:false,msg:'先勾选要入册的照片'};
    state.photos.forEach(function(p){ p.picked=true; });
    list=state.photos.slice();
  }
  const sk=applySkin(skinId||state.skin,{keepColors:o.keepColors});
  const seq=autoSeq(sk);
  const raw=(o.off==null?(state._autoOff||0):(o.off|0));
  const off=((raw%seq.length)+seq.length)%seq.length;
  for(let i=0;i<list.length;i++) list[i].tpl=seq[(i+off)%seq.length];
  state._autoOff=off;
  state._autoUsed=true;
  /* 封面交给 coverScore() 自动挑（coverIdx=0 = 打分最高那张）。
     「换一版」时轮转一位，否则换了模版却不换封面，封面永远是同一张。 */
  state.book.coverIdx=o.coverIdx==null?0:(o.coverIdx|0);
  const rec=sk.rec||{};
  if(o.layout!==false&&rec.layout) state.book.layout=rec.layout;
  state._coverRank=null;
  if(list[0]&&list[0].id) state.sel=list[0].id;
  state.tpl=seq[off];
  return {ok:true,count:list.length,skin:sk,off:off,seq:seq,layout:state.book.layout};
}
/* 「换一版」：换的是"这一版的装帧与排法"，不换照片、也不换氛围。
   用户上一版的原话是"换一版用起来很单一" —— 因为当时它只动了模版顺序和封面，
   一本书最直观的差异（材料 + 版式 + 封面）里有两样没动。现在四样一起换：
     ① 材料（亚麻布 → 帆布 → 皮革…）—— 封面与内页的质感整本换掉
     ② 版式（居中留白 → 贴纸手账…）
     ③ 模版序列起点 +1
     ④ 封面主图顺延一张
   并把"换掉了什么"回传给调用方，让提示能说人话。 */
function autoRoll(opt){
  const o=opt||{};
  if(!state.photos.length) return {ok:false,msg:'先导入一些照片'};
  const before={
    mat:state.book.mat, layout:state.book.layout, cover:state.book.coverIdx||0, off:state._autoOff||0
  };
  const rec=skinCfg().rec||{};
  const lpool=[rec.layout].concat(rec.alts||[]).filter(function(v){ return !!v; });
  let layout='';
  if(lpool.length>1){
    const at=lpool.indexOf(state.book.layout);
    layout=lpool[(at+1+lpool.length)%lpool.length];
  }
  const ml=matChoices();
  let mat=state.book.mat;
  if(ml.length>1){
    const i=ml.indexOf(mat);
    mat=ml[(i+1+ml.length)%ml.length];
  }
  const rank=(typeof coverRank==='function')?coverRank():[];
  const cv=rank.length>1?(((state.book.coverIdx||0)+1)%rank.length):0;
  const r=autoBook(state.skin,{off:(state._autoOff||0)+1,coverIdx:cv,layout:false});
  if(!r.ok) return r;
  if(mat) state.book.mat=mat;
  if(layout) state.book.layout=layout;
  r.mat=state.book.mat;
  r.matName=matName(r.mat);
  r.layoutName=layoutLabel(r.layout);
  r.changed=(before.mat!==r.mat)||(before.layout!==r.layout)||(before.cover!==r.cover);
  r.from={mat:before.mat,matLabel:matName(before.mat),layoutName:layoutLabel(before.layout)};
  return r;
}
/* 一键成书的面板卡片。三处复用（首屏 / 逐张分配 / 选片成书），
   文案按当前状态自己变：没照片 → 禁用；有照片没勾 → 说明"会全做进去"。 */
function autoHTML(){
  const n=state.photos.length, pk=state.photos.filter(function(p){ return p.picked; }).length;
  const sk=skinCfg(), seq=autoSeq(sk);
  const used=state._autoUsed||state.generated.length;
  let h='<div class="auto">';
  h+='<div class="auto-hd"><b>一键氛围成书</b><s>'+sk.name+' · '+
     matName(state.book.mat)+' · '+
     seq.map(function(k){ return TPL[k]?TPL[k].name:k; }).join(' → ')+'</s></div>';
  h+='<p class="note">一次点击做四件事：套上这套氛围（色号 + <b>材料</b> + 封面题字工艺）→ '+
     '按上面的顺序把推荐模版铺给入册照片 → 自动挑一张最适合当封面的照片 → 直接生成成片。'+
     '生完之后照样能逐张改模版、换材料、换封面、换氛围 —— 它不是一次性模板，只是把决策一次性做完。</p>';
  if(!n){
    h+='<button class="btn block" id="autoBook" disabled>先导入照片</button>';
  } else {
    h+='<div class="row"><button class="btn primary sm" id="autoBook">'+
       (pk?('一键成书 · '+pk+' 张'):('把这 '+n+' 张做成书'))+'</button>';
    if(used) h+='<button class="btn sm" id="autoRoll">换一版</button>';
    h+='</div>';
    h+='<p class="fine">会用「'+sk.name+' · '+matName(state.book.mat)+'」'+
       (sk.rec&&sk.rec.layout?(' + 「'+layoutLabel(sk.rec.layout)+'」版式'):'')+
       (pk?'。':('，并把全部 '+n+' 张都做进去（现在还没有勾选入册照片）。'))+
       '「换一版」会连材料与版式一起换。</p>';
  }
  h+='</div>';
  return h;
}
function panel0(){
  const s=state.spec, a=state.adj;
  const n=state.photos.length, pk=state.photos.filter(function(p){ return p.picked; }).length;
  let h='';
  h+='<div class="stat"><b>'+(n?(pk+' / '+n):'0')+'</b><span>'+
    (n?'张已入册 · 点缩略图左上角圆圈可加入 / 移出':'还没有素材 —— 拖入照片，或用右上角「示例照片」')+'</span></div>';
  /* 一键成书放在第一屏最上面。首屏的决策成本 = 「她会不会卡住」：
     面对 7 个氛围色块已经比面对 11 套模版轻，但"还要再挑模版顺序 + 挑封面"
     仍然是一串决策。这一张卡片把整串决策收成一个按钮，
     想动手的人再往下的「氛围」「模版」里细调即可。 */
  h+='<details class="sec" open><summary>一键氛围成书<span class="hint">'+
     (state._autoUsed?'已用过 · 可换一版':'一次点击')+'</span></summary><div class="sec-body">';
  h+=autoHTML();
  h+='</div></details>';
  /* 氛围放在第一屏第一位。第一屏的决策成本是「她会不会卡住」的关键：
     面对 11 套模版要先理解「模版是哪一类框」，而面对 7 个色块不用解释。 */
  h+='<details class="sec" open><summary>氛围<span class="hint">'+skinCfg().name+'</span></summary><div class="sec-body">';
  h+=skinHTML();
  h+='<div class="field"><label class="lb">材质<span class="val">'+matName(state.book.mat)+'</span></label>';
  h+=matHTML();
  h+='</div>';
  h+='<p class="note">氛围一次换的是<b>整套</b>观感：书页纸色、材料与纹理、书封、印片纸色与强调色、'+
     '封面题字的工艺（压凹 / 烫金）、圆角。下面三个材质是这套氛围配好的，随便挑 —— '+
     '<b>材质是独立可换的</b>，换它只重排书页，不用重新出片。</p>';
  h+='</div></details>';
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
  /* 这一步是「逐张精细调」的地盘，一键成书在这里只是逃生口 ——
     所以默认收起（不展开），不跟逐张流程抢注意力。 */
  h+='<details class="sec"><summary>一键氛围成书<span class="hint">不想逐张挑就用它</span></summary><div class="sec-body">';
  h+=autoHTML();
  h+='</div></details>';
  h+='<details class="sec" open><summary>当前模版<span class="hint">'+t.name+'</span></summary><div class="sec-body">';
  h+='<div class="stat"><b>'+t.name+'</b><span>'+t.hint+'</span></div>';
  h+='<button class="btn block sm" id="tplApplyAll2">把「'+t.name+'」应用到全部 '+n+' 张</button>';
  h+=txtHTML('opts.title',o.title,'主标题','主标题');
  h+=txtHTML('opts.sub',o.sub,'副标题 / 日期','副标题');
  h+=txtHTML('opts.corner',o.corner,'角标 / 编号','角标文字');
  h+='<p class="note">文字里可以写占位符，出片时按<b>每一张照片</b>解开 —— '+
     '<code>{name}</code> 照片名 · <code>{n}</code> 序号 · <code>{nn}</code> 两位序号 · '+
     '<code>{total}</code> 入册张数 · <code>{tpl}</code> 模版名 · '+
     '<code>{note}</code> 这张的一句话 · <code>{mood}</code> 心情标签 · '+
     '<code>{date}</code> 拍摄/文件日期。<br>'+
     '默认的 <code>{name}</code> 就是为此：不然 28 张成片会整整齐齐地重复同一句话。</p>';
  const demoP=state.photos.find(function(p){ return p.id===state.sel; })||state.photos[0];
  if(demoP&&o.title&&/\{(name|nn|n|total|tpl|note|mood|date)\}/.test(o.title))
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
  h+='<details class="sec" open><summary>字体与配色<span class="hint">'+skinCfg().name+'</span></summary><div class="sec-body">';
  h+=skinHTML();
  h+='<div class="field"><label class="lb">材质<span class="val">'+matName(state.book.mat)+'</span></label>';
  h+=matHTML();
  h+='</div>';
  h+='<div class="field"><label class="lb">字体风格</label>'+segHTML('opts.font',
    [['sans','无衬线'],['serif','衬线'],['mono','等宽'],['hand','手写']],o.font,true)+'</div>';
  const over=!!(o.paper||o.ink);
  h+=colHTML('opts.accent',o.accent||'#e08a3c','强调色');
  h+=colHTML('opts.paper',o.paper||skinCfg().tplPaper||'#fdfaf3','纸张底色（印片）');
  h+=colHTML('opts.ink',o.ink||skinCfg().tplInk||'#3a342c','墨色（印片）');
  h+='<p class="note">上面三个颜色默认<b>跟着氛围走</b>'+(over?' —— 你手改过，所以现在是你自己的色值':'')+
     '。手改之后想回到氛围，点下面的按钮。</p>';
  h+='<button class="btn block sm" id="skinColors">跟随「'+skinCfg().name+'」的配色</button>';
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
  /* 到这里用户已经看过一遍成书了。「换一版」放在最上面 ——
     它是这一步最有价值的按钮：不想逐张改的人靠它换一版，
     想改的人往下走（文案 / 版式 / 书封 / 导出都在下面）。 */
  h+='<details class="sec" open><summary>一键氛围成书<span class="hint">'+
     (state._autoUsed?'已用过 · 可换一版':'一次点击')+'</span></summary><div class="sec-body">';
  h+=autoHTML();
  h+='</div></details>';
  h+='<details class="sec" open><summary>氛围<span class="hint">'+skinCfg().name+'</span></summary><div class="sec-body">';
  h+=skinHTML();
  h+='<div class="field"><label class="lb">材质<span class="val">'+matName(state.book.mat)+'</span></label>';
  h+=matHTML();
  h+='</div>';
  h+='<p class="note">换氛围会同时改<b>书页底色 / 墨色 / 书封</b>、<b>纸的材料与纹理</b>和<b>封面题字的工艺</b>，'+
     '也会把材料换成这套氛围的默认款。成片里已经烧进旧强调色，所以换完氛围会提示重出一次成片；'+
     '而单独换材质只重排书页，不用重出。</p>';
  h+='</div></details>';
  /* 文案紧跟着照片走，所以放在选片成书这一步的最上面 —— 用户此刻正看着照片 */
  h+='<details class="sec" open><summary>给照片配一句话'
     +'<span class="hint">'+(state.photos.filter(function(p){ return p.note; }).length||'还没有')+'</span>'
     +'</summary><div class="sec-body">';
  h+=noteHTML();
  h+='</div></details>';
  h+='<details class="sec" open><summary>版式<span class="hint">'+b.ratio+'</span></summary><div class="sec-body">';
  h+='<div class="field"><label class="lb">书页比例</label>'+segHTML('book.ratio',
    [['3:4','3:4 标准'],['4:5','4:5'],['2:3','2:3'],['1:1','方形'],['9:16','竖长'],['A4','A4']],b.ratio)+'</div>';
  h+='<div class="field"><label class="lb">每页排布</label>'+segHTML('book.layout',
    [['full','满版出血'],['mat','居中留白'],['two','双图并置'],['sticker','贴纸手账']],b.layout)+'</div>';
  h+='<div class="field"><label class="lb">书页画面</label>'+segHTML('book.art',
    [['tpl','模版成品'],['plain','干净照片']],b.art)+'</div>';
  h+='<div class="field"><label class="lb">翻页形态</label>'+segHTML('book.spread',
    [[1,'跨页对开'],[0,'单页阅读']],b.spread?1:0,true)+'</div>';
  h+='<div class="field"><label class="lb">图注来源</label>'+segHTML('book.cap',
    [['note','一句话'],['name','照片名'],['title','模版标题'],['none','不显示']],b.cap)+'</div>';
  /* 把"实际用到的中文字族"写出来。单文件工具没有网络字体，只能挑系统里有的；
     而浏览器对缺字族是静默降级（中文机上多半变黑体）—— 不写出来的话，
     "我以为是宋体、你看到的是黑体"这种事在两边都是隐形的。 */
  h+='<p class="note">图注字体 <b>'+(capLabel||'界面同款黑体')+'</b>'+(capCJK
    ? ' —— 单文件工具没有网络字体，只能用这台机器上真正装了的字族。'
    : ' —— 这台机器（或这个浏览器）没有可用宋体 / 楷体 / 仿宋，只能退到界面同一套黑体。')+'</p>';
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
  h+='<details class="sec" open><summary>导出<span class="hint">'+
     (exportPresetOf(exportPresetNow())?exportPresetOf(exportPresetNow()).px:(state.spec.longEdge+' px'))+
     '</span></summary><div class="sec-body">';
  const curPreset=exportPresetNow();
  h+='<div class="field"><label class="lb">发布尺寸<span class="val">'+
     (curPreset?exportPresetOf(curPreset).px:'自定义')+'</span></label>'+
     '<div class="chips">'+EXPORT_PRESETS.map(function(p){
       return '<div class="chip'+(p.id===curPreset?' on':'')+'" data-export="'+p.id+'">'+
         p.label+'</div>';
     }).join('')+'</div></div>';
  h+='<p class="note">选了尺寸会改<b>成片本身</b>的画幅（不是导出时套白边），所以出片后不用再裁就能直接发。'+
     '改尺寸后要重出一次成片；书页比例是另一回事，在「版式」里单独调。</p>';
  h+='<button class="btn block sm" id="exportZip">导出全部成片（ZIP）</button>';
  h+='<button class="btn block sm" id="exportSheet">导出一张竖版分享长图</button>';
  h+='<button class="btn block sm" id="exportCurrent">下载当前成片</button>';
  h+='</div></details>';
  return h;
}
function renderPanel(){
  const el=$('#panel');
  el.innerHTML=state.step===0?panel0():(state.step===1?panel1():panel2());
  /* 材质小样必须在插入 DOM 之后画 —— 小 canvas 是 renderPanel 刚生成的。
     画的是真材料（同一套 tile + 同一套光照），所以用户看到的就是换上去的样子。 */
  try{ paintMats(); }catch(e){}
}
/* ================= 交互与业务逻辑 ================= */
/* 模版文字的出厂值。带占位符 —— 每张成片因此有自己的一行字。
   {name} 照片名 / {n} 序号 / {nn} 两位序号 / {total} 入册张数 / {tpl} 模版名 */
const DEFAULT_OPTS={title:'{name}',sub:'{n} / {total}',corner:'NO.{n}',paper:'',ink:'',accent:'#e08a3c',accent2:'',font:'sans'};
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
  const list=state.generated;
  const files=[];
  for(let i=0;i<list.length;i++){
    const g=list[i];
    const blob=await canvasBlob(g.canvas,fmt,state.spec.quality);
    if(!blob) continue;
    const buf=new Uint8Array(await blob.arrayBuffer());
    /* 文件名带上画幅尺寸：导出多批之后在下载目录里能分清哪个是哪个 */
    files.push({name:'lumen/'+pad2(i+1)+'-'+g.canvas.width+'x'+g.canvas.height+'-'+(g.tpl||'')+'.'+ext,data:buf});
  }
  const pz=exportPresetOf(exportPresetNow());
  files.push({name:'lumen/README.txt',data:new TextEncoder().encode(
    '光匣 LUMEN · 照片书成片\n'+
    '画幅尺寸：'+(pz?pz.label+' '+pz.px:(state.spec.longEdge+'px 长边'))+'\n'+
    '氛围：'+skinCfg().name+'\n'+
    '数量：'+files.length+' 张\n'+
    '生成时间：'+new Date().toLocaleString())});
  downloadBlob(zipStore(files),'光匣-成片-'+(pz?pz.px.replace(/ /g,''):state.spec.longEdge)+'-'+Date.now()+'.zip');
  toast('ZIP 已导出 · '+files.length+' 个文件');
}
function shareSheet(){
  const r=buildPages();
  if(!r.pages.length) return null;
  /* 环衬 / 空白页只是装订用的填充，放进分享图只会让图更长 */
  const list=r.pages.filter(function(p){ return p.kind!=='endpaper'&&p.kind!=='blank'; });
  const W=1080, pad=Math.round(W*.042), gap=Math.round(W*.022), cols=2;
  const pw=R((W-pad*2-gap*(cols-1))/cols), ph=R(pw/r.ratio);
  const head=Math.round(W*.21), foot=Math.round(W*.135);
  const rows=Math.ceil(list.length/cols);
  const H=head+rows*ph+(rows-1)*gap+foot;
  const MAXH=16000;
  let k=1;
  if(H>MAXH){ k=MAXH/H; }
  const CW=R(W*k), CH=R(H*k);
  const c=document.createElement('canvas'); c.width=CW; c.height=CH;
  const x=c.getContext('2d');
  x.fillStyle=state.book.paper; x.fillRect(0,0,CW,CH);
  const ink=hex2rgb(state.book.ink||'#2b2620');
  const soft=function(a){ return 'rgba('+ink[0]+','+ink[1]+','+ink[2]+','+a+')'; };
  x.save(); x.scale(k,k);
  /* 页眉：眉题 → 书名 → 细线 → 页数与日期 */
  x.textAlign='center'; x.textBaseline='alphabetic';
  x.fillStyle=soft(.34);
  const es=R(W*.0150);
  x.font=R(es)+'px '+FONTS.sans;
  tracked(x,'PHOTO BOOK',W/2,head*.30,es*1.2,'center');
  const ts=fitFont(x,state.book.title||'光匣',W*.6,FONTS.serif,W*.082,W*.030,'700');
  x.fillStyle=soft(1);
  x.font='700 '+R(ts)+'px '+FONTS.serif;
  tracked(x,state.book.title||'光匣',W/2,head*.58,ts*.10,'center');
  x.save(); x.globalAlpha=.28; x.fillStyle=soft(1);
  x.fillRect(W*.42,head*.66,W*.16,Math.max(1,W*.0013)); x.restore();
  const bs=R(W*.0158);
  x.fillStyle=soft(.55); x.font=R(bs)+'px '+FONTS.sans;
  const dt=new Date();
  tracked(x,(list.length+' 页 · '+dt.getFullYear()+'.'+pad2(dt.getMonth()+1)+'.'+pad2(dt.getDate())
    +' · '+(state.book.author||'')),W/2,head*.82,bs*.30,'center');
  /* 书页：浅投影，和纸色拉开一点点就够，不要做成"卡片瀑布" */
  list.forEach(function(p,i){
    const cx=pad+(i%cols)*(pw+gap);
    const cy=head+Math.floor(i/cols)*(ph+gap);
    x.save();
    x.shadowColor='rgba(0,0,0,.16)'; x.shadowBlur=W*.014; x.shadowOffsetY=W*.005;
    x.fillStyle=state.book.paper; x.fillRect(cx,cy,pw,ph);
    x.restore();
    x.drawImage(p.canvas,cx,cy,pw,ph);
  });
  x.restore();
  return {canvas:c, list:list, cols:cols, k:k, head:head, foot:foot,
    pw:pw, ph:ph, pad:pad, gap:gap, W:W, H:H, CW:CW, CH:CH};
}
/* 竖版分享长图：一张图讲完整本书，是成本最低的分发物。
   三条硬约束：
     ① 竖版 —— 微信 / 小红书的信息流是竖的，横长图会被压得看不清；
     ② 顶部带书名与日期 —— 转发出去别人不知道这是什么；
     ③ 底部留一条空白安全区 —— 小红书底部会压一层标题与控件，
        不留白的话最后一行书页会被挡住。
   页数多时高度会非常夸张，超过上限就整体等比缩小，宁可小一点也不要
   出一张打不开的图（部分浏览器对 canvas 面积有硬上限）。 */
function exportSheet(){
  const s=shareSheet();
  if(!s){ toast('还没有书页'); return; }
  const name='光匣-分享长图-'+s.CW+'x'+s.CH+'.png';
  s.canvas.toBlob(function(bl){
    if(bl) downloadBlob(bl,name);
    toast('分享长图已导出 · '+s.list.length+' 页 · '+s.CW+'×'+s.CH+(s.k<1?' · 已等比缩小':''));
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