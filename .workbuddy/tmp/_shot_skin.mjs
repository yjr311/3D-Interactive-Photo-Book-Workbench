import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'node:fs';

const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotskin';
fs.mkdirSync(OUT, { recursive: true });
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';

const b = await launch({ port: 9451, windowSize: '1500,1000' });
await b.goto(FILE, 2600);
await sleep(900);

/* 统一素材：只挑 8 张，保证每次跑的是同一批照片、同一批模版，
   这样 6 张截图之间的差异只可能来自「氛围」。 */
const prep = await b.evaluate(`(async function(){
  try{
    await window.LUMEN.loadEmbedded(true);
    var st=window.LUMEN.state;
    var tpls=['polaroid','film','minimal','kraft','postcard','grid9','duotone','titlecard'];
    st.photos.forEach(function(p,i){ p.picked=(i<8); p.tpl=tpls[i%tpls.length]; });
    /* 关掉模版自带的题字重复问题：用占位符，每页各不相同 */
    st.opts.title='{name}'; st.opts.sub='{n} / {total}'; st.opts.corner='';
    st.book.cap='name'; st.book.layout='mat'; st.book.num=true;
    window.LUMEN.setStep(2);
    await window.LUMEN.generate();
    await new Promise(function(r){ setTimeout(r,600); });
    /* generate() 在「已经处于第 2 步」时不会重调 setStep，舞台会停在占位状态。
       真实流程里是从别的步骤点「生成成片」进来的，所以不会遇到；
       这里重进一次第 2 步，只为让截图脚本可重复。 */
    window.LUMEN.setStep(1);
    window.LUMEN.setStep(2);
    await new Promise(function(r){ setTimeout(r,600); });
    return 'ok:'+st.generated.length;
  }catch(e){ return 'ERR:'+(e&&e.message||e); }
})()`);
console.log('prep:', prep);
await sleep(900);

async function shot(tag, ms) { await sleep(ms || 260); await b.screenshot(`${OUT}/${tag}.png`); }

const skins = ['studio', 'cream', 'peach', 'mist', 'mint', 'sakura', 'french'];
for (const k of skins) {
  /* 走真实点击路径（渲染面板 + 重排书页都由页面自己负责），
     而不是只调 applySkin 后手动补一堆重绘 —— 那样截出来的图不代表真实观感。 */
  const r = await b.evaluate(`(async function(){
    var L=window.LUMEN;
    var card=document.querySelector('.skin[data-skin="${k}"]');
    if(!card) return 'no-card';
    card.click();
    await new Promise(function(r){ setTimeout(r,900); });
    var B=L.BV;
    B.cur=0; B.anim=null; B.live=null; B.kick();
    return L.state.skin+':'+L.state.book.paper;
  })()`);
  console.log('  ' + k + ' -> ' + r);
  await shot('封面-' + k, 800);
  await b.evaluate(`(function(){
    var B=window.LUMEN.BV;
    B.cur=3; B.anim=null; B.live=null; B.syncUI(); B.kick(); return 1;
  })()`);
  await shot('内页-' + k, 800);
}

/* 工作台面板（第一屏的氛围卡片） */
await b.evaluate(`(async function(){
  var L=window.LUMEN;
  document.querySelector('.skin[data-skin="peach"]').click();
  await new Promise(function(r){ setTimeout(r,500); });
  L.setStep(0);
  return 1;
})()`);
await shot('面板-翻拍', 700);
await b.evaluate(`(function(){ window.LUMEN.setStep(2); return 1; })()`);
await shot('面板-书页设置', 700);

const errs = await b.evaluate('JSON.stringify(window.__errs||[])');
console.log('JS 异常:', errs);
await b.close();
