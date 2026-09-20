# -*- coding: utf-8 -*-
"""把 head.html + core.js + photos.js + app.js 组装成单文件 HTML。

用法：
  python build.py            # 正常构建（JS 用 terser 压缩，CSS 保守压缩）
  python build.py --no-min   # 不压缩，保留可读注释，便于调试

压缩策略：
  - src/*.js 始终保留注释与缩进（可读、可审）——压缩只发生在拼接产物上。
  - core.js + app.js 合成一段交给 terser（toplevel 默认不 mangle，
    所以 window.LUMEN / PHOTO_DATA 等顶层名字不会被改名）。
  - head.html 的 <style> 只去注释、去缩进、去空行，不做 token 级压缩，
    避免破坏 calc(100% - 20px) 这类空白敏感写法。
  - terser 不可用时自动降级（去块注释 + 去空行），构建不中断。
"""
import io, os, re, subprocess, sys

TMP = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
OUT = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/光匣-3D互动照片书.html"
NODE = r"C:/Users/zz/.workbuddy/binaries/node/versions/22.22.2-2/node.exe"
TERSER = r"C:/Users/zz/.workbuddy/binaries/node/workspace/node_modules/terser/bin/terser"

MIN = "--no-min" not in sys.argv


def rd(p):
    return io.open(p, encoding="utf-8").read()


def min_css(css):
    """保守压缩：去 /* */ 注释、去每行缩进、丢空行。保留行内空格（calc 安全）。"""
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    lines = [ln.strip() for ln in css.split("\n")]
    return "\n".join(ln for ln in lines if ln)


def min_js(js, label):
    """terser 压缩；失败降级为「去块注释 + 去空行」。"""
    if os.path.isfile(NODE) and os.path.isfile(TERSER):
        try:
            p = subprocess.run(
                [NODE, TERSER, "-c", "passes=2", "-m", "--comments", "false"],
                input=js.encode("utf-8"), stdout=subprocess.PIPE,
                stderr=subprocess.PIPE, timeout=240)
            if p.returncode == 0 and p.stdout.strip():
                return p.stdout.decode("utf-8")
            sys.stderr.write("!! terser 失败(%s): %s\n" % (
                label, p.stderr.decode("utf-8", "ignore")[:500]))
        except Exception as e:
            sys.stderr.write("!! terser 异常(%s): %r\n" % (label, e))
    else:
        sys.stderr.write("!! 未找到 terser(%s)，降级\n" % label)
    js = re.sub(r"/\*.*?\*/", "", js, flags=re.S)
    return "\n".join(ln for ln in js.split("\n") if ln.strip())


# ---------------- 读取 ----------------
head = rd(os.path.join(TMP, "src/head.html"))
core = rd(os.path.join(TMP, "src/core.js"))
photos = rd(os.path.join(TMP, "photos.js"))
app = rd(os.path.join(TMP, "src/app.js"))

# ---------------- core 补丁 ----------------
assert "async function generate(){" in core
core = core.replace("async function generate(){", "async function generateLegacy(){")
assert "longEdge:1600" in core
core = core.replace("longEdge:1600", "longEdge:1280")

# 头尾对齐
assert head.rstrip().endswith("<script>"), head[-80:]
assert not head.rstrip().endswith("</script>")

# ---------------- 压缩 ----------------
raw_js = core.rstrip("\n") + "\n" + app.rstrip("\n")
if MIN:
    m = re.search(r"<style>(.*?)</style>", head, flags=re.S)
    assert m, "head.html 里找不到 <style>"
    head = head[:m.start(1)] + min_css(m.group(1)) + head[m.end(1):]
    js = min_js(raw_js, "core+app")
    js_note = "terser"
else:
    js = raw_js
    js_note = "none"

# photos.js 是纯 base64 数据，压缩无收益，原样拼接
js = js.rstrip("\n") + "\n" + photos.rstrip("\n") + "\n"

html = head.rstrip("\n") + "\n" + js + "</script>\n</body>\n</html>\n"

io.open(OUT, "w", encoding="utf-8", newline="\n").write(html)

size = len(html.encode("utf-8"))
detail = "".join([
    "\n  head  %6.1f KB" % (len(head.encode("utf-8")) / 1024.0),
    "\n  js    %6.1f KB  (压缩: %s, 原始 %.1f KB)" % (
        len(js.encode("utf-8")) / 1024.0, js_note, len(raw_js.encode("utf-8")) / 1024.0),
    "\n  photos%6.1f KB" % (len(photos.encode("utf-8")) / 1024.0),
])
print("written:", OUT)
print("size: %.3f MB (%d bytes), lines: %d%s" % (
    size / 1048576.0, size, html.count("\n") + 1, detail))
print("预算 1.200 MB → 余量 %.1f KB" % ((1258291 - size) / 1024.0))
