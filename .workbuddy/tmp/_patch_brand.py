# -*- coding: utf-8 -*-
"""把品牌从「光匣 LUMEN」改成「咔哒书 KADA」，并换上新图标。
   每处替换都先断言命中，改完打值级校验（不只看文件大小）。"""
import json, base64, re, io, os

ROOT = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14"
SRC  = os.path.join(ROOT, ".workbuddy/tmp/src")
LOGO = os.path.join(ROOT, ".workbuddy/tmp/logo")

D = json.load(open(os.path.join(LOGO, "path.json"), encoding="utf-8"))["d"]

def rd(p): return open(p, encoding="utf-8").read()
def wr(p, s): open(p, "w", encoding="utf-8").write(s)
def sub(s, old, new, tag, n=1):
    c = s.count(old)
    assert c == n, f"[{tag}] 期望命中 {n} 次，实际 {c} 次"
    return s.replace(old, new)

# ---------------- favicon：base64 内嵌，免去转义坑 ----------------
FAV_SVG = ("<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 48 48'>"
           f"<path fill='#f0a63c' fill-rule='evenodd' d='{D}'/></svg>")
FAV = "data:image/svg+xml;base64," + base64.b64encode(FAV_SVG.encode("utf-8")).decode("ascii")
print("favicon 长度", len(FAV))

# ================= head.html =================
p = os.path.join(SRC, "head.html"); s = rd(p)
s = sub(s, "<title>光匣 LUMEN · 3D 互动照片书工作台</title>",
        "<title>咔哒书 KADA · 3D 互动照片书工作台</title>\n"
        f'<link rel="icon" href="{FAV}">', "title+favicon")
s = sub(s, '      <div class="logo">匣</div>\n      <div><b>光匣</b><i>LUMEN</i></div>',
        '      <svg class="logo" viewBox="0 0 48 48" aria-hidden="true">'
        f'<path fill="currentColor" fill-rule="evenodd" d="{D}"/></svg>\n'
        '      <div><b>咔哒书</b><i>KADA</i></div>', "brand-markup")
s = sub(s, """.brand .logo{
  width:29px;height:29px;border-radius:9px;display:grid;place-items:center;
  background:linear-gradient(145deg,var(--accent),#c8791f); color:var(--accent-ink);
  font-size:15px;font-weight:700; box-shadow:0 6px 18px rgba(240,166,60,.3);
}""", """.brand .logo{width:29px;height:29px;display:block;flex:none;color:var(--accent);
  filter:drop-shadow(0 5px 15px var(--glow));}""", "logo-css")
wr(p, s)

# ================= core.js =================
p = os.path.join(SRC, "core.js"); s = rd(p)
s = sub(s, "    title:'光匣', sub:'A COLLECTION OF MOMENTS', author:'LUMEN STUDIO',\n"
           "    spine:'LUMEN · 2026',",
        "    title:'咔哒书', sub:'A COLLECTION OF MOMENTS', author:'KADA STUDIO',\n"
        "    spine:'KADA · 2026',", "DEFAULT_BOOK")
s = sub(s, """      if(s.opts.title==='今日份')       s.opts.title=DEFAULT_OPTS.title;
      if(s.opts.sub==='2026 · LUMEN')   s.opts.sub=DEFAULT_OPTS.sub;
      if(s.opts.corner==='NO.01')       s.opts.corner=DEFAULT_OPTS.corner;
    }""",
        """      if(s.opts.title==='今日份')       s.opts.title=DEFAULT_OPTS.title;
      if(s.opts.sub==='2026 · LUMEN')   s.opts.sub=DEFAULT_OPTS.sub;
      if(s.opts.corner==='NO.01')       s.opts.corner=DEFAULT_OPTS.corner;
      /* 改名：老存档里还留着旧默认值的字段换成新名字。
         同样只动「原样等于旧默认值」的那些 —— 用户自己起的书名/署名一律不碰。 */
      if(s.opts.title==='光匣')          s.opts.title=DEFAULT_OPTS.title;
      if(s.opts.author==='LUMEN STUDIO') s.opts.author=DEFAULT_OPTS.author;
      if(s.opts.spine==='LUMEN · 2026')  s.opts.spine=DEFAULT_OPTS.spine;
    }""", "opt-migrate")
s = sub(s, "    if(s.book&&typeof s.book==='object'&&s.book.art==null) s.book.art=DEFAULT_BOOK_ART;",
        "    if(s.book&&typeof s.book==='object'&&s.book.art==null) s.book.art=DEFAULT_BOOK_ART;\n"
        "    if(s.book&&typeof s.book==='object'&&s.book.title==='光匣') s.book.title='咔哒书';",
        "book-migrate")
for old, new, tag in [
    ("ctx.fillText('VOLUME ONE · LUMEN PRESS'", "ctx.fillText('VOLUME ONE · KADA PRESS'", "press"),
    ("ctx.fillText('LUMEN STUDIO'", "ctx.fillText('KADA STUDIO'", "studio"),
    ("x.fillText('LUMEN STUDIO · 2026'", "x.fillText('KADA STUDIO · 2026'", "studio2026"),
    ("'lumen/'+pad2(i+1)", "'kada/'+pad2(i+1)", "zip-a"),
    ("'lumen/README.txt'", "'kada/README.txt'", "zip-b"),
    ("'光匣 LUMEN · 照片书成片\\n'", "'咔哒书 KADA · 照片书成片\\n'", "readme"),
    ("'光匣-成片-'", "'咔哒书-成片-'", "zip-out"),
    ("'光匣-分享长图-'", "'咔哒书-分享长图-'", "share-out"),
    ("'光匣-'+state.tpl+'-'", "'咔哒书-'+state.tpl+'-'", "single-out"),
]:
    s = sub(s, old, new, tag)
c = s.count("bk.title||'光匣'") + s.count("state.book.title||'光匣'")
assert c == 6, f"core.js 兜底书名命中 {c} 次，期望 6"
s = s.replace("bk.title||'光匣'", "bk.title||'咔哒书'").replace("state.book.title||'光匣'", "state.book.title||'咔哒书'")
wr(p, s)

# ================= app.js =================
p = os.path.join(SRC, "app.js"); s = rd(p)
s = sub(s, "   光匣 LUMEN v2 —— 内置示例照片 / 音效 / canvas 物理翻页引擎",
        "   咔哒书 KADA —— 内置示例照片 / 音效 / canvas 物理翻页引擎", "app-comment")
s = sub(s, "const p=makePhoto(im,it.w,it.h,'LUMEN '+it.n);",
        "const p=makePhoto(im,it.w,it.h,'KADA '+it.n);", "demo-name")
s = sub(s, "  /* 中央的「匣」印：环衬上唯一的实心元素，压住整页 */",
        "  /* 中央的「咔」印：环衬上唯一的实心元素，压住整页 */", "seal-comment")
s = sub(s, "  x.fillText('匣',W/2,H*.452);", "  x.fillText('咔',W/2,H*.452);", "seal")
s = sub(s, "  tracked(x,'LUMEN',W/2,H*.530,", "  tracked(x,'KADA',W/2,H*.530,", "landing-latin")
s = sub(s, "  tracked(x,'光匣 · 照片书',W/2,H*.602,", "  tracked(x,'咔哒书 · 照片书',W/2,H*.602,", "landing-cjk")
c = s.count("bk.title||'光匣'") + s.count("(state.book.title||'光匣')")
assert c == 4, f"app.js 兜底书名命中 {c} 次，期望 4"
s = s.replace("bk.title||'光匣'", "bk.title||'咔哒书'").replace("(state.book.title||'光匣')", "(state.book.title||'咔哒书')")
s = sub(s, "window.LUMEN={state:state,", "window.KADA=window.LUMEN={state:state,", "alias")
wr(p, s)

# ================= build.py 输出名 =================
p = os.path.join(ROOT, ".workbuddy/tmp/build.py"); s = rd(p)
s = sub(s, 'OUT = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html"',
        'OUT = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html"', "build-out")
wr(p, s)

print("源码改完")
for f in ("head.html", "core.js", "app.js"):
    t = rd(os.path.join(SRC, f))
    print(f"  {f}: 光匣={t.count('光匣')} LUMEN={t.count('LUMEN')} 咔哒书={t.count('咔哒书')} KADA={t.count('KADA')}")
