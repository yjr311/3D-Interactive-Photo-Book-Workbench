/* 第十五轮取证图：把「照片矩形」画成红框，叠在成片上。
   红框 = 代码认定的"照片在哪儿"；红点 = 贴纸 (.5,.5) 实际落点。
   改前的牛皮纸：红框大半跑到画布外，红点压在左上角 —— 一眼可见。

   做法：在页内拼成一张大画布、铺成 fixed 全屏覆盖层，再整屏截图。
   不走 toDataURL 回传（11 张 900×1200 的 base64 一次几百 KB，容易顶到 CDP 上限）。 */
import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'node:fs';

const CWD = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14';
const SHOT = CWD + '/.workbuddy/tmp/shotsb15';
fs.mkdirSync(SHOT, { recursive: true });

const BUILDS = [
  ['before', 'file:///' + CWD + '/.workbuddy/tmp/_before.html'],
  ['after', 'file:///' + CWD + '/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html'],
];
const TPLS = ['polaroid', 'film', 'kraft', 'neon', 'minimal', 'postcard',
              'duotone', 'grid9', 'cinematic', 'titlecard', 'magazine'];

async function launchRetry(port) {
  for (let i = 0; i < 3; i++) {
    try { return await launch({ port: port + i, windowSize: '1400,900' }); }
    catch (e) { console.log('  [launch retry] ' + String(e.message || e).split('\n')[0]); await sleep(1300); }
  }
  throw new Error('Chromium 连续三次没起来');
}

for (const [tag, url] of BUILDS) {
  const b = await launchRetry(9551);
  await b.goto(url, 2600);
  await sleep(800);
  async function ev(body) {
    const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
    const o = JSON.parse(raw); if (o.__err) console.log('  [err] ' + o.__err); return o;
  }
  await ev(`await window.LUMEN.loadEmbedded(true); var L=window.LUMEN; L.setStep(2);
    await L.generate();
    for(var i=0;i<80;i++){ await new Promise(function(r){setTimeout(r,120);}); if(!L.bookStale()) break; }
    return JSON.stringify({ok:1});`);

  /* 公共绘图件：把一张成片按给定宽度画进大画布，并可选叠上红框 + 红点 */
  const HELPERS = `
    window.__fig = window.__fig || {};
    /* 叠一层"相纸"：⚠ 只按宽度缩放会把 960x1280 的成片压扁成 318x232 ——
       取证图里"照片被压扁"会让人以为模版本身出问题了。这里按长宽比算实际高度，
       并把算出来的格子高回填给调用方。 */
    window.__fig.overlay = function(x, cv, ox, oy, w, withBox, label){
      var dh = Math.round(w * cv.height / cv.width);
      x.save();
      x.fillStyle='#fbfaf7'; x.strokeStyle='#d9d3c8'; x.lineWidth=1;
      x.fillRect(ox-1, oy-1, w+2, dh+2); x.strokeRect(ox-1, oy-1, w+2, dh+2);
      x.drawImage(cv, ox, oy, w, dh);
      if(withBox){
        var rc=cv.photoRect||{dx:0,dy:0,dw:cv.width,dh:cv.height};
        var k=w/cv.width;
        var bx=ox+rc.dx*k, by=oy+rc.dy*k, bw=rc.dw*k, bh=rc.dh*k;
        x.save();
        x.strokeStyle='rgba(214,38,38,.95)'; x.lineWidth=2; x.setLineDash([7,5]);
        x.strokeRect(bx,by,bw,bh);
        x.setLineDash([]);
        var px=bx+bw/2, py=by+bh/2;
        x.beginPath(); x.arc(px,py,5,0,7); x.fillStyle='rgba(214,38,38,.98)'; x.fill();
        x.strokeStyle='#fff'; x.lineWidth=2; x.stroke();
        x.restore();
      }
      if(label){
        x.fillStyle='#2a2724'; x.font='600 15px system-ui,sans-serif';
        x.textAlign='left'; x.textBaseline='top';
        x.fillText(label, ox, oy+dh+7);
      }
      x.restore();
      return dh;
    };
    /* 铺成全屏覆盖层。
       ⚠ 必须先把 body 清空：面板/书页那些层有自己的 z-index 与 transform，
         光靠给 canvas 一个 z-index:99999 挡不住（实测取证图上会透出一排照片缩略图，
         看着像"拼图脚本画错了"）。清空 + 绝对定位最省事。 */
    window.__fig.stage = function(c){
      document.body.innerHTML='';
      document.body.style.margin='0';
      document.documentElement.style.background='#f2efe9';
      c.style.position='absolute'; c.style.left='0'; c.style.top='0';
      c.style.display='block'; c.id='__fig';
      document.body.appendChild(c);
      window.scrollTo(0,0);
    };
    return JSON.stringify({ok:1});
  `;
  await ev(HELPERS);

  /* ① 牛皮纸大图：左 = 成片原样；右 = 叠红框 + 红点 */
  const big = await ev(`
    var L=window.LUMEN, st=L.state, p=st.photos[0];
    p.tpl='kraft';
    p.stickers=[L.stkFix({k:'heart',x:.5,y:.5,rot:0,s:1.2,text:''})];
    /* 画布铺满视口（1400x900）：留白的话底下会露出页面本身的深色带，
       取证图上多一条黑边，看着像截图截坏了。 */
    var c=document.createElement('canvas'); c.width=1360; c.height=790;
    var x=c.getContext('2d');
    x.fillStyle='#f2efe9'; x.fillRect(0,0,c.width,c.height);
    x.fillStyle='#18161a'; x.font='700 25px system-ui,sans-serif'; x.textAlign='left'; x.textBaseline='top';
    x.fillText('牛皮纸 · 同一枚贴纸放在 (.5,.5)', 28, 22);
    x.fillStyle='#5a554e'; x.font='18px system-ui,sans-serif';
    x.fillText('红虚线 = 代码认定的「照片在哪儿」　红点 = 贴纸实际落点', 28, 56);
    var cv=L.renderCanvas(p,'kraft',L.optsFor(p),st.spec.longEdge,false);
    var W=430;
    window.__fig.overlay(x, cv, 130, 110, W, false, '成片（贴纸已烧进去）');
    window.__fig.overlay(x, cv, 130+W+180, 110, W, true, '同一张 + 照片矩形红框');
    x.fillStyle='#8a8378'; x.font='16px system-ui,sans-serif'; x.textAlign='left'; x.textBaseline='top';
    x.fillText('画布 ' + cv.width + 'x' + cv.height, 130, 110+Math.round(W*cv.height/cv.width)+40);
    x.fillStyle='#7d766c'; x.font='17px system-ui,sans-serif';
    x.fillText('红框 = photoRect（贴纸坐标系的基准）　红点 = 贴纸 (.5,.5) 应该落在的位置', 130, 700);
    x.fillText('红点落在红框中心 = 面板上看到的和成片里烧进去的是同一处', 130, 730);
    window.__fig.stage(c);
    return JSON.stringify({rect:[+cv.photoRect.dx.toFixed(1),+cv.photoRect.dy.toFixed(1)],
      W:cv.width, H:cv.height});
  `);
  await sleep(500);
  await b.screenshot(SHOT + '/' + tag + '-kraft.png');
  console.log(tag + ' kraft  rect=(' + big.rect.join(',') + ')  画布 ' + big.W + 'x' + big.H);

  /* ② 11 个模版铺成一张：每格都叠红框。6 列 2 行 —— 成片是 3:4 竖的，
     按长宽比铺出来一行最多放得下 6 个（4 列 3 行会高到被视口切掉）。 */
  const all = await ev(`
    var L=window.LUMEN, st=L.state, p=st.photos[0];
    p.tpl='kraft';
    p.stickers=[];
    var KS=${JSON.stringify(TPLS)};
    var COLS=6, CW2=205, GAPX=14, GAPY=48, PADX=24, PADY=78;
    var cv0=L.renderCanvas(p,'kraft',L.optsFor(p),st.spec.longEdge,true);
    var CELLH=Math.round(CW2*cv0.height/cv0.width);
    var rows=Math.ceil(KS.length/COLS);
    var c=document.createElement('canvas');
    /* 铺满视口，别留边 */
    c.width=1360; c.height=790;
    var x=c.getContext('2d');
    x.fillStyle='#f2efe9'; x.fillRect(0,0,c.width,c.height);
    x.fillStyle='#18161a'; x.font='700 25px system-ui,sans-serif'; x.textAlign='left'; x.textBaseline='top';
    x.fillText('全部 11 个模版 · 照片矩形红框', PADX, 22);
    x.fillStyle='#5a554e'; x.font='18px system-ui,sans-serif';
    x.fillText('红框只要越出那张成片，就说明坐标串台了', PADX, 56);
    KS.forEach(function(k,i){
      var cv=L.renderCanvas(p,k,L.optsFor(p),st.spec.longEdge,true);
      var ox=PADX+(i%COLS)*(CW2+GAPX), oy=PADY+Math.floor(i/COLS)*(CELLH+GAPY);
      window.__fig.overlay(x, cv, ox, oy, CW2, true, null);
      var rc=cv.photoRect;
      var off = !rc || rc.dx<0||rc.dy<0||rc.dx+rc.dw>cv.width||rc.dy+rc.dh>cv.height;
      x.fillStyle = off ? '#b3261e' : '#2a2724';
      x.font='600 15px system-ui,sans-serif'; x.textAlign='left'; x.textBaseline='top';
      x.fillText(k + (off?'  ✗ 越界':''), ox, oy+CELLH+6);
      x.fillStyle='#7d766c'; x.font='13px system-ui,sans-serif';
      x.fillText(rc ? (rc.dx.toFixed(0)+','+rc.dy.toFixed(0)+'  '+rc.dw.toFixed(0)+'x'+rc.dh.toFixed(0))
                    : '没有申报矩形', ox, oy+CELLH+23);
    });
    x.fillStyle='#7d766c'; x.font='17px system-ui,sans-serif'; x.textAlign='left'; x.textBaseline='top';
    x.fillText('红虚线 = 代码认定的「照片在哪儿」　红点 = 贴纸 (.5,.5) 的落点　✗ = 红框越出了成片', PADX, 706);
    x.fillText('magazine / cinematic 的红框本来就等于整块画布 —— 这两个模版的照片就是满版出血，不是退化', PADX, 736);
    window.__fig.stage(c);
    return JSON.stringify({w:c.width, h:c.height});
  `);
  await sleep(500);
  await b.screenshot(SHOT + '/' + tag + '-all.png');
  console.log(tag + ' 11 模版拼图 ' + all.w + 'x' + all.h);

  await b.close();
  await sleep(900);
}
console.log('-> ' + SHOT);
