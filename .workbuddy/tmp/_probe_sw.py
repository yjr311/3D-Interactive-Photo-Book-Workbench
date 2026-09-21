from PIL import Image
im = Image.open('.workbuddy/tmp/shotsb2/01-八枚贴纸.png').convert('RGB')
W,H = im.size
print('size', W,H)
# 找每格的底色：取格子内部靠上的像素（避开图形）
px = im.load()
def report(x,y,label):
    print(label, px[x,y])
# 第一格 (和纸胶带) 与第二格 (小星星) 的背景都在左上角附近
report(12, 42, 'cell1 bg')
report(12, 100, 'cell1 bg2')
report(270, 42, 'cell2 bg')
