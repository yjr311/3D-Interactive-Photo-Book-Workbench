# -*- coding: utf-8 -*-
"""重写 drawSheet：分段渐变着色，消除条带瓦楞纹。"""
import io

P = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/src/app.js"
s = io.open(P, encoding="utf-8").read()
start = s.index("/* 弯曲的纸张")
end = s.index("\n};\n", start) + 4

NEW = r"""/* 弯曲的纸张：真实抬升 + 连续卷曲 + 分段渐变着色 */
BookView.prototype.drawSheet=function(ctx,i,p){
  const W=this.pw, H=this.ph, cy=this.cy, sx0=this.spineX, top=this.top;
  const front=this.sheetFront(i), back=this.sheetBack(i);
  const N=this.N, du=W/N;
  const th=Math.PI*p;
  const amp=Math.sin(Math.PI*p);
  const curl=(1.42+this.bowBoost)*Math.pow(amp,.85);
  const liftK=.13;
  const psi=function(u){
    const t=u/W;
    return th+curl*Math.pow(t,2.4);
  };
  const px=new Float64Array(N+1), pz=new Float64Array(N+1);
  let X=0,Z=0;
  for(let k=0;k<N;k++){
    const m=psi((k+.5)*du);
    X+=du*Math.cos(m); Z+=du*Math.sin(m);
    px[k+1]=X; pz[k+1]=Z;
  }
  const D=this.D, cap=Math.max(12,top-4);
  const sxp=new Float64Array(N+1), lift=new Float64Array(N+1);
  for(let k=0;k<=N;k++){
    const sc=D/Math.max(80,D-.87*pz[k]);
    sxp[k]=sx0+px[k]*sc;
    lift[k]=cap*Math.tanh(pz[k]*liftK/cap);
  }
  /* 折返点：psi 越过 90° 之后看到的是纸张背面 */
  let kr=N;
  for(let k=0;k<=N;k++){ if(Math.cos(psi(Math.min(k*du,W)))<0){ kr=k; break; } }
  const L0=LIGHT[0], L1=LIGHT[1], NA=.40+.72*.84;
  const alphaOf=function(k){
    const kk=Math.min(k,N-1);
    const u=(kk+.5)*du, m=psi(u);
    const nx=-Math.sin(m), nz=Math.cos(m);
    let dot=nx*L0+nz*L1;
    if(nz<0) dot=-dot;
    let a=clamp(1-(.40+.72*Math.max(0,dot))/NA,0,.74);
    const uu=u/W;
    const sp=uu<.12?Math.max(0,.30*(1-uu/.12)*(1-curl/2.8)):0;
    return Math.min(.84,a+sp*(1-a));
  };
  /* 落在下层书页上的投影 */
  const wide=(this.cur>0||p>.001)?2*W:W;
  ctx.save();
  ctx.beginPath(); ctx.rect(sx0-(wide>W?W:0),top-2,wide+4,H+4); ctx.clip();
  ctx.save();
  if(this.filterOK) ctx.filter='blur(15px)';
  ctx.globalAlpha=.32*amp;
  ctx.fillStyle='#000';
  ctx.beginPath();
  for(let k=0;k<=N;k++){
    const X0=sx0+px[k]+pz[k]*.22, Y0=cy-H/2+pz[k]*.30;
    if(k===0) ctx.moveTo(X0,Y0); else ctx.lineTo(X0,Y0);
  }
  for(let k=N;k>=0;k--) ctx.lineTo(sx0+px[k]+pz[k]*.22,cy+H/2+pz[k]*.30);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  /* 条带内容（含 0.45px 搭接，避免出现白色缝线） */
  const ov=.45;
  const drawRange=function(k0,k1){
    for(let k=k0;k<k1;k++){
      const xa=sxp[k], xb=sxp[k+1];
      const w=xb-xa;
      if(Math.abs(w)<.03) continue;
      const lf=(lift[k]+lift[k+1])/2;
      const dy=cy-H/2+lf;
      const src=w>=0?front:back;
      if(src){
        const S=src.width, SH=src.height, sw=S/N;
        const kx=sw/Math.max(.25,Math.abs(w));
        let sx0s=w>=0?(k*sw-ov*kx):((N-1-k)*sw-ov*kx);
        const sws=sw+2*ov*kx;
        const dxs=Math.min(xa,xb)-ov;
        const dws=Math.abs(w)+2*ov;
        ctx.drawImage(src,sx0s,0,sws,SH,dxs,dy,dws,H);
      } else {
        ctx.fillStyle=state.book.paper||'#fffdf8';
        ctx.fillRect(Math.min(xa,xb)-ov,dy,Math.abs(w)+2*ov,H);
      }
    }
  };
  const shadeRange=function(k0,k1){
    if(k1-k0<1) return;
    const xA=sxp[k0], xB=sxp[k1];
    if(Math.abs(xB-xA)<.8) return;
    const g=ctx.createLinearGradient(xA,0,xB,0);
    for(let k=k0;k<=k1;k++){
      const t=(sxp[k]-xA)/(xB-xA);
      g.addColorStop(clamp(t,0,1),'rgba(8,7,6,'+alphaOf(k).toFixed(3)+')');
    }
    ctx.save();
    ctx.beginPath();
    for(let k=k0;k<=k1;k++){
      const x=sxp[k], y=cy-H/2+lift[k];
      if(k===k0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    for(let k=k1;k>=k0;k--) ctx.lineTo(sxp[k],cy+H/2+lift[k]);
    ctx.closePath();
    ctx.fillStyle=g;
    ctx.fill();
    ctx.restore();
  };
  drawRange(0,kr); shadeRange(0,kr);
  drawRange(kr,N); shadeRange(kr,N);
};
"""

s = s[:start] + NEW + s[end:]
io.open(P, "w", encoding="utf-8", newline="\n").write(s)
print("ok, lines:", s.count("\n") + 1)
