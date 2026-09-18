# -*- coding: utf-8 -*-
"""v6：抬升高度随落页进度渐进压平，避免后半程整页悬空。"""
import io

A = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/src/app.js"
s = io.open(A, encoding="utf-8").read()

OLD = """  const XX=new Float64Array(N+1), ZZ=new Float64Array(N+1);
  for(let k=0;k<N;k++){
    const aa=(AN[k]+AN[k+1])*.5;
    XX[k+1]=XX[k]+du*Math.cos(aa);
    ZZ[k+1]=ZZ[k]+du*Math.sin(aa);
  }
  const KZ=.52;                              /* 抬升投影系数：纸离桌的高度→屏幕位移 */"""
NEW = """  const XX=new Float64Array(N+1), RAWH=new Float64Array(N+1);
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
assert OLD in s
s = s.replace(OLD, NEW, 1)

io.open(A, "w", encoding="utf-8", newline="\n").write(s)
print("ok, lines:", s.count("\n") + 1)
