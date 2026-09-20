from PIL import Image, ImageDraw, ImageFont
import os
D = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsfold/'
OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/翻页折角-修复对照.png'

# 画布几何（屏坐标）
LEFT, GUTTER, RIGHT, PBOT = 327, 691, 1055, 589
CX0, CX1 = 300, 1080          # 裁切范围
CY0, CY1 = 496, 592
K = 1.55                       # 放大
PAD = 16
LABW = 300

FONT = 'C:/Windows/Fonts/msyh.ttc'
def f(sz): return ImageFont.truetype(FONT, sz, index=0)

rows = [
    ('before-01-悬停左页左下角.png', '改前', '悬停左页左下角', '折角跑到了书沟上', 'bad'),
    ('01-悬停左页左下角.png',        '改后', '悬停左页左下角', '折角在左页书口', 'good'),
    ('02-悬停右页右下角.png',        '改后', '悬停右页右下角', '折角在右页书口（本来就对）', 'good'),
]

tilew = int((CX1 - CX0) * K); tileh = int((CY1 - CY0) * K)
W = LABW + tilew + PAD * 2
H = len(rows) * (tileh + 34 + PAD) + 74 + PAD
im = Image.new('RGB', (W, H), (250, 250, 248))
dr = ImageDraw.Draw(im)

dr.text((PAD + LABW, 16), '翻页折角位置 — 修复对照（同一本书、同一页、同一悬停位置）',
        font=f(21), fill=(28, 28, 30))
dr.text((PAD + LABW, 44), '折角 = 悬停在页面下缘时翘起的那一角。它必须落在「书口边」（外侧），不是「书沟」（内侧中缝）。',
        font=f(14), fill=(120, 120, 124))

y = 74 + PAD
for name, ver, hv, note, kind in rows:
    src = Image.open(D + name).convert('RGB').crop((CX0, CY0, CX1, CY1))
    src = src.resize((tilew, tileh), Image.LANCZOS)
    x0 = PAD + LABW
    im.paste(src, (x0, y))
    dr.rectangle([x0, y, x0 + tilew - 1, y + tileh - 1], outline=(214, 212, 206), width=1)

    # 标签
    col = (196, 60, 52) if kind == 'bad' else (30, 128, 78)
    dr.text((PAD, y + 4), ver, font=f(20), fill=col)
    dr.text((PAD, y + 32), hv, font=f(15), fill=(60, 60, 64))
    dr.text((PAD, y + 54), note, font=f(14), fill=col)

    # 标注：书沟 / 书口
    gx = x0 + (GUTTER - CX0) * K
    lx = x0 + (LEFT - CX0) * K
    rx = x0 + (RIGHT - CX0) * K

    def ring(cx, cy, r, color, wd=4):
        dr.ellipse([cx - r, cy - r, cx + r, cy + r], outline=color, width=wd)

    if kind == 'bad':
        ring(gx + 22, y + tileh * 0.64, 50, (196, 60, 52))
        dr.text((gx - 108, y + 6), '折角错在书沟', font=f(15), fill=(196, 60, 52))
    else:
        if '左页' in hv:
            ring(lx + 24, y + tileh * 0.64, 50, (30, 128, 78))
            dr.text((lx + 8, y + 6), '折角在左页书口', font=f(15), fill=(30, 128, 78))
        else:
            ring(rx - 24, y + tileh * 0.64, 50, (30, 128, 78))
            dr.text((rx - 190, y + 6), '折角在右页书口', font=f(15), fill=(30, 128, 78))

    y += tileh + 34 + PAD

im.save(OUT)
print('已保存', OUT, im.size)
