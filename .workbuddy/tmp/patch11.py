# -*- coding: utf-8 -*-
"""v9：让书在舞台里更大一些（同时给鼠标悬浮的 3D 倾斜留出余量）。"""
import io
A=r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/src/app.js"
s=io.open(A,encoding="utf-8").read()
o="""  const padX=this.spread?44:20, padTop=24, padBot=16;
  let ph=Math.max(180,(this.ch-padTop-padBot)/1.10);"""
n="""  const padX=this.spread?30:16, padTop=18, padBot=12;
  let ph=Math.max(160,(this.ch-padTop-padBot)/1.04);"""
assert o in s
s=s.replace(o,n,1)
o2="  this.top=padTop+ph*.1;"
n2="  this.top=padTop+ph*.085;"
assert o2 in s
s=s.replace(o2,n2,1)
io.open(A,"w",encoding="utf-8",newline="\n").write(s)
print("ok")
