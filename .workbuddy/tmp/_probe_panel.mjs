import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9521, windowSize: '1444,940' });
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
  L.setStep(2);
  await L.generate();
  for(var i=0;i<80;i++){ await new Promise(function(r){setTimeout(r,120);}); if(!L.bookStale()) break; }
  return JSON.stringify({ok:1});
`);

/* ① 贴纸那一段的小标题 hint 有没有内容 */
console.log('hint:', JSON.stringify(await ev(`
  var L=window.LUMEN, st=L.state;
  var c=L.stkCur();
  c.p.stickers=[L.stkFix({k:'tape',x:.2,y:.2,s:1,text:''})];
  L.renderPanel();
  await new Promise(function(r){ setTimeout(r,350); });
  var out=[];
  Array.prototype.forEach.call(document.querySelectorAll('#panel details.sec'),function(d){
    var s=d.querySelector('summary');
    var hint=s.querySelector('.hint');
    out.push({t:(s.textContent||'').trim().slice(0,14),
      hint:hint?hint.textContent:null,
      hintW:hint?Math.round(hint.getBoundingClientRect().width):null,
      sumW:Math.round(s.getBoundingClientRect().width),
      sw:Math.round(s.scrollWidth), cw:Math.round(s.clientWidth)});
  });
  c.p.stickers=[];
  L.renderPanel();
  return JSON.stringify({out:out});
`)));

/* ② 每枚小样按钮里的画布有没有内容（非底色像素占比） */
console.log('chips:', JSON.stringify(await ev(`
  var L=window.LUMEN;
  var res=[];
  Array.prototype.forEach.call(document.querySelectorAll('#panel .stks .stk'),function(bt){
    var cv=bt.querySelector('canvas'), x=cv.getContext('2d');
    var d=x.getImageData(0,0,cv.width,cv.height).data;
    /* 底色是 chip=#b9b2a6，数"不接近底色"的像素 */
    var n=0, tot=cv.width*cv.height;
    for(var i=0;i<d.length;i+=4){
      if(Math.abs(d[i]-185)>12||Math.abs(d[i+1]-178)>12||Math.abs(d[i+2]-166)>12) n++;
    }
    res.push({k:bt.dataset.stkAdd, pct:Math.round(n/tot*100)});
  });
  return JSON.stringify({res:res});
`)));

/* ③ 封底寄语的末行位置（字号放大后） */
console.log('back:', JSON.stringify(await ev(`
  var L=window.LUMEN, st=L.state;
  st.book.backNote='愿你把每一个瞬间都留下来。愿你在很多年以后翻到这一页，还能想起那个下午的风、那杯没喝完的咖啡、和身边那个正在笑的人，还有当时没说出口的那句谢谢。';
  var cv=L.renderBack(880,1320);
  var x=cv.getContext('2d');
  var d=x.getImageData(0,Math.round(1320*.47),880,Math.round(1320*.24)).data;
  var y0=Math.round(1320*.47);
  var minY=1e9,maxY=-1,minX=1e9,maxX=-1,n=0;
  for(var j=0;j<Math.round(1320*.24);j++) for(var i=0;i<880;i++){
    var o=(j*880+i)*4;
    if(d[o]<150&&d[o+1]<150&&d[o+2]<150){ n++;
      if(j+y0<minY)minY=j+y0; if(j+y0>maxY)maxY=j+y0;
      if(i<minX)minX=i; if(i>maxX)maxX=i; }
  }
  st.book.backNote='';
  return JSON.stringify({n:n, y0:minY, y1:maxY, h:maxY-minY, x0:minX, x1:maxX,
    barcodeTop:Math.round(1320*.700-1320*.026)});
`)));

await b.close();
