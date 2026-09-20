import numpy as np
from PIL import Image
D = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsfold/'
base = np.asarray(Image.open(D+'00-无悬停.png').convert('RGB')).astype(int)
for name, want in [('01-悬停左页左下角.png','左页'), ('02-悬停右页右下角.png','右页')]:
    im = np.asarray(Image.open(D+name).convert('RGB')).astype(int)
    h = min(base.shape[0], im.shape[0]); w = min(base.shape[1], im.shape[1])
    d = np.abs(base[:h,:w] - im[:h,:w]).sum(axis=2)
    ys, xs = np.where(d > 12)
    print(f'{name}  期望:折角在{want}')
    if len(xs) == 0:
        print('   没有任何差异 —— 折角没被画出来（悬停没触发）')
    else:
        print(f'   差异像素={len(xs)}  bbox x∈[{xs.min()},{xs.max()}]  y∈[{ys.min()},{ys.max()}]')
    print()
