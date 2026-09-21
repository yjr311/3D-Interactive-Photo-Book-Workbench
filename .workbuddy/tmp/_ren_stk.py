# -*- coding: utf-8 -*-
"""只把第十四轮新增块（486..662 行）里的临时变量 e1..e5 改名成 v1..v5，
避开后面 E 段（氛围音效）已经占用的 e1。逐行按词边界替换，不动别的行。"""
import io, re, sys

P = r"C:\Users\zz\WorkBuddy\2026-09-11-11-24-14\.workbuddy\tmp\test_batch2.mjs"
A, B = 486, 662          # 1-indexed，闭区间
src = io.open(P, encoding="utf-8").read().split("\n")
assert "if(bb.n" in src[A - 1 + 4] or True
head = src[A - 1][:40]
assert "const e1 = await ev(" in src[A - 1], "起始行不对: " + head
assert "B2-48" in "\n".join(src[A - 1:B]), "结尾行不对"

n = 0
for i in range(A - 1, B):
    before = src[i]
    for k in range(1, 6):
        src[i] = re.sub(r"\be%d\b" % k, "v%d" % k, src[i])
    if src[i] != before:
        n += 1

io.open(P, "w", encoding="utf-8", newline="").write("\n".join(src))
print("改名行数:", n)
