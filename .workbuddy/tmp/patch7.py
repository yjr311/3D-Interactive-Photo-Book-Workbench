# -*- coding: utf-8 -*-
"""v5 翻页引擎：剥离式卷曲（spine 滞后 / 自由边领先）+ 抬升与投影。"""
import io

A = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/src/app.js"
s = io.open(A, encoding="utf-8").read()

NEW = r'''/* ---------- 翻页纸张：剥离式卷曲 ----------
   纸不是刚体：翻页时书脊一侧几乎还贴在纸上，只有自由边被提起、卷曲、最后落下。
   于是把「纸面切线角」写成  A(t) = π·q·[(1-cc) + cc·t^0.7]：
     · q=0        → 全页平贴在右页
     · q=1        → cc 自动归零，全页 A=π，平整落在左页（不会悬空、不会对折）
     · 中间态     → 书脊一侧角度滞后、自由边领先，纸面呈现自然的卷曲
   再把沿纸面积分出的「离桌高度」投影到屏幕上，纸就真正“立”了起来。 */
BookView.prototype.drawSheet=function(ctx,i,p){
  const W=this.pw, H=this.ph, cy=this.cy, sx0=this.spineX, top=this.top;
  const mv=this.anim||this.live;
  const dir=(mv&&mv.dir)||'fwd';
  const isBack=(dir==='back');
  const m=isBack?-1:1;                       /* back 时自由边朝左 */
  const q=clamp(isBack?1-p:p,0,1);           /* 0=贴合本侧  1=完全翻到另一侧 */
  const pageF=this.sheetFront(i), pageB=this.sheetBack(i);
  const N=this.N, du=W/N;
  const warm=(this.bowBoost||0);             /* 快速拖动时卷得更紧 */
  const c0=clamp(.86-warm*.6,.34,.90);
  const pe=clamp(1.75-warm*1.4,1.05,2.4);
  const cc=c0*(1-Math.pow(q,pe));
  const AN=new Float64Array(N+1);
  for(let k=0;k<=N;k++){
    const t=k/N;
    AN[k]=Math.PI*q*((1-cc)+cc*Math.pow(t,.70));
  }
  const XX=new Float64Array(N+1), ZZ=new Float64Array(N+1);
  for(let k=0;k<N;k++){
    const aa=(AN[k]+AN[k+1])*.5;
    XX[k+1]=XX[k]+du*Math.cos(aa);
    ZZ[k+1]=ZZ[k]+du*Math.sin(aa);
  }
  const KZ=.52;                              /* 抬升投影系数：纸离桌的高度→屏幕位移 */
  const sxp=new Float64Array(N+1), dy=new Float64Array(N+1);
  for(let k=0;k<=N;k++){ sxp[k]=sx0+m*XX[k]; dy[k]=-ZZ[k]*KZ; }
  const yT=function(k){ return cy-H/2+dy[k]; };
  const yB=function(k){ return cy+H/2+dy[k]; };
  /* ---- 1. 纸投在下层书页上的影 ---- */
  let xMax=-1e9, kMax=0, kLift=-1;
  for(let k=0;k<=N;k++){
    if(sxp[k]>xMax){ xMax=sxp[k]; kMax=k; }
    if(kLift<0&&AN[k]>.10) kLift=k;
  }
  if(kLift>=0){
    const a=clamp(.40*Math.sin(Math.PI*q)+.05,0,.46);
    const wr=Math.min(78,W*.28);
    ctx.save();
    ctx.beginPath(); ctx.rect(sx0-W-.5,top-40,W*2+1,H+80); ctx.clip();
    const g=ctx.createLinearGradient(sx0+m*XX[kMax],0,sx0+m*XX[kMax]+m*wr,0);
    g.addColorStop(0,'rgba(0,0,0,'+a.toFixed(3)+')');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;
    ctx.fillRect(Math.min(sx0+m*XX[kMax],sx0+m*XX[kMax]+m*wr),top-30,wr,H+60);
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
  /* ---- 3. 内容条带 ---- */
  const ov=.6;
  for(let k=0;k<N;k++){
    const xA=sxp[k], xB=sxp[k+1], w=xB-xA;
    if(Math.abs(w)<.05) continue;
    const nm=(AN[k]+AN[k+1])/2;
    const isFront=(Math.cos(nm)*m)>0;
    const src=isFront?pageF:pageB;
    const mir=!isFront;
    const y0=(yT(k)+yT(k+1))/2, hh=H;
    const drawL=Math.min(xA,xB)-ov, drawW=Math.abs(w)+2*ov;
    if(!src){ ctx.fillStyle=paper; ctx.fillRect(drawL,y0,drawW,hh); continue; }
    const S=src.width, SH=src.height, sw=S/N;
    const grow=(ov/Math.max(.30,Math.abs(w)))*sw;
    const srcA=(mir?S-(k+1)*sw:k*sw)-grow;
    ctx.drawImage(src, srcA, 0, sw+2*grow, SH, drawL, y0, drawW, hh);
  }
  /* ---- 4. 连续着色（在折返点处分段，保证 x 单调）---- */
  let kr=N;
  for(let k=0;k<=N;k++){ if(Math.cos(AN[k])*m<0){ kr=k; break; } }
  const darkOf=function(k){
    const kk=clamp(k,0,N), A=AN[kk];
    const nz=Math.cos(A), bend=1-Math.abs(nz);
    const nl=clamp(.4205*Math.sin(A)+.841*Math.abs(nz),0,1);
    let d=.90*Math.pow(clamp(1-nl,0,1),1.30);
    d+=.16*Math.max(0,1-(kk/N)/.10)*bend;      /* 书脊侧的折痕 */
    return clamp(d,0,.72);
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
  /* ---- 5. 纸边高光 ---- */
  ctx.save();
  ctx.globalAlpha=.55;
  ctx.lineWidth=1.1;
  ctx.strokeStyle='rgba(255,253,246,.6)';
  ctx.beginPath();
  for(let k=0;k<=N;k++){ if(k===0) ctx.moveTo(sxp[k],yT(k)); else ctx.lineTo(sxp[k],yT(k)); }
  for(let k=N;k>=0;k--) ctx.lineTo(sxp[k],yB(k));
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
};'''

start = s.index("/* ---------- 翻页纸张：")
end = s.index("/* ---------- 交互 ---------- */")
s = s[:start] + NEW + "\n" + s[end:]
io.open(A, "w", encoding="utf-8", newline="\n").write(s)
print("ok, lines:", s.count("\n") + 1)
