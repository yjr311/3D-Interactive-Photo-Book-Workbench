# -*- coding: utf-8 -*-
"""替换 BookView.prototype.drawSheet 为「错峰转角 + 弧长积分 + 透视放大」模型。"""
import io, os, re

P = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/src/app.js"
s = io.open(P, encoding="utf-8").read()

NEW = r'''/* ---------- 翻页纸张：错峰转角 + 弧长积分 + 透视放大 ----------
   每一根竖条带都有自己的“翻动进度” prog，越靠自由边越领先，
   于是纸面自然形成一道从书脊扫向自由边的波浪；
   沿纸面做弧长积分得到真实的空间曲线，再用透视把靠近观者的部分放大，
   上/下边缘因此成为曲线、纸面出现“立起来扑面而来”的体积感。 */
BookView.prototype.drawSheet=function(ctx,i,p){
  const W=this.pw, H=this.ph, cy=this.cy, sx0=this.spineX, top=this.top;
  const mv=this.anim||this.live;
  const dir=(mv&&mv.dir)||'fwd';
  const isBack=(dir==='back');
  const m=isBack?-1:1;
  const q=isBack?1-p:p;                       /* 0=贴合本侧  1=完全翻到另一侧 */
  const pageF=this.sheetFront(i), pageB=this.sheetBack(i);
  const mirF=isBack, mirB=!isBack;            /* 源图是否需要左右镜像采样 */
  const N=this.N, du=W/N;
  const a=.72;                                /* 错峰量：越大波浪越明显 */
  const amp=Math.sin(Math.PI*clamp(q,0,1));
  const bulge=.07+(this.bowBoost||0)*.85;
  const prog=function(t){
    return clamp(q*(1+a)-a*(1-t)+bulge*Math.sin(Math.PI*t)*amp,0,1);
  };
  const AN=new Float64Array(N+1), XX=new Float64Array(N+1), CC=new Float64Array(N+1);
  for(let k=0;k<=N;k++) AN[k]=Math.PI*prog(k/N);
  for(let k=0;k<N;k++){
    const aa=Math.PI*prog((k+.5)/N);
    XX[k+1]=XX[k]+du*Math.cos(aa);
    CC[k+1]=CC[k]+du*Math.sin(aa);
  }
  const D=this.D, K=.94;
  const sxp=new Float64Array(N+1), fz=new Float64Array(N+1);
  for(let k=0;k<=N;k++){
    const f=D/Math.max(120,D-K*CC[k]);
    fz[k]=f; sxp[k]=sx0+m*XX[k]*f;
  }
  const tracePath=function(c){
    c.beginPath();
    for(let k=0;k<=N;k++){ const y=cy-H*fz[k]/2; if(k===0) c.moveTo(sxp[k],y); else c.lineTo(sxp[k],y); }
    for(let k=N;k>=0;k--) c.lineTo(sxp[k],cy+H*fz[k]/2);
    c.closePath();
  };
  /* ---- 1. 纸面投在下层书页上的阴影 ---- */
  const lead=sxp[N];
  const xa=Math.min(sx0,lead), xb=Math.max(sx0,lead);
  if(xb-xa>2){
    ctx.save();
    ctx.beginPath(); ctx.rect(sx0-W-.5,top-2,W*2+1,H+4); ctx.clip();
    if(this.filterOK) ctx.filter='blur(17px)';
    ctx.globalAlpha=clamp(.12+.40*amp,0,.52);
    const g=ctx.createLinearGradient(sx0,0,lead,0);
    g.addColorStop(0,'rgba(0,0,0,.95)');
    g.addColorStop(.5,'rgba(0,0,0,.45)');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;
    ctx.fillRect(xa-8,top+3,xb-xa+16,H-6);
    ctx.restore();
  }
  /* ---- 2. 剪影底色（保证上下边缘是平滑曲线）---- */
  const paper=state.book.paper||'#fffdf8';
  tracePath(ctx);
  ctx.save();
  ctx.fillStyle=paper; ctx.fill();
  ctx.clip();
  /* 以上 save/clip 已打开，绘制完条带与着色后统一 restore */
  const ov=.55;
  for(let k=0;k<N;k++){
    const xA=sxp[k], xB=sxp[k+1], w=xB-xA;
    if(Math.abs(w)<.045) continue;
    const fmid=(fz[k]+fz[k+1])/2;
    const yTop=cy-H*fmid/2, hh=H*fmid;
    const nzMid=Math.cos((AN[k]+AN[k+1])/2);
    const src=nzMid>=0?pageF:pageB;
    const mir=nzMid>=0?mirF:mirB;
    const drawL=Math.min(xA,xB)-ov, drawW=Math.abs(w)+2*ov;
    if(!src){ ctx.fillStyle=paper; ctx.fillRect(drawL,yTop,drawW,hh); continue; }
    const S=src.width, SH=src.height, sw=S/N;
    const u0=k*du/W, u1=(k+1)*du/W;
    const grow=(ov/Math.max(.25,Math.abs(w)))*sw;
    const srcA=(mir?S-u1*S:u0*S)-grow;
    ctx.drawImage(src, srcA, 0, sw+2*grow, SH, drawL, yTop, drawW, hh);
  }
  /* ---- 3. 分段渐变着色（连续，无瓦楞纹）---- */
  let kr=N;
  for(let k=0;k<=N;k++){ if(Math.cos(AN[k])<0){ kr=k; break; } }
  const shadeCol=function(k){
    const kk=clamp(k,0,N);
    const nz=Math.cos(AN[kk]), nx=-Math.sin(AN[kk])*m;
    const lit=clamp(nx*LIGHT[0]+Math.abs(nz)*LIGHT[1],0,1);
    let d=.055+.60*Math.pow(1-Math.abs(nz),1.08);
    d*=1-.34*lit;
    if(nz<0) d=d*.80+.02;                      /* 背面略亮 */
    const t=kk/N;
    d+=.20*Math.max(0,1-t/.11)*(1-.45*amp);    /* 书脊折痕 */
    return 'rgba(10,8,6,'+clamp(d,0,.80).toFixed(3)+')';
  };
  const shade=function(k0,k1){
    if(k1-k0<1) return;
    const xA=sxp[k0], xB=sxp[k1];
    if(Math.abs(xB-xA)<1) return;
    const g=ctx.createLinearGradient(xA,0,xB,0);
    for(let k=k0;k<=k1;k++) g.addColorStop(clamp((sxp[k]-xA)/(xB-xA),0,1),shadeCol(k));
    ctx.fillStyle=g; ctx.fillRect(Math.min(xA,xB),cy-H,Math.abs(xB-xA),H*2);
  };
  shade(0,kr); shade(kr,N);
  ctx.restore();
  /* ---- 4. 自由边的纸厚高光 ---- */
  ctx.save();
  ctx.globalAlpha=.75;
  ctx.strokeStyle='rgba(255,251,240,.60)';
  ctx.lineWidth=1.6;
  ctx.beginPath();
  ctx.moveTo(sxp[N], cy-H*fz[N]/2+2);
  ctx.lineTo(sxp[N], cy+H*fz[N]/2-2);
  ctx.stroke();
  ctx.restore();
};'''

start = s.index("/* 弯曲的纸张：真实抬升 + 连续卷曲 + 分段渐变着色 */")
end = s.index("/* ---------- 交互 ---------- */")
old = s[start:end]
assert "drawSheet" in old and len(old) < 6000, len(old)
s = s[:start] + NEW + "\n" + s[end:]
io.open(P, "w", encoding="utf-8", newline="\n").write(s)
print("ok, lines:", s.count("\n") + 1)
