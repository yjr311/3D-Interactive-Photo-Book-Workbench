# -*- coding: utf-8 -*-
"""布局探针：输出关键元素的几何与溢出情况。"""
import io, os, re, subprocess

TMP = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"

PROBE = r"""
<script>
(function(){
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
var out={};
function r(sel){
  var e=document.querySelector(sel); if(!e) return null;
  var b=e.getBoundingClientRect(); var cs=getComputedStyle(e);
  return {x:Math.round(b.x),y:Math.round(b.y),w:Math.round(b.width),h:Math.round(b.height),
          bottom:Math.round(b.bottom),disp:cs.display,of:cs.overflow,pos:cs.position,ht:cs.height};
}
async function main(){
  for(var i=0;i<240;i++){ await sleep(120); if(window.LUMEN&&LUMEN.state.generated.length>=28&&LUMEN.state.step===2) break; }
  await sleep(600);
  out.vp={iw:innerWidth,ih:innerHeight,de_scrollH:document.documentElement.scrollHeight,
          de_clientH:document.documentElement.clientHeight,b_scrollH:document.body.scrollHeight,
          scrollX:window.scrollX,scrollY:window.scrollY,sw:document.documentElement.scrollWidth};
  ['.app','.top','.work','.rail','.stage','.panel','.dock','.dock-inner','.dock-tabs','.tplbar','.strip','.strip-track','.scard','.tplcard','.stage-body','.bv'].forEach(function(s){ out[s]=r(s); });
  // 溢出检测
  out.over=[];
  ['.dock-inner','.strip','.tplbar','.rail','.panel'].forEach(function(s){
    var e=document.querySelector(s); if(!e) return;
    var b=e.getBoundingClientRect();
    var kids=[].slice.call(e.children);
    kids.forEach(function(k){
      var kb=k.getBoundingClientRect(); if(kb.width===0&&kb.height===0) return;
      if(kb.bottom>b.bottom+1||kb.top<b.top-1||kb.right>b.right+1)
        out.over.push(s+'>'+k.className+' '+Math.round(kb.top)+'..'+Math.round(kb.bottom)+' vs '+Math.round(b.top)+'..'+Math.round(b.bottom));
    });
  });
  var card=document.querySelector('.scard');
  if(card){ var cb=card.getBoundingClientRect(); var st=document.querySelector('.strip').getBoundingClientRect();
    out.card={top:cb.top,bottom:cb.bottom,h:cb.height,stripTop:st.top,stripBottom:st.bottom,stripH:st.height}; }
  var d=document.createElement('div'); d.id='__probe'; d.setAttribute('data-r',JSON.stringify(out));
  d.style.display='none'; document.body.appendChild(d);
}
setTimeout(main,400);
})();
</script>
"""

html = io.open(SRC, encoding="utf-8").read().replace("</body>", PROBE + "</body>")
p = os.path.join(TMP, "probe.html")
io.open(p, "w", encoding="utf-8", newline="\n").write(html)
cmd = [CHROME, "--headless", "--disable-gpu", "--no-sandbox", "--mute-audio", "--hide-scrollbars",
       "--window-size=1512,900", "--virtual-time-budget=45000", "--dump-dom",
       "file:///" + p.replace("\\", "/")]
r = subprocess.run(cmd, capture_output=True, timeout=300)
dom = r.stdout.decode("utf-8", "replace")
m = re.search(r'id="__probe" data-r="(.*?)"', dom, re.S)
if not m:
    print("PROBE FAILED"); print(dom[-1500:]); raise SystemExit(1)
import html as H, json
data = json.loads(H.unescape(m.group(1)))
for k, v in data.items():
    print(k, "=", v)
