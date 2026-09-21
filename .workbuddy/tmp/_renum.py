# -*- coding: utf-8 -*-
"""把 test_batch2.mjs 里的 'B2-N ...' 标签按出现顺序重新编号。

为什么要脚本化：手写编号在插入/删除断言之后必然错位（上一轮就出现过
两个 B2-19、以及总数与最大编号对不上）。编号只是给人看的，
但"对不上"会直接毁掉它的作用 —— 失败时没法说"第 37 条挂了"。
"""
import io, re

P = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/test_batch2.mjs"
src = io.open(P, encoding="utf-8").read()

n = [0]
def bump(m):
    n[0] += 1
    return "'B2-%d " % n[0]

out = re.sub(r"'B2-\d+ ", bump, src)
io.open(P, "w", encoding="utf-8", newline="\n").write(out)
print("renumbered:", n[0], "labels")
