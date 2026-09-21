import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

/* 图标落地后的真·改前/改后：两个产物各拍顶栏（深/浅），3× 放大。
   改前那份是 _build_old.py 用 _bak_head2.html 组出来的（旧方块图标），
   所以这是"同一份产品、只差图标"的对照，不是嘴上的 before/after。 */
const OUT = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/logo';
const Z = 3;
const CASES = [
  { tag: 'old', file: 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/_oldlogo.html', port: 9661 },
  { tag: 'new', file: 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/咔哒书-3D互动照片书.html', port: 9662 },
];

for (const c of CASES) {
  // 中文文件名必须逐字节百分号编码；encodeURI 只编非 ASCII，不会动 `:` 和 `/`，正好合用
  const url = 'file:///' + encodeURI(c.file);
  const b = await launch({ port: c.port, windowSize: `${1000 * Z},${170 * Z}` });
  await b.goto(url, 3200);
  await b.evaluate(`document.documentElement.style.zoom='${Z}'; 1`);
  await sleep(800);
  const r = await b.evaluate(`(function(){
    var e=document.querySelector('.brand .logo'); if(!e) return 'none';
    var q=e.getBoundingClientRect();
    var n=document.querySelector('.brand').getBoundingClientRect();
    var left=Math.min(q.left,n.left);
    return JSON.stringify({l:Math.round(left),t:Math.round(q.top),w:Math.round(q.width),h:Math.round(q.height),
      brandW:Math.round(n.width), paths:e.querySelectorAll('path').length,
      fill:(e.querySelector('path')||{}).getAttribute?(e.querySelector('path').getAttribute('fill')):'-'});
  })()`);
  console.log(c.tag, 'rect =', r);
  await b.screenshot(`${OUT}/cmp_${c.tag}_dark.png`);
  await b.click('#themeBtn');
  await sleep(700);
  await b.screenshot(`${OUT}/cmp_${c.tag}_light.png`);
  console.log(c.tag, 'errors', JSON.stringify(b.errors));
  await b.close();
}
console.log('done');
