# -*- coding: utf-8 -*-
"""第十五轮取证图：牛皮纸「贴纸拖不动」的根因 = 照片矩形串了坐标系。

四张素材全部来自 _shot_kraft15.mjs（改前 = .workbuddy/tmp/_before.html，
把 paintPhoto 的 CTM 映射、与画框求交、1e-6 容差、双色 declare 四处一起还原）。

⚠ 拼图脚本的老坑：先算总高、再画；末排说明的边距要够，否则最后一排会被画到画布外，
   看起来像"被截断"。
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14"
S = os.path.join(ROOT, ".workbuddy/tmp/shotsb15")
OUT = os.path.join(ROOT, "咔哒书-贴纸坐标系-改前改后.png")

BG = (248, 247, 244)
INK = (24, 22, 20)
SUB = (62, 58, 53)
ACC = (176, 112, 26)
BAD = (179, 38, 30)

PAD = 26
CW = 1400
CONTENT = CW - PAD * 2
CAP_H = 27


def F(sz, bold=False):
    p = r"C:/Windows/Fonts/msyhbd.ttc" if bold else r"C:/Windows/Fonts/msyh.ttc"
    try:
        return ImageFont.truetype(p, sz)
    except Exception:
        return ImageFont.load_default()


def plain(t):
    return t.replace("**", "")


def wrap(d, txt, font, maxw):
    lines, cur = [], ""
    for ch in txt:
        if ch == "\n":
            lines.append(cur); cur = ""; continue
        if d.textlength(cur + ch, font=font) > maxw:
            cut = cur.rfind(" ")
            if cut > len(cur) * 0.55:
                lines.append(cur[:cut]); cur = cur[cut + 1:] + ch
            else:
                lines.append(cur); cur = ch
        else:
            cur += ch
    if cur:
        lines.append(cur)
    return [plain(s) for s in lines]


def load(n):
    return Image.open(os.path.join(S, n)).convert("RGB")


def fitw(im, w):
    k = w / im.width
    return im.resize((w, max(1, int(round(im.height * k)))), Image.LANCZOS)


def crop(im, box):
    """⚠ 必须**钳到图内**：PIL 的 crop 允许越界，越界部分补**黑**。
    实测 CDP 的 screenshot 拿到的是 1384x805（比 windowSize 小），
    按 1400x900 裁就会在右边/下面多出一条黑边，看上去像"截图截坏了"。"""
    x0, y0, x1, y1 = box
    x0 = max(0, min(x0, im.width - 1)); x1 = max(x0 + 1, min(x1, im.width))
    y0 = max(0, min(y0, im.height - 1)); y1 = max(y0 + 1, min(y1, im.height))
    return im.crop((x0, y0, x1, y1))


# -------- 素材 --------
# ⚠ section() 是**单行**布局：一行塞 4 张 640 宽的图会排到画布外（图上只剩前两张，
#   后两张静默消失）。所以牛皮纸拆成"改前 / 改后"两组，每组两张。
bk_b1 = fitw(crop(load("before-kraft.png"), (100, 100, 600, 700)), 660)   # 改前 成片
bk_b2 = fitw(crop(load("before-kraft.png"), (710, 100, 1210, 700)), 660)  # 改前 红框
bk_a1 = fitw(crop(load("after-kraft.png"),  (100, 100, 600, 700)), 660)   # 改后 成片
bk_a2 = fitw(crop(load("after-kraft.png"),  (710, 100, 1210, 700)), 660)  # 改后 红框

# 11 个模版整宽铺 —— 660 宽时每格只剩 100px，红框看不出来
all_before = fitw(crop(load("before-all.png"), (0, 0, 1360, 790)), CONTENT)
all_after  = fitw(crop(load("after-all.png"),  (0, 0, 1360, 790)), CONTENT)

FOOT = [
    "· 根因**不在贴纸代码里**：牛皮纸模版是 `translate(W/2,H*.45); rotate(-.028)` 之后才 `c.paint(-pw/2,-ph/2,…)` 的，",
    "  于是 drawFit 返回的矩形是**调用点的局部坐标**（-345.6,-460.8，矩形有 3/4 落在画布外，中心正好压在画布左上角）。",
    "  它却被当成「画布像素」用 → 拖拽换算 (px-rc.dx)/dw 得到**负数** → clamp(0,1) 夹回 0 → 往右/往下纹丝不动。",
    "· 修法：`rectThruM(rc, ctx.getTransform())` —— 把矩形四个角过一遍**绘制那一刻的 CTM** 取外接矩形。",
    "  旋转下矩形的中心点不变，所以 (.5,.5) 仍然精确；不返回矩阵，是为了不给「两套坐标系」留后门。",
    "· 顺带查出三个同源缺陷（只看牛皮纸发现不了，靠「11 个模版全量量一遍」才逼出来）：",
    "    ① 双色压根不调 c.paint（自己 makeDuotone + drawImage）→ 没人申报，矩形退化成整块画布，锚点偏 90px；",
    "    ② 九宫格「面积最大者胜」用严格 `>`，而九格面积差在 1e-6 px² 以下 → 赢家由**舍入**决定（去掉容差会跳到另一格）；",
    "    ③ cover 溢出的那一圈被算成照片（明信片上下各 158px）→ 贴纸会飘到照片外面，而面板的虚线还画在「照片边界」上。",
    "· 验：test_batch2 90 → 101 项；把同一套断言打回「改前」产物，**9 项失败**（含往右/往下两条本身）。",
]

# -------- 先算总高 --------
probe = ImageDraw.Draw(Image.new("RGB", (10, 10)))
f_foot = F(19)
foot_h = sum(24 * len(wrap(probe, t, f_foot, CONTENT)) for t in FOOT)

H_TITLE, H_SUB = 42, 26
H_SEC, GAP_SEC, GAP_BLOCK = 30, 16, 26
ROW1 = max(bk_b1.height, bk_b2.height) + CAP_H

TOTAL = (26 + H_TITLE + H_SUB + 24
         + 4 * (H_SEC + GAP_SEC + ROW1 + GAP_BLOCK)
         + 2 * (H_SEC + GAP_SEC + all_before.height + CAP_H + GAP_BLOCK)
         + 18 + foot_h + 34)

canvas = Image.new("RGB", (CW, TOTAL), BG)
d = ImageDraw.Draw(canvas)

y = 26
d.text((PAD, y), "咔哒书 · 牛皮纸「贴纸拖不动」的根因：照片矩形串了坐标系（第十五轮）",
       font=F(31, True), fill=INK)
y += H_TITLE
d.text((PAD, y), "红虚线 = 代码认定的「照片在哪儿」（photoRect）　红点 = 贴纸放在 (.5,.5) 时的落点",
       font=F(19), fill=SUB)
y += H_SUB
d.text((PAD, y), "10 个测试套件 / 404 项全绿　·　test_batch2 90 → 101　·　产物 1.122 MB（余量 79.8 KB）",
       font=F(19), fill=ACC)
y += 24


def section(title, imgs, caps, gap=22, color=ACC):
    global y
    d.rectangle((PAD, y + 5, PAD + 5, y + 23), fill=color)
    d.text((PAD + 14, y), title, font=F(23, True), fill=INK)
    top = y + H_SEC + GAP_SEC
    x, hmax = PAD, 0
    for i, im in enumerate(imgs):
        canvas.paste(im, (x, top))
        h = im.height
        if caps and len(caps) > i and caps[i]:
            d.text((x, top + h + 7), caps[i], font=F(17), fill=SUB)
            h += CAP_H
        hmax = max(hmax, h)
        x += im.width + gap
    y = top + hmax + GAP_BLOCK


section("① 牛皮纸 · 改前（同一枚贴纸放在 (.5,.5)）",
        [bk_b1, bk_b2],
        ["成片：贴纸被烧在画布左上角，照片里根本没有",
         "红框大半在画布外，红点压在画布左上角"],
        color=BAD)
section("① 牛皮纸 · 改后（同样的设置）",
        [bk_a1, bk_a2],
        ["成片：贴纸落在照片中心",
         "红框=照片，红点=红框中心（面板所见即成片所得）"])
section("② 全部 11 个模版 · 改前", [all_before],
        ["kraft / polaroid / postcard 的红框越出成片；双色 0,0 退化成整块画布"],
        color=BAD)
section("② 全部 11 个模版 · 改后", [all_after],
        ["11 个红框全部落在照片上，红点全在红框中心"])

d.line((PAD, y - 8, CW - PAD, y - 8), fill=(222, 217, 208), width=1)
for t in FOOT:
    for ln in wrap(d, t, f_foot, CONTENT):
        d.text((PAD, y), ln, font=f_foot, fill=SUB)
        y += 24

canvas.save(OUT)
print("->", OUT, canvas.size)
