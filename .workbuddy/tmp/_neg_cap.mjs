import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

/* 反向对照：把 plateHasText 退回旧实现（"印片有字就不画图注"）的那个产物，
   同一组断言必须全部失败。如果这里还"通过"，说明守卫是假的。 */
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/_old_cap.html';
const b = await launch({ port: 9494, windowSize: '1400,920' });
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
  var g=st.generated[0], ph=L.photoOfIm(g);
  st.book.art='tpl'; st.book.layout='mat'; st.book.cap='note';
  var W=620,H=820, PB=H*.104, capY=H-PB-W*.048, cs=16;
  var yA=Math.round(capY-cs*0.9), yB=Math.round(capY+cs*2.0);
  function bandDiff(note){
    ph.note=''; var a=L.renderContent([g],3,W,H,'r');
    ph.note=note; var c=L.renderContent([g],3,W,H,'r');
    var da=a.getContext('2d').getImageData(0,yA,W,yB-yA).data;
    var dc=c.getContext('2d').getImageData(0,yA,W,yB-yA).data;
    var n=0;
    for(var i=0;i<da.length;i+=4){
      if(Math.abs(da[i]-dc[i])+Math.abs(da[i+1]-dc[i+1])+Math.abs(da[i+2]-dc[i+2])>12) n++;
    }
    return n;
  }
  var bd=bandDiff('无题，但很喜欢');
  var draw=L.capWillDraw(g);
  /* 顺带看：四个版式是不是都画不出来 */
  var per={};
  ['mat','two','sticker','full'].forEach(function(ly){ st.book.layout=ly; per[ly]=bandDiff('无题，但很喜欢'); });
  st.book.layout='mat';
  return JSON.stringify({draw:draw, bd:bd, per:per, plateTitle:g.title, note:'无题，但很喜欢'});
`);
console.log('旧代码：capWillDraw =', r.draw, '（新代码应为 true，旧代码应为 false）');
console.log('旧代码：图注带差异 =', r.bd, '（新代码 799，旧代码应为 0）');
console.log('旧代码：四版式差异 =', JSON.stringify(r.per), '（应全为 0）');
const caught = r.draw === false && r.bd === 0 && Object.keys(r.per).every((k) => r.per[k] === 0);
console.log(caught ? '\n✅ 反向对照成立：旧代码被守卫抓住（守卫有牙齿）' : '\n❌ 反向对照失败：旧代码居然也能通过（守卫是假的）');
await b.close();
process.exit(caught ? 0 : 1);
