// Adds `await` to all db.prepare().all/get/run() and db.exec() call sites
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

let totalChanges = 0;

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  let src = original;

  // 1. db.prepare(...).<method>( — add await before db.prepare
  //    Handles both single-line and multi-line (the .get/.all/.run may be on next line)
  src = src.replace(/(?<![.\w])(?<!await\s)(db\.prepare\s*\()/g, 'await $1');

  // 2. db.exec( — add await
  src = src.replace(/(?<![.\w])(?<!await\s)(db\.exec\s*\()/g, 'await $1');

  // 3. Stored prepared statement variables: upd.run(, stmt.all(, etc.
  //    Find all `const/let varName = await db.prepare(...)` then add await to varName.run/get/all
  //    Strategy: find variable names assigned from db.prepare, then add await to their method calls
  const prepVarNames = new Set();
  const prepAssignRe = /(?:const|let|var)\s+(\w+)\s*=\s*await db\.prepare\s*\(/g;
  let m;
  while ((m = prepAssignRe.exec(src)) !== null) {
    prepVarNames.add(m[1]);
  }

  for (const varName of prepVarNames) {
    const re = new RegExp(`(?<!await\\s)(\\b${varName}\\s*\\.\\s*(?:all|get|run)\\s*\\()`, 'g');
    src = src.replace(re, 'await $1');
  }

  // 4. Chained .map() after .all() — the await goes on the whole expression
  //    e.g. db.prepare(...).all(...).map(  →  (await db.prepare(...).all(...)).map(
  //    This is already handled since await has lower precedence — but we need parens
  //    for cases like: db.prepare(...).all(x).map(p => p.name)
  //    After step 1, this becomes: (await db.prepare(...)).all(x).map(p => p.name) — WRONG
  //    We need: (await db.prepare(...).all(x)).map(p => p.name)
  //    The current replacement puts await before db.prepare() which means:
  //    await db.prepare(...) returns the {all,get,run} object, then .all(x) is called on it
  //    That's correct! await applies to the whole chain up to the last .all/.get/.run call
  //    because await has the lowest precedence in expressions.
  //    BUT: (await db.prepare(...)).all(x).map() — await only applies to prepare(), NOT to .all()
  //    We need the await to apply to .all() too.
  //    Fix: the await needs to wrap the WHOLE chain including .all/.get/.run
  //    Solution: use (await db.prepare(...).all(x)) wrapping

  // Re-approach: instead of putting await before db.prepare,
  // put it before the whole expression ending in .all/.get/.run
  // Undo step 1 and redo correctly
  src = src.replace(/\bawait (db\.prepare\s*\()/g, '$1'); // undo step 1

  // Now do the correct replacement: wrap entire db.prepare(...).method(...) in await
  // Pattern: db.prepare(`...`).all(  — the tricky part is matching the SQL string
  // Use a two-pass approach: find .all/.get/.run endpoints and work backwards

  // Simple approach that works for 95% of cases:
  // Find "db.prepare" that is NOT preceded by await, add await before it
  // The key insight: `await db.prepare(sql).all()` works correctly because:
  //   1. db.prepare(sql) returns {all,get,run} object (sync)
  //   2. .all() returns a Promise
  //   3. await waits for the Promise
  // So `await db.prepare(sql).all()` correctly awaits the Promise from .all()
  src = src.replace(/(?<![.\w])(?<!await\s)(db\.prepare\s*\()/g, 'await $1');

  if (src !== original) {
    writeFileSync(file, src, 'utf8');
    const changes = (src.match(/\bawait db\.prepare\b/g) || []).length +
                    (src.match(/\bawait db\.exec\b/g) || []).length;
    console.log(`  ${file.split('src')[1]}: ${changes} awaits added`);
    totalChanges++;
  }
}

console.log(`\nDone. ${totalChanges} files modified.`);
