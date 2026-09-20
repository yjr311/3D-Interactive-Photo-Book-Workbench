# -*- coding: utf-8 -*-
"""修正品牌迁移：title/author/spine 属于 book 而不是 opts；
   并把品牌名收成一个常量，避免"默认值改了、迁移还写着旧名"这种脱节。"""
import os
ROOT = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14"
SRC  = os.path.join(ROOT, ".workbuddy/tmp/src")
def rd(p): return open(p, encoding="utf-8").read()
def wr(p, s): open(p, "w", encoding="utf-8").write(s)
def sub(s, old, new, tag, n=1):
    c = s.count(old)
    assert c == n, f"[{tag}] 期望 {n} 次，实际 {c} 次"
    return s.replace(old, new)

p = os.path.join(SRC, "core.js"); s = rd(p)

# ① 品牌常量（插在 state 之前）
s = sub(s, "const state={\n  step:0,", """/* 品牌名集中在这里 —— 默认值与「改名迁移」共用同一份，不然很容易
   出现"默认值改了、迁移里还写着旧名"的脱节。以后再改名只动这两行。 */
const BRAND={name:'咔哒书', studio:'KADA STUDIO', spine:'KADA · 2026'};
const OLD_BRAND={name:'光匣', studio:'LUMEN STUDIO', spine:'LUMEN · 2026'};

const state={
  step:0,""", "BRAND-const")

# ② 默认值改用常量
s = sub(s, "    title:'咔哒书', sub:'A COLLECTION OF MOMENTS', author:'KADA STUDIO',\n"
           "    spine:'KADA · 2026',",
        "    title:BRAND.name, sub:'A COLLECTION OF MOMENTS', author:BRAND.studio,\n"
        "    spine:BRAND.spine,", "book-defaults")

# ③ 删掉写错的 opts 迁移（这三个字段根本不在 opts 里）
s = sub(s, """      /* 改名：老存档里还留着旧默认值的字段换成新名字。
         同样只动「原样等于旧默认值」的那些 —— 用户自己起的书名/署名一律不碰。 */
      if(s.opts.title==='光匣')          s.opts.title=DEFAULT_OPTS.title;
      if(s.opts.author==='LUMEN STUDIO') s.opts.author=DEFAULT_OPTS.author;
      if(s.opts.spine==='LUMEN · 2026')  s.opts.spine=DEFAULT_OPTS.spine;
    }""", "    }", "drop-wrong-opts")

# ④ 正确的 book 迁移
s = sub(s, "    if(s.book&&typeof s.book==='object'&&s.book.title==='光匣') s.book.title='咔哒书';",
        """    /* 改名：书名 / 署名 / 书脊还等于**旧默认值**的，换成新名字。
       只动「原样等于旧默认值」的字段 —— 用户自己起的书名、署名一律不碰。 */
    if(s.book&&typeof s.book==='object'){
      if(s.book.title===OLD_BRAND.name)    s.book.title=BRAND.name;
      if(s.book.author===OLD_BRAND.studio) s.book.author=BRAND.studio;
      if(s.book.spine===OLD_BRAND.spine)   s.book.spine=BRAND.spine;
    }""", "book-migrate")

# ⑤ 兜底书名也走常量（core.js 6 处）
c = s.count("bk.title||'咔哒书'") + s.count("state.book.title||'咔哒书'")
assert c == 6, f"兜底书名 {c} 处，期望 6"
s = s.replace("bk.title||'咔哒书'", "bk.title||BRAND.name").replace("state.book.title||'咔哒书'", "state.book.title||BRAND.name")
wr(p, s)

# ⑥ app.js 2 处兜底
p = os.path.join(SRC, "app.js"); s = rd(p)
c = s.count("bk.title||'咔哒书'") + s.count("(state.book.title||'咔哒书')")
assert c == 4, f"app.js 兜底 {c} 处，期望 4"
s = s.replace("bk.title||'咔哒书'", "bk.title||BRAND.name").replace("(state.book.title||'咔哒书')", "(state.book.title||BRAND.name)")
wr(p, s)

print("修正完成")
for f in ("core.js", "app.js"):
    t = rd(os.path.join(SRC, f))
    print(f"  {f}: OLD_BRAND={t.count('OLD_BRAND')} BRAND.={t.count('BRAND.')} 残留'光匣'={t.count('光匣')}")
