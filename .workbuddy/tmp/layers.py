# -*- coding: utf-8 -*-
"""逐个关闭图层，定位异常叠加。"""
import io, os, subprocess
from PIL import Image
TMP=r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC=r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html"
SHOT=os.path.join(TMP,"shots")
CHROME=r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"
base=io.open(SRC,encoding="utf-8").read()

VAR={
 "A_all":       [],
 "B_noshadow":  [("if(kA>=0&&kB>kA){\n    const x1=Math.min(sxp[kA],sxp[kB]), x2=Math.max(sxp[kA],sxp[kB]);\n    ctx.save();\n    if(this.filterOK) ctx.filter='blur(19px)';","if(false){\n    const x1=0,x2=0;\n    ctx.save();\n    if(this.filterOK) ctx.filter='blur(19px)';")],
 "C_noshade":   [("shade(0,kr); shade(kr,N);","")],
 "D_noHI":      [("gg.addColorStop(.46,'rgba(255,253,246,.26)');","gg.addColorStop(.46,'rgba(255,253,246,0)');")],
 "E_flatshade": [("let d=.035+.60*Math.pow(bend,1.12);","let d=.035+.60*Math.pow(bend,1.12); d=.035;")],
}
PS=[0.25,0.5]
for name,reps in VAR.items():
    h=base
    for a,b in reps:
        assert a in h, (name, a[:40])
        h=h.replace(a,b,1)
    files=[]
    for p in PS:
        body=("await ready(); freeze(); noTilt(); BV.cur=2; BV.off=BV.targetOff(); BV.offT=BV.off;"
              "BV.live={i:2,dir:'fwd',p:%f}; BV.bowBoost=0; BV.layout(); BV.draw(); await sleep(300); BV.draw(); await sleep(150);"%p)
        inj=("<script>(function(){function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}"
             "function freeze(){if(BV.raf){try{cancelAnimationFrame(BV.raf);}catch(e){} BV.raf=0;}}"
             "function noTilt(){BV.tilt.x=0;BV.tilt.y=0;BV.tiltT.x=0;BV.tiltT.y=0;BV.cv.style.transform='';}"
             "async function ready(){for(var i=0;i<240;i++){await sleep(150);if(state.generated.length>=28&&state.step===2)break;}"
             "var end=performance.now()+2200;while(performance.now()<end){BV.raf=0;try{BV.step(performance.now());}catch(e){}await sleep(10);}}"
             "var BV=window.LUMEN.BV,state=window.LUMEN.state;"
             "async function main(){try{"+body+"}catch(e){document.title='ERR '+e.message;}}setTimeout(main,400);})();</script>")
        hh=h.replace("</body>",inj+"</body>")
        pp=os.path.join(TMP,"lay.html"); io.open(pp,"w",encoding="utf-8",newline="\n").write(hh)
        out=os.path.join(SHOT,"%s-%02d.png"%(name,int(p*100))).replace("\\","/")
        subprocess.run([CHROME,"--headless","--disable-gpu","--no-sandbox","--mute-audio","--hide-scrollbars",
                        "--window-size=1512,900","--virtual-time-budget=60000","--screenshot="+out,
                        "file:///"+pp.replace("\\","/")],capture_output=True,timeout=600)
        files.append(out)
    ims=[Image.open(f).convert("RGB") for f in files]
    W,H=ims[0].size; cw,ch=int(W*.52),int(H*.62)
    x0=(W-cw)//2; y0=int(H*.13)
    crops=[im.crop((x0,y0,x0+cw,y0+ch)) for im in ims]
    tw,th=int(cw*.62),int(ch*.62)
    sheet=Image.new("RGB",(2*tw,th),(10,10,12))
    for i,im in enumerate(crops): sheet.paste(im.resize((tw,th),Image.LANCZOS),(i*tw,0))
    sheet.save(os.path.join(SHOT,name+".png"))
    print(name,"ok",sheet.size)
