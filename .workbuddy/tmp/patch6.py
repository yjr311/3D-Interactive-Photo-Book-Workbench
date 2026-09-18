# -*- coding: utf-8 -*-
"""v4 翻页引擎：行进式卷曲 + 侧立处内容淡出 + 连续着色 + 纸边高光。"""
import io

A = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/src/app.js"
s = io.open(A, encoding="utf-8").read()

NEW = r'''/* ---------- 翻页纸张：行进式卷曲（traveling curl） ----------
   真实翻页不是“整页绕书脊旋转”——那样 90° 时整页侧立会塌成一条线。
   真正的形态是：纸面绝大部分仍然平贴，只有一条很短弧长的“卷曲带”
   从自由边出发、扫过整页、最后抵达书脊。
   任意时刻：卷曲带两侧的纸分别平贴在左右页上，中间是一段立起来的圆柱面。
   侧立处纸面几乎与视线平行，图文自然淡出，只留下纸的明暗与纸边高光。 */
BookView.prototype.drawSheet=function(ctx,i,p){
  const W=this.pw, H=this.ph, cy=this.cy, sx0=this.spineX, top=this.top;
  const mv=this.anim||this.live;
  const dir=(mv&&mv.dir)||'fwd';
  const isBack=(dir==='back');
  const m=isBack?-1:1;                       /* back 时自由边朝左 */
  const q=clamp(isBack?1-p:p,0,1);           /* 0=贴合本侧  1=完全翻到另一侧 */
  const pageF=this.sheetFront(i), pageB=this.sheetBack(i);
  const N=this.N, du=W/N;
  const lam=W*(.34-(this.bowBoost||0)*.10);  /* 卷曲带弧长 */
  const c=W+lam/2-q*(W+lam);                 /* 卷曲带中心（纸面弧长坐标） */
  const ss=function(t){ t=clamp(t,0,1); return t*t*(3-2*t); };
  const AN=new Float64Array(N+1), XX=new Float64Array(N+1), CC=new Float64Array(N+1);
  for(let k=0;k<=N;k++) AN[k]=Math.PI*ss((k*du-(c-lam/2))/lam);
  for(let k=0;k<N;k++){
    const aa=(AN[k]+AN[k+1])*.5;
    XX[k+1]=XX[k]+du*Math.cos(aa);
    CC[k+1]=CC[k]+du*Math.sin(aa);
  }
  const D=this.D;
  const sxp=new Float64Array(N+1), fz=new Float64Array(N+1);
  for(let k=0;k<=N;k++){
    const f=clamp(D/Math.max(140,D-1.15*CC[k]),1,1.26);
    fz[k]=f; sxp[k]=sx0+m*XX[k]*f;
  }
  const paper=state.book.paper||'#fffdf8';
  let kA=-1,kB=-1;
  for(let k=0;k<=N;k++){ if(AN[k]>.22&&AN[k]<Math.PI-.22){ if(kA<0)kA=k; kB=k; } }
  /* ---- 1. 卷曲带投在下层书页上的投影（柔和渐变，无硬边）---- */
  if(kA>=0&&kB>kA){
    const x1=Math.min(sxp[kA],sxp[kB]), x2=Math.max(sxp[kA],sxp[kB]);
    const a=clamp(.36*Math.sin(Math.PI*q)+.05,0,.44);
    const wR=Math.min(70,W*.24), wL=Math.min(48,W*.17);
    ctx.save();
    ctx.beginPath(); ctx.rect(sx0-W-.5,top-3,W*2+1,H+6); ctx.clip();
    let g=ctx.createLinearGradient(x2,0,x2+wR,0);
    g.addColorStop(0,'rgba(0,0,0,'+a.toFixed(3)+')');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(x2,top+4,wR,H-8);
    g=ctx.createLinearGradient(x1,0,x1-wL,0);
    g.addColorStop(0,'rgba(0,0,0,'+(a*.7).toFixed(3)+')');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(x1-wL,top+4,wL,H-8);
    ctx.restore();
  }
  /* ---- 2. 剪影：纸面底色 + 裁剪 ---- */
  const trace=function(){
    ctx.beginPath();
    for(let k=0;k<=N;k++){ const y=cy-H*fz[k]/2; if(k===0) ctx.moveTo(sxp[k],y); else ctx.lineTo(sxp[k],y); }
    for(let k=N;k>=0;k--) ctx.lineTo(sxp[k],cy+H*fz[k]/2);
    ctx.closePath();
  };
  trace();
  ctx.save();
  ctx.fillStyle=paper; ctx.fill();
  ctx.clip();
  /* ---- 3. 内容条带：越接近侧立，图文越淡 ---- */
  const ov=.6;
  for(let k=0;k<N;k++){
    const xA=sxp[k], xB=sxp[k+1], w=xB-xA;
    const nm=(AN[k]+AN[k+1])/2;
    const facing=Math.abs(Math.cos(nm));
    let aC=clamp((facing-.16)/(.60-.16),0,1); aC=aC*aC*(3-2*aC);
    if(aC<.005) continue;
    const fmid=(fz[k]+fz[k+1])/2;
    const yTop=cy-H*fmid/2, hh=H*fmid;
    const isFront=(Math.cos(nm)*m)>0;
    const src=isFront?pageF:pageB;
    const mir=!isFront;
    const drawL=Math.min(xA,xB)-ov, drawW=Math.abs(w)+2*ov;
    if(!src){ ctx.fillStyle=paper; ctx.fillRect(drawL,yTop,drawW,hh); continue; }
    if(Math.abs(w)<.05) continue;
    const S=src.width, SH=src.height, sw=S/N;
    const grow=(ov/Math.max(.30,Math.abs(w)))*sw;
    const srcA=(mir?S-(k+1)*sw:k*sw)-grow;
    ctx.globalAlpha=aC;
    ctx.drawImage(src, srcA, 0, sw+2*grow, SH, drawL, yTop, drawW, hh);
    ctx.globalAlpha=1;
  }
  /* ---- 4. 连续着色（分段渐变，覆盖平贴区与卷曲带）---- */
  const darkOf=function(k){
    const kk=clamp(k,0,N), A=AN[kk];
    const nz=Math.cos(A), bend=1-Math.abs(nz);
    const nl=clamp(.4205*Math.sin(A)+.841*Math.abs(nz),0,1);   /* 可见面法线 · 光源 */
    let d=.92*Math.pow(clamp(1-nl,0,1),1.35);
    d+=.13*Math.max(0,1-(kk/N)/.085)*bend;                     /* 书脊侧折痕 */
    return clamp(d,0,.70);
  };
  let kr=N;
  for(let k=0;k<=N;k++){ if(Math.cos(AN[k])*m<0){ kr=k; break; } }
  const shade=function(k0,k1){
    if(k1-k0<1) return;
    const xA=sxp[k0], xB=sxp[k1];
    if(Math.abs(xB-xA)<1.2) return;
    const g=ctx.createLinearGradient(xA,0,xB,0);
    for(let k=k0;k<=k1;k++) g.addColorStop(clamp((sxp[k]-xA)/(xB-xA),0,1),'rgba(8,7,6,'+darkOf(k).toFixed(3)+')');
    ctx.fillStyle=g;
    ctx.fillRect(Math.min(xA,xB)-1,cy-H,Math.abs(xB-xA)+2,H*2);
  };
  shade(0,kr); shade(kr,N);
  /* ---- 5. 卷曲带迎光侧的一道柔光 ---- */
  if(kA>=0&&kB>kA){
    let kc=kA;
    for(let k=kA;k<=kB;k++) if(Math.abs(AN[k]-Math.PI/2)<Math.abs(AN[kc]-Math.PI/2)) kc=k;
    const xc=sxp[kc], rw=Math.max(16,W*.075);
    const g=ctx.createLinearGradient(xc-rw,0,xc+rw,0);
    g.addColorStop(0,'rgba(255,255,255,0)');
    g.addColorStop(.45,'rgba(255,252,242,.30)');
    g.addColorStop(1,'rgba(255,255,255,0)');
    ctx.fillStyle=g;
    ctx.fillRect(xc-rw,cy-H,rw*2,H*2);
  }
  ctx.restore();
  /* ---- 6. 纸边：一圈极淡的高光，读出纸张厚度 ---- */
  ctx.save();
  ctx.globalAlpha=.5;
  ctx.lineWidth=1.1;
  ctx.strokeStyle='rgba(255,253,246,.55)';
  trace(); ctx.stroke();
  ctx.restore();
};'''

start = s.index("/* ---------- 翻页纸张：行进式卷曲")
end = s.index("/* ---------- 交互 ---------- */")
s = s[:start] + NEW + "\n" + s[end:]
io.open(A, "w", encoding="utf-8", newline="\n").write(s)
print("ok, lines:", s.count("\n") + 1)
