# -*- coding: utf-8 -*-
"""造一个"退回旧 plateHasText"的产物，用来做反向对照：
   证明新加的守卫（N21/N25/B30）真的能抓住那个 bug，而不是永远放行。"""
import io, re
src = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html"
dst = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/_old_cap.html"
h = io.open(src, encoding="utf-8").read()
pat = re.compile(r'function plateHasText\(t\)\{if\("tpl"!==artMode\(\)\)return!1;.*?some\(function\(t\)\{return e\(t\)===n\}\)\}')
new = 'function plateHasText(t){return"tpl"===artMode()&&!!String(t&&t.title||"").replace(/[\s]/g,"")}'
hh, n = pat.subn(lambda m: new, h)   # lambda 避开 re 模板对 \s 的转义解析
assert n == 1, "replace count = %d (expect 1)" % n
io.open(dst, "w", encoding="utf-8", newline="\n").write(hh)
print("ok replaced %d, wrote %s (%d bytes, orig %d)" % (n, dst, len(hh), len(h)))
