import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';
const FILE = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9443, windowSize: '1400,920' });
await b.goto(FILE, 2600);
await sleep(900);
await b.evaluate(`(async function(){ await window.LUMEN.loadEmbedded(true); window.LUMEN.setStep(2); await window.LUMEN.generate(); await new Promise(r=>setTimeout(r,700)); return 'ok'; })()`);
const r = await b.evaluate(`(async function(){
  try{
    function sleep(ms){return new Promise(function(r){setTimeout(r,ms);});}
    var L=window.LUMEN, st=L.state;
    function sig(cv){
      var x=cv.getContext('2d');
      var d=x.getImageData(0,0,cv.width,cv.height).data;
      var s=0,n=0;
      for(var i=0;i<d.length;i+=4*97){ s+=d[i]+d[i+1]*3+d[i+2]*7; n++; }
      return Math.round(s/n);
    }
    st.photos.forEach(function(p,i){ p.picked=(i===0); p.tpl='polaroid'; });
    st.opts.title='{name}'; st.opts.sub=''; st.opts.corner='';
    st.book.cap='name';
    var log=[];
    L.applySkin('studio');
    await L.generate(); log.push('gen1='+st.generated.length);
    var cv=st.generated[0].art; log.push('art='+cv.width+'x'+cv.height);
    var a=sig(cv); log.push('a='+a);
    L.applySkin('sakura');
    await L.generate(); log.push('gen2='+st.generated.length);
    var b2=sig(st.generated[0].art); log.push('b='+b2);
    return JSON.stringify({log:log,a:a,b:b2});
  }catch(e){ return 'ERR:'+(e&&e.stack||e); }
})()`);
console.log(r);
await b.close();
