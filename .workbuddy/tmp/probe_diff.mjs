import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

/* 落地前后一帧的差分图：定位残余亮度差到底出在画面的哪一块 */
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9393, windowSize: '1512,900' });
await b.goto(FILE, 1200);
const ev = (x) => b.evaluate(x);
for (let i = 0; i < 120; i++) { if ((await ev('state.photos.length')) >= 28) break; await sleep(200); }
if ((await ev('state.photos.length')) < 28) { try { await ev('window.LUMEN.loadEmbedded(true)'); } catch (e) { } }
if ((await ev('state.generated.length')) < 28) { try { await ev('window.LUMEN.generate()'); } catch (e) { } }
for (let i = 0; i < 240; i++) { if ((await ev('state.generated.length')) >= 28) break; await sleep(250); }
await ev('setStep(2); state.book.spread=true; BV.spread=true;'); await sleep(900);
await ev('window.__raf=window.requestAnimationFrame; window.requestAnimationFrame=function(){return 0;};');

const out = await ev(`(function(){
  BV.anim=null; BV.live=null; BV.queue=[]; BV.cur=0;
  BV.offT=BV.targetOff(); BV.off=BV.offT; BV.syncUI(); BV.layout(); BV.draw();
  var ctx=BV.ctx,dpr=BV.dpr;
  var W=Math.round(BV.cw*dpr), H=Math.round(BV.ch*dpr);
  function grab(){ return ctx.getImageData(0,0,W,H).data; }
  BV.flipOne('fwd',{dur:400});
  var t0=BV.anim.t0, pre=null, land=null, preState='', landState='';
  for(var f=0;f<=26;f++){
    BV.raf=0;
    var wasCur=BV.cur, wasAnim=!!BV.anim;
    BV.step(t0+f*16);
    var nowCur=BV.cur, nowAnim=!!BV.anim;
    if(f===23){ pre=grab(); preState='cur='+wasCur+' anim='+(wasAnim?BV.anim.p.toFixed(4):'-'); }
    if(f===24){ land=grab(); landState='cur='+wasCur+'->'+nowCur+' anim='+(nowAnim?'still':'-')+
                 ' off='+BV.off.toFixed(2)+' spineX='+BV.spineX.toFixed(1)+' _lastLift='+(BV._lastLift||0).toFixed(4); }
  }
  /* 逐块统计｜Δ亮度｜，找出差异集中的区域 */
  var BX=10, BY=8, bw=Math.floor(W/BX), bh=Math.floor(H/BY), grid=[];
  for(var gy=0;gy<BY;gy++){ var row=[];
    for(var gx=0;gx<BX;gx++){
      var s=0,n=0;
      for(var y=gy*bh;y<(gy+1)*bh;y+=2) for(var x=gx*bw;x<(gx+1)*bw;x+=2){
        var i=(y*W+x)*4;
        var Lp=pre[i]*0.299+pre[i+1]*0.587+pre[i+2]*0.114, Ap=pre[i+3];
        var Ll=land[i]*0.299+land[i+1]*0.587+land[i+2]*0.114, Al=land[i+3];
        s+=Math.abs(Ll-Lp)+Math.abs(Al-Ap)*0.7; n++;
      }
      row.push(Math.round(s/n*10));
    }
    grid.push(row);
  }
  return JSON.stringify({preState:preState, landState:landState, W:W, H:H, grid:grid,
    spineXD:Math.round(BV.spineX*dpr), bw:bw, bh:bh});
})()`);

const d = JSON.parse(out);
console.log('落地前:', d.preState);
console.log('落地帧:', d.landState);
console.log('画布', d.W + 'x' + d.H, ' spineX=' + d.spineXD, ' 每块', d.bw + 'x' + d.bh);
console.log('|Δ|×10 的分布（列 →，行 ↓；spineX 在列 ' + (d.spineXD / d.bw).toFixed(1) + '）');
d.grid.forEach((r, i) => console.log(String(i).padStart(2) + ' ' + r.map(v => String(v).padStart(5)).join('')));
await ev('window.requestAnimationFrame=window.__raf;');
await b.close();
