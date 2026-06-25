export const migrations = [
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

  // ── Roles base ──────────────────────────────────────────────────────────
  `INSERT OR IGNORE INTO roles (id, name, description) VALUES
    (1, 'it',        'Equipo IT — acceso completo'),
    (2, 'farmacias', 'Acceso solo al directorio de farmacias')`,

  `INSERT OR IGNORE INTO permissions (id, name) VALUES
    (1, 'full'),
    (2, 'farmacias')`,

  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (1,1),(1,2),(2,2)`,

  // ── Permisos granulares ──────────────────────────────────────────────────
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

  // supervisor(3): metrics+tickets+tech-requests+faqs+sedes:r+despacho:r
  // almacen(4):    metrics+sedes:r+despacho:rce
  // auditor(5):    metrics+tickets+tech-requests+faqs+sedes+despacho+audit:r
  // viewer(6):     metrics+tickets+tech-requests+faqs+sedes+despacho:r
  // farmacias(2):  granular farmacias:*
  `INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES
    (3,3),(3,4),(3,5),(3,6),(3,8),(3,9),(3,10),(3,12),(3,13),(3,14),(3,16),(3,20),
    (4,3),(4,16),(4,20),(4,21),(4,22),
    (5,3),(5,4),(5,8),(5,12),(5,16),(5,20),(5,24),
    (6,3),(6,4),(6,8),(6,12),(6,16),(6,20),
    (2,25),(2,26),(2,27),(2,28)`,
];
