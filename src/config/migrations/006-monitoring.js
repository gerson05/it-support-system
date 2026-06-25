export const migrations = [
  `INSERT OR IGNORE INTO permissions (id, name) VALUES (35, 'monitoring:read')`,
  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (1, 35)`,

  `CREATE TABLE IF NOT EXISTS comandos_agente (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    agente_id  INTEGER NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
    tipo       TEXT NOT NULL,
    parametro  TEXT,
    estado     TEXT DEFAULT 'pendiente',
    output     TEXT DEFAULT '',
    exit_code  INTEGER,
    creado_por TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`,

  `CREATE INDEX IF NOT EXISTS idx_comandos_agente ON comandos_agente(agente_id, estado)`,
  `ALTER TABLE despachos ADD COLUMN cedula TEXT DEFAULT NULL`,

  `INSERT OR IGNORE INTO permissions (id, name) VALUES (36, 'monitoring:command')`,
  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (1, 36)`,
];
