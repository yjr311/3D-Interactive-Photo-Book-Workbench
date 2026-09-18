import base64, io, json, os, sys
from PIL import Image, ImageOps

SRC = r"D:/test/image"
OUT = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/photos.js"
MAX = int(sys.argv[1]) if len(sys.argv) > 1 else 1080
Q = int(sys.argv[2]) if len(sys.argv) > 2 else 74

files = sorted([f for f in os.listdir(SRC) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))])
data = []
total = 0
for f in files:
    im = Image.open(os.path.join(SRC, f))
    im = ImageOps.exif_transpose(im).convert("RGB")
    w, h = im.size
    k = min(1.0, MAX / max(w, h))
    if k < 1.0:
        im = im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=Q, optimize=True, progressive=True)
    b = buf.getvalue()
    total += len(b)
    data.append({"n": os.path.splitext(f)[0], "w": im.size[0], "h": im.size[1],
                 "d": "data:image/jpeg;base64," + base64.b64encode(b).decode()})
    print(f, im.size, len(b) // 1024, "KB")

js = "const PHOTO_DATA=" + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n"
with open(OUT, "w", encoding="utf-8") as fh:
    fh.write(js)
print("---- files:", len(data), "raw:", total // 1024, "KB  js:", len(js.encode()) // 1024, "KB")
