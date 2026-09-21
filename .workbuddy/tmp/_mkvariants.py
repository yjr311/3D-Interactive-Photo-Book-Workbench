# -*- coding: utf-8 -*-
"""造两份"只坏一处"的产物，用来**隔离**九宫格矩形被改动的真实原因。

第十五轮同时改了四处，改前/改后一对比，九宫格的矩形从 255.8,21.8 变成了 352.6,184。
但"改前连渲 12 次是稳定的"，所以不能再说"平局由浮点噪声裁决" —— 那是我记下的一个**假设**，
没被实测支持。两个变量一起动，谁改了它？只能一个个回退。

  _tolon.html   只去掉 1e-6 容差（其余保持现状）
  _nointer.html 只去掉"与画框求交"（其余保持现状）
"""
import io

SRC = r'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html'
D = r'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/'
data = io.open(SRC, encoding='utf-8').read()


def variant(path, patches, expects_absent):
    out = data
    for old, new in patches:
        assert out.count(old) == 1, '锚点 %r 出现 %d 次' % (old[:50], out.count(old))
        cand = out.replace(old, new)
        assert cand != out, '替换没生效：%r' % old[:50]
        out = cand
    for s in expects_absent:
        assert s not in out, '残留 %r' % s
    assert out.count('function renderCanvas') == 1
    io.open(path, 'w', encoding='utf-8', newline='').write(out)
    print('%-58s %d -> %d' % (path.split('/')[-1], len(data), len(out)))


# 只回退容差：严格 > 回来，求交与 CTM 都留着
variant(D + '_tolon.html',
        [('l.dw*l.dh>f.dw*f.dh+1e-6', 'l.dw*l.dh>f.dw*f.dh'),
         ('o.dw*o.dh>f.dw*f.dh+1e-6', 'o.dw*o.dh>f.dw*f.dh')],
        ['+1e-6'])

# 只回退求交：paintPhoto 不裁掉 cover 溢出的那一圈，CTM 映射与容差都留着
# 压缩后形如： let d=c;if(c){...求交...}return rectThruM(d,l)
variant(D + '_nointer.html',
        [('let d=c;if(c){', 'let d=c;if(0){')],
        [])
