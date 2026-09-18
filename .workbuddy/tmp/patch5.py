# -*- coding: utf-8 -*-
"""v3：消除图层接缝 + 柔和投影 + 更强透视 + 卷曲带高光。"""
import io

A = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/src/app.js"
s = io.open(A, encoding="utf-8").read()

# ---- 1. flatPage：去掉与书脊阴影重复的渐变，避免与纸面副本产生接缝 ----
OLD_FLAT = """  const g=ctx.createLinearGradient(side==='l'?x+w-34:x,0,side==='l'?x+w:x+34,0);
  g.addColorStop(0,'rgba(0,0,0,.20)');
  g.addColorStop(1,'rgba(0,0,0,0)');
  ctx.save(); ctx.fillStyle=g;
  ctx.fillRect(side==='l'?x+w-34:x,y,34,h);
  ctx.restore();
  if(k===0&&this.cur===0){ /* 封面态：外缘更亮一点 */ }
};"""
NEW_FLAT = """  /* 书脊阴影统一在 drawSheet 之后统一画，避免纸面副本出现接缝 */
};"""
assert OLD_FLAT in s
s = s.replace(OLD_FLAT, NEW_FLAT, 1)

# ---- 2. draw()：把「书脊阴影」挪到翻动纸之后 ----
OLD_SPINE = """  /* 书脊阴影 */
  if(spread&&(under.l>=0||moving)){
    const g=ctx.createLinearGradient(spineX-30,0,spineX+30,0);
    g.addColorStop(0,'rgba(0,0,0,0)');
    g.addColorStop(.44,'rgba(0,0,0,.30)');
    g.addColorStop(.5,'rgba(0,0,0,.42)');
    g.addColorStop(.56,'rgba(0,0,0,.30)');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.save(); ctx.fillStyle=g;
    ctx.fillRect(spineX-30,top,60,ph);
    ctx.restore();
  }
  /* 翻动中的纸张 */
  if(moving) this.drawSheet(ctx,moving.i,moving.p);"""
NEW_SPINE = """  /* 翻动中的纸张 */
  if(moving) this.drawSheet(ctx,moving.i,moving.p);
  /* 书脊阴影：压在整本书之上（含翻动纸），保证两侧一致 */
  if(spread){
    const g=ctx.createLinearGradient(spineX-46,0,spineX+46,0);
    g.addColorStop(0,'rgba(0,0,0,0)');
    g.addColorStop(.40,'rgba(0,0,0,.22)');
    g.addColorStop(.5,'rgba(0,0,0,.34)');
    g.addColorStop(.60,'rgba(0,0,0,.22)');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.save(); ctx.fillStyle=g;
    ctx.fillRect(spineX-46,top,92,ph);
    ctx.restore();
  }"""
assert OLD_SPINE in s
s = s.replace(OLD_SPINE, NEW_SPINE, 1)

# ---- 3. 透视：更强 ----
s = s.replace("this.D=Math.max(700,pw*3.2);", "this.D=Math.max(300,pw*1.05);", 1)
s = s.replace("  const D=this.D, K=.90;", "  const D=this.D, K=1.15;", 1)

# ---- 4. 柔和投影替换硬边矩形 ----
OLD_SH = """  if(kA>=0&&kB>kA){
    const x1=Math.min(sxp[kA],sxp[kB]), x2=Math.max(sxp[kA],sxp[kB]);
    ctx.save();
    if(this.filterOK) ctx.filter='blur(19px)';
    ctx.globalAlpha=clamp(.30*Math.sin(Math.PI*q)+.05,0,.42);
    ctx.fillStyle='#000';
    ctx.fillRect(Math.max(sx0-W,x1-4)+17, top+6, Math.min(W*2,x2-x1+8), H-12);
    ctx.restore();
  }"""
NEW_SH = """  if(kA>=0&&kB>kA){
    const x1=Math.min(sxp[kA],sxp[kB]), x2=Math.max(sxp[kA],sxp[kB]);
    const a=clamp(.34*Math.sin(Math.PI*q)+.05,0,.42);
    ctx.save();
    ctx.beginPath(); ctx.rect(sx0-W-.5,top-2,W*2+1,H+4); ctx.clip();
    let g=ctx.createLinearGradient(x2,0,x2+Math.min(64,W*.22),0);
    g.addColorStop(0,'rgba(0,0,0,'+a.toFixed(3)+')');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(x2,top+3,Math.min(64,W*.22),H-6);
    g=ctx.createLinearGradient(x1,0,x1-Math.min(46,W*.16),0);
    g.addColorStop(0,'rgba(0,0,0,'+(a*.75).toFixed(3)+')');
    g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g; ctx.fillRect(x1-Math.min(46,W*.16),top+3,Math.min(46,W*.16),H-6);
    ctx.restore();
  }"""
assert OLD_SH in s
s = s.replace(OLD_SH, NEW_SH, 1)

# ---- 5. 着色：平贴处完全不着色 ----
s = s.replace("let d=.035+.60*Math.pow(bend,1.12);",
              "let d=.62*Math.pow(bend,1.15);", 1)
s = s.replace("if(nz*m<0) d=d*.82+.015;", "if(nz*m<0) d*=.86;", 1)

io.open(A, "w", encoding="utf-8", newline="\n").write(s)
print("ok, lines:", s.count("\n") + 1)
