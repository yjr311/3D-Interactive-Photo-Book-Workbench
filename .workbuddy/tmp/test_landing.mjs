import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

/* 回归：三个视觉缺陷
   ① 合着书时书脊阴影溢出到书左侧桌面上（灰痕）
   ② 每次翻页「落地」瞬间亮度跳一档（白一下）
   ③ 模版预览区正中被固定画了一团黑色径向渐变（大黑点）
   全部用画布像素 / 计算样式取证，不靠肉眼。

   驱动翻页的关键：把 anim.t0 挪到「远未来」再按 16ms 步进。
   否则 step() 里 `now = Math.max(ts, performance.now())` 会让真实时钟
   抢先推完动画，抓到的「落地帧」就不是真的落地帧（两次运行结果会不一致）。 */

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%85%89%E5%8C%A3-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const R = [];
const ok = (n, c, extra = '') => R.push((c ? 'PASS' : '**FAIL**') + ' ' + n + (extra ? '  ' + extra : ''));

const b = await launch({ port: 9397, windowSize: '1512,900' });
await b.goto(FILE, 1200);
const ev = (x) => b.evaluate(x);

for (let i = 0; i < 120; i++) { if ((await ev('state.photos.length')) >= 28) break; await sleep(200); }
if ((await ev('state.photos.length')) < 28) { try { await ev('window.LUMEN.loadEmbedded(true)'); } catch (e) { } }
if ((await ev('state.generated.length')) < 28) { try { await ev('window.LUMEN.generate()'); } catch (e) { } }
for (let i = 0; i < 240; i++) { if ((await ev('state.generated.length')) >= 28) break; await sleep(250); }
await ev('setStep(2); state.book.spread=true; BV.spread=true;'); await sleep(900);
await ev('window.__raf=window.requestAnimationFrame; window.requestAnimationFrame=function(){return 0;};');

/* ---------- 逐帧推进一次翻页，返回「落地帧」前后的测量 ---------- */
const FLIP = `(function(startCur,dir){
  BV.anim=null; BV.live=null; BV.queue=[]; BV.cur=startCur;
  BV.offT=BV.targetOff(); BV.off=BV.offT; BV.syncUI(); BV.layout(); BV.draw();
  var ctx=BV.ctx, dpr=BV.dpr, W=Math.round(BV.cw*dpr), H=Math.round(BV.ch*dpr);
  function meas(){
    var d=ctx.getImageData(0,0,W,H).data, sx=Math.round(BV.spineX*dpr);
    var ls=0,ln=0,lw=0, rs=0,rn=0,rw=0, all=0,alln=0;
    for(var y=0;y<H;y+=3) for(var x=0;x<W;x+=3){
      var i=(y*W+x)*4, r=d[i],g=d[i+1],bl=d[i+2], L=r*0.299+g*0.587+bl*0.114;
      var isw=(r>245&&g>245&&bl>245);
      if(x<sx){ ls+=L;ln++; if(isw) lw++; } else { rs+=L;rn++; if(isw) rw++; }
      all+=L; alln++;
    }
    return {L:+(ls/Math.max(1,ln)).toFixed(2), Lw:+(lw/Math.max(1,ln)*100).toFixed(2),
            R:+(rs/Math.max(1,rn)).toFixed(2), M:+(all/Math.max(1,alln)).toFixed(2)};
  }
  BV.flipOne(dir,{dur:400});
  if(!BV.anim) return 'NOFLIP';
  var t0=BV.anim.t0+100000; BV.anim.t0=t0;     /* 远未来时间戳 → 完全由我步进 */
  var seq=[], landIdx=-1, mid=null;
  for(var f=0;f<=34;f++){
    BV.raf=0;
    var had=!!BV.anim;
    BV.step(t0+f*16);
    var m=meas(); seq.push(m);
    if(had&&!BV.anim&&landIdx<0) landIdx=seq.length-1;
    if(had&&BV.anim&&mid===null){
      /* back 方向 p 从 1 递减，必须换算成 q=1-p 才是「翻到哪了」 */
      var qq=dir==='back'?1-BV.anim.p:BV.anim.p;
      if(qq>=0.45) mid=m;
    }
  }
  if(landIdx<1) return 'NOLAND';
  var pre=seq[landIdx-1], land=seq[landIdx], post=seq[Math.min(landIdx+1,seq.length-1)];
  return JSON.stringify({pre:pre, land:land, post:post, mid:mid, landIdx:landIdx,
    dL:+(land.L-pre.L).toFixed(2), dM:+(land.M-pre.M).toFixed(2),
    dLw:+(land.Lw-pre.Lw).toFixed(2)});
})`;

/* ① 书脊阴影不越界 */
const sp = JSON.parse(await ev(`(function(){
  BV.anim=null; BV.live=null; BV.cur=0; BV.offT=BV.targetOff(); BV.off=BV.offT; BV.syncUI(); BV.layout(); BV.draw();
  var ctx=BV.ctx,dpr=BV.dpr,W=Math.round(BV.cw*dpr),H=Math.round(BV.ch*dpr);
  function alphaBand(x0,x1){
    x0=Math.max(0,Math.round(x0*dpr)); x1=Math.min(W,Math.round(x1*dpr));
    var d=ctx.getImageData(0,0,W,H).data, s=0,n=0,mx=0;
    var y0=Math.round((BV.top+BV.ph*0.3)*dpr), y1=Math.round((BV.top+BV.ph*0.7)*dpr);
    for(var y=y0;y<y1;y+=2) for(var x=x0;x<x1;x+=2){ var a=d[(y*W+x)*4+3]; s+=a; n++; if(a>mx) mx=a; }
    return {avg:+(s/Math.max(1,n)).toFixed(1), max:mx, n:n};
  }
  var out={};
  out.cur0_left=alphaBand(BV.spineX-56, BV.spineX-2);
  out.cur0_inside=alphaBand(BV.spineX+2, BV.spineX+56);
  BV.cur=BV.n; BV.offT=BV.targetOff(); BV.off=BV.offT; BV.syncUI(); BV.draw();
  out.curN_right=alphaBand(BV.spineX+2, BV.spineX+56);
  out.pw=Math.round(BV.pw); out.cw=Math.round(BV.cw);
  return JSON.stringify(out);
})()`));
ok('① 封面态：书脊左侧桌面上无任何绘制', sp.cur0_left.max === 0, 'alpha峰=' + sp.cur0_left.max + ' 采样点=' + sp.cur0_left.n);
ok('① 封面态：封面内侧书脊阴影仍在', sp.cur0_inside.max === 255, 'alpha峰=' + sp.cur0_inside.max);
ok('① 末页态：书脊右侧桌面上无绘制', sp.curN_right.max === 0, 'alpha峰=' + sp.curN_right.max);

/* ①b 合着书时封面上不该有书沟阴影。
   书沟的物理前提是「两侧都有纸」，只有封面时不成立。
   判定方式：把「贴着封面左边缘的一条带」的平均亮度，和封面页纹理同一条带比。
   阴影会在整条带上均匀压暗，而缩放带来的亚像素差异会被平均掉。 */
const BAND = `function bandMean(pageIdx, d0, d1){
  var src=BV.pages[pageIdx];
  var c=document.createElement('canvas'); c.width=src.width; c.height=src.height;
  var cx=c.getContext('2d'); cx.drawImage(src,0,0);
  var sd=cx.getImageData(0,0,src.width,src.height).data;
  var cd=BV.ctx.getImageData(0,0,BV.cv.width,BV.cv.height).data;
  var kx=src.width/BV.pw, ky=src.height/BV.ph, dpr=BV.dpr;
  function L(a,i){ return a[i]*0.299+a[i+1]*0.587+a[i+2]*0.114; }
  var sc=0,sn=0,tc=0,tn=0;
  for(var d=d0;d<d1;d+=2){
    for(var yy=BV.top+BV.ph*.25; yy<BV.top+BV.ph*.75; yy+=6){
      var px=Math.round((BV.spineX+d)*dpr), py=Math.round(yy*dpr);
      var i=(py*BV.cv.width+px)*4;
      sc+=L(cd,i); sn++;
      var j=(Math.round((yy-BV.top)*ky)*src.width+Math.round(d*kx))*4;
      tc+=L(sd,j); tn++;
    }
  }
  return {canvas:+(sc/Math.max(1,sn)).toFixed(2), tex:+(tc/Math.max(1,tn)).toFixed(2)};
}`;

const cov = JSON.parse(await ev(`(function(){
  BV.anim=null; BV.live=null; BV.cur=0;
  BV.offT=BV.targetOff(); BV.off=BV.offT; BV.syncUI(); BV.layout(); BV.draw();
  ${BAND}
  var b=bandMean(0,3,26);
  return JSON.stringify({canvas:b.canvas, tex:b.tex, d:+(b.canvas-b.tex).toFixed(2)});
})()`));
ok('①b 合着书：封面上没有书沟阴影（贴边条带亮度与页纹理一致）', Math.abs(cov.d) < 4,
  '画布=' + cov.canvas + ' 纹理=' + cov.tex + ' Δ=' + cov.d);

/* ①c 翻开之后书沟阴影必须回来（不能为了消痕迹把正常书脊也一起砍掉） */
const gut = JSON.parse(await ev(`(function(){
  BV.anim=null; BV.live=null; BV.cur=3;
  BV.offT=BV.targetOff(); BV.off=BV.offT; BV.syncUI(); BV.layout(); BV.draw();
  ${BAND}
  var near=bandMean(6,3,26), far=bandMean(6,40,63);
  return JSON.stringify({near:near, far:far, d:+(near.canvas-near.tex).toFixed(2)});
})()`));
ok('①c 跨页态：书沟阴影仍在（贴书脊条带明显暗于页纹理）', gut.d < -18,
  '贴脊条带 Δ=' + gut.d + '（画布=' + gut.near.canvas + ' 纹理=' + gut.near.tex + '）');

/* ② 落地亮度连续性 */
for (const [name, cur, dir] of [['封面翻页 fwd', 0, 'fwd'], ['中间页翻页 fwd', 4, 'fwd'], ['中间页回翻 back', 5, 'back']]) {
  const raw = await ev(FLIP + '(' + cur + ',\'' + dir + '\')');
  if (raw === 'NOFLIP' || raw === 'NOLAND') { ok('② ' + name, false, raw); continue; }
  const r = JSON.parse(raw);
  ok('② ' + name + '：落地亮度连续', Math.abs(r.dL) < 1.5 && Math.abs(r.dM) < 1.5,
    '左半 L ' + r.pre.L + ' → ' + r.land.L + ' → ' + r.post.L + ' (Δ' + r.dL + ')' +
    ' | 全幅 M ' + r.pre.M + ' → ' + r.land.M + ' (Δ' + r.dM + ')' +
    ' | 白占比 ' + r.pre.Lw + '% → ' + r.land.Lw + '%' + ' @帧' + r.landIdx);
  /* 诊断（非断言）：中段纸面应当比落地后更暗。像素均值受页面内容影响较大，
     不足以做硬性判定，这里只打印数值供人工比对。 */
  if (r.mid) R.push('[诊断] ' + name + ' 弧线中段：白占比=' + r.mid.Lw + '% 全幅M=' + r.mid.M +
    ' ／ 落地后：白占比=' + r.post.Lw + '% M=' + r.post.M +
    '（中段更暗=' + (r.mid.M < r.post.M || r.mid.Lw < r.post.Lw) + '）');
}

/* ③ 预览区那团黑印已移除（#pvWrap 只在步骤一存在） */
await ev('setStep(1)'); await sleep(600);
const blob = JSON.parse(await ev(`(function(){
  var w=document.querySelector('#pvWrap');
  if(!w) return JSON.stringify({err:'no pvWrap'});
  return JSON.stringify({before:getComputedStyle(w,'::before').content});
})()`));
ok('③ 预览区固定黑印已移除', ['none', 'normal', '""'].indexOf(blob.before) >= 0, '::before content=' + blob.before);
ok('③ 预览画布自带投影（替代黑印）',
  (await ev('getComputedStyle($("#previewCv")).boxShadow')).indexOf('rgba') >= 0);

const errors = b.errors.filter(e => !/favicon|net::ERR_FILE/.test(e));
console.log(R.join('\n'));
console.log('\n--- JS 异常:' + (errors.length ? '\n' + errors.join('\n') : ' none'));
console.log('--- 失败项: ' + R.filter(r => r.startsWith('**')).length + ' / ' + R.length);
await ev('window.requestAnimationFrame=window.__raf;');
await b.close();
