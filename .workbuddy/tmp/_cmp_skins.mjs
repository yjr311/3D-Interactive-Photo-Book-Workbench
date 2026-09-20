import fs from 'fs';
const html=fs.readFileSync('咔哒书-3D互动照片书.html','utf8');
const i=html.indexOf('SKINS={');
// 从产物里取出 SKINS 对象字面量（括号配平）
let d=0,j=i+6,ins=false,q='';
for(;j<html.length;j++){const c=html[j];
  if(ins){ if(c==='\\'){j++;continue;} if(c===q)ins=false; continue; }
  if(c==='"'||c==="'"){ins=true;q=c;continue;}
  if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}
}
const lit=html.slice(i+6,j);
const orig=eval('('+lit+')');
const src=fs.readFileSync('.workbuddy/tmp/src/core.js','utf8');
// 用 Function 求值 src 里的 SKINS（只截取该对象）
const k=src.indexOf('const SKINS={'), m=src.indexOf('\n};',k);
const SK=eval('('+src.slice(k+'const SKINS='.length,m+3).replace(/;$/,'')+')');
const keys=['tplPaper','tplInk','tplKraft','bookPaper','bookInk','cover','accent','accent2','handRole','grain','radius'];
let bad=0;
for(const id of Object.keys(orig)){
  if(!SK[id]){ console.log('MISSING',id); bad++; continue; }
  for(const f of keys){
    if(JSON.stringify(orig[id][f])!==JSON.stringify(SK[id][f])){ console.log('DIFF',id,f,orig[id][f],'!=',SK[id][f]); bad++; }
  }
  if(JSON.stringify(orig[id].ui)!==JSON.stringify(SK[id].ui)){ console.log('DIFF ui',id); bad++; }
  if(JSON.stringify(orig[id].sw)!==JSON.stringify(SK[id].sw)){ console.log('DIFF sw',id); bad++; }
  if(orig[id].name!==SK[id].name||orig[id].hint!==SK[id].hint){ console.log('DIFF name/hint',id); bad++; }
}
console.log('skin value diffs:',bad,'| skins in orig:',Object.keys(orig).length,'| in src:',Object.keys(SK).length);
