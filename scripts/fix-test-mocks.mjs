// Makes db mock methods async in all test files
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

function walk(dir) {
  const results = [];
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    if (statSync(full).isDirectory()) results.push(...walk(full));
    else if (extname(f) === '.mjs' || extname(f) === '.js') results.push(full);
  }
  return results;
}

const testsDir = join(process.cwd(), 'tests');
const files = walk(testsDir);
let total = 0;

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  let src = original;

  // Make mock prepare methods async: run/get/all: (...a) => X  →  run/get/all: async (...a) => X
  src = src.replace(
    /\b(run|get|all)\s*:\s*(?!async\s)(\()/g,
    '$1: async $2'
  );

  // Add lastInsertRowid to _mockRun default return value
  src = src.replace(
    /let _mockRun\s*=\s*\(\)\s*=>\s*\(\{\s*changes\s*:\s*1\s*\}\)/g,
    'let _mockRun = () => ({ changes: 1, lastInsertRowid: 1 })'
  );

  if (src !== original) {
    writeFileSync(file, src, 'utf8');
    console.log(`  Fixed: ${file.split('tests')[1]}`);
    total++;
  }
}

console.log(`\nDone. ${total} test files updated.`);
