# -*- coding: utf-8 -*-
"""v7：明确「自由边领先 + 落页点内移」的角度剖面，并让抬升高度随落页归零。"""
import io

A = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/src/app.js"
s = io.open(A, encoding="utf-8").read()

OLD_A = """  const warm=(this.bowBoost||0);             /* 快速拖动时卷得更紧 */
  const c0=clamp(.86-warm*.6,.34,.90);
  const pe=clamp(1.75-warm*1.4,1.05,2.4);
  const cc=c0*(1-Math.pow(q,pe));
  const AN=new Float64Array(N+1);
  for(let k=0;k<=N;k++){
    const t=k/N;
    AN[k]=Math.PI*q*((1-cc)+cc*Math.pow(t,.70));
  }
  const XX=new Float64Array(N+1), RAWH=new Float64Array(N+1);
  for(let k=0;k<N;k++){
    const aa=(AN[k]+AN[k+1])*.5;
    XX[k+1]=XX[k]+du*Math.cos(aa);
    RAWH[k+1]=RAWH[k]+du*Math.sin(aa);
  }
  /* 落页：越到后半程，越靠自由边的那一段先被压回书面
     （纸真正铺到左页上，而不是整张悬在空中） */
  const tL=.52;
  const land=clamp((q-.46)/.42,0,1);
  const sm=function(t){ t=clamp(t,0,1); return t*t*(3-2*t); };
  const KZ=.55;                              /* 抬升投影系数：纸离桌高度 → 屏幕位移 */
  const ZZ=new Float64Array(N+1);
  for(let k=0;k<=N;k++){
    const t=k/N;
    ZZ[k]=RAWH[k]*(1-land*sm((t-tL)/(1-tL)));
  }"""

NEW_A = """  const warm=(this.bowBoost||0);             /* 快速拖动时卷得更紧 */
  const qL=clamp(.86-warm*.18,.55,.92);      /* 自由边落到左页的那个时刻 */
  const A1=Math.min(1,q/qL);                 /* 自由边的转角比例 */
  const lam=.86*(1-Math.pow(q,2.0));         /* 书脊一侧的滞后量，q→1 时归零 */
  const A0=A1*(1-lam);
  const tc=clamp(1-(q-qL)/(1-qL),0,1);       /* 落页点（纸面弧长坐标）：1→0 */
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
  const KZ=.46*(1-.30*q);                    /* 高度 → 屏幕位移的投影系数 */
  const ZZ=new Float64Array(N+1);
  if(tc<1-1e-6){
    const hc=RAWH[Math.max(0,Math.min(N,Math.round(tc*N)))];
    for(let k=0;k<=N;k++){
      const t=k/N;
      ZZ[k]= t>=tc ? 0 : Math.max(0,RAWH[k]-hc*sm(t/tc));
    }
  } else {
    for(let k=0;k<=N;k++) ZZ[k]=RAWH[k];
  }"""
assert OLD_A in s
s = s.replace(OLD_A, NEW_A, 1)

io.open(A, "w", encoding="utf-8", newline="\n").write(s)
print("ok, lines:", s.count("\n") + 1)
