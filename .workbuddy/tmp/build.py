# -*- coding: utf-8 -*-
"""把 head.html + core.js + photos.js + app.js 组装成单文件 HTML。"""
import io, os, re, sys

TMP = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
OUT = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/光匣-3D互动照片书.html"

head = io.open(os.path.join(TMP, "src/head.html"), encoding="utf-8").read()
core = io.open(os.path.join(TMP, "src/core.js"), encoding="utf-8").read()
photos = io.open(os.path.join(TMP, "photos.js"), encoding="utf-8").read()
app = io.open(os.path.join(TMP, "src/app.js"), encoding="utf-8").read()

# --- core 补丁 ---
assert "async function generate(){" in core
core = core.replace("async function generate(){", "async function generateLegacy(){")
assert "longEdge:1600" in core
core = core.replace("longEdge:1600", "longEdge:1280")

# 头尾对齐
assert head.rstrip().endswith("<script>"), head[-80:]
assert not head.rstrip().endswith("</script>")

html = head.rstrip("\n") + "\n" + core.rstrip("\n") + "\n" + photos.rstrip("\n") + "\n" + app.rstrip("\n") + "\n</script>\n</body>\n</html>\n"

io.open(OUT, "w", encoding="utf-8", newline="\n").write(html)
print("written:", OUT)
print("size: %.2f MB, lines: %d" % (len(html.encode("utf-8")) / 1048576.0, html.count("\n") + 1))
