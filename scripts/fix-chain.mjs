// Fixes patterns like:
//   await db.prepare(sql).get().n   →  (await db.prepare(sql).get()).n
//   await db.prepare(sql).all().map(  →  (await db.prepare(sql).all()).map(
import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

function walk(dir) {
  const results = [];
  for (const f of readdirSync(dir)) {
    const full = join(dir, f);
    if (statSync(full).isDirectory()) results.push(...walk(full));
    else if (extname(f) === '.js') results.push(full);
  }
  return results;
}

const srcDir = join(process.cwd(), 'src');
const files  = walk(srcDir).filter(f => !f.includes('database.js'));

let totalFiles = 0;

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  let src = original;

  // Fix: await db.prepare(sql).get(args).PROPERTY
  // Becomes: (await db.prepare(sql).get(args)).PROPERTY
  // Pattern: await db.prepare(ANYTHING).get(ANYTHING).word
  // We handle this line by line to avoid multiline SQL regex issues
  const lines = src.split('\n');
  const fixed = lines.map(line => {
    // Match: await db.prepare(???).get(???).identifier
    // The ??? can include nested parens from template literals — use a simple heuristic
    line = line.replace(
      /\b(await\s+db\.prepare\s*\(.*?\)\s*\.\s*get\s*\([^)]*\))\s*\.\s*(\w+)\b/g,
      '($1).$2'
    );
    line = line.replace(
      /\b(await\s+db\.prepare\s*\(.*?\)\s*\.\s*get\s*\([^)]*\))\s*\.\s*(\w+)\b/g,
      '($1).$2'
    );
    // Match: await db.prepare(???).all(???).map/filter/find/forEach/reduce/length
    line = line.replace(
      /\b(await\s+db\.prepare\s*\(.*?\)\s*\.\s*all\s*\([^)]*\))\s*\.\s*(map|filter|find|forEach|reduce|length|some|every)\b/g,
      '($1).$2'
    );
    return line;
  });

  src = fixed.join('\n');

  if (src !== original) {
    writeFileSync(file, src, 'utf8');
    console.log(`  Fixed chains: ${file.split('src')[1]}`);
    totalFiles++;
  }
}

console.log(`\nDone. ${totalFiles} files fixed.`);
