# -*- coding: utf-8 -*-
"""造一份「改前」产物：把 paintPhoto 里的 CTM 映射与"与画框求交"都还原回去，
   也就是第十五轮动手之前的样子。用来实测"修前到底是什么症状" ——
   凭记忆复述机制是靠不住的，得让旧代码自己说话。

   替换串把**匹配区间内所有要保留的内容**原样带回去（本项目正则补丁的老坑）：
   这里匹配区间是 `return rectThruM(d,l)}function renderCanvas`，
   替换成 `return c}function renderCanvas` —— `function renderCanvas` 必须带回去，
   否则后面整个 renderCanvas 的头就没了。"""
import io, os, sys

SRC = r'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html'
DST = r'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/_before.html'

data = io.open(SRC, encoding='utf-8').read()

# 三个补丁，逐条把第十五轮的四项机制还原掉。
PATCHES = [
    # ① CTM 映射 + 与画框求交（paintPhoto 直接返回 drawFit 的局部坐标）
    ('return rectThruM(d,l)}function renderCanvas', 'return c}function renderCanvas'),
    # ② "面积最大者胜"的 1e-6 容差（还原成严格 >，平局交给浮点噪声裁决）
    ('l.dw*l.dh>f.dw*f.dh+1e-6', 'l.dw*l.dh>f.dw*f.dh'),
    ('o.dw*o.dh>f.dw*f.dh+1e-6', 'o.dw*o.dh>f.dw*f.dh'),
    # ③ 双色的 c.declare(...) 申报（还原成"没人吭声"）
    ('t.declare(r,.1*a,n-2*r,.66*a),', ''),
]
out = data
for old, new in PATCHES:
    assert out.count(old) == 1, '锚点 %r 出现 %d 次，拒绝打补丁' % (old[:40], out.count(old))
    cand = out.replace(old, new)
    assert cand != out and len(cand) < len(out), '替换没生效：%r' % old[:40]
    out = cand
io.open(DST, 'w', encoding='utf-8', newline='').write(out)

# 值级校验：新串在、旧串不在、且 renderCanvas 的头还在
assert 'return rectThruM(d,l)}function renderCanvas' not in out
assert 'return c}function renderCanvas' in out
assert out.count('function renderCanvas') == 1
assert '+1e-6' not in out, '容差没还原干净'
assert 't.declare(' not in out, 'declare 调用没删干净'
print('written %s  %d -> %d bytes' % (DST, len(data), len(out)))
