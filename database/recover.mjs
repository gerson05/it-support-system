import { DatabaseSync } from 'node:sqlite';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';

const DB = '/app/database/tickets.db';
const DUMP = '/app/database/dump.json';
const NEW = '/app/database/tickets_new.db';
const SCHEMA = '/app/database/schema.sql';

const src = new DatabaseSync(DB);
const tables = src.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all();

const dump = {};
let ok = 0, fail = 0;
for (const { name } of tables) {
  try {
    dump[name] = src.prepare(`SELECT * FROM "${name}"`).all();
    console.log(`  ${name}: ${dump[name].length} rows`);
    ok++;
  } catch(e) {
    dump[name] = [];
    fail++;
    console.log(`  WARN ${name}: ${e.message}`);
  }
}
writeFileSync(DUMP, JSON.stringify(dump));
console.log(`\nExported ${ok} OK, ${fail} failed. Total rows: ${Object.values(dump).reduce((s,r)=>s+r.length,0)}`);

// Recreate fresh DB
const dst = new DatabaseSync(NEW);
dst.exec(readFileSync(SCHEMA, 'utf8'));

// Reinsert data
for (const [table, rows] of Object.entries(dump)) {
  if (!rows.length) continue;
  try {
    const cols = Object.keys(rows[0]);
    const placeholders = cols.map(() => '?').join(',');
    const stmt = dst.prepare(`INSERT OR IGNORE INTO "${table}" (${cols.map(c => `"${c}"`).join(',')}) VALUES (${placeholders})`);
    let inserted = 0;
    for (const row of rows) {
      try { stmt.run(...cols.map(c => row[c])); inserted++; } catch {}
    }
    console.log(`  ${table}: inserted ${inserted}/${rows.length}`);
  } catch(e) {
    console.log(`  SKIP ${table}: ${e.message}`);
  }
}

const check = dst.prepare('PRAGMA integrity_check').get();
console.log('\nNew DB integrity:', check.integrity_check);
