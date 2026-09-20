import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'fs';

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsmat';
fs.mkdirSync(OUT, { recursive: true });
const b = await launch({ port: 9493, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(900);
async function ev(body) {
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const o = JSON.parse(raw);
  if (o && o.__err) console.log('  [err] ' + o.__err);
  return o;
}

const r = await ev(`
  var L=window.LUMEN, st=L.state;
  await L.loadEmbedded(true);
  st.photos.forEach(function(p,i){ p.picked=(i<2); });
  L.setStep(2);
  await L.generate();
  for(var i=0;i<120;i++){ await new Promise(function(x){setTimeout(x,120);}); if(st.generated.length===2) break; }
  var g=st.generated[0], ph=st.photos[0];
  var W=620,H=820, PL=W*.098, PR=W*.098, PB=H*.104;
  var capY=H-PB-W*.048, cs=R(W*.0255);
  /* 图注那一行所在的带（细线 + 文字） */
  var yA=Math.round(capY-cs*0.9), yB=Math.round(capY+cs*2.0);

  function band(layout,note){
    var keep=st.book.layout; st.book.layout=layout; st.book.cap='note';
    ph.note=''; var a=L.renderContent([g],3,W,H,'r');
    ph.note=note||''; var c=L.renderContent([g],3,W,H,'r');
    var da=a.getContext('2d').getImageData(0,yA,W,yB-yA).data;
    var dc=c.getContext('2d').getImageData(0,yA,W,yB-yA).data;
    /* 带内的"墨"：比纸暗或比纸亮的都算（满版版式上是白字压暗带） */
    function ink(d,base){
      var n=0;
      for(var i=0;i<d.length;i+=4){
        var v=(d[i]+d[i+1]+d[i+2])/3;
        if(Math.abs(v-base)>34) n++;
      }
      return n;
    }
    var n=0, mx=0;
    for(var i=0;i<da.length;i+=4){
      var t=Math.abs(da[i]-dc[i])+Math.abs(da[i+1]-dc[i+1])+Math.abs(da[i+2]-dc[i+2]);
      if(t>12) n++; if(t>mx) mx=t;
    }
    st.book.layout=keep; ph.note='';
    return {bandDiff:n, maxDelta:mx, yA:yA, yB:yB, capY:Math.round(capY), cs:Math.round(cs)};
  }
  var out={};
  ['mat','two','sticker','full'].forEach(function(ly){ out[ly]=band(ly,'无题，但很喜欢'); });

  /* 出一张图：mat 版式，写文案前后各一页 */
  st.book.layout='mat'; st.book.cap='note';
  ph.note=''; var p0=L.renderContent([g],3,W,H,'r');
  ph.note='无题，但很喜欢'; var p1=L.renderContent([g],3,W,H,'r');
  ph.note='今天也是被自己可爱到的一天，风把头发吹乱了，但我很喜欢这张'; var p2=L.renderContent([g],3,W,H,'r');
  var CW=W, CH=H, PAD=12;
  var sheet=document.createElement('canvas'); sheet.width=PAD+(CW+PAD)*3; sheet.height=CH+58;
  var sx=sheet.getContext('2d'); sx.fillStyle='#131317'; sx.fillRect(0,0,sheet.width,sheet.height);
  [[p0,'没写文案（图注退回照片名）'],[p1,'写了一句文案'],[p2,'写了一句很长的文案']].forEach(function(it,i){
    sx.drawImage(it[0],PAD+i*(CW+PAD),PAD);
    sx.fillStyle='#e6e2dc'; sx.font='600 15px system-ui,sans-serif'; sx.textAlign='center';
    sx.fillText(it[1],PAD+i*(CW+PAD)+CW/2,CH+38); sx.textAlign='left';
  });
  ph.note='';
  return JSON.stringify({out:out, url:sheet.toDataURL('image/png')});
`);
console.log('图注带 y∈[', r.out.mat.yA, ',', r.out.mat.yB, ']  capY=', r.out.mat.capY, ' cs=', r.out.mat.cs);
for (const ly of Object.keys(r.out)) {
  const o = r.out[ly];
  console.log(`  layout=${ly.padEnd(8)} 带内差异=${String(o.bandDiff).padStart(6)}  最大通道差=${o.maxDelta}`);
}
const m = /^data:image\/png;base64,([\s\S]+)$/.exec(r.url || '');
if (m) { fs.writeFileSync(OUT + '/CAP-图注对照.png', Buffer.from(m[1], 'base64')); console.log('wrote CAP-图注对照.png'); }
await b.close();
