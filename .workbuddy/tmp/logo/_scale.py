"""把 48 网格上的路径按 (sx,sy) 关于 (24,24) 缩放，并打印新路径。
只处理 M/C/Z + 纯坐标的路径（本项目的图标路径都是这种）。"""
import re, sys

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

NUM = re.compile(r'-?\d+(?:\.\d+)?')


def scale(d, sx, sy, cx=24.0, cy=24.0):
    """只缩放数字：偶数位当 x、奇数位当 y（M/C 的每一组都是 x y 成对）。"""
    out = []
    i = 0
    for tok in re.finditer(r'[A-Za-z]|-?\d+(?:\.\d+)?', d):
        t = tok.group(0)
        if t.isalpha():
            out.append(t)
            continue
        v = float(t)
        # 交替判断：用已输出的数字个数
        if i % 2 == 0:
            nv = cx + (v - cx) * sx
        else:
            nv = cy + (v - cy) * sy
        i += 1
        out.append(('%.2f' % nv).rstrip('0').rstrip('.'))
    # 重新拼：字母后接空格，数字间加空格
    s = ''
    for j, t in enumerate(out):
        if t.isalpha():
            s += t
        else:
            if j and not out[j - 1].isalpha():
                s += ' '
            s += t
    return s


def bbox(d):
    nums = [float(x) for x in NUM.findall(d)]
    xs, ys = nums[0::2], nums[1::2]
    return min(xs), max(xs), min(ys), max(ys)


if __name__ == '__main__':
    SX, SY = 1.055, 1.17
    for name, d in [('OPEN', OPEN), ('PAGE_L', PAGE_L), ('PAGE_R', PAGE_R),
                    ('GUT', GUT), ('ALBUM', ALBUM), ('ALBUM_SPINE', ALBUM_SPINE),
                    ('PHOTO', PHOTO), ('PHOTO_IN', PHOTO_IN)]:
        nd = scale(d, SX, SY)
        b = bbox(nd)
        print('%-12s %s' % (name, nd))
        print('%-12s bbox x %.2f~%.2f  y %.2f~%.2f   (w %.2f h %.2f)'
              % ('', b[0], b[1], b[2], b[3], b[1] - b[0], b[3] - b[2]))
    print()
    print('SPARKS(不动) ', SPARKS)
