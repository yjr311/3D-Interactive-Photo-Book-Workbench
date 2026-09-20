import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

/* 用法：node _shot.mjs <file-url> <out.png> [zoom] [w] [h]
   —— cdp.mjs 的 launch 固定 --force-device-scale-factor=1，拿不到 2x。
      这里改用「窗口放大 N 倍 + body zoom=N」拿到 N 倍像素密度（SVG 会重新栅格化，是真清晰）。 */
const url = process.argv[2];
const out = process.argv[3];
const zoom = Number(process.argv[4] || 1);
const w = Number(process.argv[5] || 1240);
const h = Number(process.argv[6] || 620);

const b = await launch({ port: 9610, windowSize: `${w * zoom},${h * zoom}` });
await b.goto('file:///' + url.replace(/\\/g, '/'), 1800);
if (zoom !== 1) await b.evaluate(`document.documentElement.style.zoom='${zoom}'; 1`);
await sleep(700);
await b.screenshot(out);
await b.close();
console.log('saved', out, 'zoom=' + zoom);
