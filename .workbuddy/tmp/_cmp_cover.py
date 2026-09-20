# -*- coding: utf-8 -*-
"""把各氛围的封面截图裁到书封区域，横向拼一张对比图。"""
from PIL import Image, ImageDraw

tags = ['studio', 'cream', 'peach', 'mist', 'mint', 'sakura', 'french']
labels = [u'原味', u'奶油日记', u'蜜桃气泡', u'雾紫梦境', u'薄荷苏打', u'夜樱', u'法式午后']

crops = []
for t in tags:
    im = Image.open(u'shotskin/封面-%s.png' % t).convert('RGB')
    W, H = im.size
    box = (int(W * 0.26), int(H * 0.04), int(W * 0.66), int(H * 0.86))
    c = im.crop(box)
    c = c.resize((int(c.width * 0.66), int(c.height * 0.66)), Image.LANCZOS)
    crops.append((t, c))

cw, ch = crops[0][1].size
pad = 8
lb = 24
cols = 4
rows = 2
out = Image.new('RGB', (cw * cols + pad * (cols + 1), (ch + lb + pad) * rows + pad), (250, 250, 250))
d = ImageDraw.Draw(out)
for i, (t, c) in enumerate(crops):
    x = pad + (i % cols) * (cw + pad)
    y = pad + (i // cols) * (ch + lb + pad)
    out.paste(c, (x, y + lb))
    d.text((x + 2, y + 5), u'%s (%s)' % (labels[i], t), fill=(30, 30, 30))
out.save('shotskin/_compare_封面.png')
print('ok', out.size)
