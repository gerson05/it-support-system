// Fix employee tables: drop & recreate with nullable usuario/contraseña/usuario_id
// Tables are empty so no data is lost.
export const migrations = [
  `DROP TABLE IF EXISTS employee_logs`,
  `DROP TABLE IF EXISTS employees`,
  `CREATE TABLE IF NOT EXISTS employees (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    cedula                  TEXT NOT NULL UNIQUE,
    nombre_completo         TEXT NOT NULL,
    cargo                   TEXT NOT NULL,
    area                    TEXT NOT NULL,
    usuario                 TEXT UNIQUE,
    contraseña              TEXT,
    fecha_respuesta_soporte TEXT,
    created_by              INTEGER,
    created_at              TEXT DEFAULT (datetime('now','localtime')),
    updated_by              INTEGER,
    updated_at              TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (created_by) REFERENCES users(id),
    FOREIGN KEY (updated_by) REFERENCES users(id)
  )`,
  `CREATE TABLE IF NOT EXISTS employee_logs (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id     INTEGER NOT NULL,
    usuario_id      INTEGER,
    accion          TEXT NOT NULL,
    campo_cambio    TEXT,
    valor_anterior  TEXT,
    valor_nuevo     TEXT,
    timestamp       TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (employee_id) REFERENCES employees(id),
    FOREIGN KEY (usuario_id) REFERENCES users(id)
  )`,
];
