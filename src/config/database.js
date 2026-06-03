import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, '../../database/tickets.db');
const schemaPath = path.resolve(__dirname, '../../database/schema.sql');

// Asegurar que exista el directorio de la base de datos
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');

// Inicializar tablas usando el esquema
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

// Migraciones incrementales (columnas nuevas en tablas existentes)
const migrations = [
  `ALTER TABLE tickets ADD COLUMN title TEXT DEFAULT ''`,
  `ALTER TABLE conversations ADD COLUMN warned_inactive INTEGER DEFAULT 0`,
  `ALTER TABLE messages ADD COLUMN attachment TEXT DEFAULT NULL`,
  `ALTER TABLE tickets ADD COLUMN chat_id TEXT DEFAULT NULL`,
  `CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id INTEGER,
    entity_number TEXT,
    details TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS despachos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    numero TEXT UNIQUE NOT NULL,
    fecha TEXT DEFAULT (date('now','localtime')),
    destinatario TEXT NOT NULL,
    sede TEXT,
    area TEXT,
    articulos TEXT NOT NULL,
    observaciones TEXT,
    requiere_acta INTEGER DEFAULT 0,
    acta_numero TEXT,
    acta_firmada INTEGER DEFAULT 0,
    ticket_id INTEGER,
    agente TEXT,
    created_at TEXT DEFAULT (datetime('now','localtime')),
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
  `CREATE INDEX IF NOT EXISTS idx_acta_uploads_entity
   ON acta_uploads(entity_type, entity_id)`,
  `CREATE TABLE IF NOT EXISTS roles (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    description TEXT
  )`,
  `CREATE TABLE IF NOT EXISTS permissions (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
  )`,
  `CREATE TABLE IF NOT EXISTS role_permissions (
    role_id       INTEGER NOT NULL,
    permission_id INTEGER NOT NULL,
    PRIMARY KEY (role_id, permission_id),
    FOREIGN KEY (role_id)       REFERENCES roles(id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id)
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role_id       INTEGER NOT NULL,
    active        INTEGER DEFAULT 1,
    created_at    TEXT DEFAULT (datetime('now','localtime')),
    updated_at    TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (role_id) REFERENCES roles(id)
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    token      TEXT NOT NULL UNIQUE,
    user_id    INTEGER NOT NULL,
    expires_at TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (user_id) REFERENCES users(id)
  )`,
  `INSERT OR IGNORE INTO roles (id, name, description) VALUES
    (1, 'it',        'Equipo IT — acceso completo'),
    (2, 'farmacias', 'Acceso solo al directorio de farmacias')`,
  `INSERT OR IGNORE INTO permissions (id, name) VALUES
    (1, 'full'),
    (2, 'farmacias')`,
  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (1,1),(1,2),(2,2)`,

  // ── Granular permissions ──────────────────────────────────────────────────
  `INSERT OR IGNORE INTO permissions (id, name) VALUES
    (3,  'metrics:read'),
    (4,  'tickets:read'),       (5,  'tickets:create'),
    (6,  'tickets:edit'),       (7,  'tickets:delete'),
    (8,  'tech-requests:read'), (9,  'tech-requests:create'),
    (10, 'tech-requests:edit'), (11, 'tech-requests:delete'),
    (12, 'faqs:read'),          (13, 'faqs:create'),
    (14, 'faqs:edit'),          (15, 'faqs:delete'),
    (16, 'sedes:read'),         (17, 'sedes:create'),
    (18, 'sedes:edit'),         (19, 'sedes:delete'),
    (20, 'despacho:read'),      (21, 'despacho:create'),
    (22, 'despacho:edit'),      (23, 'despacho:delete'),
    (24, 'audit:read'),
    (25, 'farmacias:read'),     (26, 'farmacias:create'),
    (27, 'farmacias:edit'),     (28, 'farmacias:delete'),
    (29, 'settings:read'),      (30, 'settings:edit')`,

  `INSERT OR IGNORE INTO roles (id, name, description) VALUES
    (3, 'supervisor', 'Gestión de tickets y requerimientos'),
    (4, 'almacen',    'Gestión de despachos'),
    (5, 'auditor',    'Lectura completa + auditoría'),
    (6, 'viewer',     'Solo lectura en todos los módulos')`,

  // supervisor (3): metrics+tickets:rce + tech-requests:rce + faqs:rce + sedes:r + despacho:r
  // almacen   (4): metrics:r + sedes:r + despacho:rce
  // auditor   (5): metrics:r + tickets:r + tech-requests:r + faqs:r + sedes:r + despacho:r + audit:r
  // viewer    (6): metrics:r + tickets:r + tech-requests:r + faqs:r + sedes:r + despacho:r
  // farmacias (2): gains granular farmacias:* (already has old id=2 perm, add new ones)
  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
    (3,3),(3,4),(3,5),(3,6),(3,8),(3,9),(3,10),(3,12),(3,13),(3,14),(3,16),(3,20),
    (4,3),(4,16),(4,20),(4,21),(4,22),
    (5,3),(5,4),(5,8),(5,12),(5,16),(5,20),(5,24),
    (6,3),(6,4),(6,8),(6,12),(6,16),(6,20),
    (2,25),(2,26),(2,27),(2,28)`,
];
for (const sql of migrations) {
  try { db.exec(sql); } catch { /* columna ya existe */ }
}

// Limpiar sesiones expiradas al arrancar
try {
  db.exec("DELETE FROM sessions WHERE datetime(expires_at) <= datetime('now')");
} catch {}

// Poblar tabla sedes desde datos estáticos si está vacía
const sedesCount = db.prepare('SELECT COUNT(*) as n FROM sedes').get().n;
if (sedesCount === 0) {
  const { CIUDADES } = await import('../whatsapp/sedes.js');
  const ins = db.prepare('INSERT INTO sedes (ciudad, nombre_punto) VALUES (?, ?)');
  for (const [ciudad, puntos] of Object.entries(CIUDADES)) {
    for (const punto of puntos) ins.run(ciudad, punto);
  }
  console.log(`[DB] Red de puntos inicializada: ${db.prepare('SELECT COUNT(*) as n FROM sedes').get().n} puntos.`);
}

export default db;
