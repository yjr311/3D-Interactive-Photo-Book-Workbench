import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
import fs from 'fs';
const ROOT='C:/Users/zz/WorkBuddy/2026-09-11-11-24-14';
const FILE='file:///'+ROOT+'/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const OUT=ROOT+'/.workbuddy/tmp/shotsb2'; fs.mkdirSync(OUT,{recursive:true});
const b = await launch({ port: 9533, windowSize: '1440,940' });
await b.goto(FILE, 2500); await sleep(700);
async function ev(x){
  const raw=await b.evaluate(`(async function(){try{${x}}catch(e){return JSON.stringify({__err:String(e&&e.stack||e)})}})()`);
  const o=JSON.parse(raw); if(o&&o.__err) console.log('  [err] '+o.__err); return o;
}
const panel = await ev(`
  var L=window.LUMEN, st=L.state;
  await L.loadEmbedded(true); await L.generate();
  for(var i=0;i<80;i++){ await new Promise(function(r){setTimeout(r,100);}); if(!L.bookStale()) break; }
  L.setStep(2);
  var p=st.photos[0];
  p.stickers=[L.stkFix({k:'tape',x:.18,y:.12,rot:-.2,s:1.1,text:''}),
              L.stkFix({k:'heart',x:.62,y:.40,rot:.12,s:1.3,text:''}),
              L.stkFix({k:'doodle',x:.40,y:.74,rot:.02,s:1.2,text:'好喜欢这天'})];
  st._stkSel=1;
  L.refreshStickerArt(p);
  L.renderPanel();
  await new Promise(function(r){setTimeout(r,500);});
  var secs=document.querySelectorAll('#panel details.sec'), sec=null;
  for(var i=0;i<secs.length;i++){ if(secs[i].querySelector('.stks')) { sec=secs[i]; break; } }
  if(sec){ sec.open=true; sec.scrollIntoView({block:'start'}); }
  await new Promise(function(r){setTimeout(r,700);});
  var r=sec?sec.getBoundingClientRect():{left:0,top:0,width:0,height:0};
  var cv=document.getElementById('stkStage');
  return JSON.stringify({x:Math.round(r.left),y:Math.round(r.top),w:Math.round(r.width),h:Math.round(r.height),
    cv:cv?cv.width+'x'+cv.height:'?', css:cv?(function(){var q=cv.getBoundingClientRect();return Math.round(q.width)+'x'+Math.round(q.height);})():'?'});
`);
console.log('panel:', JSON.stringify(panel));
await b.screenshot(OUT+'/06-贴纸面板-带模版.png');
console.log('wrote 06');
await b.close();
