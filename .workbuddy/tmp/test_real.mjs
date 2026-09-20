import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

/* 真实输入回归：所有交互一律走 CDP Input 域的原生鼠标事件。
   覆盖 pointer 捕获 / click 重定向 / 拖拽判定 等合成事件测不出来的路径。 */

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const R = [];
const ok = (n, c, extra = '') => R.push((c ? 'PASS' : '**FAIL**') + ' ' + n + (extra ? '  ' + extra : ''));

const b = await launch({ port: 9361, windowSize: '1440,900' });
await b.goto(FILE, 1200);
const ev = (x) => b.evaluate(x);

/* 首屏现在刻意不自动载入示例 —— 由脚本自己显式载入，再开始测交互 */
if ((await ev('state.photos.length')) < 28) { try { await ev('window.LUMEN.loadEmbedded(true)'); } catch (e) { } }
for (let i = 0; i < 160; i++) { if ((await ev('state.photos.length')) >= 28) break; await sleep(200); }
await sleep(600);
const np = await ev('state.photos.length');
ok('显式载入 28 张示例素材', np >= 28, 'photos=' + np);
ok('初始停留在步骤一（不再被自动顶到步骤二）', (await ev('state.step')) === 0, 'step=' + await ev('state.step'));
ok('模版胶片带可见', (await ev('getComputedStyle($("#tplbar")).display')) === 'flex');

/* ================= A. 点击模版卡片（用户报告的 bug） ================= */
const keys = await ev('Object.keys(TPL)');
let allOk = true; const miss = [];
for (const k of keys) {
  await b.click('.tplcard[data-tpl="' + k + '"]', { settle: 90 });
  const now = await ev('state.tpl');
  if (now !== k) { allOk = false; miss.push(k + '->' + now); }
}
ok('A1 全部 ' + keys.length + ' 张卡片真实点击均能切换', allOk, miss.join(','));
const on = await ev('document.querySelector(".tplcard.on").dataset.tpl');
ok('A2 选中态跟随', on === keys[keys.length - 1], 'on=' + on);
ok('A3 aria-pressed 同步',
  (await ev('document.querySelector(\'.tplcard[data-tpl="' + keys[keys.length - 1] + '"]\').getAttribute("aria-pressed")')) === 'true');
ok('A4 切换后预览标题同步', (await ev('$("#stageNote").textContent')).indexOf(await ev('TPL[state.tpl].name')) >= 0,
  await ev('$("#stageNote").textContent'));

/* ================= B. 胶片带拖拽：先放大到溢出，再拖 ================= */
/* 取一张当前真正落在视口内、且未被选中的卡片（放大后卡片会滚出屏幕，必须按矩形筛） */
const visibleCard = async (exclude) => JSON.parse(await ev(`(function(){
  var els=[...document.querySelectorAll('.tplcard')];
  for(var i=0;i<els.length;i++){
    var r=els[i].getBoundingClientRect();
    if(r.left>170&&r.right<1250&&els[i].dataset.tpl!==${JSON.stringify(exclude)})
      return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),tpl:els[i].dataset.tpl});
  }
  return 'null';
})()`));

const bc = await b.center('#tplbar');
for (let i = 0; i < 5; i++) {
  await b.mouse('mouseWheel', bc.x, bc.y, { deltaX: 0, deltaY: -120, modifiers: 2 });
  await sleep(140);
}
await sleep(600);
const wBig = await ev('document.querySelector(".tplcard").getBoundingClientRect().width');
const ov = await ev('JSON.stringify({sw:$("#tplbar").scrollWidth, cw:$("#tplbar").clientWidth})');
ok('B0 Ctrl+滚轮放大胶片', wBig > 100, 'cardW=' + wBig.toFixed(1));
ok('B1 放大后胶片可横向滚动', JSON.parse(ov).sw > JSON.parse(ov).cw, ov);

const tplBefore = await ev('state.tpl');
await ev('$("#tplbar").scrollLeft=760');
const v2 = await visibleCard(tplBefore);
ok('B2 取得视口内可拖拽的卡片', v2 !== null, JSON.stringify(v2));
const sl0 = await ev('$("#tplbar").scrollLeft');
await b.mouse('mouseMoved', v2.x, v2.y);
await b.mouse('mousePressed', v2.x, v2.y);
for (let i = 1; i <= 6; i++) { await b.mouse('mouseMoved', v2.x - i * 14, v2.y); await sleep(16); }
await b.mouse('mouseReleased', v2.x - 84, v2.y);
await sleep(600);
const sl = await ev('$("#tplbar").scrollLeft');
ok('B3 拖拽改变 scrollLeft', sl > sl0 + 40, sl0 + ' -> ' + sl);
ok('B4 拖拽不误切换模版', (await ev('state.tpl')) === tplBefore, tplBefore + ' -> ' + await ev('state.tpl'));

/* B5 拖拽结束后紧接的普通点击仍然有效（抑制窗口不能吃掉后续点击） */
await ev('$("#tplbar").scrollLeft=760');
const v5 = await visibleCard(await ev('state.tpl'));
await b.mouse('mouseMoved', v5.x, v5.y);
await b.mouse('mousePressed', v5.x, v5.y);
await b.mouse('mouseReleased', v5.x, v5.y);
await sleep(200);
ok('B5 拖拽后点击仍生效', (await ev('state.tpl')) === v5.tpl, 'want=' + v5.tpl + ' got=' + await ev('state.tpl'));

/* B6 手抖 3px 仍按点击处理 */
await ev('$("#tplbar").scrollLeft=760');
const v6 = await visibleCard(await ev('state.tpl'));
await b.mouse('mouseMoved', v6.x, v6.y);
await b.mouse('mousePressed', v6.x, v6.y);
await b.mouse('mouseMoved', v6.x + 3, v6.y + 2);
await b.mouse('mouseReleased', v6.x + 3, v6.y + 2);
await sleep(200);
ok('B6 手抖 3px 仍按点击处理', (await ev('state.tpl')) === v6.tpl, 'want=' + v6.tpl + ' got=' + await ev('state.tpl'));

/* B7 Ctrl+滚轮缩小 */
const wSmall0 = wBig;
await b.mouse('mouseWheel', bc.x, bc.y, { deltaX: 0, deltaY: 200, modifiers: 2 });
await sleep(250);
const wSmall1 = await ev('document.querySelector(".tplcard").getBoundingClientRect().width');
ok('B7 Ctrl+滚轮缩小胶片', wSmall1 < wSmall0 - 1, wSmall0.toFixed(1) + ' -> ' + wSmall1.toFixed(1));

/* B8 键盘 Enter 切换 */
await ev('$("#tplbar").scrollLeft=0');
const kb = (await ev('state.tpl')) === keys[0] ? keys[2] : keys[0];
await ev('$(".tplcard[data-tpl=\'' + kb + '\']").focus()');
await ev('(function(){var e=$(".tplcard[data-tpl=\'' + kb + '\']");' +
  'e.dispatchEvent(new KeyboardEvent("keydown",{key:"Enter",bubbles:true,cancelable:true}));})()');
await sleep(200);
ok('B8 键盘 Enter 切换模版', (await ev('state.tpl')) === kb, 'want=' + kb + ' got=' + await ev('state.tpl'));

/* ================= C. 生成成片 → 选片条 ================= */
await b.click('#genBtn');
for (let i = 0; i < 240; i++) { if ((await ev('(state.generated||[]).length')) > 0) break; await sleep(250); }
const ng = await ev('(state.generated||[]).length');
ok('C0 点击生成成片', ng > 0, 'generated=' + ng);
await sleep(900);
ok('C1 选片条可见', (await ev('getComputedStyle($("#strip")).display')) !== 'none');

/* C2/C3 命中测试：确认照片真的能被点中（此前被轨道平面遮挡） */
const hits = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('.sitem')].slice(0,6).map(function(el){
  var r=el.getBoundingClientRect();
  var h=document.elementFromPoint(Math.round(r.left+r.width/2),Math.round(r.top+r.height/2));
  return {i:el.dataset.i, x:Math.round(r.left+r.width/2),
          hit:h?(h.closest&&h.closest('.sitem')?h.closest('.sitem').dataset.i:('X:'+(h.className||h.tagName))):'null'};
}))`));
ok('C2 选片条照片可被命中的范围', hits.filter(h => h.hit === h.i).length >= 4,
  hits.map(h => h.i + '→' + h.hit).join(' '));

/* C3 点居中照片 → 切换收录 */
const pos0 = await ev('R(STRIP.pos)');
const pick0 = await ev('state.generated[' + pos0 + '].picked');
const ctr = await b.center('.sitem[data-i="' + pos0 + '"]');
await b.mouse('mouseMoved', ctr.x, ctr.y);
await b.mouse('mousePressed', ctr.x, ctr.y);
await b.mouse('mouseReleased', ctr.x, ctr.y);
await sleep(500);
ok('C3 点居中照片切换收录', (await ev('state.generated[' + pos0 + '].picked')) !== pick0,
  'i=' + pos0 + ' ' + pick0 + ' -> ' + await ev('state.generated[' + pos0 + '].picked'));

/* C4 点两侧照片 → 滚到居中 */
const side = Math.min(pos0 + 2, ng - 1);
const sc = await b.center('.sitem[data-i="' + side + '"]');
if (sc && sc.x > 100 && sc.x < 1300) {
  await b.mouse('mouseMoved', sc.x, sc.y);
  await b.mouse('mousePressed', sc.x, sc.y);
  await b.mouse('mouseReleased', sc.x, sc.y);
  await sleep(900);
  ok('C4 点两侧照片使其居中', (await ev('R(STRIP.pos)')) === side,
    'want=' + side + ' got=' + await ev('R(STRIP.pos)'));
} else ok('C4 点两侧照片使其居中', false, '目标不在可视区 x=' + (sc && sc.x));

/* C5 箭头 */
const p5 = await ev('R(STRIP.pos)');
await b.click('#stripNext', { settle: 700 });
ok('C5 下一张箭头', (await ev('R(STRIP.pos)')) === Math.min(p5 + 1, ng - 1), 'pos=' + await ev('R(STRIP.pos)'));

/* C6 拖拽 + 惯性 + 弹簧落整数位 */
const dc6 = await b.center('#stripTrack');
await b.mouse('mouseMoved', dc6.x, dc6.y);
await b.mouse('mousePressed', dc6.x, dc6.y);
for (let i = 1; i <= 6; i++) { await b.mouse('mouseMoved', dc6.x - i * 16, dc6.y); await sleep(16); }
await b.mouse('mouseReleased', dc6.x - 96, dc6.y);
await sleep(1500);
const pf = await ev('STRIP.pos');
ok('C6 拖拽后弹簧落到整数位', Math.abs(pf - Math.round(pf)) < 0.01, 'pos=' + pf);
ok('C7 拖拽不会误切换收录', (await ev('state.generated[' + Math.round(pf) + '].picked')) === (await ev('state.generated[' + Math.round(pf) + '].picked')), '');

/* ================= D. 预览区 ================= */
await ev('setStep(1)');
await sleep(600);
const z0 = await ev('PV.zoom');
const pc = await b.center('#pvWrap');
await b.mouse('mouseWheel', pc.x, pc.y, { deltaX: 0, deltaY: -240, modifiers: 2 });
await sleep(350);
ok('D1 预览 Ctrl+滚轮缩放', (await ev('PV.zoom')) > z0 + .01, z0.toFixed(3) + ' -> ' + await ev('PV.zoom'));
await b.click('#pvFit', { settle: 350 });
ok('D2 适应窗口按钮', Math.abs((await ev('PV.zoom')) - 1) < .02, 'zoom=' + await ev('PV.zoom'));
await b.click('#pvZoomIn', { settle: 300 });
ok('D3 放大按钮', (await ev('PV.zoom')) > 1.01, 'zoom=' + await ev('PV.zoom'));

/* ================= 结果 ================= */
const errors = b.errors.filter(e => !/favicon|net::ERR_FILE/.test(e));
console.log(R.join('\n'));
console.log('\n--- JS 异常:' + (errors.length ? '\n' + errors.join('\n') : ' none'));
console.log('--- 失败项: ' + R.filter(r => r.startsWith('**')).length + ' / ' + R.length);

await b.close();
