import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const publicDir = join(process.cwd(), 'public');

function walk(dir) {
  const results = [];
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    if (statSync(full).isDirectory()) results.push(...walk(full));
    else if (extname(f) === '.html') results.push(full);
  }
  return results;
}

const files = walk(publicDir);
let total = 0;

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  // Add type="module" to script tags that load JS core/ui files without it
  const fixed = original.replace(
    /<script\s+src="(\/js\/[^"]+\.js)"\s*>/g,
    (match, src) => `<script type="module" src="${src}">`
  );
  if (fixed !== original) {
    writeFileSync(file, fixed, 'utf8');
    console.log(`  Fixed: ${file.split('public')[1]}`);
    total++;
  }
}
console.log(`\nDone. ${total} files fixed.`);
