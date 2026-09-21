from PIL import Image
im = Image.open('.workbuddy/tmp/shotsb2/04-封面与封底寄语.png').convert('RGB')
W,H = im.size
print('size', W, H)
# 封底两张在右半边；寄语在书名与条码之间
c = im.crop((int(W*0.48), int(H*0.30), W, int(H*0.62)))
c = c.resize((c.width*3, c.height*3), Image.LANCZOS)
c.save('.workbuddy/tmp/shotsb2/04z-封底寄语放大.png')
print('crop ->', c.size)
