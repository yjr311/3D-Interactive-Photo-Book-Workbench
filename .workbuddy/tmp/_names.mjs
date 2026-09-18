import fs from 'node:fs';
const s = fs.readFileSync('C:/Users/zz/WorkBuddy/2026-09-11-11-24-14/.workbuddy/tmp/photos.js', 'utf8');
const m = s.match(/name\s*:\s*("([^"]*)"|'([^']*)')/g) || [];
console.log('count:', m.length);
console.log(m.join('\n'));
console.log('--- head 300 ---');
console.log(s.slice(0, 300));
