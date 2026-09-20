# -*- coding: utf-8 -*-
"""把各氛围的内页截图裁到书本区域，纵向拼一张对比图。"""
from PIL import Image, ImageDraw

tags = ['studio', 'cream', 'peach', 'mist', 'mint', 'sakura', 'french']
labels = [u'原味', u'奶油日记', u'蜜桃气泡', u'雾紫梦境', u'薄荷苏打', u'夜樱', u'法式午后']

crops = []
for t in tags:
    im = Image.open(u'shotskin/内页-%s.png' % t).convert('RGB')
    W, H = im.size
    # 书本大致区域：避开左侧素材栏与右侧面板
    box = (int(W * 0.185), int(H * 0.07), int(W * 0.75), int(H * 0.72))
    c = im.crop(box)
    c = c.resize((int(c.width * 0.62), int(c.height * 0.62)), Image.LANCZOS)
    crops.append((t, c))

cw, ch = crops[0][1].size
pad = 8
lb = 26
out = Image.new('RGB', (cw * 2 + pad * 3, (ch + lb + pad) * 4 + pad), (250, 250, 250))
d = ImageDraw.Draw(out)
for i, (t, c) in enumerate(crops):
    col = i % 2
    row = i // 2
    x = pad + col * (cw + pad)
    y = pad + row * (ch + lb + pad)
    out.paste(c, (x, y + lb))
    d.text((x + 2, y + 6), u'%s  (%s)' % (labels[i], t), fill=(30, 30, 30))
out.save('shotskin/_compare_内页.png')
print('ok', out.size)
