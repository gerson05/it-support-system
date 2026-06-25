export const migrations = [
  `CREATE TABLE IF NOT EXISTS requerimientos (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_num         TEXT UNIQUE NOT NULL,
    area               TEXT NOT NULL,
    nombre             TEXT NOT NULL,
    correo             TEXT DEFAULT '',
    punto              TEXT NOT NULL,
    tipo               TEXT NOT NULL,
    descripcion        TEXT NOT NULL,
    fecha_requerida    TEXT DEFAULT '',
    ticket_relacionado TEXT DEFAULT '',
    observaciones      TEXT DEFAULT '',
    prioridad          TEXT NOT NULL DEFAULT 'NORMAL',
    estado             TEXT NOT NULL DEFAULT 'Recibido',
    fotos              TEXT DEFAULT '[]',
    created_at         TEXT DEFAULT (datetime('now','localtime')),
    updated_at         TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `ALTER TABLE sedes ADD COLUMN despacho_id INTEGER REFERENCES despachos(id)`,
  `ALTER TABLE sedes ADD COLUMN tracking_token TEXT`,
];
