export const migrations = [
  `CREATE TABLE IF NOT EXISTS tipos_articulo (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre     TEXT NOT NULL UNIQUE,
    activo     INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `INSERT OR IGNORE INTO tipos_articulo (nombre) VALUES
    ('TONER'),('EQUIPO'),('CARGADOR'),('IMPRESORA'),('UPS'),('MONITOR'),
    ('TURNERO'),('TECLADO'),('ESCANER'),('MOUSE'),('VGA')`,

  `CREATE TABLE IF NOT EXISTS confirmaciones_entrega (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    despacho_id  INTEGER NOT NULL UNIQUE REFERENCES despachos(id) ON DELETE CASCADE,
    token        TEXT NOT NULL UNIQUE,
    confirmed_at TEXT,
    ip           TEXT,
    created_at   TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_confirmaciones_token ON confirmaciones_entrega(token)`,
];
