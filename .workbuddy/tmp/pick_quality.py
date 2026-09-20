# -*- coding: utf-8 -*-
"""选画质：在**实际显示尺寸**下测 PSNR，而不是在原始分辨率下测。

为什么这件事重要：示例照片在书页里的显示长边只有约 700px。所以
「1024 长边 + 低质量」和「768 长边 + 高质量」哪个更好看，不能凭直觉 ——
要在 700px 下比。压缩伪影在显示尺寸下会被重采样抹掉一部分，
而分辨率不足造成的糊是抹不掉的。
"""
import io, math, os, sys
import numpy as np
from PIL import Image, ImageOps

SRC = r"D:/test/image"
DISP = 700
fs = sorted([f for f in os.listdir(SRC) if f.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))])
LE_GRID = [int(x) for x in (sys.argv[1].split(",") if len(sys.argv) > 1 else "1024,896,832,768,700".split(","))]
Q_GRID = [int(x) for x in (sys.argv[2].split(",") if len(sys.argv) > 2 else "72,65,58".split(","))]


def resize(im, le):
    w, h = im.size
    k = min(1.0, le / max(w, h))
    if k >= 1.0:
        return im
    return im.resize((max(1, round(w * k)), max(1, round(h * k))), Image.LANCZOS)


def psnr(a, b):
    x = np.asarray(a, dtype="float32")
    y = np.asarray(b, dtype="float32")
    m = ((x - y) ** 2).mean()
    return 99.0 if m <= 0 else 10 * math.log10(255 * 255 / m)


origs = [ImageOps.exif_transpose(Image.open(os.path.join(SRC, f))).convert("RGB") for f in fs]
refs = [resize(o, DISP) for o in origs]
by_le = {le: [resize(o, le) for o in origs] for le in LE_GRID}

rows = []
for LE in LE_GRID:
    for q in Q_GRID:
        tot = 0
        acc = 0.0
        for im, ref in zip(by_le[LE], refs):
            buf = io.BytesIO()
            im.save(buf, "WEBP", quality=q, method=5)
            data = buf.getvalue()
            tot += len(data)
            dec = Image.open(io.BytesIO(data)).convert("RGB").resize(ref.size, Image.LANCZOS)
            acc += psnr(ref, dec)
        rows.append((LE, q, tot * 4 / 3 / 1024, acc / len(origs)))
        print("LE=%4d q=%2d  %7.1f KB  %.2f dB" % (LE, q, tot * 4 / 3 / 1024, acc / len(origs)))
        sys.stdout.flush()

print("\n在 <= 950 KB 预算内按画质排序：")
for LE, q, kb, ps in sorted([r for r in rows if r[2] <= 950], key=lambda r: -r[3]):
    print("  LE=%4d q=%2d  %6.1f KB  %.2f dB" % (LE, q, kb, ps))
