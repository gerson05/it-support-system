/**
 * Base SQLite en memoria con la misma interfaz async que src/config/database.js
 * (prepare().get/all/run y exec), para probar SQL real sin tocar archivos.
 */
import { DatabaseSync } from 'node:sqlite';

export function createMemoryDb(statements = []) {
  const sqlite = new DatabaseSync(':memory:');
  const db = {
    prepare(sql) {
      const stmt = sqlite.prepare(sql);
      return {
        // node:sqlite devuelve objetos sin prototipo; se copian para compararlos como objetos normales
        async get(...a) { const r = stmt.get(...a.flat()); return r ? { ...r } : null; },
        async all(...a) { return stmt.all(...a.flat()).map(r => ({ ...r })); },
        async run(...a) {
          const r = stmt.run(...a.flat());
          return { changes: Number(r.changes), lastInsertRowid: Number(r.lastInsertRowid) };
        },
      };
    },
    async exec(sql) { sqlite.exec(sql); },
    raw: sqlite,
  };
  for (const s of statements) sqlite.exec(s);
  return db;
}
