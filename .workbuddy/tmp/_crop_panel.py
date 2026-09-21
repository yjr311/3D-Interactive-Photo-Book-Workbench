from PIL import Image
im = Image.open('.workbuddy/tmp/shotsb2/05-面板全屏.png').convert('RGB')
W,H = im.size
c = im.crop((1113, 90, min(1424,W), H))
c = c.resize((c.width*2, c.height*2), Image.LANCZOS)
c.save('.workbuddy/tmp/shotsb2/05z-面板放大.png')
print('crop ->', c.size)
