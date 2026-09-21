import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9471, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(900);

async function ev(body) {
  const raw = await b.evaluate(
    `(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const out = JSON.parse(raw);
  if (out && out.__err) console.log('  [page error] ' + out.__err);
  return out;
}

const r = await ev(`
  await window.LUMEN.loadEmbedded(true);
  var L=window.LUMEN, st=L.state;
  L.setStep(2);
  await L.generate();
  await new Promise(function(r){ setTimeout(r,900); });
  return JSON.stringify({n:st.photos.length, gen:st.generated.length,
    keys:Object.keys(L).filter(function(k){ return /stk|STK|stick|perPage|drawSticker/.test(k); })});
`);
console.log('setup:', JSON.stringify(r));

/* 面板里有没有贴纸那一段？ */
const dom = await ev(`
  var s=document.querySelector('#panel');
  return JSON.stringify({
    hasWraps: !!s.querySelector('.sec summary'),
    sum: Array.prototype.map.call(s.querySelectorAll('.sec>summary'), function(e){ return e.textContent.trim().slice(0,18); }),
    pal: s.querySelectorAll('.stks .stk').length,
    stage: !!s.querySelector('#stkStage'),
    stageW: (s.querySelector('#stkStage')||{}).width,
    stageH: (s.querySelector('#stkStage')||{}).height,
    snd: !!s.querySelector('input[data-snd]')
  });
`);
console.log('panel:', JSON.stringify(dom));

/* 真点一枚贴纸 */
const click = await ev(`
  var s=document.querySelector('#panel');
  var btn=s.querySelector('.stks .stk[data-stk-add]');
  if(!btn) return JSON.stringify({err:'没有贴纸按钮'});
  var rect=btn.getBoundingClientRect();
  if(rect.top<0||rect.bottom>innerHeight){ btn.scrollIntoView({block:'center'}); await new Promise(function(r){setTimeout(r,260);}); }
  btn.click();
  await new Promise(function(r){ setTimeout(r,360); });
  var L=window.LUMEN, st=L.state;
  var c=L.stkCur();
  return JSON.stringify({added: L.stickOf(c.p).length, sig:L.stickerSig(c.p),
    stale:L.bookStale(), stage: !!document.querySelector('#stkStage'),
    list: document.querySelectorAll('.stklist .si').length});
`);
console.log('click:', JSON.stringify(click));

/* 贴纸是否被画进了干净照片 */
const px = await ev(`
  var L=window.LUMEN, st=L.state;
  var c=L.stkCur(), p=c.p;
  function sigOf(cv){ var x=cv.getContext('2d'); var d=x.getImageData(0,0,cv.width,cv.height).data;
    var h=2166136261; for(var i=0;i<d.length;i+=97){ h^=d[i]; h=Math.imul(h,16777619); } return (h>>>0); }
  var a=L.renderPlain(p, 640); var h1=sigOf(a);
  p.stickers=[];
  var b2=L.renderPlain(p, 640); var h2=sigOf(b2);
  return JSON.stringify({a:[a.width,a.height],h1:h1,h2:h2,same:h1===h2});
`);
console.log('plain:', JSON.stringify(px));

await b.close();
