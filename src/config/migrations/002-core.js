export const migrations = [
  `CREATE TABLE IF NOT EXISTS audit_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at   TEXT DEFAULT (datetime('now','localtime')),
    actor        TEXT NOT NULL,
    action       TEXT NOT NULL,
    entity_type  TEXT,
    entity_id    INTEGER,
    entity_number TEXT,
    details      TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS despachos (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    numero        TEXT UNIQUE NOT NULL,
    fecha         TEXT DEFAULT (date('now','localtime')),
    destinatario  TEXT NOT NULL,
    sede          TEXT,
    area          TEXT,
    articulos     TEXT NOT NULL,
    observaciones TEXT,
    requiere_acta INTEGER DEFAULT 0,
    acta_numero   TEXT,
    acta_firmada  INTEGER DEFAULT 0,
    ticket_id     INTEGER,
    agente        TEXT,
    created_at    TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
  )`,

  `CREATE TABLE IF NOT EXISTS despacho_borradores (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    agente        TEXT NOT NULL UNIQUE,
    destinatario  TEXT DEFAULT '',
    sede          TEXT DEFAULT '',
    area          TEXT DEFAULT '',
    articulos     TEXT DEFAULT '[]',
    observaciones TEXT DEFAULT '',
    requiere_acta INTEGER DEFAULT 0,
    ticket_id     INTEGER DEFAULT NULL,
    updated_at    TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `CREATE TABLE IF NOT EXISTS acta_uploads (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    token       TEXT NOT NULL UNIQUE,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('tech_request','despacho')),
    entity_id   INTEGER NOT NULL,
    entity_ref  TEXT NOT NULL,
    filename    TEXT,
    filepath    TEXT,
    uploaded_at TEXT,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_acta_uploads_entity ON acta_uploads(entity_type, entity_id)`,
];
