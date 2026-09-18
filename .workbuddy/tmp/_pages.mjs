import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/out3';
fs.mkdirSync(OUT, { recursive: true });
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%85%89%E5%8C%A3-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';

const b = await launch({ port: 9422, windowSize: '1400,900' });
await b.goto(FILE, 2600);
await sleep(900);

const prep = await b.evaluate(`(async function(){
  try{
    await window.LUMEN.loadEmbedded(true);
    window.LUMEN.setStep(2);
    await window.LUMEN.generate();
    await new Promise(function(r){ setTimeout(r,600); });
    var L=window.LUMEN;
    // 原始照片 / 干净照片 / 模版成品 三者的对比（查「发白发灰」）
    function mean(cv){
      var x=cv.getContext('2d');
      var d=x.getImageData(0,0,cv.width,cv.height).data;
      var s=0,s2=0,n=0;
      for(var i=0;i<d.length;i+=4*37){ var v=(d[i]+d[i+1]+d[i+2])/3; s+=v; s2+=v*v; n++; }
      var m=s/n; return [Math.round(m), Math.round(Math.sqrt(s2/n-m*m))];
    }
    var out=[];
    for(var i=0;i<3;i++){
      var g=L.state.generated[i];
      var p=L.state.photos.filter(function(q){return q.id===g.photoId;})[0];
      out.push({name:g.name, art:mean(g.art), plain:mean(g.plain), raw:mean(p.el)});
    }
    return JSON.stringify({stat:out, fit:L.state.spec.fit, adj:L.state.adj,
      zoom0:L.state.generated[0].plain.width+'x'+L.state.generated[0].plain.height,
      src0:(function(){var g=L.state.generated[0];var p=L.state.photos.filter(function(q){return q.id===g.photoId;})[0];return p.w+'x'+p.h;})()});
  }catch(e){ return 'ERR:'+(e&&e.message||e); }
})()`);
console.log(prep);

// 把所有书页拼成一张联页图
const montage = await b.evaluate(`(function(){
  try{
    var pages=window.LUMEN.buildBookPages().pages;
    var COLS=6, CW=300;
    var cell=[];
    pages.forEach(function(p){ cell.push(p.canvas); });
    var rows=Math.ceil(cell.length/COLS);
    var ch=Math.round(CW*pages[0].canvas.height/pages[0].canvas.width);
    var m=document.createElement('canvas');
    m.width=COLS*(CW+10)+10; m.height=rows*(ch+10)+10;
    var x=m.getContext('2d');
    x.fillStyle='#1b1d22'; x.fillRect(0,0,m.width,m.height);
    cell.forEach(function(cv,i){
      var cx=10+(i%COLS)*(CW+10), cy=10+Math.floor(i/COLS)*(ch+10);
      x.drawImage(cv,cx,cy,CW,ch);
      x.strokeStyle='rgba(255,255,255,.22)'; x.lineWidth=1; x.strokeRect(cx+.5,cy+.5,CW-1,ch-1);
      x.fillStyle='rgba(255,255,255,.55)'; x.font='11px monospace';
      x.fillText('#'+i, cx+4, cy+12);
    });
    return m.toDataURL('image/png');
  }catch(e){ return 'ERR:'+(e&&e.message||e); }
})()`);

if (typeof montage === 'string' && montage.startsWith('data:')) {
  fs.writeFileSync(`${OUT}/联页-全部书页.png`, Buffer.from(montage.split(',')[1], 'base64'));
  console.log('montage written');
} else console.log('montage failed:', montage);

await b.close();
console.log('done');
