import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

/* 把每个候选的顶栏拍下来（2x）。用法：node _shot_bar.mjs A3 A3t At E3 F3 */
const DIR = 'C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/logo';
const keys = process.argv.slice(2);
const W = 1240, H = 260, Z = 2;

for (const k of keys) {
  const b = await launch({ port: 9620 + Math.floor(Math.random() * 40), windowSize: `${W * Z},${H * Z}` });
  await b.goto(`file:///${DIR}/prev_${k}.html`, 2600);
  await b.evaluate(`document.documentElement.style.zoom='${Z}'; 1`);
  await sleep(1200);
  await b.screenshot(`${DIR}/bar_${k}_dark.png`);
  // 切浅色主题
  await b.click('#themeBtn');
  await sleep(900);
  await b.screenshot(`${DIR}/bar_${k}_light.png`);
  const t = await b.evaluate(`document.documentElement.getAttribute('data-theme')`);
  console.log(k, 'theme after click =', t);
  await b.close();
}
console.log('bar shots done');
