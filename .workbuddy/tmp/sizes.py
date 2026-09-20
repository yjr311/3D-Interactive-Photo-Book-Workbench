# -*- coding: utf-8 -*-
import io,os,re,subprocess,html as H
TMP=r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp"
SRC=r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html"
CHROME=r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"
INJ=r"""
<script>(function(){
window.__err=[];window.addEventListener('error',function(e){window.__err.push('ERR '+(e.message||''));});
function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
function rc(s){var e=document.querySelector(s);if(!e)return null;var b=e.getBoundingClientRect();
 return [Math.round(b.top),Math.round(b.bottom),Math.round(b.height)];}
async function main(){
  for(var i=0;i<240;i++){ await sleep(120); if(window.LUMEN&&LUMEN.state.generated.length>=28&&LUMEN.state.step===2) break; }
  await sleep(700);
  var o={iw:innerWidth,ih:innerHeight,sh:document.documentElement.scrollHeight,cw:document.documentElement.clientWidth};
  var bad=[];
  var st=document.querySelector('.strip'), it=document.querySelectorAll('.sitem');
  var sb=st?st.getBoundingClientRect():null;
  if(sb){
    o.strip=[Math.round(sb.top),Math.round(sb.bottom)];
    for(var i=0;i<it.length;i++){var b=it[i].getBoundingClientRect();
      if(b.height<2) continue;
      if(b.top<sb.top-1||b.bottom>sb.bottom+1) bad.push('sitem '+Math.round(b.top)+'..'+Math.round(b.bottom)+' vs '+Math.round(sb.top)+'..'+Math.round(sb.bottom));
    }
  }
  if(o.sh>o.ih+1) bad.push('docScroll '+o.sh+'>'+o.ih);
  if(o.cw>o.iw+1) bad.push('docWidth '+o.cw+'>'+o.iw);
  o.bad=bad; o.err=window.__err;
  for(var k of ['.app','.work','.dock','.stage','.bv','.panel']){ o[k]=rc(k); }
  var d=document.createElement('div');d.id='__d';d.setAttribute('data-r',JSON.stringify(o));d.style.display='none';document.body.appendChild(d);
}
setTimeout(main,400);})();</script>"""
h=io.open(SRC,encoding="utf-8").read().replace("</body>",INJ+"</body>")
p=os.path.join(TMP,"sz.html");io.open(p,"w",encoding="utf-8",newline="\n").write(h)
for w,ht in [(1920,1080),(1600,1000),(1512,900),(1440,800),(1366,720),(1280,700),(1280,640),(1100,780),(900,700)]:
    r=subprocess.run([CHROME,"--headless","--disable-gpu","--no-sandbox","--mute-audio","--hide-scrollbars",
       "--window-size=%d,%d"%(w,ht),"--virtual-time-budget=40000","--dump-dom","file:///"+p.replace("\\","/")],capture_output=True,timeout=300)
    dom=r.stdout.decode("utf-8","replace")
    m=re.search(r'id="__d" data-r="(.*?)"',dom,re.S)
    if not m: print(w,ht,"NO DATA"); continue
    import json
    o=json.loads(H.unescape(m.group(1)))
    ok = (not o['bad']) and (not o['err'])
    print("%5dx%-5d %s vp=%dx%d scrollH=%d dock=%s bv=%s %s%s" % (
        w,ht,"OK " if ok else "BAD",o['iw'],o['ih'],o['sh'],
        o.get('.dock'),o.get('.bv'),("bad="+str(o['bad'])) if o['bad'] else "",(" err="+str(o['err'])) if o['err'] else ""))
