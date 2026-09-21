import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9522, windowSize: '1444,940' });
await b.goto(FILE, 2600);
await sleep(900);
async function ev(body) {
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const o = JSON.parse(raw);
  if (o && o.__err) console.log('  [err] ' + o.__err);
  return o;
}
await ev(`
  await window.LUMEN.loadEmbedded(true);
  var L=window.LUMEN, st=L.state;
  L.setStep(2); await L.generate();
  for(var i=0;i<80;i++){ await new Promise(function(r){setTimeout(r,120);}); if(!L.bookStale()) break; }
  return JSON.stringify({ok:1});
`);

console.log('back-diff:', JSON.stringify(await ev(`
  var L=window.LUMEN, st=L.state;
  /* 差分量测：拿"没有寄语"的那一版当底，逐像素比。
     阈值法（暗于某值的都算墨）会把纸的材料纹理、条形码一起算进来，
     于是"寄语有没有压到条形码"既量不准、也会随材料变化而翻脸。 */
  function diffBox(a,bq){
    var xa=a.getContext('2d').getImageData(0,0,a.width,a.height).data;
    var xb=bq.getContext('2d').getImageData(0,0,bq.width,bq.height).data;
    var W=a.width, minX=1e9,maxX=-1,minY=1e9,maxY=-1,n=0;
    for(var i=0,p=0;i<xa.length;i+=4,p++){
      if(Math.abs(xa[i]-xb[i])>10||Math.abs(xa[i+1]-xb[i+1])>10||Math.abs(xa[i+2]-xb[i+2])>10){
        n++; var xx=p%W, yy=(p-xx)/W;
        if(xx<minX)minX=xx; if(xx>maxX)maxX=xx; if(yy<minY)minY=yy; if(yy>maxY)maxY=yy;
      }
    }
    return {n:n,x0:minX,x1:maxX,y0:minY,y1:maxY,h:maxY-minY};
  }
  var W=880,H=1320;
  st.book.backNote='';
  var base=L.renderBack(W,H);
  st.book.backNote='愿你把每一个瞬间都留下来。';
  var one=diffBox(base,L.renderBack(W,H));
  st.book.backNote='愿你把每一个瞬间都留下来。愿你在很多年以后翻到这一页，还能想起那个下午的风、那杯没喝完的咖啡、和身边那个正在笑的人，还有当时没说出口的那句谢谢。';
  var many=diffBox(base,L.renderBack(W,H));
  st.book.coverNote='';
  var cbase=L.renderCover(W,H);
  st.book.coverNote='送给 2026 年的我们';
  var cov=diffBox(cbase,L.renderCover(W,H));
  st.book.backNote=''; st.book.coverNote='';
  return JSON.stringify({one:one, many:many, cov:cov,
    barcodeCardTop:Math.round(H*.700-H*.026), line3Top:Math.round(H*.520)+2*Math.round(W*.0234*1.62)});
`)));

await b.close();
