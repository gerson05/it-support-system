export const migrations = [
  `CREATE TABLE IF NOT EXISTS bodegas (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre     TEXT NOT NULL,
    ciudad     TEXT NOT NULL,
    activo     INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_bodegas_ciudad ON bodegas(ciudad)`,
  `CREATE INDEX IF NOT EXISTS idx_bodegas_activo ON bodegas(activo)`,
];
