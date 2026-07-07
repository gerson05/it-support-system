export const migrations = [
  `CREATE TABLE IF NOT EXISTS puntos (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre         TEXT NOT NULL,
    ciudad         TEXT NOT NULL,
    tipo           TEXT NOT NULL DEFAULT 'punto'
                     CHECK(tipo IN ('punto','bodega')),
    activo         INTEGER DEFAULT 1,
    despacho_id    INTEGER,
    tracking_token TEXT,
    created_at     TEXT DEFAULT (datetime('now','localtime'))
  )`,
  `CREATE INDEX IF NOT EXISTS idx_puntos_tipo   ON puntos(tipo)`,
  `CREATE INDEX IF NOT EXISTS idx_puntos_activo ON puntos(activo)`,
  `CREATE INDEX IF NOT EXISTS idx_puntos_ciudad ON puntos(ciudad)`,
  `INSERT OR IGNORE INTO puntos (nombre, ciudad, tipo, activo, despacho_id, tracking_token, created_at)
   SELECT nombre_punto, ciudad, 'punto', activo, despacho_id, tracking_token, created_at
   FROM sedes`,
  `INSERT OR IGNORE INTO puntos (nombre, ciudad, tipo, activo, created_at)
   SELECT nombre, ciudad, 'bodega', activo, created_at
   FROM bodegas`,
];
