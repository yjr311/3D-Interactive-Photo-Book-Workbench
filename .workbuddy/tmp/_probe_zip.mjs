import { launch, sleep } from 'file:///C:/Users/zz/.workbuddy/skills/verify-html-in-browser/scripts/cdp.mjs';

const F = 'file:///C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/%E5%92%94%E5%93%92%E4%B9%A6-3D%E4%BA%92%E5%8A%A8%E7%85%A7%E7%89%87%E4%B9%A6.html';
const b = await launch({ port: 9633, windowSize: '1380,900' });
await b.goto(F, 3200);
await b.evaluate(`try{localStorage.clear()}catch(e){}; 1`);
await b.goto(F, 3200);
await sleep(900);

// 拦下载：把 blob 留下，别真的存盘
await b.evaluate(`(function(){
  window.__blob=null;
  var o=URL.createObjectURL.bind(URL);
  URL.createObjectURL=function(x){ try{ if(x&&x.size>1000) window.__blob=x; }catch(e){} return o(x); };
  HTMLAnchorElement.prototype.click=function(){ window.__clicked=(this.download||''); };
  return 1;
})()`);

// 装一个 ZIP 解包 + JPEG 尺寸读取器（页面内跑，避免把几 MB 传回来）
await b.evaluate(`(function(){
  window.__readZip=async function(blob){
    const buf=new Uint8Array(await blob.arrayBuffer());
    const dv=new DataView(buf.buffer);
    let p=0, out=[];
    while(p+30<=buf.length){
      if(dv.getUint32(p,true)!==0x04034b50) break;
      const method=dv.getUint16(p+8,true);
      const csize=dv.getUint32(p+18,true);
      const nlen=dv.getUint16(p+26,true), elen=dv.getUint16(p+28,true);
      const name=new TextDecoder().decode(buf.subarray(p+30,p+30+nlen));
      const dataStart=p+30+nlen+elen;
      const comp=buf.subarray(dataStart,dataStart+csize);
      let raw=comp;
      if(method===8){
        const ds=new DecompressionStream('deflate-raw');
        const w=ds.writable.getWriter(); w.write(comp); w.close();
        raw=new Uint8Array(await new Response(ds.readable).arrayBuffer());
      }
      let dim='-';
      if(/\\.jpe?g$/.test(name)){
        for(let i=0;i<raw.length-9;i++){
          if(raw[i]===0xFF && raw[i+1]>=0xC0 && raw[i+1]<=0xC3){
            dim=dv2(raw,i); break;
          }
        }
      } else if(/\\.png$/.test(name)){
        const d=new DataView(raw.buffer,raw.byteOffset,raw.byteLength);
        dim=d.getUint32(16)+'x'+d.getUint32(20);
      } else if(/\\.txt$/.test(name)){
        dim=new TextDecoder().decode(raw).replace(/\\n/g,' | ');
      }
      out.push({name:name, size:csize, dim:dim});
      p=dataStart+csize;
    }
    return out;
    function dv2(a,i){
      const h=(a[i+5]<<8)|a[i+6], w=(a[i+7]<<8)|a[i+8];
      return w+'x'+h;
    }
  };
  return 1;
})()`);

console.log('== 生成一批成片（默认尺寸）==');
await b.evaluate(`(async function(){
  var L=window.LUMEN, st=L.state;
  await L.loadEmbedded(true);
  st.photos.forEach(function(p,i){ p.picked=(i<4); });
  L.setStep(2); await L.generate();
  for(var i=0;i<250;i++){ await new Promise(function(r){setTimeout(r,120);}); if(st.generated.length===4) break; }
  L.renderPanel(); L.setStep(0); L.setStep(2);
  await new Promise(function(r){setTimeout(r,900);});
  return 1;
})()`);
await sleep(600);

const st1 = await b.evaluate(`(function(){var s=window.LUMEN.state;return JSON.stringify({ratio:s.spec.ratio,LE:s.spec.longEdge,cur:window.LUMEN.exportPresetNow(),c0:s.generated[0].canvas.width+'x'+s.generated[0].canvas.height});})()`);
console.log('生成后：', st1);

console.log('== 改成「方图」，但**不重新生成**，直接导出 ZIP ==');
await b.evaluate(`(function(){var e=document.querySelector('.chip[data-export="square"]'); e.scrollIntoView({block:'center'}); return 1})()`);
await sleep(400);
let c = await b.center('.chip[data-export="square"]');
await b.mouse('mousePressed', c.x, c.y, { button: 'left', clickCount: 1 });
await b.mouse('mouseReleased', c.x, c.y, { button: 'left', clickCount: 1 });
await sleep(900);
console.log('点后方图：', await b.evaluate(`(function(){var s=window.LUMEN.state;return JSON.stringify({ratio:s.spec.ratio,LE:s.spec.longEdge,cur:window.LUMEN.exportPresetNow(),stale:window.LUMEN.bookStale(),c0:s.generated[0].canvas.width+'x'+s.generated[0].canvas.height});})()`));

await b.evaluate(`(function(){var e=document.getElementById('exportZip'); e.scrollIntoView({block:'center'}); return 1})()`);
await sleep(400);
c = await b.center('#exportZip');
await b.mouse('mousePressed', c.x, c.y, { button: 'left', clickCount: 1 });
await b.mouse('mouseReleased', c.x, c.y, { button: 'left', clickCount: 1 });
await sleep(3500);

const zip = await b.evaluate(`(async function(){
  if(!window.__blob) return '没有抓到 blob';
  var r=await window.__readZip(window.__blob);
  return JSON.stringify({download:window.__clicked, files:r});
})()`);
console.log('ZIP 文件名 =', JSON.parse(zip).download);
console.log('ZIP 内文件：');
for (const f of JSON.parse(zip).files) console.log('   ', f.name, '|', f.dim);

console.log('== 现在真的重新生成，再导一次做对照 ==');
await b.evaluate(`(async function(){
  var L=window.LUMEN, st=L.state;
  await L.generate();
  for(var i=0;i<250;i++){ await new Promise(function(r){setTimeout(r,120);}); if(st.generated.length===4&&!L.bookStale()) break; }
  window.__blob=null; return 1;
})()`);
await b.evaluate(`(function(){var e=document.getElementById('exportZip'); e.scrollIntoView({block:'center'}); return 1})()`);
await sleep(400);
c = await b.center('#exportZip');
await b.mouse('mousePressed', c.x, c.y, { button: 'left', clickCount: 1 });
await b.mouse('mouseReleased', c.x, c.y, { button: 'left', clickCount: 1 });
await sleep(3500);
const zip2 = await b.evaluate(`(async function(){
  if(!window.__blob) return '没有抓到 blob';
  var r=await window.__readZip(window.__blob);
  return JSON.stringify({download:window.__clicked, files:r});
})()`);
console.log('ZIP 文件名 =', JSON.parse(zip2).download);
for (const f of JSON.parse(zip2).files) console.log('   ', f.name, '|', f.dim);

console.log('JS 异常', JSON.stringify(b.errors));
await b.close();
