export const migrations = [
  `CREATE TABLE IF NOT EXISTS salas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre      TEXT NOT NULL,
    descripcion TEXT DEFAULT '',
    activo      INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `CREATE TABLE IF NOT EXISTS reuniones (
    id                 INTEGER PRIMARY KEY AUTOINCREMENT,
    sala_id            INTEGER NOT NULL REFERENCES salas(id),
    titulo             TEXT NOT NULL,
    tipo               TEXT NOT NULL CHECK(tipo IN ('interna','con_sede','con_proveedor','formacion')),
    fecha_inicio       TEXT NOT NULL,
    fecha_fin          TEXT NOT NULL,
    organizador_nombre TEXT NOT NULL,
    organizador_correo TEXT DEFAULT '',
    participantes      TEXT DEFAULT '[]',
    descripcion        TEXT DEFAULT '',
    sede_id            INTEGER REFERENCES sedes(id),
    meet_link          TEXT DEFAULT NULL,
    google_event_id    TEXT DEFAULT NULL,
    token_externo      TEXT UNIQUE,
    estado             TEXT DEFAULT 'activa' CHECK(estado IN ('activa','cancelada')),
    created_at         TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_reuniones_sala_fechas ON reuniones(sala_id, fecha_inicio, fecha_fin)`,
  `CREATE INDEX IF NOT EXISTS idx_reuniones_token ON reuniones(token_externo)`,

  `INSERT OR IGNORE INTO permissions (id, name) VALUES
    (37, 'reuniones:read'),
    (38, 'reuniones:create'),
    (39, 'reuniones:edit'),
    (40, 'reuniones:delete')`,

  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
    (1,37),(1,38),(1,39),(1,40),
    (3,37),(3,38),(3,39),
    (5,37),
    (6,37)`,
];
