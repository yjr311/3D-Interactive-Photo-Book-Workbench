# -*- coding: utf-8 -*-
"""v2 翻页引擎：行进式圆柱卷曲（旅行波）模型。"""
import io

P = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/src/app.js"
s = io.open(P, encoding="utf-8").read()

NEW = r'''/* ---------- 翻页纸张：行进式卷曲（traveling curl） ----------
   真实翻页不是“门绕书脊旋转”——那样 90° 时整页侧立会塌成一条线。
   真正的形态是：纸面绝大部分仍然平贴，只有一条几十度弧长的“卷曲带”
   从自由边出发、扫过整页、最后到达书脊。
   于是任意时刻：卷曲带右侧的纸平贴在右页，左侧的纸已经翻过去平贴在左页，
   中间是一条立起来的圆柱面——这正是所有人熟悉的翻页形态。 */
BookView.prototype.drawSheet=function(ctx,i,p){
  const W=this.pw, H=this.ph, cy=this.cy, sx0=this.spineX, top=this.top;
  const mv=this.anim||this.live;
  const dir=(mv&&mv.dir)||'fwd';
  const isBack=(dir==='back');
  const m=isBack?-1:1;                       /* 镜像：back 时自由边朝左 */
  const q=clamp(isBack?1-p:p,0,1);           /* 0=贴合本侧  1=完全翻到另一侧 */
  const pageF=this.sheetFront(i), pageB=this.sheetBack(i);
  const N=this.N, du=W/N;
  const lam=W*(.32-(this.bowBoost||0)*.10);  /* 卷曲带弧长 */
  const c=W+lam/2-q*(W+lam);                 /* 卷曲带中心（沿纸面弧长坐标） */
  const ss=function(t){ t=clamp(t,0,1); return t*t*(3-2*t); };
  const AN=new Float64Array(N+1), XX=new Float64Array(N+1), CC=new Float64Array(N+1);
  for(let k=0;k<=N;k++) AN[k]=Math.PI*ss((k*du-(c-lam/2))/lam);
  for(let k=0;k<N;k++){
    const aa=(AN[k]+AN[k+1])*.5;
    XX[k+1]=XX[k]+du*Math.cos(aa);
    CC[k+1]=CC[k]+du*Math.sin(aa);
  }
  const D=this.D, K=.90;
  const sxp=new Float64Array(N+1), fz=new Float64Array(N+1);
  for(let k=0;k<=N;k++){
    const f=D/Math.max(120,D-K*CC[k]);
    fz[k]=f; sxp[k]=sx0+m*XX[k]*f;
  }
  /* ---- 1. 卷曲带投在下层书页上的阴影 ---- */
  let kA=-1,kB=-1;
  for(let k=0;k<=N;k++){ if(AN[k]>.26&&AN[k]<Math.PI-.26){ if(kA<0)kA=k; kB=k; } }
  if(kA>=0&&kB>kA){
    const x1=Math.min(sxp[kA],sxp[kB]), x2=Math.max(sxp[kA],sxp[kB]);
    ctx.save();
    if(this.filterOK) ctx.filter='blur(19px)';
    ctx.globalAlpha=clamp(.30*Math.sin(Math.PI*q)+.05,0,.42);
    ctx.fillStyle='#000';
    ctx.fillRect(Math.max(sx0-W,x1-4)+17, top+6, Math.min(W*2,x2-x1+8), H-12);
    ctx.restore();
  }
  /* ---- 2. 剪影底色（上下边缘为平滑曲线）---- */
  const paper=state.book.paper||'#fffdf8';
  ctx.beginPath();
  for(let k=0;k<=N;k++){ const y=cy-H*fz[k]/2; if(k===0) ctx.moveTo(sxp[k],y); else ctx.lineTo(sxp[k],y); }
  for(let k=N;k>=0;k--) ctx.lineTo(sxp[k],cy+H*fz[k]/2);
  ctx.closePath();
  ctx.save();
  ctx.fillStyle=paper; ctx.fill();
  ctx.clip();
  /* ---- 3. 内容条带 ---- */
  const ov=.6;
  for(let k=0;k<N;k++){
    const xA=sxp[k], xB=sxp[k+1], w=xB-xA;
    if(Math.abs(w)<.04) continue;
    const fmid=(fz[k]+fz[k+1])/2;
    const yTop=cy-H*fmid/2, hh=H*fmid;
    const nm=(AN[k]+AN[k+1])/2;
    const isFront=(Math.cos(nm)*m)>0;        /* 正面朝向观察者 */
    const src=isFront?pageF:pageB;
    const mir=!isFront;                      /* 左页的图文要左右镜像采样 */
    const drawL=Math.min(xA,xB)-ov, drawW=Math.abs(w)+2*ov;
    if(!src){ ctx.fillStyle=paper; ctx.fillRect(drawL,yTop,drawW,hh); continue; }
    const S=src.width, SH=src.height, sw=S/N;
    const grow=(ov/Math.max(.25,Math.abs(w)))*sw;
    const srcA=(mir?S-(k+1)*sw:k*sw)-grow;
    ctx.drawImage(src, srcA, 0, sw+2*grow, SH, drawL, yTop, drawW, hh);
  }
  /* ---- 4. 分段渐变着色（连续，无瓦楞纹）---- */
  let kr=N;
  for(let k=0;k<=N;k++){ if(Math.cos(AN[k])*m<0){ kr=k; break; } }
  const shadeCol=function(k){
    const kk=clamp(k,0,N);
    const nz=Math.cos(AN[kk]), nx=-Math.sin(AN[kk])*m;
    const bend=1-Math.abs(nz);               /* 0=平贴  1=侧立 */
    const lit=clamp(nx*LIGHT[0]+Math.abs(nz)*LIGHT[1],0,1);
    let d=.035+.60*Math.pow(bend,1.12);
    d*=1-.36*lit;
    if(nz*m<0) d=d*.82+.015;                 /* 背面略亮一些 */
    const t=kk/N;
    d+=.17*Math.max(0,1-t/.10)*(1-Math.abs(Math.cos(AN[Math.min(kk+3,N)])));
    return 'rgba(10,8,6,'+clamp(d,0,.78).toFixed(3)+')';
  };
  const shade=function(k0,k1){
    if(k1-k0<1) return;
    const xA=sxp[k0], xB=sxp[k1];
    if(Math.abs(xB-xA)<1) return;
    const g=ctx.createLinearGradient(xA,0,xB,0);
    for(let k=k0;k<=k1;k++) g.addColorStop(clamp((sxp[k]-xA)/(xB-xA),0,1),shadeCol(k));
    ctx.fillStyle=g;
    ctx.fillRect(Math.min(xA,xB)-1,cy-H,Math.abs(xB-xA)+2,H*2);
  };
  shade(0,kr); shade(kr,N);
  /* ---- 5. 卷曲带的高光（光打在立起来的纸面上）---- */
  if(kA>=0&&kB>kA){
    const x1=Math.min(sxp[kA],sxp[kB]), x2=Math.max(sxp[kA],sxp[kB]);
    if(x2-x1>3){
      const gg=ctx.createLinearGradient(x1,0,x2,0);
      gg.addColorStop(0,'rgba(255,255,255,0)');
      gg.addColorStop(.46,'rgba(255,253,246,.26)');
      gg.addColorStop(.54,'rgba(255,253,246,.26)');
      gg.addColorStop(1,'rgba(255,255,255,0)');
      ctx.fillStyle=gg;
      ctx.fillRect(x1,cy-H,x2-x1,H*2);
    }
  }
  ctx.restore();
  /* ---- 6. 自由边纸厚 ---- */
  ctx.save();
  ctx.globalAlpha=.7;
  ctx.strokeStyle='rgba(255,251,240,.55)';
  ctx.lineWidth=1.5;
  ctx.beginPath();
  ctx.moveTo(sxp[N],cy-H*fz[N]/2+2);
  ctx.lineTo(sxp[N],cy+H*fz[N]/2-2);
  ctx.stroke();
  ctx.restore();
};'''

start = s.index("/* ---------- 翻页纸张：错峰转角")
end = s.index("/* ---------- 交互 ---------- */")
old = s[start:end]
assert "drawSheet" in old, "marker"
s = s[:start] + NEW + "\n" + s[end:]
io.open(P, "w", encoding="utf-8", newline="\n").write(s)
print("ok, lines:", s.count("\n") + 1)
