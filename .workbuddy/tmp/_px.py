# -*- coding: utf-8 -*-
from PIL import Image
for tag in ('studio', 'peach', 'sakura', 'mint'):
    im = Image.open(u'shotskin/内页-%s.png' % tag).convert('RGB')
    W, H = im.size
    pts = {
        '左页纸面_上': (int(W * 0.245), int(H * 0.16)),
        '左页纸面_下': (int(W * 0.40), int(H * 0.55)),
        '右页纸面_下': (int(W * 0.80), int(H * 0.52)),
    }
    print(tag, dict((k, im.getpixel(v)) for k, v in pts.items()))
