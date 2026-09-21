# -*- coding: utf-8 -*-
"""第二批「能玩」落地取证图：把 shotsb2/ 里那几张拼成一张工作区级对照图。

⚠ 拼图脚本的老坑（第十二轮）：给末排文字留的边距要够，否则最后一排说明会被画到画布外，
   看起来像"被截断"。所以这里统一**先算总高、再画**，而不是边画边追加。
"""
import os
from PIL import Image, ImageDraw, ImageFont

ROOT = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14"
S = os.path.join(ROOT, ".workbuddy/tmp/shotsb2")
OUT = os.path.join(ROOT, "咔哒书-第二批-能玩.png")

BG = (248, 247, 244)
INK = (24, 22, 20)
SUB = (62, 58, 53)
ACC = (176, 112, 26)

PAD = 26
CW = 1180
CONTENT = CW - PAD * 2
CAP_H = 24          # 单张图下方的小注一行高


def F(sz, bold=False):
    p = r"C:/Windows/Fonts/msyhbd.ttc" if bold else r"C:/Windows/Fonts/msyh.ttc"
    try:
        return ImageFont.truetype(p, sz)
    except Exception:
        return ImageFont.load_default()


def plain(t):
    """图里的文字不认 markdown —— `**加粗**` 会原样画出两个星号，这里先剥掉。"""
    return t.replace("**", "")


def wrap(d, txt, font, maxw):
    """逐字断行；但若溢出点落在拉丁词中间（如 `0.738`），就退回最近一个空格再断，
    免得把数字劈成 "0." / "738" —— 拼图脚本里这种瑕疵最显眼。"""
    lines, cur = [], ""
    for ch in txt:
        if ch == "\n":
            lines.append(cur); cur = ""; continue
        if d.textlength(cur + ch, font=font) > maxw:
            cut = cur.rfind(" ")
            if cut > len(cur) * 0.55:      # 空格离行尾不远 -> 在空格处断
                lines.append(cur[:cut])
                cur = cur[cut + 1:] + ch
            else:
                lines.append(cur); cur = ch
        else:
            cur += ch
    if cur:
        lines.append(cur)
    return [plain(s) for s in lines]


def load(name):
    return Image.open(os.path.join(S, name)).convert("RGB")


def fitw(im, w):
    k = w / im.width
    return im.resize((w, max(1, int(round(im.height * k)))), Image.LANCZOS)


# ---------------- 素材 ----------------
stk    = fitw(load("01-八枚贴纸.png"), CONTENT)                        # 八枚贴纸（白底样张）
photo  = fitw(load("02-贴纸在照片上.png"), 640)                         # 原样 vs 贴满
panel  = fitw(load("05z-面板放大.png").crop((0, 150, 622, 800)), 466)   # 面板：照片比例的画布
pages  = fitw(load("03-书页版式对照.png"), CONTENT)                     # 五种版式
covers = fitw(load("04-封面与封底寄语.png"), CONTENT)                   # 封面与封底寄语

H_TITLE, H_SUB, H_SEC, GAP_SEC, GAP_BLOCK, H_FOOT_LINE = 42, 26, 30, 16, 28, 25

FOOT = [
    "· 贴纸坐标是「相对照片」的 0..1，并**烧进成片** —— 切「干净照片」／当封面／导分享长图都不丢；一册最多 6 枚。",
    "· 八枚贴纸都真能画（在白底画布上数非白像素）；同一枚贴纸在 5 种画幅上落在同一归一化点（x 0.740 / 0.739 / 0.740 / 0.739 / 0.738，短边占比同为 18.1%）。",
    "· 反向对照：清空贴纸后画面**逐像素还原**；封面寄语为空时与「确定性重渲染」的差异是 0 个像素。",
    "· 九宫格**不进任何一键推荐**（可主动选，但不推荐）：一键成书是给不想做决定的人用的，28 张铺成九宫格联系表不是相册。",
    "· 封底寄语最多 3 行、超了收省略号，字号 W*.0234，落在 END OF VOLUME 细线与条形码之间。",
]

# ---------------- 先算总高 ----------------
probe = ImageDraw.Draw(Image.new("RGB", (10, 10)))
f_foot = F(19)
foot_h = sum(H_FOOT_LINE * len(wrap(probe, t, f_foot, CONTENT)) for t in FOOT)

row2_h = max(photo.height, panel.height + CAP_H)

TOTAL = (26 + H_TITLE + H_SUB + 24
         + (H_SEC + GAP_SEC + stk.height + GAP_BLOCK)
         + (H_SEC + GAP_SEC + row2_h + GAP_BLOCK)
         + (H_SEC + GAP_SEC + pages.height + GAP_BLOCK)
         + (H_SEC + GAP_SEC + covers.height + GAP_BLOCK)
         + 20 + foot_h + 34)

canvas = Image.new("RGB", (CW, TOTAL), BG)
d = ImageDraw.Draw(canvas)

y = 26
d.text((PAD, y), "咔哒书 · 第二批「能玩」落地（第十三轮）", font=F(33, True), fill=INK)
y += H_TITLE
d.text((PAD, y), "贴纸与手写圈 · 氛围音效 · 九宫格小卡页 · 日期戳 / 票根 · 双封面寄语", font=F(19), fill=SUB)
y += H_SUB
d.text((PAD, y), "10 个测试套件 / 379 项全绿　·　产物 1.119 MB（余量 83 KB）　·　零依赖单文件",
       font=F(19), fill=ACC)
y += 24


def section(title, imgs, caps=None):
    """一行放若干张图；caps[i] 为 None 表示这张不写小注。"""
    global y
    d.rectangle((PAD, y + 5, PAD + 5, y + 23), fill=ACC)
    d.text((PAD + 14, y), title, font=F(23, True), fill=INK)
    top = y + H_SEC + GAP_SEC
    x, hmax = PAD, 0
    for i, im in enumerate(imgs):
        canvas.paste(im, (x, top))
        h = im.height
        if caps and len(caps) > i and caps[i]:
            d.text((x, top + h + 6), caps[i], font=F(17), fill=SUB)
            h += CAP_H
        hmax = max(hmax, h)
        x += im.width + 22
    y = top + hmax + GAP_BLOCK


section("① 八枚贴纸（实际画法 · 白底样张）", [stk])
section("② 同一张照片：原样 / 贴满，以及贴纸面板",
        [photo, panel],
        [None, "⑤ 面板：照片比例的画布，点一下就挪过去，也能按住拖"])
section("③ 五种书页版式（满版出血 / 贴纸手账 / 居中留白 / 九宫格小卡 ×2）", [pages])
section("④ 双封面寄语（封底超长会自动收在 3 行内）", [covers])

d.line((PAD, y - 10, CW - PAD, y - 10), fill=(222, 217, 208), width=1)
for t in FOOT:
    for ln in wrap(d, t, f_foot, CONTENT):
        d.text((PAD, y), ln, font=f_foot, fill=SUB)
        y += H_FOOT_LINE

canvas.save(OUT)
print("->", OUT, canvas.size)
