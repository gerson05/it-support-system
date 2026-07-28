// Makes non-exported `function X(` declarations async when they contain `await`
const fs = require('fs');
const path = require('path');

function walk(dir) {
  let r = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) r.push(...walk(full));
    else if (f.endsWith('.js') || f.endsWith('.mjs')) r.push(full);
  }
  return r;
}

const files = walk('src');
let total = 0;

for (const file of files) {
  const src = fs.readFileSync(file, 'utf8');
  const lines = src.split('\n');
  const out = [];
  let changed = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Match non-async, non-exported function declarations
    if (/^function\s+\w+\s*\(/.test(line) && !/^async\s/.test(line)) {
      // Scan next 40 lines for `await`
      const body = lines.slice(i + 1, i + 41).join('\n');
      if (/\bawait\b/.test(body)) {
        out.push(line.replace(/^function\s+/, 'async function '));
        changed = true;
        continue;
      }
    }
    out.push(line);
  }

  if (changed) {
    fs.writeFileSync(file, out.join('\n'));
    console.log('fixed:', path.relative('src', file));
    total++;
  }
}
console.log('Total:', total);
