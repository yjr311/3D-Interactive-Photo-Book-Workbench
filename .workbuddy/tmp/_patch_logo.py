# -*- coding: utf-8 -*-
"""把顶栏图标 + favicon 从「几何方块挖空」换成「手绘小书」（第十一轮定稿的姿态/配色）。
只改 src/head.html 三处；改完必须重新 build。"""
import base64, io, os, re, sys

TMP = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
HEAD = os.path.join(TMP, "src/head.html")

# ---- 几何：48 网格。已在 _scale.py 里放过 1.055×1.17（视觉分量对齐）并下移 1.05 居中 ----
OPEN = ('M4.69 12.42C11.66 10.55 19.25 12.42 24 16.16C28.75 12.18 36.34 10.43 43.31 12.07'
        'C44.15 17.68 43.94 26.22 42.57 31.72C35.82 32.19 28.75 33.95 24 35.35'
        'C19.15 33.83 12.08 32.42 5.33 31.25C3.53 24.94 3.85 17.1 4.69 12.42Z')
PL = 'M9.86 21.19C13.24 20.26 16.51 20.61 19.15 21.54'
PR = 'M28.85 21.54C31.49 20.61 34.76 20.26 38.14 21.19'
GUT = 'M24 17.21C23.58 22.71 23.58 28.91 24 34.76'

INK = '#4a2708'      # 描边：深暖棕，不是纯黑（参考图 lum≈60）
FA, FB = '#eec9a4', '#d7a578'   # 填充：上浅下深（参考图 lum≈176）
SW, IW = 3.4, 1.9    # 描边 7.1% / 页线；中缝单独 2.6@.95（16px 才读得出是"摊开的书"）
TILT = -13


def logo_svg(gid, cid, xmlns=False):
    """生成图标。xmlns 供 favicon 那个独立文档用。"""
    x = ' xmlns="http://www.w3.org/2000/svg"' if xmlns else ''
    return (
        f'<svg{x} viewBox="0 0 48 48">'
        f'<defs>'
        f'<linearGradient id="{gid}" x1="0" y1="0" x2=".25" y2="1">'
        f'<stop offset="0" stop-color="{FA}"/><stop offset="1" stop-color="{FB}"/></linearGradient>'
        f'<clipPath id="{cid}"><path d="{OPEN}" transform="translate(0 1.05)"/></clipPath>'
        f'</defs>'
        f'<g transform="rotate({TILT} 24 24)"><g transform="translate(0 1.05)">'
        f'<path d="{OPEN}" fill="url(#{gid})" stroke="{INK}" stroke-width="{SW}" '
        f'stroke-linejoin="round" stroke-linecap="round"/>'
        # 铅笔"描两遍"的轻微错位，给一点手绘毛感（大尺寸可见，小尺寸只是略厚）
        f'<g clip-path="url(#{cid})">'
        f'<path d="{OPEN}" fill="none" stroke="{INK}" stroke-width="1.1" opacity=".26" '
        f'transform="translate(.55 -.6)"/></g>'
        f'<g stroke="{INK}" stroke-width="{IW}" stroke-linecap="round" fill="none" opacity=".5">'
        f'<path d="{PL}"/><path d="{PR}"/></g>'
        f'<path d="{GUT}" stroke="{INK}" stroke-width="2.6" stroke-linecap="round" '
        f'fill="none" opacity=".95"/>'
        f'</g></g></svg>')


def sub(s, old, new, what, times=1):
    n = s.count(old)
    assert n == times, f'{what}: 命中 {n} 次，期望 {times} 次'
    return s.replace(old, new)


def main():
    s = io.open(HEAD, encoding='utf-8').read()
    orig_len = len(s)

    # ---- ① favicon（data-URI，免 href 转义坑）----
    fav_uri = ('data:image/svg+xml;base64,'
               + base64.b64encode(logo_svg('kfAV', 'kfAC', xmlns=True).encode('utf-8')).decode('ascii'))
    m = re.search(r'<link rel="icon" href="[^"]*">', s)
    assert m, 'favicon 那行没找到'
    s = s[:m.start()] + f'<link rel="icon" href="{fav_uri}">' + s[m.end():]
    print('favicon uri 长度', len(fav_uri))

    # ---- ② 顶栏 svg ----
    m = re.search(r'<svg class="logo"[^>]*>.*?</svg>', s, re.S)
    assert m, '顶栏 <svg class="logo"> 没找到'
    new_svg = logo_svg('kadaLogoG', 'kadaLogoC').replace(
        '<svg ', '<svg class="logo" aria-hidden="true" ', 1)
    s = s[:m.start()] + new_svg + s[m.end():]
    print('顶栏 svg 长度', len(new_svg))

    # ---- ③ CSS：琥珀光晕配棕色贴纸有点冲，换成中性投影 ----
    s = sub(s,
            '.brand .logo{width:29px;height:29px;display:block;flex:none;color:var(--accent);',
            '.brand .logo{width:29px;height:29px;display:block;flex:none;',
            'CSS color:var(--accent)')
    s = sub(s,
            'filter:drop-shadow(0 5px 15px var(--glow));}',
            'filter:drop-shadow(0 2px 5px rgba(0,0,0,.34));}',
            'CSS drop-shadow')

    io.open(HEAD, 'w', encoding='utf-8', newline='\n').write(s)
    print('head.html %d → %d 字符 (+%d)' % (orig_len, len(s), len(s) - orig_len))
    return 0


if __name__ == '__main__':
    sys.exit(main())
