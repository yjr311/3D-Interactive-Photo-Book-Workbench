import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'fs';

/* 材料/质感层的视觉取证。
   三张图：
     A 材料样张 —— 7 种材料各画一块封面（含题字工艺）+ 一块内页，拼成对照表
     B 面板 —— 材料选择器（真实小样）
     C 书本 —— 同一本书换材料前后（书页与书封） */
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsmat';
fs.mkdirSync(OUT, { recursive: true });

const b = await launch({ port: 9482, windowSize: '1440,940' });
await b.goto(FILE, 2600);
await sleep(900);

async function ev(body) {
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const o = JSON.parse(raw);
  if (o && o.__err) console.log('  [err] ' + o.__err);
  return o;
}
function saveDataUrl(url, name) {
  const m = /^data:image\/png;base64,([\s\S]+)$/.exec(url || '');
  if (!m) { console.log('  no dataurl for ' + name); return; }
  fs.writeFileSync(OUT + '/' + name + '.png', Buffer.from(m[1], 'base64'));
  console.log('wrote', name, Math.round(m[1].length * 0.75 / 1024) + 'KB');
}

/* ---------- A 材料样张 ---------- */
const A = await ev(`
  var L=window.LUMEN;
  var CW=232, CH=310, PAD=16, COLS=7;
  var W=PAD+(CW+PAD)*COLS, H=44+CH+PAD+22+CH+PAD*2+40;
  var c=document.createElement('canvas'); c.width=W; c.height=H;
  var x=c.getContext('2d');
  x.fillStyle='#16161a'; x.fillRect(0,0,W,H);
  x.fillStyle='#e8e6e2'; x.font='600 17px system-ui,sans-serif'; x.textAlign='left';
  x.fillText('封面材料（上排）+ 内页材料（下排）', PAD, 28);
  var order=['cloth','heavy','kraft','silk','leather','board','smooth'];
  order.forEach(function(k, i){
    var m=L.MATSETS[k];
    var cx=PAD+i*(CW+PAD), cy=44;
    /* 封面：换成白纸底，才看得清材料本身（深底上会吃掉纹理） */
    var cov=document.createElement('canvas'); cov.width=CW; cov.height=CH;
    var cvx=cov.getContext('2d');
    L.boardGround(cvx,CW,CH,{mat:k,color:'#efe9df'});
    L.pressTreat(cvx,'光匣',CW/2,CH*0.30,30,5,'serif',null,'#2b2620');
    L.pressTreat(cvx,'L U M E N',CW/2,CH*0.86,11,3.2,'serif',null,'#5a5248');
    x.drawImage(cov,cx,cy);
    /* 内页 */
    var pg=document.createElement('canvas'); pg.width=CW; pg.height=CH;
    var pgx=pg.getContext('2d');
    L.paperGround(pgx,CW,CH,{mat:k,side:'l',color:'#fdfbf6',seed:7});
    pgx.fillStyle='rgba(60,52,44,.72)'; pgx.font='400 12px serif';
    pgx.fillText('正文示例 · 这一页的纸有它自己的手感', 18, 30);
    pgx.fillStyle='rgba(60,52,44,.42)'; pgx.font='400 11px serif';
    pgx.fillText('第二行。摸不着的纹理，看得见。', 18, 50);
    x.drawImage(pg,cx,cy+CH+22);
    x.fillStyle='#cfcac2'; x.font='600 13px system-ui,sans-serif'; x.textAlign='center';
    x.fillText(m.name + ' · ' + m.emboss, cx+CW/2, cy+CH-8);
    x.textAlign='left';
  });
  return JSON.stringify({url:c.toDataURL('image/png'), W:W, H:H});
`);
saveDataUrl(A.url, 'A-材料样张');
console.log('A 尺寸', A.W + '×' + A.H);

/* ---------- B 面板上的材料选择器（真实小样） ---------- */
await ev(`var L=window.LUMEN,st=L.state; await L.loadEmbedded(true);
  st.photos.forEach(function(p,i){ p.picked=(i<10); }); L.setStep(0);
  await new Promise(function(r){setTimeout(r,400);}); return JSON.stringify({});`);
await sleep(600);
/* 面板区域单独截：滚到材质那一块 */
const rect = await ev(`
  var el=document.querySelector('#panel .mats');
  if(!el) return JSON.stringify({none:true});
  el.scrollIntoView({block:'center'});
  await new Promise(function(r){ setTimeout(r,300); });
  var p=document.querySelector('#panel').getBoundingClientRect();
  var r=el.getBoundingClientRect();
  return JSON.stringify({px:Math.round(p.left),py:Math.round(p.top),pw:Math.round(p.width),ph:Math.round(p.height),
    mx:Math.round(r.left),my:Math.round(r.top),mw:Math.round(r.width),mh:Math.round(r.height)});
`);
console.log('mats rect', JSON.stringify(rect));
await b.screenshot(OUT + '/B-面板与材料选择器.png');
console.log('wrote B-面板与材料选择器');

/* 材料小样放大样张 */
const B2 = await ev(`
  var L=window.LUMEN;
  var els=[].slice.call(document.querySelectorAll('#panel .mat[data-mat]'));
  var Z=3, CW=92, CH=30, PAD=14;
  var W=PAD+(CW*Z+PAD)*els.length, H=40+CH*Z+PAD*2+26;
  var c=document.createElement('canvas'); c.width=W; c.height=H; var x=c.getContext('2d');
  x.fillStyle='#16161a'; x.fillRect(0,0,W,H);
  x.fillStyle='#e8e6e2'; x.font='600 15px system-ui,sans-serif';
  x.fillText('材料选择器上的小样（放大 3 倍 —— 小样必须等于换上去的样子）', PAD, 26);
  els.forEach(function(e,i){
    var src=e.querySelector('canvas');
    var cx=PAD+i*(CW+PAD), cy=40;
    x.imageSmoothingEnabled=false;
    x.drawImage(src,0,0,CW,CH, cx,cy, CW*Z, CH*Z);
    x.fillStyle='#cfcac2'; x.font='600 13px system-ui,sans-serif'; x.textAlign='center';
    x.fillText(e.dataset.mat, cx+CW*Z/2, cy+CH*Z+20);
    x.textAlign='left';
  });
  return JSON.stringify({url:c.toDataURL('image/png'), W:W, H:H});
`);
saveDataUrl(B2.url, 'B2-小样放大');
console.log('B2 尺寸', B2.W + '×' + B2.H);

/* ---------- C 同一本书换材料 ---------- */
await ev(`var L=window.LUMEN,st=L.state;
  L.applySkin('sakura',{keepColors:false}); st.book.mat='leather'; L.renderPanel();
  L.autoBook('sakura',{off:0,coverIdx:0});
  await L.doAuto(false);
  await new Promise(function(r){setTimeout(r,2800);}); return JSON.stringify({});`);
await sleep(1400);
await b.screenshot(OUT + '/C1-书本-皮革.png');
console.log('wrote C1-书本-皮革');

await ev(`var L=window.LUMEN,st=L.state;
  /* 走真实的点击路径换材料（合成 click 也会冒泡到面板的委托处理器） */
  var btn=document.querySelector('#panel .mat[data-mat="silk"]');
  if(btn) btn.click(); else { st.book.mat='silk'; L.renderPanel(); }
  await new Promise(function(r){setTimeout(r,900);});
  return JSON.stringify({mat:st.book.mat});`);
await sleep(800);
await b.screenshot(OUT + '/C2-书本-丝绸（换材料）.png');
console.log('wrote C2-书本-丝绸');

await b.close();
console.log('done');
