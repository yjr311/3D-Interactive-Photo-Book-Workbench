"""把候选图标换进真实产物的顶栏，生成若干预览 html。
不改产物本身；每个候选写一份临时副本来截图。"""
import io, os, re, sys

TMP = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html"
OUT = os.path.join(TMP, "logo")

INK = '#4a2708'; FILLA = '#eec9a4'; FILLB = '#d7a578'; SPARK = '#ef9f2e'
SW = 3.4; IW = 1.9

OPEN = ('M5.7 14.1C12.3 12.5 19.5 14.1 24 17.3C28.5 13.9 35.7 12.4 42.3 13.8'
        'C43.1 18.6 42.9 25.9 41.6 30.6C35.2 31 28.5 32.5 24 33.7'
        'C19.4 32.4 12.7 31.2 6.3 30.2C4.6 24.8 4.9 18.1 5.7 14.1Z')
PAGE_L = 'M10.6 21.6C13.8 20.8 16.9 21.1 19.4 21.9'
PAGE_R = 'M28.6 21.9C31.1 21.1 34.2 20.8 37.4 21.6'
GUT = 'M24 18.2C23.6 22.9 23.6 28.2 24 33.2'
SPARKS = ('M37.4 4.6C38.9 7.6 40.6 8.8 43.6 9.4C40.6 10 38.9 11.2 37.4 14.2'
          'C35.9 11.2 34.2 10 31.2 9.4C34.2 8.8 35.9 7.6 37.4 4.6Z')

ALBUM = ('M14.2 15.6C22 13.6 31.4 13.9 37.6 16C38.6 22.6 38.6 29.6 37.2 35.8'
         'C30.4 37.8 21.2 37.6 14.9 35.4C13.6 29 13.6 21.6 14.2 15.6Z')
ALBUM_SPINE = 'M18.4 14.9C17.5 21.7 17.5 29 18.1 35.7'
PHOTO = ('M22.6 19.9C26.2 19.2 30 19.2 33.4 20C33.9 23.8 33.9 27.6 33.4 31.3'
         'C29.9 32.1 26.1 32.1 22.6 31.3C22.1 27.5 22.1 23.7 22.6 19.9Z')
PHOTO_IN = ('M24.4 22.2C26.2 21.9 28.6 21.9 30.4 22.2C30.6 24.4 30.6 27 30.4 29.2'
            'C28.5 29.5 26.2 29.5 24.4 29.2C24.2 27 24.2 24.4 24.4 22.2Z')


def grads():
    return (f'<linearGradient id="lgA" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{FILLA}"/><stop offset="1" stop-color="{FILLB}"/>'
            f'</linearGradient>'
            f'<linearGradient id="lgB" x1="0" y1="0" x2="0" y2="1">'
            f'<stop offset="0" stop-color="{FILLA}"/><stop offset="1" stop-color="{FILLB}"/>'
            f'</linearGradient>'
            f'<clipPath id="cpA"><path d="{OPEN}"/></clipPath>'
            f'<clipPath id="cpB"><path d="{ALBUM}"/></clipPath>')


def open_book():
    return (
        f'<path d="{OPEN}" fill="url(#lgA)" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>'
        f'<g clip-path="url(#cpA)"><path d="{OPEN}" fill="none" stroke="{INK}" stroke-width="1.1" '
        f'opacity=".28" transform="translate(.55 -.6)"/></g>'
        f'<g stroke="{INK}" stroke-width="{IW}" stroke-linecap="round" fill="none" opacity=".5">'
        f'<path d="{PAGE_L}"/><path d="{PAGE_R}"/></g>'
        f'<path d="{GUT}" stroke="{INK}" stroke-width="2.6" stroke-linecap="round" fill="none" opacity=".95"/>')


def album():
    return (
        f'<path d="{ALBUM}" fill="url(#lgB)" stroke="{INK}" stroke-width="{SW}" stroke-linejoin="round"/>'
        f'<g clip-path="url(#cpB)"><path d="{ALBUM}" fill="none" stroke="{INK}" stroke-width="1.1" '
        f'opacity=".28" transform="translate(.5 -.55)"/></g>'
        f'<path d="{ALBUM_SPINE}" stroke="{INK}" stroke-width="{IW}" stroke-linecap="round" fill="none" opacity=".45"/>'
        f'<path d="{PHOTO}" fill="{FILLA}" stroke="{INK}" stroke-width="2.4" stroke-linejoin="round"/>'
        f'<path d="{PHOTO_IN}" fill="{FILLB}" stroke="{INK}" stroke-width="1.5" stroke-linejoin="round" opacity=".9"/>')


def wrap(inner, deg):
    return f'<g transform="rotate({deg} 24 24)">{inner}</g>' if deg else inner


VARIANTS = {
    'A3':  wrap(open_book(), 0),
    'A3t': wrap(open_book(), -13),
    'At':  wrap(open_book(), -20),
    'E3':  wrap(open_book() + f'<path d="{SPARKS}" fill="{SPARK}" stroke="{INK}" stroke-width="2.8" '
                              f'stroke-linejoin="round"/>', -13),
    'F3':  wrap(album(), -6),
}


def main():
    html = io.open(SRC, encoding='utf-8').read()
    m = re.search(r'<svg class="logo"[^>]*>.*?</svg>', html, re.S)
    if not m:
        print('!! 没找到 <svg class="logo">', file=sys.stderr)
        return 1
    print('原 logo svg 长度 =', len(m.group(0)))
    os.makedirs(OUT, exist_ok=True)

    for k, inner in VARIANTS.items():
        body = f'<svg class="logo" viewBox="0 0 48 48" aria-hidden="true"><defs>{grads()}</defs>{inner}</svg>'
        new = html[:m.start()] + body + html[m.end():]
        p = os.path.join(OUT, f'prev_{k}.html')
        io.open(p, 'w', encoding='utf-8', newline='\n').write(new)
        print('  wrote', p, 'delta =', len(new) - len(html))
    return 0


if __name__ == '__main__':
    sys.exit(main())
