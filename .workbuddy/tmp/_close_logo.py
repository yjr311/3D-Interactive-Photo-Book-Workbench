# -*- coding: utf-8 -*-
"""图标定稿收尾：
  ① 先把第十轮那份方案页（讲旧方块图标的）归档 —— 必须**先归档再覆写**，否则会被冲掉
  ② 把方案页里的预览注入属性洗掉（预览面板会给每个元素塞 data-page-node-id）
  ③ 把「待定夺」口径改成「已定稿并已落地」
  ④ 合并成唯一一份 咔哒书-LOGO方案.html
"""
import io, os, re, shutil, sys

ROOT = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14"
TMP = os.path.join(ROOT, ".workbuddy/tmp")
SRC = os.path.join(ROOT, "咔哒书-LOGO方案2.html")
CANON = os.path.join(ROOT, "咔哒书-LOGO方案.html")
ARCH = os.path.join(TMP, "_archive_咔哒书-LOGO方案-第十轮（旧方块图标）.html")


def sub(s, old, new, what, times=1):
    n = s.count(old)
    assert n == times, f'{what}: 命中 {n} 次，期望 {times} 次'
    return s.replace(old, new)


def main():
    # ① 先归档旧的（顺序不能反）
    assert os.path.exists(CANON), '第十轮那份不见了？'
    old = io.open(CANON, encoding='utf-8').read()
    # 归档前的防线：确认待归档的真是第十轮那份（讲「圆角方块 + 挖空的书」）
    # 注意不要拿「方块图标的 path 字面量」当判据 —— 那份是用 <rect> + JS 常量画的，
    # 页面里根本没有内联 path 文本（第一次就是这么误判、把脚本卡住的）。
    assert '一、主标 · 放进顶栏看实况' in old, '归档对象不像第十轮那份（找不到第一节标题）'
    assert '保留原来的「圆角方块 + 琥珀金」' in old, '归档对象不像第十轮那份（找不到方块口径）'
    shutil.move(CANON, ARCH)
    print('已归档 →', os.path.basename(ARCH), len(old), '字符')

    # ② 洗注入
    s = io.open(SRC, encoding='utf-8').read()
    n = len(re.findall(r' data-page-node-id="[^"]*"', s))
    s = re.sub(r' data-page-node-id="[^"]*"', '', s)
    print('洗掉预览注入属性', n, '个')

    # ③ 口径：待定夺 → 已定稿
    s = sub(s, 'KADA · 图标方案 2', 'KADA · 图标（已实施）', '标题小字')
    s = sub(s,
            '反推出笔宽、填充亮度和对比度，再照数值重画。</p>',
            '反推出笔宽、填充亮度和对比度，再照数值重画。\n'
            '<span style="display:inline-block;margin-top:12px;padding:9px 14px;border-radius:10px;'
            'background:rgba(240,166,60,.12);border:1px solid rgba(240,166,60,.34);color:#e8dcc6">'
            '<b style="color:var(--accent)">已实施</b> —— 定稿：<b>倾斜 13° ＋ 暖棕（参考图同色）</b>；'
            '顶栏与 favicon 都已换成这一份，回归 9 套件 / 303 项全绿。</span></p>',
            '行情说明')

    # ④ 第十节：待办 → 已办
    a = s.index('<h2>十、定稿后要动的地方</h2>')
    b = s.index('</div>\n\n<script>', a)
    new_ten = '''<h2>十、落地清单（已全部完成）</h2>
<div class="card" style="padding:6px 14px">
<table>
<tr><th>位置</th><th>改成</th><th>状态</th></tr>
<tr><td>顶栏图标 29px</td><td>手绘小书（本页矢量 · 倾斜 13° · 暖棕）</td><td><b style="color:#6cc7e8">已实施</b></td></tr>
<tr><td>favicon / 标签页</td><td>同一份矢量，内嵌 data-URI（仍是单文件离线）</td><td><b style="color:#6cc7e8">已实施</b></td></tr>
<tr><td>顶栏投影</td><td><code>0 5px 15px var(--glow)</code> → <code>0 2px 5px rgba(0,0,0,.34)</code><br>
  琥珀光晕配棕色实物感有点冲，换中性投影</td><td><b style="color:#6cc7e8">已实施</b></td></tr>
<tr><td>首屏 hero</td><td>不换 —— 首屏除顶栏外没有第二处品牌标志（核实过整屏截图）</td><td>无需动</td></tr>
</table>
<p style="font-size:12.5px;color:#b9b3a8;margin:12px 0 4px">
图标<b style="color:var(--accent)">自带暖棕、不跟强调色走</b>：换氛围皮肤时它固定不变，像一枚贴在界面上的实物贴纸。
这是刻意的 —— 品牌色如果是"当前皮肤色"，它就不成其为品牌色了。</p>
</div>
'''
    s = s[:a] + new_ten + s[b:]

    io.open(CANON, 'w', encoding='utf-8', newline='\n').write(s)
    print('写出', os.path.basename(CANON), len(s), '字符')
    return 0


if __name__ == '__main__':
    sys.exit(main())
