import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

/* 逐帧采样翻页画布：找「落地后白一下」到底白在哪一帧、白在哪个区域 */
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%85%89%E5%8C%A3-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9371, windowSize: '1440,900' });
await b.goto(FILE, 1200);
const ev = (x) => b.evaluate(x);

for (let i = 0; i < 120; i++) { if ((await ev('state.photos.length')) >= 28) break; await sleep(200); }
if ((await ev('state.photos.length')) < 28) { try { await ev('window.LUMEN.loadEmbedded(true)'); } catch (e) { } }
if ((await ev('state.generated.length')) < 28) { try { await ev('window.LUMEN.generate()'); } catch (e) { } }
for (let i = 0; i < 240; i++) { if ((await ev('state.generated.length')) >= 28) break; await sleep(250); }
await ev('setStep(2)'); await sleep(1200);
await ev(`window.__raf=window.requestAnimationFrame; window.requestAnimationFrame=function(){return 0;};`);

const out = await ev(`(function(){
  var BV=window.LUMEN.BV, state=window.LUMEN.state;
  BV.anim=null; BV.live=null; BV.queue=[]; BV.cur=0; BV.offT=BV.targetOff(); BV.off=BV.offT;
  BV.syncUI(); BV.draw();
  var ctx=BV.ctx, dpr=BV.dpr, W=Math.round(BV.cw), H=Math.round(BV.ch);
  function meas(){
    var d=ctx.getImageData(0,0,Math.round(W*dpr),Math.round(H*dpr)).data;
    var sx=Math.round(BV.spineX*dpr), pw=Math.round(BV.pw*dpr);
    var sum=0,n=0,wht=0, ls=0,ln=0,lw=0, rs=0,rn=0,rw=0, osum=0,on=0;
    var w=Math.round(W*dpr), h=Math.round(H*dpr);
    for(var y=0;y<h;y+=3) for(var x=0;x<w;x+=3){
      var i=(y*w+x)*4, r=d[i],g=d[i+1],bl=d[i+2];
      var L=(r*0.299+g*0.587+bl*0.114);
      sum+=L;n++; if(r>245&&g>245&&bl>245) wht++;
      if(x<sx){ ls+=L;ln++; if(r>245&&g>245&&bl>245) lw++; }
      else { rs+=L;rn++; if(r>245&&g>245&&bl>245) rw++; }
    }
    return {mean:+(sum/n).toFixed(1), white:+(wht/n*100).toFixed(2),
            L:+(ls/Math.max(1,ln)).toFixed(1), Lw:+(lw/Math.max(1,ln)*100).toFixed(2),
            R:+(rs/Math.max(1,rn)).toFixed(1), Rw:+(rw/Math.max(1,rn)*100).toFixed(2)};
  }
  var rows=[];
  function run(){
    BV.cur=0; BV.anim=null; BV.live=null; BV.queue=[];
    BV.offT=BV.targetOff(); BV.off=BV.offT; BV.syncUI(); BV.draw();
    BV.flipOne('fwd',{dur:400});
    var t0=BV.anim.t0;
    rows=[]; 
    for(var f=0;f<=29;f++){
      BV.raf=0;
      var t=t0+f*16;
      var beforeCur=BV.cur;
      BV.step(t);
      var m=meas();
      rows.push((f*16)+'ms cur'+beforeCur+'->'+BV.cur+' anim='+(BV.anim?BV.anim.p.toFixed(3):'done')+
                ' | mean='+m.mean+' white%='+m.white+' | 左半 L='+m.L+' white%='+m.Lw+' | 右半 R='+m.R+' white%='+m.Rw);
    }
    BV.anim=null; BV.live=null; BV.kick&&0;
  }
  run();
  /* 书脊阴影是否溢出到书左侧的桌面上：对比「紧贴书左边」与「远处背景」的平均亮度 */
  BV.anim=null; BV.live=null; BV.cur=0; BV.offT=BV.targetOff(); BV.off=BV.offT; BV.syncUI(); BV.draw();
  var d2=ctx.getImageData(0,0,Math.round(W*dpr),Math.round(H*dpr)).data;
  var w2=Math.round(W*dpr), h2=Math.round(H*dpr);
  var sx2=BV.spineX*dpr, lx=sx2-BV.pw*dpr;                 /* 书左边缘（css→device） */
  var y0=Math.round((BV.top+BV.ph*0.30)*dpr), y1=Math.round((BV.top+BV.ph*0.70)*dpr);
  function band(xa,xb){
    xa=Math.max(0,Math.round(xa)); xb=Math.min(w2,Math.round(xb));
    var s=0,n=0,al=0,amax=0;
    for(var y=y0;y<y1;y+=2) for(var x=xa;x<xb;x+=2){
      var i=(y*w2+x)*4; s+=d2[i]*0.299+d2[i+1]*0.587+d2[i+2]*0.114; n++;
      al+=d2[i+3]; if(d2[i+3]>amax) amax=d2[i+3];
    }
    return n?('亮度'+(s/n).toFixed(1)+' alpha均'+(al/n).toFixed(1)+' alpha峰'+amax):'空';
  }
  var geom='cw='+Math.round(W)+' ch='+Math.round(H)+' pw='+Math.round(BV.pw)+' spineX='+Math.round(BV.spineX)+
           ' 书左边缘='+Math.round(BV.spineX-BV.pw)+' 书右边缘='+Math.round(BV.spineX+BV.pw);
  /* 灰痕出现的位置是 spineX-58 .. spineX（书脊左半边被铺到了桌面上）。
     未绘制的像素 alpha=0；若阴影溢出，这些像素的 alpha 会 >0。 */
  var bleed=band(sx2-56*dpr, sx2-2*dpr);                    /* 紧贴书脊左侧（应 alpha=0） */
  var inb  =band(sx2+2*dpr, sx2+56*dpr);                    /* 封面内侧书脊处（应有阴影） */
  return rows.join('\\n')+'\\n\\n[书脊溢出检查] '+geom+
         '\\n  书脊左侧 0~56px → '+bleed+'\\n  封面内侧 0~56px → '+inb;
})()`);

console.log(out);
console.log('\nspread=', await ev('BV.spread'), ' pages=', await ev('BV.pages.length'), ' n=', await ev('BV.n'), ' paper=', await ev('JSON.stringify(state.book.paper)'));
await ev('window.requestAnimationFrame=window.__raf;');
await b.close();
