# -*- coding: utf-8 -*-
"""合并后的方案页还有三处标题写着"待定夺"的口径，改成"定稿"。

用的是逐条精确字面量替换 + 命中次数断言（不是正则跨区间），
因为上一次用 [\s\S]*? 跨区间匹配，把中间要保留的内容整段丢了。
"""
import io, sys

P = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-LOGO方案.html"

EDITS = [
    ('<h2>一、主推方案 · 放在真实顶栏里（29px 实际尺寸）</h2>',
     '<h2>一、定稿方案 · 放在真实顶栏里（29px 实际尺寸）</h2>'),
    ('<h2>二、同一张图，三种姿态</h2>',
     '<h2>二、定稿过程：同一张图，三种姿态（最终取「倾斜 13°」）</h2>'),
    ('<h2>三、两种配色 · 参考图的暖棕 / 跟产品主色的琥珀</h2>',
     '<h2>三、两种配色（最终取「暖棕」）· 参考图的暖棕 / 跟产品主色的琥珀</h2>'),
]


def main():
    s = io.open(P, encoding='utf-8').read()
    before = len(s)
    for old, new in EDITS:
        n = s.count(old)
        assert n == 1, '锚点命中 %d 次（期望 1）：%s' % (n, old[:40])
        s = s.replace(old, new)
    assert len(s) == before + sum(len(a) - len(b) for b, a in EDITS), '长度对不上，可能有内容被吞'
    io.open(P, 'w', encoding='utf-8', newline='\n').write(s)
    print('ok', before, '→', len(s))
    return 0


if __name__ == '__main__':
    sys.exit(main())
