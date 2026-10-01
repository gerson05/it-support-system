// Catálogos de Mantis (perfiles, bodegas, comprobantes) cargados desde Excel por Gestión Humana,
// y datos de Mantis en cada empleado creado desde "Crear usuarios".
// Claves VARCHAR (no TEXT) para que MariaDB acepte PRIMARY KEY.
export const migrations = [
  `CREATE TABLE IF NOT EXISTS mantis_perfiles (
    codigo      INTEGER PRIMARY KEY,
    nombre      VARCHAR(150) NOT NULL,
    updated_at  TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `CREATE TABLE IF NOT EXISTS mantis_comprobantes (
    codigo      VARCHAR(20) PRIMARY KEY,
    nombre      VARCHAR(200) NOT NULL,
    fuente      VARCHAR(100),
    estado      VARCHAR(20),
    updated_at  TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `CREATE TABLE IF NOT EXISTS mantis_bodegas (
    codigo              INTEGER PRIMARY KEY,
    nombre              VARCHAR(200) NOT NULL,
    ciudad              VARCHAR(100),
    estado              VARCHAR(5),
    punto_dispensacion  INTEGER DEFAULT 0,
    centro_costo        VARCHAR(200),
    comprobante         VARCHAR(20),
    comprobante_origen  VARCHAR(20),
    updated_at          TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `CREATE TABLE IF NOT EXISTS mantis_cargas (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    tipo        VARCHAR(20) NOT NULL,
    archivo     VARCHAR(255),
    filas       INTEGER,
    usuario     VARCHAR(100),
    created_at  TEXT DEFAULT (datetime('now','localtime'))
  )`,

  `ALTER TABLE employees ADD COLUMN perfil_codigo INTEGER DEFAULT NULL`,
  `ALTER TABLE employees ADD COLUMN bodega_codigo INTEGER DEFAULT NULL`,
  `ALTER TABLE employees ADD COLUMN sede TEXT DEFAULT NULL`,
  `ALTER TABLE employees ADD COLUMN comprobante VARCHAR(20) DEFAULT NULL`,
  `ALTER TABLE employees ADD COLUMN mantis_estado VARCHAR(20) DEFAULT NULL`,
  `ALTER TABLE employees ADD COLUMN mantis_error TEXT DEFAULT NULL`,
  `ALTER TABLE employees ADD COLUMN mantis_creado_at TEXT DEFAULT NULL`,
];
