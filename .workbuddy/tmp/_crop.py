from PIL import Image
import sys
src, out, box, z = sys.argv[1], sys.argv[2], [int(v) for v in sys.argv[3].split(',')], float(sys.argv[4])
im = Image.open(src).convert('RGB').crop(tuple(box))
im = im.resize((int(im.width*z), int(im.height*z)), Image.NEAREST)
im.save(out); print(out, im.size)
