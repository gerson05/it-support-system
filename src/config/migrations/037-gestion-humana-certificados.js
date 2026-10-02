// Gestión Humana: datos de personal cargados desde Excel, plantilla de certificado
// y registro de certificados generados. Claves VARCHAR y MEDIUMTEXT para MariaDB.
export const migrations = [
  `CREATE TABLE IF NOT EXISTS hr_empleados (
    cedula         VARCHAR(20) PRIMARY KEY,
    nombre         VARCHAR(200),
    genero         VARCHAR(1),
    cargo          VARCHAR(200),
    tipo_contrato  VARCHAR(100),
    contrato       VARCHAR(40),
    fecha_ingreso  VARCHAR(10),
    fecha_retiro   VARCHAR(10),
    estado         VARCHAR(1),
    salario        INTEGER,
    es_empleado    INTEGER DEFAULT 0,
    fuente         VARCHAR(255),
    updated_at     TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `CREATE TABLE IF NOT EXISTS hr_cargas (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    archivo       VARCHAR(255),
    filas         INTEGER,
    creados       INTEGER,
    actualizados  INTEGER,
    campos        TEXT,
    usuario       VARCHAR(100),
    created_at    TEXT DEFAULT (datetime('now','localtime'))
  )`,

  // Correspondencia columna → campo recordada por "firma" de encabezados
  `CREATE TABLE IF NOT EXISTS hr_mapeos (
    firma       VARCHAR(255) PRIMARY KEY,
    mapeo       TEXT NOT NULL,
    updated_at  TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `CREATE TABLE IF NOT EXISTS hr_plantillas (
    tipo        VARCHAR(40) PRIMARY KEY,
    archivo     VARCHAR(255),
    contenido   MEDIUMTEXT NOT NULL,
    usuario     VARCHAR(100),
    updated_at  TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `CREATE TABLE IF NOT EXISTS hr_config (
    clave  VARCHAR(60) PRIMARY KEY,
    valor  VARCHAR(255)
  )`,

  `CREATE TABLE IF NOT EXISTS hr_certificados (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    cedula      VARCHAR(20) NOT NULL,
    nombre      VARCHAR(200),
    tipo        VARCHAR(20),
    usuario     VARCHAR(100),
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `INSERT OR IGNORE INTO permissions (name) VALUES ('hr:read'), ('hr:edit')`,

  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
   SELECT r.id, p.id FROM roles r, permissions p
   WHERE r.name = 'gestion_humana' AND p.name IN ('hr:read', 'hr:edit')`,
];
