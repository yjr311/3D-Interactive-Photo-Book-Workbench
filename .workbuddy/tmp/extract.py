import io, os

SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html"
DST = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/src"
os.makedirs(DST, exist_ok=True)

lines = io.open(SRC, encoding="utf-8").read().split("\n")  # 0-indexed, lines[n-1] == 第 n 行


def seg(a, b):
    return "\n".join(lines[a - 1:b])


core = "\n".join([
    "/* ===== 以下核心引擎（渲染管线 / 模版库 / 面板 / 导出）自 v1 中抽取复用 ===== */",
    seg(501, 1323),
    seg(1636, 1752),
    seg(1782, 1815),
    seg(1816, 1932),
])
io.open(os.path.join(DST, "core.js"), "w", encoding="utf-8").write(core)
print("core.js lines:", core.count("\n") + 1)
for n in (501, 1323, 1636, 1752, 1782, 1815, 1816, 1932):
    print(n, "|", lines[n - 1][:90])
