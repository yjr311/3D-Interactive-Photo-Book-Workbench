import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'fs';

/* 第二批「能玩」的出图：把新东西摆到几张图上看一遍。
   出图只是交叉核对 —— 真正的取证是 test_batch2.mjs 里的像素量测
   （几何量测为主、看图做交叉核对，是这个项目一直的做法）。 */
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsb2';
fs.mkdirSync(OUT, { recursive: true });

const b = await launch({ port: 9511, windowSize: '1444,940' });
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
  if (!m) { console.log('NO DATAURL ' + name); return; }
  fs.writeFileSync(OUT + '/' + name + '.png', Buffer.from(m[1], 'base64'));
  console.log('wrote ' + name);
}
async function board(body, name) {
  const r = await ev(body);
  save(r.url, name);
}

console.log('setup:', JSON.stringify(await ev(`
  await window.LUMEN.loadEmbedded(true);
  var L=window.LUMEN, st=L.state;
  L.setStep(2);
  await L.generate();
  for(var i=0;i<80;i++){ await new Promise(function(r){setTimeout(r,120);}); if(!L.bookStale()) break; }
  return JSON.stringify({n:st.photos.length, gen:st.generated.length});
`)));

/* ① 八枚贴纸的实际画法 */
await board(`
  var L=window.LUMEN;
  var CW=240, CH=150, cols=4, rows=2, pad=8;
  var c=document.createElement('canvas');
  c.width=cols*CW+pad*(cols+1); c.height=rows*CH+pad*(rows+1);
  var x=c.getContext('2d');
  x.fillStyle='#f2efe9'; x.fillRect(0,0,c.width,c.height);
  L.STK_ORDER.forEach(function(k,i){
    var cx=pad+(i%cols)*(CW+pad), cy=pad+Math.floor(i/cols)*(CH+pad);
    x.save();
    x.fillStyle='#fffdf8'; x.fillRect(cx,cy,CW,CH);
    x.strokeStyle='#ddd8cf'; x.lineWidth=1; x.strokeRect(cx+.5,cy+.5,CW-1,CH-1);
    /* ⚠ 贴纸的锚点是**矩形内**的归一化点（rect.dx + x*rect.dw，第十四轮起）。
       这里已经把原点 translate 到格子中心了，所以矩形要给 dx=dy=0 ——
       锚点就落在 translate 后的原点上，即格子中心。尺寸仍取 min(CW,CH)*基准。
       要挪的是 translate，不是坐标 —— 这是给贴纸做样张时最容易写错的一处。 */
    x.translate(cx+CW/2,cy+CH/2+6);
    L.drawStickers(x,{dx:0,dy:0,dw:CW,dh:CH},[L.stkFix({k:k,x:0,y:0,rot:0,s:2.9,
      text:String(L.STICKERS[k].dflt||'')})],L.state.photos[0]);
    x.restore();
    x.fillStyle='#8a8378'; x.font='13px sans-serif'; x.textAlign='left';
    x.fillText((L.STICKERS[k].name||'')+'  '+k,cx+7,cy+17);
  });
  return JSON.stringify({url:c.toDataURL('image/png')});
`, '01-八枚贴纸');

/* ② 同一张照片：原样 vs 贴满 */
await board(`
  var L=window.LUMEN, st=L.state;
  var p=st.photos[0];
  var CW=360, CH=Math.round(CW*4/3), pad=10;
  var c=document.createElement('canvas'); c.width=CW*2+pad*3; c.height=CH+pad*2+22;
  var x=c.getContext('2d');
  x.fillStyle='#f2efe9'; x.fillRect(0,0,c.width,c.height);
  function shot(stickers,ox,label){
    p.stickers=stickers;
    var art=L.renderPlain(p,900);
    x.save(); x.shadowColor='rgba(0,0,0,.22)'; x.shadowBlur=14; x.shadowOffsetY=4;
    x.fillStyle='#fff'; x.fillRect(ox+pad,pad,CW,CH); x.restore();
    var k=Math.min(CW/art.width,CH/art.height);
    var dw=art.width*k, dh=art.height*k;
    x.drawImage(art,ox+pad+(CW-dw)/2,pad+(CH-dh)/2,dw,dh);
    x.fillStyle='#4a443c'; x.font='13px sans-serif'; x.textAlign='center';
    x.fillText(label,ox+pad+CW/2,pad+CH+16);
  }
  var S=function(k,xx,yy,rot,s,txt){ return L.stkFix({k:k,x:xx,y:yy,rot:rot||0,s:s||1,text:txt==null?'':txt}); };
  shot([], 0, '原样（没有贴纸）');
  shot([S('tape',.20,.13,-.22,1.1),
        S('doodle',.70,.74,.03,1.5,'好喜欢这天'),
        S('stamp',.76,.15,-.04,1.0,'{date}'),
        S('heart',.26,.82,.14,.9),
        S('ticket',.50,.46,-.06,1.0,'KADA · 入场券')], CW+pad,
        '贴满：胶带 / 手写圈 / 日期戳 / 爱心 / 票根');
  p.stickers=[];
  return JSON.stringify({url:c.toDataURL('image/png')});
`, '02-贴纸在照片上');

/* ③ 书页版式对照（含九宫格） */
await board(`
  var L=window.LUMEN, st=L.state;
  st.generated.forEach(function(g){ g.picked=true; });
  st.book.ratio='3:4'; st.book.cap='name';
  function page(layout,art){
    st.book.layout=layout; st.book.art=art;
    var r=L.buildBookPages();
    var cc=r.pages.filter(function(p){ return p.kind==='content'; });
    return cc[Math.min(1,cc.length-1)].canvas;
  }
  var CW=290, pad=10, CH=0;
  var spec=[['full','tpl'],['sticker','tpl'],['mat','tpl'],['grid','tpl'],['grid','plain']];
  var arr=spec.map(function(a){ var cv=page(a[0],a[1]);
    CH=Math.max(CH,Math.round(CW*cv.height/cv.width)); return {cv:cv,a:a}; });
  var c=document.createElement('canvas');
  c.width=pad+(CW+pad)*arr.length; c.height=CH+pad*2+22;
  var x=c.getContext('2d');
  x.fillStyle='#f2efe9'; x.fillRect(0,0,c.width,c.height);
  arr.forEach(function(o,i){
    var ox=pad+i*(CW+pad);
    x.save(); x.shadowColor='rgba(0,0,0,.20)'; x.shadowBlur=12; x.shadowOffsetY=3;
    x.fillStyle='#fff'; x.fillRect(ox,pad,CW,CH); x.restore();
    x.drawImage(o.cv,ox,pad,CW,CH);
    x.fillStyle='#4a443c'; x.font='12px sans-serif'; x.textAlign='center';
    x.fillText(L.layoutLabel(o.a[0])+(o.a[1]==='tpl'?'':'（干净照片）'),ox+CW/2,pad+CH+16);
  });
  st.book.layout='mat'; st.book.art='tpl';
  return JSON.stringify({url:c.toDataURL('image/png')});
`, '03-书页版式对照');

/* ④ 双封面寄语 */
await board(`
  var L=window.LUMEN, st=L.state;
  var CW=290, CH=Math.round(CW*3/2), pad=10;
  var c=document.createElement('canvas');
  c.width=pad+(CW+pad)*4; c.height=CH+pad*2+22;
  var x=c.getContext('2d');
  x.fillStyle='#f2efe9'; x.fillRect(0,0,c.width,c.height);
  function draw(cv,ox,label){
    x.save(); x.shadowColor='rgba(0,0,0,.20)'; x.shadowBlur=12; x.shadowOffsetY=3;
    x.fillStyle='#fff'; x.fillRect(ox,pad,CW,CH); x.restore();
    x.drawImage(cv,ox,pad,CW,CH);
    x.fillStyle='#4a443c'; x.font='12px sans-serif'; x.textAlign='center';
    x.fillText(label,ox+CW/2,pad+CH+16);
  }
  var W=880, H=1320;
  st.book.coverNote=''; st.book.backNote='';
  draw(L.renderCover(W,H),pad,'封面 · 无寄语');
  st.book.coverNote='送给 2026 年的我们';
  draw(L.renderCover(W,H),pad+(CW+pad),'封面 · 有寄语');
  st.book.backNote='愿你把每一个瞬间都留下来。';
  draw(L.renderBack(W,H),pad+(CW+pad)*2,'封底 · 一句');
  st.book.backNote='愿你把每一个瞬间都留下来。愿你在很多年以后翻到这一页，还能想起那个下午的风、那杯没喝完的咖啡、和身边那个正在笑的人，还有当时没说出口的那句谢谢。';
  draw(L.renderBack(W,H),pad+(CW+pad)*3,'封底 · 超长（收在 3 行内）');
  st.book.coverNote=''; st.book.backNote='';
  return JSON.stringify({url:c.toDataURL('image/png')});
`, '04-封面与封底寄语');

/* ⑤ 面板实况（真实浏览器截图）+ 贴纸那一段裁剪 */
const box = await ev(`
  var L=window.LUMEN, st=L.state;
  var c=L.stkCur();
  c.p.stickers=[L.stkFix({k:'tape',x:.24,y:.20,rot:-.2,s:1.2,text:''}),
                L.stkFix({k:'doodle',x:.70,y:.70,rot:.03,s:1.4,text:'好喜欢这天'}),
                L.stkFix({k:'stamp',x:.76,y:.18,rot:-.04,s:1,text:'{date}'})];
  L.renderPanel();
  await new Promise(function(r){ setTimeout(r,600); });
  var secs=document.querySelectorAll('#panel details.sec');
  var sec=null;
  for(var i=0;i<secs.length;i++){ if(secs[i].querySelector('.stks')) { sec=secs[i]; break; } }
  if(!sec) return JSON.stringify({err:'找不到贴纸那一段'});
  sec.open=true;
  sec.scrollIntoView({block:'start'});
  await new Promise(function(r){ setTimeout(r,600); });
  var r=sec.getBoundingClientRect();
  return JSON.stringify({x:Math.round(r.left),y:Math.round(r.top),
    w:Math.round(r.width),h:Math.round(r.height), dpr:window.devicePixelRatio||1});
`);
console.log('panel box:', JSON.stringify(box));
await b.screenshot(OUT + '/05-面板全屏.png');
console.log('wrote 05-面板全屏');

await b.close();
console.log('done ->', OUT);
