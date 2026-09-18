# -*- coding: utf-8 -*-
"""用新版 drawSheet 替换旧实现（整函数替换，避免片段匹配问题）。"""
import io, re

P = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/src/app.js"
s = io.open(P, encoding="utf-8").read()

start = s.index("BookView.prototype.drawSheet=function")
end = s.index("\n};\n", start) + 4

NEW = r"""/* 弯曲的纸张：真实抬升 + 连续卷曲 + 逐条带投影 */
BookView.prototype.drawSheet=function(ctx,i,p){
  const W=this.pw, H=this.ph, cy=this.cy, sx0=this.spineX, top=this.top;
  const front=this.sheetFront(i), back=this.sheetBack(i);
  const N=this.N, du=W/N;
  const th=Math.PI*p;
  const amp=Math.sin(Math.PI*p);
  /* 卷曲量中段最大；t^2.4 让“靠书脊处仍贴平、外缘先卷起” */
  const curl=(1.42+this.bowBoost)*Math.pow(amp,.85);
  const liftK=.34;
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
    const s=D/Math.max(80,D-.87*pz[k]);
    sxp[k]=sx0+px[k]*s;
    lift[k]=cap*Math.tanh(pz[k]*liftK/cap);
  }
  const wide=(this.cur>0||p>.001)?2*W:W;
  /* 落在下层书页上的投影（随抬升向右下漂移、扩大） */
  ctx.save();
  ctx.beginPath(); ctx.rect(sx0-(wide>W?W:0),top-2,wide+4,H+4); ctx.clip();
  ctx.save();
  if(this.filterOK) ctx.filter='blur(15px)';
  ctx.globalAlpha=.34*amp;
  ctx.fillStyle='#000';
  ctx.beginPath();
  for(let k=0;k<=N;k++){
    const X0=sx0+px[k]+pz[k]*.30, Y0=cy-H/2+pz[k]*.44;
    if(k===0) ctx.moveTo(X0,Y0); else ctx.lineTo(X0,Y0);
  }
  for(let k=N;k>=0;k--) ctx.lineTo(sx0+px[k]+pz[k]*.30,cy+H/2+pz[k]*.44);
  ctx.closePath(); ctx.fill();
  ctx.restore();
  ctx.restore();
  /* 纸张本体 */
  const L0=LIGHT[0], L1=LIGHT[1], NA=.34+.72*.84;
  for(let k=0;k<N;k++){
    const xa=sxp[k], xb=sxp[k+1];
    const w=xb-xa;
    if(Math.abs(w)<.02) continue;
    const lf=(lift[k]+lift[k+1])/2;
    const dy=cy-H/2+lf;
    const src=w>=0?front:back;
    if(src){
      const S=src.width, SH=src.height, sw=S/N;
      if(w>=0) ctx.drawImage(src,(k*S)/N,0,sw,SH,xa,dy,w,H);
      else ctx.drawImage(src,((N-1-k)*S)/N,0,sw,SH,xb,dy,-w,H);
    } else {
      ctx.fillStyle=state.book.paper||'#fffdf8';
      ctx.fillRect(Math.min(xa,xb),dy,Math.abs(w),H);
    }
    /* 明暗：弯折朝向 + 靠书脊的暗部 */
    const u=(k+.5)*du, m=psi(u);
    const nx=-Math.sin(m), nz=Math.cos(m);
    let dot=nx*L0+nz*L1;
    if(w<0) dot=-dot;
    let a=clamp(1-(.34+.72*Math.max(0,dot))/NA,0,.78);
    const uu=u/W;
    const spine=uu<.12?Math.max(0,.34*(1-uu/.12)*(1-curl/2.6)):0;
    a=Math.min(.86,a+spine*(1-a));
    if(a>.004){
      ctx.fillStyle='rgba(8,7,6,'+a.toFixed(3)+')';
      ctx.fillRect(Math.min(xa,xb),dy,Math.abs(w)+.6,H);
    }
  }
};
"""

s = s[:start] + NEW + s[end:]
io.open(P, "w", encoding="utf-8", newline="\n").write(s)
print("drawSheet replaced; file lines:", s.count("\n") + 1)
