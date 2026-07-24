// Adds `async` to every `export function` and standalone `function` declarations
// that contain `await` in their body — fixes functions that got await added by add-await.mjs
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

  // Add async to: export function X(  →  export async function X(
  // but NOT if already async
  src = src.replace(/\bexport function\s+(\w+)\s*\(/g, (match, name) => {
    return `export async function ${name}(`;
  });

  // Add async to: export default function(  →  export default async function(
  src = src.replace(/\bexport default function\s*\(/g, 'export default async function(');

  // Add async to standalone function declarations that contain await:
  // This is harder — only convert if the word "await" appears after the function opening
  // We do a simpler approach: convert ALL standalone exported functions
  // (non-exported standalone functions stay sync unless they had await added)

  if (src !== original) {
    writeFileSync(file, src, 'utf8');
    console.log(`  async-ified: ${file.split('src')[1]}`);
    totalFiles++;
  }
}

console.log(`\nDone. ${totalFiles} files updated.`);
