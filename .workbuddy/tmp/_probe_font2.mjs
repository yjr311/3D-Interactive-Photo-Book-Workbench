import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'fs';

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/shotsfont';
fs.mkdirSync(OUT, { recursive: true });

const b = await launch({ port: 9499, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(600);

async function ev(body) {
  const raw = await b.evaluate(`(async function(){ try{ ${body} }catch(e){ return JSON.stringify({__err:(e&&e.stack)||String(e)}); } })()`);
  const o = JSON.parse(raw);
  if (o && o.__err) console.log('  [err] ' + o.__err);
  return o;
}

const STACKS = [
  ['项目 serif', 'Georgia,"Songti SC","SimSun",serif'],
  ['项目 sans', '"Helvetica Neue",Helvetica,Arial,"PingFang SC","Microsoft YaHei",sans-serif'],
  ['generic serif', 'serif'],
  ['SimSun', 'SimSun'],
  ['Microsoft YaHei', '"Microsoft YaHei"'],
  ['SimHei', 'SimHei'],
  ['DengXian', 'DengXian'],
  ['KaiTi', 'KaiTi'],
  ['FangSong', 'FangSong'],
  ['Microsoft JhengHei', '"Microsoft JhengHei"'],
  ['Georgia', 'Georgia'],
  ['Times New Roman', '"Times New Roman"'],
  ['SimSun 打头+Georgia 兜底', 'SimSun,Georgia,serif'],
  ['Georgia+SimSun', 'Georgia,SimSun,serif'],
];

const res = await ev(`
  function hashCanvas(fam, text, size, track){
    var c=document.createElement('canvas'); c.width=900; c.height=110;
    var x=c.getContext('2d');
    x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height);
    x.fillStyle='#000'; x.font=size+'px '+fam; x.textBaseline='middle';
    /* 逐字画，避免字距影响可比性；此处只画一遍 */
    x.fillText(text,10,55);
    var d=x.getImageData(0,0,c.width,c.height).data;
    var ink=0,sum=0,h=0;
    for(var i=0;i<d.length;i+=4){
      if(d[i]<200){ ink++; sum+=(255-d[i]); }
      h=(h*31 + d[i]*1 + d[i+1]*3 + d[i+2]*7)>>>0;
    }
    return {h:h, ink:ink, dark:(ink? Math.round(sum/ink*10)/10 : 0)};
  }
  var stacks=${JSON.stringify(STACKS)};
  var out=[];
  for(var i=0;i<stacks.length;i++){
    var s=stacks[i];
    var cjk=hashCanvas(s[1],'拍照的人先笑一个',56);
    var lat=hashCanvas(s[1],'LUMEN 08',56);
    out.push({name:s[0], cjk:cjk, lat:lat});
  }
  return JSON.stringify({out:out});
`);

const rows = res.out;
function group(key) {
  const by = new Map();
  rows.forEach(r => {
    const h = r[key].h;
    if (!by.has(h)) by.set(h, []);
    by.get(h).push(r.name);
  });
  return by;
}
console.log('===== CJK 实际落点（只画中文，不含拉丁）=====');
group('cjk').forEach((names, h) => {
  const s = rows.find(r => r.cjk.h === h).cjk;
  console.log(`  ink=${String(s.ink).padStart(5)} 墨深=${String(s.dark).padStart(5)}  ← ${names.join(' / ')}`);
});
console.log('\n===== 拉丁 实际落点 =====');
group('lat').forEach((names, h) => {
  const s = rows.find(r => r.lat.h === h).lat;
  console.log(`  ink=${String(s.ink).padStart(5)} 墨深=${String(s.dark).padStart(5)}  ← ${names.join(' / ')}`);
});

const projSerif = rows.find(r => r.name === '项目 serif');
const simsun = rows.find(r => r.name === 'SimSun');
const yahei = rows.find(r => r.name === 'Microsoft YaHei');
const gserif = rows.find(r => r.name === 'generic serif');
console.log('\n===== 关键判定 =====');
console.log(`  项目 serif 的中文 == SimSun ?      ${projSerif.cjk.h === simsun.cjk.h ? '✅ 是' : '❌ 不是'}`);
console.log(`  项目 serif 的中文 == YaHei ?       ${projSerif.cjk.h === yahei.cjk.h ? '✅ 是（这就是"板正"的来源）' : '❌ 不是'}`);
console.log(`  项目 serif 的中文 == generic serif ? ${projSerif.cjk.h === gserif.cjk.h ? '✅ 是' : '❌ 不是'}`);
console.log(`  项目 serif 的拉丁 == Georgia ?      ${projSerif.lat.h === rows.find(r => r.name === 'Georgia').lat.h ? '✅ 是' : '❌ 不是'}`);
console.log(`  中文墨量：项目serif=${projSerif.cjk.ink}  SimSun=${simsun.cjk.ink}  YaHei=${yahei.cjk.ink}（越小越纤细）`);

/* 大图对照：只画中文，最能看出气质 */
const sheet = await ev(`
  var TEXT='拍照的人先笑一个';
  var picks=[
    ['当前项目 serif（用户看到的）','Georgia,"Songti SC","SimSun",serif'],
    ['SimSun 宋体（细明体气质）','SimSun'],
    ['FangSong 仿宋','FangSong'],
    ['KaiTi 楷体','KaiTi'],
    ['Microsoft YaHei 微软雅黑','"Microsoft YaHei"'],
    ['SimHei 黑体','SimHei'],
    ['DengXian 等线','DengXian'],
    ['Microsoft JhengHei 微软正黑','"Microsoft JhengHei"'],
  ];
  var LW=210, RH=96, W=1180, H=RH*picks.length+30;
  var c=document.createElement('canvas'); c.width=W; c.height=H;
  var x=c.getContext('2d');
  x.fillStyle='#f4efe4'; x.fillRect(0,0,W,H);
  for(var i=0;i<picks.length;i++){
    var y=RH*i+20;
    x.fillStyle='#7a7060'; x.font='600 15px system-ui,"Microsoft YaHei",sans-serif'; x.textAlign='left';
    x.fillText(picks[i][0],12,y+22);
    x.fillStyle='#2b2620'; x.font='52px '+picks[i][1]; x.textBaseline='middle';
    x.fillText(TEXT,LW,y+RH*0.55);
    x.fillStyle='rgba(0,0,0,.10)'; x.fillRect(0,y+RH-1,W,1);
  }
  return JSON.stringify({url:c.toDataURL('image/png')});
`);
const m = /^data:image\/png;base64,([\s\S]+)$/.exec(sheet.url || '');
if (m) { fs.writeFileSync(OUT + '/FONT-中文气质对照.png', Buffer.from(m[1], 'base64')); console.log('\nwrote FONT-中文气质对照.png'); }

await b.close();
