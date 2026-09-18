# -*- coding: utf-8 -*-
"""生成最终预览图到工作区。

本轮（第五轮）重点在「书本观感 + 翻页手感」，所以预览图上多了两件证据：
  · 翻页九宫格改成**两排**：上排是硬封面翻开（刚体平板 + 板厚度），
    下排是内页翻开（纸的卷曲）—— 一眼能看出两种材质在做不同的事。
  · 新增「书页版式」联页图，把封面/环衬/扉页/内页/封底摊开看。
"""
import io, os, subprocess, shutil
from PIL import Image

TMP = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/光匣-3D互动照片书.html"
OUT = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"
S = os.path.join(TMP, "shots")
os.makedirs(S, exist_ok=True)

BASE = io.open(SRC, encoding="utf-8").read()

COMMON = r"""
function freeze(){ if(BV.raf){ try{cancelAnimationFrame(BV.raf);}catch(e){} BV.raf=0; } }
function noTilt(){ BV.tilt.x=0;BV.tilt.y=0;BV.tiltT.x=0;BV.tiltT.y=0;BV.cv.style.transform=''; }
function hud(t){ var z=document.getElementById('pvZoom'); if(z){ z.textContent=t; z.classList.add('on'); } }
async function ready(){
  /* 首屏现在刻意不自动载入示例，这里显式载入 + 显式生成 */
  if(state.photos.length<28){ try{ await window.LUMEN.loadEmbedded(true); }catch(e){} }
  if(state.generated.length<28){ try{ await window.LUMEN.generate(); }catch(e){ document.title='ERR gen '+e.message; } }
  for(var i=0;i<240;i++){ await sleep(150); if(state.generated.length>=28&&state.step===2) break; }
  var end=performance.now()+2200;
  while(performance.now()<end){ BV.raf=0; try{BV.step(performance.now());}catch(e){} await sleep(10); }
}
/* 给每张照片轮着分配不同模版，好让「每张各有各的模版」在截图里看得出来 */
function assignEach(){
  var keys=Object.keys(window.LUMEN.TPL);
  state.photos.forEach(function(p,i){ p.tpl=keys[i%keys.length]; });
  state.sel=state.photos[0].id; syncTplFromSel();
  renderRail(); renderPanel(); renderDock();
}
/* 只留前 14 张入册，缩略图上能看到「已入册 / 未入册」两种状态 */
function pickSome(){
  state.photos.forEach(function(p,i){ p.picked=(i<14); });
  renderRail(); renderPanel();
}
/* 把某一翻固定在 p 处定格（确定性截图用） */
function holdFlip(i,p){
  BV.anim=null; BV.cur=i; BV.offT=BV.targetOff();
  BV.live={i:i,dir:'fwd',p:p}; BV.off=BV.targetOff(); BV.bowBoost=0;
  BV.layout(); BV.cur=i; BV.offT=BV.targetOff(); BV.off=BV.targetOff();
  BV.live={i:i,dir:'fwd',p:p};
  freeze(); BV.draw();
}
"""


def inject(body, extra_head=""):
    return ("<script>\n(function(){\n"
            "function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}\n"
            + COMMON +
            "var BV=window.LUMEN.BV, state=window.LUMEN.state;\n"
            "async function main(){ try{ " + body + " }catch(e){ document.title='ERR '+e.message; } }\n"
            "setTimeout(main,400);\n})();\n</script>")


def shoot(body, out_png, extra_head="", win="1512,900"):
    html = BASE.replace("</body>", extra_head + inject(body) + "</body>")
    p = os.path.join(TMP, "pv.html")
    io.open(p, "w", encoding="utf-8", newline="\n").write(html)
    subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio",
                    "--hide-scrollbars", "--window-size=" + win,
                    "--virtual-time-budget=60000", "--screenshot=" + out_png,
                    "file:///" + p.replace("\\", "/")], capture_output=True, timeout=600)
    return os.path.exists(out_png)


SHOTS = [
    # 0. 首屏：空的，只有引导 + 空素材栏 + 演示用胶片带
    ("p0", "freeze(); noTilt(); setStep(0); await sleep(900); BV.raf=0;"),
    # 1. 导入与规格：缩略图带模版徽章 + 入册勾选圈，部分未入册
    ("p1", "await ready(); freeze(); noTilt(); assignEach(); pickSome(); setStep(0); await sleep(900); BV.raf=0;"),
    # 2. 逐张分配模版：选中一张，胶片带高亮跟随，面板显示模版分配统计
    ("p2", "await ready(); freeze(); noTilt(); setStep(1); await sleep(500);"
           "assignEach(); await sleep(300);"
           "state.sel=state.photos[2].id; syncTplFromSel();"
           "renderRail(); renderPanel(); renderDock(); renderPreview(); await sleep(700);"
           "pvZoomAt(1.35); await sleep(300); pvZoomAt(1.35); hud('135%'); await sleep(140);"),
    # 3. 选片成书（3D 选片条居中、两侧箭头）
    ("p3", "await ready(); freeze(); noTilt(); assignEach(); pickSome(); setStep(2); await sleep(600);"
           "document.querySelectorAll('.sitem')[3].dispatchEvent(new MouseEvent('click',{bubbles:true}));"
           "stripSettle(3); await sleep(800); freeze(); BV.draw(); await sleep(200);"),
    # 4. 浅色主题
    ("p4light", "await ready(); freeze(); noTilt(); setStep(2); await sleep(400);"
                "document.getElementById('themeBtn').click(); await sleep(500);"
                "BV.cur=3; BV.anim=null; BV.live=null; BV.offT=BV.targetOff(); BV.off=BV.offT;"
                "BV.layout(); BV.draw(); await sleep(400);"),
    # 5. 沉浸阅读：内页跨页（干净照片 + 细线图注 + 外下角页码）
    ("p5reader", "await ready(); freeze(); noTilt(); BV.cur=6; BV.anim=null; BV.live=null;"
                 "BV.offT=BV.targetOff(); BV.off=BV.offT; openReader(); await sleep(1400);"
                 "freeze(); BV.draw(); await sleep(400);"),
    # 6. 封面：单独居中（showCover 行为），自动挑出的主图 + 四段式中轴排版
    ("p6cover", "await ready(); freeze(); noTilt(); openReader(); await sleep(1200);"
                "BV.cur=0; BV.anim=null; BV.live=null; BV.offT=BV.targetOff(); BV.off=BV.offT;"
                "BV.layout(); freeze(); BV.draw(); await sleep(500);"),
]

for name, body in SHOTS:
    o = os.path.join(S, name + ".png").replace("\\", "/")
    print(name, "ok" if shoot(body, o) else "FAIL")

# ---- 翻页九宫格：上排硬封面、下排内页 ----
STYLE = ("<style>.rail,.panel,.dock{display:none!important}"
         ".work{grid-template-columns:minmax(0,1fr)!important;min-height:0!important}"
         ".stage{min-height:0!important}.bv-thumbs,.bv-hint,.stage-note{display:none!important}</style>")
PS = [0.10, 0.34, 0.50, 0.70]
frames = []
for sheet, tag in ((0, "hard"), (4, "paper")):
    for p in PS:
        body = ("await ready(); freeze(); noTilt();"
                "holdFlip(%d,%f); await sleep(320); freeze(); BV.draw(); await sleep(200);"
                % (sheet, p))
        o = os.path.join(S, "f-%s-%02d.png" % (tag, int(p * 100))).replace("\\", "/")
        if shoot(body, o, STYLE):
            frames.append((tag, o))
            print("frame", tag, p, "ok")

# ---- 书页联页图：把封面/环衬/扉页/内页/封底摊开 ----
PICK = ("0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,PAGES-2,PAGES-1")
MONTAGE = ("""
(function(){
  var L=window.LUMEN;
  var pages=L.buildBookPages().pages;
  var idx='%s'.split(',').map(function(t){ return t==='PAGES-2'?pages.length-2:(t==='PAGES-1'?pages.length-1:parseInt(t,10)); });
  var COLS=6, ROWS=3;
  var CW=236, CH=Math.round(CW*pages[0].canvas.height/pages[0].canvas.width);
  var m=document.createElement('canvas');
  m.width=COLS*(CW+10)+10; m.height=ROWS*(CH+30)+10;
  var x=m.getContext('2d');
  x.fillStyle='#15171c'; x.fillRect(0,0,m.width,m.height);
  idx.forEach(function(k,i){
    var cx=10+(i%%COLS)*(CW+10), cy=10+Math.floor(i/COLS)*(CH+30);
    x.drawImage(pages[k].canvas,cx,cy+22,CW,CH);
    x.strokeStyle='rgba(255,255,255,.24)'; x.lineWidth=1; x.strokeRect(cx+.5,cy+22.5,CW-1,CH-1);
    x.fillStyle='#c9c6c0'; x.font='600 13px system-ui,sans-serif';
    x.fillText('#'+k+'  '+pages[k].kind,cx+1,cy+16);
  });
  m.style.cssText='position:fixed;left:0;top:0;z-index:99999';
  document.body.appendChild(m);
  document.title='montage';
  return 1;
})();
""" % PICK)

html = BASE.replace("</body>", STYLE + inject("await ready(); " + MONTAGE + " await sleep(500);") + "</body>")
p = os.path.join(TMP, "pvmon.html")
io.open(p, "w", encoding="utf-8", newline="\n").write(html)
mont = os.path.join(S, "pages.png").replace("\\", "/")
subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio",
                "--hide-scrollbars", "--window-size=1490,900",
                "--virtual-time-budget=60000", "--screenshot=" + mont,
                "file:///" + p.replace("\\", "/")], capture_output=True, timeout=600)
print("pages montage", "ok" if os.path.exists(mont) else "FAIL")

# ---- 书页画面对照：上排「模版成品」、下排「干净照片」（同一个版式、同几页） ----
CMPBODY = ("""
(function(){
  var L=window.LUMEN, st=L.state;
  function grab(){
    var pages=L.buildBookPages().pages.filter(function(p){ return p.kind==='content'; });
    var want=[0,2,5,9], out=[];
    want.forEach(function(i){ if(pages[i]) out.push(pages[i].canvas); });
    return out;
  }
  st.book.art='tpl';   var A=grab();
  st.book.art='plain'; var B=grab();
  st.book.art='tpl';
  var COLS=4, CW=318, CH=Math.round(CW*A[0].height/A[0].width);
  var m=document.createElement('canvas');
  m.width=COLS*(CW+12)+12; m.height=2*(CH+36)+12;
  var x=m.getContext('2d');
  x.fillStyle='#15171c'; x.fillRect(0,0,m.width,m.height);
  function row(list,y,tag){
    x.fillStyle='#e8e4dc'; x.font='700 15px system-ui,sans-serif';
    x.fillText(tag,12,y+18);
    list.forEach(function(cv,i){
      var cx=12+i*(CW+12);
      x.drawImage(cv,cx,y+28,CW,CH);
      x.strokeStyle='rgba(255,255,255,.22)'; x.lineWidth=1;
      x.strokeRect(cx+.5,y+28.5,CW-1,CH-1);
    });
  }
  row(A,12,'书页画面 = 模版成品（默认）：你为每张照片挑的模版，装裱进版心');
  row(B,12+CH+36+12,'书页画面 = 干净照片：只留调色后的照片，最像一本正经的摄影集');
  m.style.cssText='position:fixed;left:0;top:0;z-index:99999';
  document.body.appendChild(m);
  document.title='cmpart';
  return 1;
})();
""")
html = BASE.replace("</body>", STYLE + inject("await ready(); " + CMPBODY + " await sleep(600);") + "</body>")
p = os.path.join(TMP, "pvcmp.html")
io.open(p, "w", encoding="utf-8", newline="\n").write(html)
cmpart = os.path.join(S, "cmpart.png").replace("\\", "/")
subprocess.run([CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio",
                "--hide-scrollbars", "--window-size=1420,1500",
                "--virtual-time-budget=60000", "--screenshot=" + cmpart,
                "file:///" + p.replace("\\", "/")], capture_output=True, timeout=600)
print("book-art compare", "ok" if os.path.exists(cmpart) else "FAIL")

# ---- 拼九宫格 ----
CR = (150, 40, 1362, 830)
ims = [Image.open(f).convert("RGB").crop(CR) for _, f in frames]
cw, ch = ims[0].size
k = 0.40
tw, th = int(cw * k), int(ch * k)
cols = len(PS)
rows = 2
sheet = Image.new("RGB", (cols * tw + (cols + 1) * 8, rows * th + (rows + 1) * 8), (12, 12, 15))
for i, im in enumerate(ims):
    x = 8 + (i % cols) * (tw + 8)
    y = 8 + (i // cols) * (th + 8)
    sheet.paste(im.resize((tw, th), Image.LANCZOS), (x, y))
sheet.save(os.path.join(S, "flipgrid.png"))
print("grid:", sheet.size)

# ---- 拷到工作区 ----
FOR = [("p0.png", "预览-00-首屏引导.png"),
       ("p1.png", "预览-01-导入与规格.png"),
       ("p2.png", "预览-02-逐张分配模版.png"),
       ("p3.png", "预览-03-选片成书.png"),
       ("p5reader.png", "预览-04-沉浸阅读.png"),
       ("p4light.png", "预览-05-浅色主题.png"),
       ("flipgrid.png", "预览-06-翻页动画.png"),
       ("p6cover.png", "预览-07-封面排布.png"),
       ("pages.png", "预览-08-书页版式.png"),
       ("cmpart.png", "预览-09-书页画面对照.png")]
for src, dst in FOR:
    sp = os.path.join(S, src)
    if os.path.exists(sp):
        shutil.copyfile(sp, os.path.join(OUT, dst))
        print("->", dst)
    else:
        print("!! missing", src)

for stale in ["预览-02-模版预览-可拖拽缩放.png"]:
    q = os.path.join(OUT, stale)
    if os.path.exists(q):
        os.remove(q); print("removed stale:", stale)
