import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

/* 本轮新增的「流程 + 保存」回归。
   用户反馈：① 每张照片分配不同模版，到底有没有被记住？② 现在流程像半成品
             ③ 首屏不该自动载入示例照片。

   验证点：
   F1 首屏是空的（0 张照片），不再自动载入示例
   F2 空状态里有「载入 28 张示例照片」按钮，真实点击后确实出来 28 张
   F3 胶片带点击只改「当前选中那张」的模版，其它照片不受影响
   F4 「应用到全部」把当前模版铺给所有照片
   F5 缩略图上的模版徽章文字 = 该照片实际模版
   F6 勾选/取消入册，生成按钮上的张数跟着变
   F7 生成只出「已入册」的照片，且每张用各自的模版
   F8 刷新页面后，模版分配与入册状态被恢复（持久化真的生效）
   F9 刷新后首屏仍然是空的（设置恢复了，但照片本来就不该自动加载）
*/

const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%85%89%E5%8C%A3-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const R = [];
const ok = (n, c, extra = '') => R.push((c ? 'PASS' : '**FAIL**') + ' ' + n + (extra ? '  ' + extra : ''));

const b = await launch({ port: 9401, windowSize: '1512,900' });
const ev = (x) => b.evaluate(x);

/* 每次都从干净状态开始（清掉上一次跑留下的保存数据） */
await b.goto(FILE, 1400);
await ev('try{localStorage.removeItem(PERSIST.KEY);}catch(e){}');
await b.goto(FILE, 1400);

/* ---------- F1 首屏为空 ---------- */
await sleep(900);
const n0 = await ev('state.photos.length');
ok('F1 首屏不自动载入示例照片', n0 === 0, 'photos=' + n0);
const emptyTxt = await ev("(document.querySelector('#stageBody .empty')||{}).textContent||''");
ok('F1b 空状态给出完整流程说明', /导入照片/.test(emptyTxt) && /模版/.test(emptyTxt) && /勾选/.test(emptyTxt));
const genDis = await ev("document.getElementById('genBtn').disabled");
ok('F1c 没有素材时「生成成片」是禁用的', genDis === true);
const railEmpty = await ev("!!document.querySelector('#railGrid .rail-empty')");
ok('F1d 素材栏有空状态提示', railEmpty === true);
const demoCards = await ev("document.querySelectorAll('#tplbar .tplcard canvas').length");
const demoPainted = await ev(`(function(){
  var cv=document.querySelector('#tplbar .tplcard canvas');
  if(!cv) return -1;
  var d=cv.getContext('2d').getImageData(0,0,cv.width,cv.height).data, n=0;
  for(var i=3;i<d.length;i+=4000) if(d[i]>8) n++;
  return n;
})()`);
ok('F1e 没有素材时胶片带用示例图演示（不是空框）', demoCards === 11 && demoPainted > 0,
   'cards=' + demoCards + ' 抽样非空=' + demoPainted);

/* ---------- F2 空状态按钮真实点击载入示例 ---------- */
await b.click('#stageBody #emptyDemo', { settle: 200 });
for (let i = 0; i < 160; i++) { if ((await ev('state.photos.length')) >= 28) break; await sleep(250); }
const n28 = await ev('state.photos.length');
ok('F2 点「载入 28 张示例照片」后确实有 28 张', n28 === 28, 'photos=' + n28);
ok('F2b 按钮上的张数已更新', /28/.test(await ev("document.getElementById('genBtn').textContent")),
   await ev("document.getElementById('genBtn').textContent"));

/* ---------- F3 逐张分配模版 ---------- */
await ev("setStep(1);");
await sleep(500);
/* 选中第 0 张，给它换成「胶片」 */
await ev("state.sel=state.photos[0].id; syncTplFromSel(); renderRail(); renderPanel(); renderDock();");
await sleep(300);
await b.click('#tplbar .tplcard[data-tpl="film"]', { settle: 300 });
const p0 = await ev("state.photos[0].tpl"), p1 = await ev("state.photos[1].tpl");
ok('F3 点模版只改当前选中那张', p0 === 'film' && p1 !== 'film', 'p0=' + p0 + ' p1=' + p1);
const badge0 = await ev("(document.querySelectorAll('#railGrid .rthumb .tplb')[0]||{}).textContent");
const badge1 = await ev("(document.querySelectorAll('#railGrid .rthumb .tplb')[1]||{}).textContent");
ok('F3b 缩略图徽章跟着变（胶片 / 其余）', badge0 === '胶片' && badge1 !== '胶片',
   '徽章0=' + badge0 + ' 徽章1=' + badge1);
const follw = await ev("state.tpl");
ok('F3c 当前模版跟随这张照片', follw === 'film', 'state.tpl=' + follw);

/* ---------- F4 应用到全部 ---------- */
await b.click('#tplbar .tplcard[data-tpl="grid9"]', { settle: 200 });
await b.click('#tplApplyAll', { settle: 600 });
const allGrid = await ev("state.photos.filter(function(p){return p.tpl==='grid9';}).length");
ok('F4 「应用到全部」把模版铺给所有照片', allGrid === 28, 'grid9=' + allGrid);

/* 回到「逐张不同」的状态，便于后面验证生成用的是各自的模版 */
await ev(`(function(){
  var keys=Object.keys(TPL);
  state.photos.forEach(function(p,i){ p.tpl=keys[i%keys.length]; });
  renderRail(); renderPanel(); renderDock();
})()`);
await sleep(400);
const spread = await ev("new Set(state.photos.map(function(p){return p.tpl;})).size");
ok('F4b 28 张照片现在各用不同模版', spread === 11, '用到 ' + spread + ' 套');

/* ---------- F6 勾选入册 ---------- */
await b.click('#railGrid .rthumb:nth-child(3) .pick', { settle: 250 });
const picked = await ev("state.photos.filter(function(p){return p.picked;}).length");
ok('F6 点勾选圈可把照片移出成片', picked === 27, '入册=' + picked);
await b.click('#pickNone', { settle: 250 });
const picked0 = await ev("state.photos.filter(function(p){return p.picked;}).length");
const genDis2 = await ev("document.getElementById('genBtn').disabled");
ok('F6b 「全不选」后入册为 0 且生成按钮禁用', picked0 === 0 && genDis2 === true,
   '入册=' + picked0 + ' disabled=' + genDis2);
await ev('railPickAll(true);');
await sleep(200);
ok('F6c 「全选」恢复 28 张入册',
   (await ev("state.photos.filter(function(p){return p.picked;}).length")) === 28);

/* 只留前 6 张入册 */
await ev(`(function(){
  state.photos.forEach(function(p,i){ p.picked = (i<6); });
  renderRail(); renderPanel();
})()`);
await sleep(200);

/* ---------- F7 生成只出已入册的，且各用自己的模版 ---------- */
await ev("window.LUMEN.generate()");
for (let i = 0; i < 120; i++) { if ((await ev('state.generated.length')) >= 6) break; await sleep(250); }
const g = await ev("state.generated.length");
const gtpl = await ev("state.generated.map(function(x){return x.tpl;})");
const ptpl = await ev("state.photos.slice(0,6).map(function(p){return p.tpl;})");
ok('F7 只生成已入册的 6 张', g === 6, 'generated=' + g);
ok('F7b 每张成片用的是它自己的模版', JSON.stringify(gtpl) === JSON.stringify(ptpl),
   '成片=' + JSON.stringify(gtpl) + ' 照片=' + JSON.stringify(ptpl));

/* ---------- F8 刷新后恢复 ---------- */
await ev('PERSIST.flush();');
await b.goto(FILE, 1600);
await sleep(800);
const nAfter = await ev('state.photos.length');
ok('F9 刷新后首屏仍然是空的（照片不自动加载）', nAfter === 0, 'photos=' + nAfter);
/* 模版恢复是「按照片名」的，所以要重新导入同名照片才会接回来 */
await ev("window.LUMEN.loadEmbedded(true)");
for (let i = 0; i < 160; i++) { if ((await ev('state.photos.length')) >= 28) break; await sleep(250); }
const restored = await ev("state.photos.filter(function(p){return p._restored;}).length");
const rp0 = await ev("state.photos[0].tpl");
const rp1 = await ev("state.photos[1].tpl");
const rpk = await ev("state.photos.filter(function(p){return p.picked;}).length");
ok('F8 重新导入后模版分配被接回来', restored === 28 && rp0 === ptpl[0] && rp1 === ptpl[1],
   '恢复=' + restored + ' p0=' + rp0 + '/' + ptpl[0] + ' p1=' + rp1 + '/' + ptpl[1]);
ok('F8b 入册勾选也被恢复了', rpk === 6, '入册=' + rpk);
const tplRestored = await ev("state.tpl");
ok('F8c 当前模版也被恢复', typeof tplRestored === 'string' && tplRestored.length > 0, tplRestored);

/* ---------- 收尾：清掉本次测试写入的保存 ---------- */
await ev("try{localStorage.removeItem(PERSIST.KEY);}catch(e){}");

const errs = b.errors.filter((e) => !/favicon|net::ERR_FILE/.test(e));
console.log(R.join('\n'));
console.log('\n--- JS 异常: ' + (errs && errs.length ? '\n' + errs.join('\n') : 'none'));
const bad = R.filter((x) => x.startsWith('**FAIL**')).length;
console.log('--- 失败项: ' + bad + ' / ' + R.length);
await b.close();
process.exit(bad ? 1 : 0);
