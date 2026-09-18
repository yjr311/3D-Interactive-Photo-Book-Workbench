# -*- coding: utf-8 -*-
"""最小复现：同样的 CSS，button vs div。"""
import io, os, re, subprocess

SRC = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/光匣-3D互动照片书.html"
CHROME = r"C:/Users/zz/AppData/Local/ms-playwright/chromium-1228/chrome-win64/chrome.exe"

html = io.open(SRC, encoding="utf-8").read()
css = re.search(r"<style>(.*?)</style>", html, re.S).group(1)

mini = """<!doctype html><html lang="zh-CN" data-theme="dark"><head><meta charset="utf-8"><style>
%s
html,body{overflow:visible}
#host{width:900px;height:140px;display:block;position:relative}
/* 候选修法 */
.tplcard{appearance:none;-webkit-appearance:none;flex:0 0 var(--tplW);min-width:0}
</style></head><body>
<div id="host"><div class="tplbar" id="bar"></div></div>
<div id="out"></div>
<script>
var bar=document.getElementById('bar');
bar.style.cssText='display:flex;position:static;height:120px';
bar.innerHTML=
 '<button type="button" class="tplcard"><span class="tp-th"><canvas width="232" height="309"></canvas><span class="tp-nm">A</span></span></button>'+
 '<div class="tplcard"><span class="tp-th"><canvas width="232" height="309"></canvas><span class="tp-nm">B</span></span></div>';
var L=[];
L.push('--tplW on bar = '+getComputedStyle(bar).getPropertyValue('--tplW'));
var btns=bar.querySelectorAll('button.tplcard'), divs=bar.querySelectorAll('div.tplcard');
L.push('base: button w='+btns[0].getBoundingClientRect().width.toFixed(2)+' div w='+divs[0].getBoundingClientRect().width.toFixed(2));
bar.style.setProperty('--tplW','150px');
L.push('var150: button='+btns[0].getBoundingClientRect().width.toFixed(2)+' div='+divs[0].getBoundingClientRect().width.toFixed(2)+
       ' th='+btns[0].querySelector('.tp-th').getBoundingClientRect().width.toFixed(2)+'x'+btns[0].querySelector('.tp-th').getBoundingClientRect().height.toFixed(2));
bar.style.setProperty('--tplW','60px');
L.push('var60:  button='+btns[0].getBoundingClientRect().width.toFixed(2)+' thH='+btns[0].querySelector('.tp-th').getBoundingClientRect().height.toFixed(2));
bar.style.setProperty('--tplW','');
L.push('auto:   button='+btns[0].getBoundingClientRect().width.toFixed(2)+' cardH='+btns[0].getBoundingClientRect().height.toFixed(2)+
       ' barContentH='+ (bar.clientHeight-22));
document.getElementById('out').textContent=L.join('\\n');
</script></body></html>
""" % css

t = r"C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/_mini.html"
io.open(t, "w", encoding="utf-8", newline="\n").write(mini)
cmd = [CHROME, "--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars",
       "--virtual-time-budget=3000", "--window-size=1000,400", "--dump-dom", "file:///" + t]
p = subprocess.run(cmd, capture_output=True)
doc = p.stdout.decode("utf-8", "replace")
m = re.search(r'<div id="out">(.*?)</div>', doc, re.S)
print(m.group(1) if m else doc[-1500:])
