import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'fs';

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsfont';
fs.mkdirSync(OUT, { recursive: true });

const b = await launch({ port: 9497, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(600);

async function ev(body) {
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const o = JSON.parse(raw);
  if (o && o.__err) console.log('  [err] ' + o.__err);
  return o;
}

/* 1) 看 FONTS 能不能从全局拿到 */
const meta = await ev(`
  var has = (typeof FONTS!=='undefined');
  return JSON.stringify({ hasFONTS: has, serif: has?FONTS.serif:'(none)', sans: has?FONTS.sans:'(none)', hand: has?FONTS.hand:'(none)' });
`);
console.log('FONTS 可见性:', JSON.stringify(meta));

/* 2) 用位图等价类判断"到底落到了哪个字体" */
const STACKS = [
  ['serif(项目)', 'Georgia,"Songti SC","SimSun",serif'],
  ['sans(项目)', '"Helvetica Neue",Helvetica,Arial,"PingFang SC","Microsoft YaHei",sans-serif'],
  ['hand(项目)', '"Segoe Script","Bradley Hand","STXingkai","PingFang SC","Microsoft YaHei",cursive'],
  ['generic-serif', 'serif'],
  ['generic-sans', 'sans-serif'],
  ['SimSun', 'SimSun'],
  ['NSimSun', 'NSimSun'],
  ['宋体', '宋体'],
  ['Microsoft YaHei', '"Microsoft YaHei"'],
  ['SimHei', 'SimHei'],
  ['DengXian', 'DengXian'],
  ['KaiTi', 'KaiTi'],
  ['楷体', '楷体'],
  ['FangSong', 'FangSong'],
  ['仿宋', '仿宋'],
  ['STSong', 'STSong'],
  ['Songti SC', '"Songti SC"'],
  ['STZhongsong', 'STZhongsong'],
  ['STKaiti', 'STKaiti'],
  ['STXingkai', 'STXingkai'],
  ['LiSu', 'LiSu'],
  ['YouYuan', 'YouYuan'],
  ['Source Han Serif SC', '"Source Han Serif SC"'],
  ['Noto Serif CJK SC', '"Noto Serif CJK SC"'],
  ['Noto Serif SC', '"Noto Serif SC"'],
  ['Source Han Sans SC', '"Source Han Sans SC"'],
  ['Yu Mincho', '"Yu Mincho"'],
  ['Hiragino Mincho ProN', '"Hiragino Mincho ProN"'],
  ['MingLiU', 'MingLiU'],
  ['PMingLiU', 'PMingLiU'],
  ['Microsoft JhengHei', '"Microsoft JhengHei"'],
  ['Times New Roman', '"Times New Roman"'],
];

const res = await ev(`
  var TEXT='拍照的人先笑一个';
  function drawCJK(fam){
    var c=document.createElement('canvas'); c.width=560; c.height=90;
    var x=c.getContext('2d');
    x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height);
    x.fillStyle='#000'; x.font='56px '+fam; x.textBaseline='middle';
    x.fillText(TEXT,10,45);
    x.fillStyle='#000'; x.font='56px '+fam;
    x.fillText('LUMEN 08',300,45);
    var d=x.getImageData(0,0,c.width,c.height).data;
    var ink=0,sum=0,h=0;
    for(var i=0;i<d.length;i+=4){
      var v=d[i];
      if(v<200){ ink++; sum+=(255-v); }
      h=(h*31 + d[i] + d[i+1]*3 + d[i+2]*7)>>>0;
    }
    return {h:h, ink:ink, dark:(ink? sum/ink:0)};
  }
  var stacks=${JSON.stringify(STACKS)};
  var out=[];
  for(var i=0;i<stacks.length;i++){
    var r=drawCJK(stacks[i][1]);
    out.push({name:stacks[i][0], fam:stacks[i][1], h:r.h, ink:r.ink, dark:Math.round(r.dark*10)/10});
  }
  return JSON.stringify({out:out});
`);

const rows = res.out;
/* 归组：hash 相同 = 同一字体 */
const byHash = new Map();
rows.forEach(r => {
  if (!byHash.has(r.h)) byHash.set(r.h, []);
  byHash.get(r.h).push(r.name);
});
console.log('\n===== 实际落到的字体等价类（同组 = 同一款字体渲染）=====');
let gi = 0;
const groupOf = {};
byHash.forEach((names, h) => {
  gi++;
  const sample = rows.find(r => r.h === h);
  console.log(`组${gi}  ink=${String(sample.ink).padStart(5)}  平均墨深=${String(sample.dark).padStart(5)}  ← ${names.join(' / ')}`);
  names.forEach(n => groupOf[n] = gi);
});
console.log('\n===== 逐项明细 =====');
rows.forEach(r => console.log(`  组${groupOf[r.name]}  ink=${String(r.ink).padStart(5)}  墨深=${String(r.dark).padStart(5)}  ${r.name}`));

/* 3) 出一张放大对照图：把候选字体各画一行，肉眼看气质 */
const sheet = await ev(`
  var TEXT='拍照的人先笑一个';
  var picks=[
    ['当前（项目 serif）','Georgia,"Songti SC","SimSun",serif'],
    ['SimSun 宋体','SimSun'],
    ['FangSong 仿宋','FangSong'],
    ['KaiTi 楷体','KaiTi'],
    ['STKaiti','STKaiti'],
    ['STXingkai 行楷','STXingkai'],
    ['Microsoft YaHei（用户现在看到的）','"Microsoft YaHei"'],
    ['SimHei 黑体','SimHei'],
    ['DengXian 等线','DengXian'],
    ['STZhongsong','STZhongsong'],
    ['Georgia（拉丁，右页图注用的）','Georgia'],
  ];
  var LW=170, RH=78, W=1000, H=RH*picks.length+30;
  var c=document.createElement('canvas'); c.width=W; c.height=H;
  var x=c.getContext('2d');
  x.fillStyle='#f4efe4'; x.fillRect(0,0,W,H);
  for(var i=0;i<picks.length;i++){
    var y=RH*i+20;
    x.fillStyle='#7a7060'; x.font='600 15px system-ui,"Microsoft YaHei",sans-serif'; x.textAlign='left';
    x.fillText(picks[i][0],12,y+18);
    x.fillStyle='#2b2620'; x.font='44px '+picks[i][1]; x.textBaseline='middle';
    x.fillText(TEXT,LW,y+RH*0.55);
    x.globalAlpha=.9; x.font='30px '+picks[i][1];
    x.fillText('LUMEN 08',LW+430,y+RH*0.55);
    x.globalAlpha=1;
    x.fillStyle='rgba(0,0,0,.10)'; x.fillRect(0,y+RH-1,W,1);
  }
  return JSON.stringify({url:c.toDataURL('image/png')});
`);
const m = /^data:image\/png;base64,([\s\S]+)$/.exec(sheet.url || '');
if (m) { fs.writeFileSync(OUT + '/FONT-候选字体对照.png', Buffer.from(m[1], 'base64')); console.log('\nwrote FONT-候选字体对照.png'); }

await b.close();
