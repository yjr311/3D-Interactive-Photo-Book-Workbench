# -*- coding: utf-8 -*-
"""v8 收尾：短窗口保持固定布局 + 柔化翻页投影。"""
import io

H = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/src/head.html"
h = io.open(H, encoding="utf-8").read()

OLD = """@media(max-height:680px){
  body{overflow:auto}
  .app{height:auto;min-height:100dvh}
  .work{min-height:400px}
  :root{--dockH:152px}
}"""
NEW = """@media(max-height:720px){
  body{overflow:hidden}
  .app{height:100dvh;min-height:0}
  .work{min-height:0}
  :root{--dockH:clamp(118px,16.5vh,152px)}
}"""
assert OLD in h
h = h.replace(OLD, NEW, 1)
io.open(H, "w", encoding="utf-8", newline="\n").write(h)

A = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/src/app.js"
s = io.open(A, encoding="utf-8").read()
o = """    const a=clamp(.40*Math.sin(Math.PI*q)+.05,0,.46);
    const wr=Math.min(78,W*.28);"""
n = """    const a=clamp(.27*Math.sin(Math.PI*q)+.03,0,.33);
    const wr=Math.min(58,W*.20);"""
assert o in s
s = s.replace(o, n, 1)
io.open(A, "w", encoding="utf-8", newline="\n").write(s)
print("ok")
