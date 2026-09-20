import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

/* 用法：node _shot_full.mjs <file-url> <out.png> [w] [startY] [h]
   整页很长 → 分 2 段拍，再用 PIL 竖着拼起来。 */
const url = process.argv[2];
const out = process.argv[3];
const w = Number(process.argv[4] || 1240);
const H = Number(process.argv[5] || 1400);

const b = await launch({ port: 9616, windowSize: `${w},${H}` });
await b.goto('file:///' + url.replace(/\\/g, '/'), 2000);
await sleep(700);
const total = await b.evaluate('Math.ceil(document.documentElement.scrollHeight)');
console.log('total height =', total, ' capture =', H);
const n = Math.ceil(total / H);
for (let i = 0; i < n; i++) {
  const y = i * H;
  await b.evaluate(`window.scrollTo(0, ${y}); 1`);
  await sleep(500);
  await b.screenshot(out.replace(/\.png$/, `-${i}.png`));
  console.log('  seg', i, 'y=', y);
}
await b.close();
console.log('saved', n, 'segments');
