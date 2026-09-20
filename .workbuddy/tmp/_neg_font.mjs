import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

/* 反向对照：把"图注字族"改回旧写法 / 改成一个本机没有的中文字族，
   同一批断言必须挂 —— 证明 N26~N30 这几项有牙，不是恒真的摆设。 */
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9551, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(700);

async function ev(body) {
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const o = JSON.parse(raw);
  if (o && o.__err) console.log('  [err]', o.__err);
  return o;
}

const BMP = `
  function bmp(text, fam){
    var c=document.createElement('canvas'); c.width=620; c.height=96;
    var x=c.getContext('2d');
    x.fillStyle='#fff'; x.fillRect(0,0,620,96);
    x.fillStyle='#000'; x.font='44px '+fam; x.textBaseline='middle';
    x.fillText(text,10,48);
    var d=x.getImageData(0,0,620,96).data;
    var minX=1e9,maxX=-1,minY=1e9,maxY=-1;
    for(var y=0;y<96;y++) for(var xx=0;xx<620;xx++){
      var o=(y*620+xx)*4;
      if(d[o]<200){ if(xx<minX)minX=xx; if(xx>maxX)maxX=xx; if(y<minY)minY=y; if(y>maxY)maxY=y; }
    }
    if(maxX<0) return 'blank';
    var h=0;
    for(var y2=minY;y2<=maxY;y2++) for(var x2=minX;x2<=maxX;x2++) h=(h*31 + d[(y2*620+x2)*4])>>>0;
    return h+':'+(maxX-minX+1)+'x'+(maxY-minY+1);
  }
  var CJK='拍照的人先笑一个';
`;

const r = await ev(`
  ${BMP}
  var out={};
  var yahei=bmp(CJK,'"PingFang SC","Microsoft YaHei",sans-serif');
  var georgia=bmp('Lumen 08','Georgia');
  var serifCJK=bmp(CJK,FONTS.serif);
  var keep=FONTS.cap;
  var cases=[
    ['now',   keep],
    ['old',   'Georgia,"Songti SC","SimSun",serif'],
    ['nofont','Georgia,"__lumen_missing__",sans-serif']
  ];
  for(var i=0;i<cases.length;i++){
    FONTS.cap=cases[i][1];
    out[cases[i][0]]={stack:FONTS.cap,
      cjk:bmp(CJK,FONTS.cap), lat:bmp('Lumen 08',FONTS.cap)};
  }
  FONTS.cap=keep;
  return JSON.stringify({out:out, yahei:yahei, georgia:georgia, serifCJK:serifCJK});
`);

console.log('情形               N28(≠黑体)  N29(=Georgia)  N30(≠标题字族)');
for (const k of ['now', 'old', 'nofont']) {
  const o = r.out[k];
  const n28 = o.cjk !== r.yahei;
  const n29 = o.lat === r.georgia;
  const n30 = o.cjk !== r.serifCJK;
  console.log(`${k.padEnd(18)} ${n28 ? 'PASS' : 'FAIL'}        ${n29 ? 'PASS' : 'FAIL'}          ${n30 ? 'PASS' : 'FAIL'}   ${o.stack}`);
}
console.log('\n结论：把字族改回旧的 serif（图注不再另起角色）→ N30 挂；');
console.log('      把一个本机没有的中文字族写在前面 → 中文落到黑体 → N28 挂。');
await b.close();
