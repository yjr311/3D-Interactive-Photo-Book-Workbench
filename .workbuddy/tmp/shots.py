# -*- coding: utf-8 -*-
"""生成预览截图：静置跨页 / 翻页中 / 模版步 / 阅读器 / 窄窗。"""
import io, os, re, subprocess, sys

TMP = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html"
SHOT = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shots"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"
os.makedirs(SHOT, exist_ok=True)

COMMON = r"""
function freeze(){ if(BV.raf){ try{cancelAnimationFrame(BV.raf);}catch(e){} BV.raf=0; } }
function noTilt(){ BV.tilt.x=0;BV.tilt.y=0;BV.tiltT.x=0;BV.tiltT.y=0;BV.cv.style.transform=''; }
async function ready(){
  for(var i=0;i<240;i++){ await sleep(150); if(state.generated.length>=28&&state.step===2) break; }
  // 等封面开合动画
  var end=performance.now()+2000;
  while(performance.now()<end){ BV.raf=0; try{BV.step(performance.now());}catch(e){} await sleep(10); }
}
"""

SHOTS = [
    ("shot1-book.png", 1512, 900, r"""
      await ready(); freeze(); noTilt();
      BV.cur=1; BV.anim=null; BV.live=null; BV.offT=BV.targetOff(); BV.off=BV.offT;
      BV.draw(); document.getElementById('bvHintDummy');
      await sleep(400);
    """),
    ("shot2-flip.png", 1512, 900, r"""
      await ready(); freeze(); noTilt();
      BV.cur=1; BV.off=0; BV.offT=0;
      BV.live={i:1,dir:'fwd',p:0.52};
      BV.bowBoost=0.10;
      BV.draw();
      await sleep(400);
    """),
    ("shot3-templates.png", 1512, 900, r"""
      await ready(); freeze();
      setStep(1);
      await sleep(900);
      window.scrollTo(0,0);
    """),
    ("shot4-reader.png", 1512, 900, r"""
      await ready(); freeze(); noTilt();
      BV.cur=4; BV.anim=null; BV.live=null; BV.offT=BV.targetOff(); BV.off=BV.offT;
      openReader();
      await sleep(700);
      freeze(); BV.draw();
      await sleep(300);
    """),
    ("shot5-flipback.png", 1512, 900, r"""
      await ready(); freeze(); noTilt();
      BV.cur=5; BV.off=0; BV.offT=0;
      BV.live={i:4,dir:'back',p:0.62};
      BV.bowBoost=0.0;
      BV.draw();
      await sleep(400);
    """),
    ("shot6-narrow.png", 1280, 700, r"""
      await ready(); freeze(); noTilt();
      BV.cur=1; BV.anim=null; BV.live=null; BV.offT=BV.targetOff(); BV.off=BV.offT;
      BV.layout(); BV.draw();
      await sleep(400);
    """),
]

for name, w, h, body in SHOTS:
    inj = ("<script>\n(function(){\n"
           "function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}\n"
           + COMMON +
           "var BV=window.LUMEN.BV, state=window.LUMEN.state, setStep=null;\n"
           "async function main(){ try{ " + body + " }catch(e){ document.title='ERR '+e.message; } }\n"
           "setTimeout(main,400);\n})();\n</script>")
    # setStep 需要走 window.LUMEN 之外的全局：注：函数在全局作用域，直接可用
    inj = inj.replace("var BV=window.LUMEN.BV, state=window.LUMEN.state, setStep=null;",
                      "var BV=window.LUMEN.BV, state=window.LUMEN.state;")
    html = io.open(SRC, encoding="utf-8").read().replace("</body>", inj + "</body>")
    p = os.path.join(TMP, "shot.html")
    io.open(p, "w", encoding="utf-8", newline="\n").write(html)
    out_png = os.path.join(SHOT, name).replace("\\", "/")
    cmd = [CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio",
           "--hide-scrollbars", "--window-size=%d,%d" % (w, h),
           "--virtual-time-budget=60000", "--screenshot=" + out_png,
           "file:///" + p.replace("\\", "/")]
    r = subprocess.run(cmd, capture_output=True, timeout=600)
    ok = os.path.exists(out_png) and os.path.getsize(out_png) > 5000
    print("%-22s %s  %s" % (name, "OK" if ok else "FAIL",
                            (str(os.path.getsize(out_png)) + "B") if ok else r.stderr.decode("utf-8", "replace")[:200]))
