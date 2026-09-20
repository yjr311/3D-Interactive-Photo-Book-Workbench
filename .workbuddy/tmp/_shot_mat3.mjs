import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'fs';

/* 面向用户的材料对照图：每种材料用**它自己的**题字工艺，浅底 + 深底各一遍。
   （真实氛围里封面经常是深色的，只在浅底上看会低估差别。） */
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14';
const b = await launch({ port: 9484, windowSize: '1440,940' });
await b.goto(FILE, 2600);
await sleep(900);
async function ev(body) {
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const o = JSON.parse(raw);
  if (o && o.__err) console.log('  [err] ' + o.__err);
  return o;
}
function save(url, name) {
  const m = /^data:image\/png;base64,([\s\S]+)$/.exec(url || '');
  if (!m) { console.log('no dataurl ' + name); return; }
  fs.writeFileSync(OUT + '/' + name, Buffer.from(m[1], 'base64'));
  console.log('wrote', name, Math.round(m[1].length * 0.75 / 1024) + 'KB');
}

const r = await ev(`
  var L=window.LUMEN;
  var CW=252, CH=336, PAD=14, COLS=7, GAP=18;
  var W=PAD*2+(CW+PAD)*(COLS-1)+CW;
  var rowH=CH+34;
  var H=54+rowH+30+rowH+22+PAD;
  var c=document.createElement('canvas'); c.width=W; c.height=H; var x=c.getContext('2d');
  x.fillStyle='#131317'; x.fillRect(0,0,W,H);
  x.fillStyle='#f0ede8'; x.font='600 18px system-ui,sans-serif';
  x.fillText('材料 / 质感对照：上排浅色封面 · 下排深色封面（每种材料用自己的题字工艺）', PAD, 32);
  var order=['cloth','heavy','kraft','silk','leather','board','smooth'];
  var bases=['#efe9df','#332c33'];
  bases.forEach(function(base, row){
    order.forEach(function(k, i){
      var m=L.MATSETS[k];
      L.state.book.mat=k;              /* 题字工艺取自当前材料 */
      var cx=PAD+i*(CW+PAD), cy=54+row*(rowH+30);
      var cov=document.createElement('canvas'); cov.width=CW; cov.height=CH; var v=cov.getContext('2d');
      L.boardGround(v,CW,CH,{mat:k,color:base});
      /* 深底用浅字、浅底用深字 —— 不然浅底上的浅字看不见 */
      var ink = row===0 ? '#3a332c' : '#efe6d8';
      var foil = row===0 ? '#a8843c' : '#d8b271';
      L.pressTreat(v,'光匣',CW/2,CH*0.30,40,7,'serif',m.emboss, m.emboss==='foil'?foil:ink);
      L.pressTreat(v,'L U M E N',CW/2,CH*0.55,13,3.4,'serif',m.emboss, m.emboss==='foil'?foil:ink);
      L.pressTreat(v,'封面材料',CW/2,CH*0.86,12,2,'serif','plain', row===0?'#8a8078':'#9b9088');
      x.drawImage(cov,cx,cy);
      x.fillStyle='#e6e2dc'; x.font='700 15px system-ui,sans-serif'; x.textAlign='center';
      x.fillText(m.name, cx+CW/2, cy+CH+22);
      x.fillStyle='#8d8781'; x.font='400 12px system-ui,sans-serif';
      x.fillText(m.cover+' · '+m.emboss, cx+CW/2, cy+CH+38);
      x.textAlign='left';
    });
  });
  return JSON.stringify({url:c.toDataURL('image/png'), W:W, H:H});
`);
save(r.url, '材料质感对照.png');
console.log('尺寸', r.W + '×' + r.H);

/* 内页材料对照（浅底，因为书页是白的） */
const r2 = await ev(`
  var L=window.LUMEN;
  var CW=340, CH=440, PAD=16, COLS=4;
  var rows=2, W=PAD+(CW+PAD)*COLS, H=50+(CH+40+PAD)*rows+10;
  var c=document.createElement('canvas'); c.width=W; c.height=H; var x=c.getContext('2d');
  x.fillStyle='#131317'; x.fillRect(0,0,W,H);
  x.fillStyle='#f0ede8'; x.font='600 17px system-ui,sans-serif';
  x.fillText('内页材料（书页的纸 —— 刻意比封面轻，不能跟照片抢）', PAD, 30);
  var order=['cloth','heavy','kraft','silk','leather','board','smooth'];
  order.forEach(function(k,i){
    var m=L.MATSETS[k];
    var col=i%COLS, row=(i/COLS)|0;
    var cx=PAD+col*(CW+PAD), cy=50+row*(CH+40+PAD);
    var pg=document.createElement('canvas'); pg.width=CW; pg.height=CH; var v=pg.getContext('2d');
    L.paperGround(v,CW,CH,{mat:k,side:'l',color:'#fdfbf6',seed:11});
    v.fillStyle='rgba(58,50,42,.86)'; v.font='600 17px serif';
    v.fillText('这一页的纸有它自己的手感', 30, 54);
    v.fillStyle='rgba(58,50,42,.52)'; v.font='400 14px serif';
    v.fillText('纹理必须轻到不干扰阅读，', 30, 84);
    v.fillText('又重到换一张纸看得出来。', 30, 108);
    /* 画一张照片块，检查纹理会不会跟照片打架 */
    v.fillStyle='#b9c3bf'; v.fillRect(30,150,CW-60,150);
    v.fillStyle='rgba(58,50,42,.7)'; v.font='400 13px serif';
    v.fillText('（照片印在这张纸上）', 30, 330);
    x.drawImage(pg,cx,cy);
    x.fillStyle='#e6e2dc'; x.font='700 15px system-ui,sans-serif'; x.textAlign='center';
    x.fillText(m.name+'  ·  内页 '+m.page, cx+CW/2, cy+CH+24); x.textAlign='left';
  });
  return JSON.stringify({url:c.toDataURL('image/png'), W:W, H:H});
`);
save(r2.url, '内页材料对照.png');
console.log('尺寸', r2.W + '×' + r2.H);

await b.close();
console.log('done');
