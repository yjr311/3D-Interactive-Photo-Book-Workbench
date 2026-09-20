import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'node:fs';

/* 把所有书页分批铺到页面上再截图。
   ⚠ 不要把大 data URL 通过 Runtime.evaluate 传回来 —— 上一版就是这么卡死的，
   几十张 880×1173 的 PNG 拼成一张，base64 有好几 MB，returnByValue 直接堵住。
   改成「在页面里拼好 → 截图」，跨进程只传一张 PNG。 */
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/out3';
fs.mkdirSync(OUT, { recursive: true });
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';

const b = await launch({ port: 9423, windowSize: '1440,940' });
await b.goto(FILE, 2600);
await sleep(900);

const prep = await b.evaluate(`(async function(){
  try{
    await window.LUMEN.loadEmbedded(true);
    window.LUMEN.setStep(2);
    await window.LUMEN.generate();
    await new Promise(function(r){ setTimeout(r,600); });
    var L=window.LUMEN;
    function stat(cv){
      var x=cv.getContext('2d');
      var d=x.getImageData(0,0,cv.width,cv.height).data;
      var s=0,s2=0,n=0;
      for(var i=0;i<d.length;i+=4*53){ var v=(d[i]+d[i+1]+d[i+2])/3; s+=v; s2+=v*v; n++; }
      var m=s/n; return Math.round(m)+'±'+Math.round(Math.sqrt(s2/n-m*m));
    }
    var out=[];
    for(var i=0;i<3;i++){
      var g=L.state.generated[i];
      var p=L.state.photos.filter(function(q){return q.id===g.photoId;})[0];
      out.push(g.name+' raw='+stat(p.el)+' plain='+stat(g.plain)+' art='+stat(g.art));
    }
    var cp=window.coverPhoto?null:null;
    return JSON.stringify({fit:L.state.spec.fit, adj:L.state.adj, stats:out,
      coverIdx:L.state.book.coverIdx, speed:L.state.book.speed, layout:L.state.book.layout,
      pages:LUMEN.buildBookPages().pages.length});
  }catch(e){ return 'ERR:'+(e&&e.message||e); }
})()`);
console.log(prep);

// 建一个覆盖视口的 canvas，分批画书页
await b.evaluate(`(function(){
  var m=document.createElement('canvas');
  m.id='__sheet'; m.width=1440; m.height=940;
  m.style.cssText='position:fixed;left:0;top:0;z-index:99999';
  document.body.appendChild(m);
  window.__drawBatch=function(from,cols,rows){
    var pages=window.LUMEN.buildBookPages().pages;
    var cw=Math.floor((1440-10)/cols)-8, ch=Math.round(cw*pages[0].canvas.height/pages[0].canvas.width);
    var x=m.getContext('2d');
    x.fillStyle='#15171c'; x.fillRect(0,0,1440,940);
    for(var i=0;i<cols*rows;i++){
      var k=from+i; if(k>=pages.length) break;
      var cx=8+(i%cols)*(cw+8), cy=8+Math.floor(i/cols)*(ch+8);
      x.drawImage(pages[k].canvas,cx,cy,cw,ch);
      x.strokeStyle='rgba(255,255,255,.25)'; x.lineWidth=1; x.strokeRect(cx+.5,cy+.5,cw-1,ch-1);
      x.fillStyle='rgba(255,255,255,.75)'; x.font='bold 13px monospace';
      x.fillText('#'+k+' '+pages[k].kind,cx+5,cy+15);
    }
    return pages.length;
  };
  return 1;
})()`);

const total = await b.evaluate('window.__drawBatch(0,6,4)');
console.log('pages:', total);
await sleep(500);
await b.screenshot(`${OUT}/批次1.png`);

await b.evaluate('window.__drawBatch(24,6,4)');
await sleep(500);
await b.screenshot(`${OUT}/批次2.png`);

await b.evaluate('window.__drawBatch(8,4,4)');
await sleep(500);
await b.screenshot(`${OUT}/批次3.png`);

console.log('errors:', await b.evaluate('JSON.stringify(window.__errs||[])'));
await b.close();
console.log('done');
