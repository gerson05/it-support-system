export const migrations = [
  `CREATE TABLE IF NOT EXISTS inventario_equipos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    placa           TEXT NOT NULL UNIQUE,
    marca           TEXT NOT NULL,
    nombre_equipo   TEXT NOT NULL,
    serial          TEXT NOT NULL UNIQUE,
    procesador      TEXT,
    ram             TEXT,
    tipo_ram        TEXT,
    cap_disco       TEXT,
    tipo_disco      TEXT,
    serial_cargador TEXT,
    area            TEXT,
    responsable     TEXT,
    fecha_compra    TEXT,
    created_at      TEXT DEFAULT (datetime('now','localtime')),
    updated_at      TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `CREATE TABLE IF NOT EXISTS inventario_celulares (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    fecha_registro  TEXT DEFAULT (date('now','localtime')),
    area            TEXT,
    ciudad          TEXT,
    nombre_completo TEXT NOT NULL,
    cedula          TEXT,
    linea           TEXT,
    operador        TEXT,
    equipo          TEXT,
    almacenamiento  TEXT,
    ram             TEXT,
    modelo          TEXT,
    imei            TEXT UNIQUE,
    imei2           TEXT,
    estado          TEXT DEFAULT 'nuevo',
    accesorio       TEXT,
    fecha_entrega   TEXT,
    entregado_por   TEXT,
    created_at      TEXT DEFAULT (datetime('now','localtime')),
    updated_at      TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `INSERT OR IGNORE INTO permissions (id, name) VALUES
    (31, 'inventario:read'),
    (32, 'inventario:create'),
    (33, 'inventario:edit'),
    (34, 'inventario:delete')`,

  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
    (1,31),(1,32),(1,33),(1,34),
    (3,31),(3,32),(3,33),
    (4,31),
    (5,31),
    (6,31)`,

  `CREATE TABLE IF NOT EXISTS registro_tokens (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    token      TEXT NOT NULL UNIQUE,
    tipo       TEXT NOT NULL DEFAULT 'equipos',
    label      TEXT,
    created_by TEXT,
    expires_at TEXT,
    max_uses   INTEGER,
    use_count  INTEGER DEFAULT 0,
    active     INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `CREATE TABLE IF NOT EXISTS inventario_ups (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    placa          TEXT NOT NULL UNIQUE,
    marca          TEXT,
    nombre_equipo  TEXT,
    serial         TEXT,
    area           TEXT,
    voltaje        TEXT,
    fecha_compra   TEXT,
    fecha_despacho TEXT,
    created_at     TEXT DEFAULT (datetime('now','localtime')),
    updated_at     TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (1,16)`,
];
