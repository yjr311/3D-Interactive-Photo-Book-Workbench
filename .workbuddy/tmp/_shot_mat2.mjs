import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'fs';

/* 把每种材料单独放大渲染，逐张看 —— 样张表在这个尺度上丢掉了细节。 */
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsmat';
fs.mkdirSync(OUT, { recursive: true });

const b = await launch({ port: 9483, windowSize: '1440,940' });
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
  fs.writeFileSync(OUT + '/' + name + '.png', Buffer.from(m[1], 'base64'));
  console.log('wrote', name);
}

/* 每种材料一块 460×620 的封面 + 一块内页，单独成图（并带一个小尺寸对照） */
for (const k of ['cloth', 'heavy', 'kraft', 'silk', 'leather', 'board']) {
  const r = await ev(`
    var L=window.LUMEN, m=L.MATSETS['${k}'];
    /* pressTreat 的工艺取自 state.book.mat（它在真实渲染里就是当前材料），
       所以样张必须同步设状态，否则看到的工艺不对。 */
    L.state.book.mat='${k}';
    var CW=460, CH=320;
    var c=document.createElement('canvas'); c.width=CW; c.height=CH*2+8; var x=c.getContext('2d');
    x.fillStyle='#141417'; x.fillRect(0,0,c.width,c.height);
    /* 封面 */
    var cov=document.createElement('canvas'); cov.width=CW; cov.height=CH; var cx=cov.getContext('2d');
    L.boardGround(cx,CW,CH,{mat:'${k}',color:'#efe9df'});
    L.pressTreat(cx,'光匣 LUMEN',CW/2,CH*0.30,40,6,'serif',null,'#2b2620');
    L.pressTreat(cx,'A COLLECTION OF MOMENTS',CW/2,CH*0.86,12,3,'serif',null,'#5a5248');
    x.drawImage(cov,0,0);
    /* 内页 */
    var pg=document.createElement('canvas'); pg.width=CW; pg.height=CH; var px=pg.getContext('2d');
    L.paperGround(px,CW,CH,{mat:'${k}',side:'l',color:'#fdfbf6',seed:7});
    px.fillStyle='rgba(60,52,44,.80)'; px.font='400 15px serif';
    px.fillText('正文示例：这一页的纸有它自己的手感。', 26, 46);
    px.fillStyle='rgba(60,52,44,.46)'; px.font='400 13px serif';
    px.fillText('第二行小字，用来核对纹理是否干扰阅读。', 26, 72);
    x.drawImage(pg,0,CH+8);
    x.fillStyle='#cfcac2'; x.font='600 14px system-ui,sans-serif';
    x.fillText(m.name+'  ('+m.cover+' / page '+m.page+' / '+m.emboss+'  tex'+m.tex+' sheen'+m.sheen+')', 10, CH-8);
    return JSON.stringify({url:c.toDataURL('image/png')});
  `);
  save(r.url, 'Z-' + k);
}

/* 题字工艺放大：同一块亚麻底上三种工艺 */
const t = await ev(`
  var L=window.LUMEN;
  var W=900, H=340;
  var c=document.createElement('canvas'); c.width=W; c.height=H; var x=c.getContext('2d');
  x.fillStyle='#141417'; x.fillRect(0,0,W,H);
  var modes=['deboss','foil','plain'];
  modes.forEach(function(md,i){
    var cw=W/3-8;
    var cov=document.createElement('canvas'); cov.width=cw; cov.height=H-40; var cx=cov.getContext('2d');
    L.boardGround(cx,cov.width,cov.height,{mat: md==='foil'?'leather':'cloth', color:'#3a3128'});
    /* 关掉自动取色，专看工艺本身：用手写一个金色 */
    L.pressTreat(cx,'光匣',cov.width/2,cov.height*0.34,44,7,'serif',md, md==='foil'?'#d8b271':'#efe6d8');
    L.pressTreat(cx,'LUMEN',cov.width/2,cov.height*0.74,15,4,'serif',md, md==='foil'?'#d8b271':'#cdbfa8');
    x.drawImage(cov, i*(W/3)+4, 8);
    x.fillStyle='#cfcac2'; x.font='600 14px system-ui,sans-serif'; x.textAlign='center';
    x.fillText(md, i*(W/3)+W/6, H-14); x.textAlign='left';
  });
  return JSON.stringify({url:c.toDataURL('image/png')});
`);
save(t.url, 'Z-题字工艺');

await b.close();
console.log('done');
