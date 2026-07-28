const fs = require('fs');
const path = require('path');

function walk(dir) {
  let r = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) r.push(...walk(full));
    else if (f.endsWith('.mjs') || f.endsWith('.js')) r.push(full);
  }
  return r;
}

const files = walk('tests');
let n = 0;
for (const f of files) {
  let s = fs.readFileSync(f, 'utf8');
  const orig = s;
  s = s.replace(/\b(run|get|all)\s*:\s*(?!async\s)(\()/g, '$1: async $2');
  s = s.replace(/let _mockRun\s*=\s*\(\)\s*=>\s*\(\{\s*changes\s*:\s*1\s*\}\)/g,
    'let _mockRun = () => ({ changes: 1, lastInsertRowid: 1 })');
  if (s !== orig) { fs.writeFileSync(f, s); n++; console.log('fixed:', path.relative('tests', f)); }
}
console.log('Total:', n);
