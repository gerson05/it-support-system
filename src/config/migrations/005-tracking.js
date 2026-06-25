export const migrations = [
  `CREATE TABLE IF NOT EXISTS paquete_tracking (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    despacho_id INTEGER NOT NULL UNIQUE,
    token       TEXT    NOT NULL UNIQUE,
    estado      TEXT    NOT NULL DEFAULT 'creado',
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    updated_at  TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (despacho_id) REFERENCES despachos(id)
  )`,

  `CREATE TABLE IF NOT EXISTS paquete_eventos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_id    INTEGER NOT NULL,
    tipo           TEXT NOT NULL,
    recibido_por   TEXT NOT NULL,
    entregado_por  TEXT NOT NULL,
    ubicacion      TEXT NOT NULL,
    sede_id        INTEGER,
    cargo_receptor TEXT,
    observaciones  TEXT,
    foto_path      TEXT NOT NULL,
    foto_filename  TEXT NOT NULL,
    estado_paquete TEXT NOT NULL,
    ip             TEXT,
    created_at     TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (tracking_id) REFERENCES paquete_tracking(id)
  )`,

  `CREATE TABLE IF NOT EXISTS paquete_entrega_items (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    evento_id         INTEGER NOT NULL,
    item_index        INTEGER NOT NULL,
    equipment_name    TEXT NOT NULL,
    cantidad          INTEGER NOT NULL DEFAULT 1,
    recibido_conforme INTEGER NOT NULL DEFAULT 1,
    observacion_item  TEXT,
    FOREIGN KEY (evento_id) REFERENCES paquete_eventos(id)
  )`,

  `CREATE TABLE IF NOT EXISTS paquete_acta_final (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_id  INTEGER NOT NULL UNIQUE,
    filepath     TEXT NOT NULL,
    filename     TEXT NOT NULL,
    firmado_por  TEXT NOT NULL,
    cargo        TEXT NOT NULL,
    generated_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (tracking_id) REFERENCES paquete_tracking(id)
  )`,

  `CREATE INDEX IF NOT EXISTS idx_paquete_tracking_despacho ON paquete_tracking(despacho_id)`,
  `CREATE INDEX IF NOT EXISTS idx_paquete_tracking_token    ON paquete_tracking(token)`,
  `CREATE INDEX IF NOT EXISTS idx_paquete_eventos_tracking  ON paquete_eventos(tracking_id)`,
];
