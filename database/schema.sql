-- Schema del Sistema de Tickets IT
-- Base de datos: SQLite

-- Tabla de agentes IT (los 4 miembros del equipo)
CREATE TABLE IF NOT EXISTS agents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Tabla de tickets
CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_number TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    requester_name TEXT DEFAULT 'Sin nombre',
    area TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    priority TEXT DEFAULT 'media',
    status TEXT DEFAULT 'abierto',
    description TEXT NOT NULL,
    faq_tried TEXT DEFAULT '[]',
    assigned_to INTEGER,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    updated_at TEXT DEFAULT (datetime('now', 'localtime')),
    resolved_at TEXT,
    FOREIGN KEY (assigned_to) REFERENCES agents(id)
);

-- Tabla de mensajes (historial de conversación por ticket)
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    sender_type TEXT NOT NULL CHECK(sender_type IN ('user', 'bot', 'agent')),
    sender_name TEXT,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id)
);

-- Tabla de conversaciones activas del chatbot (sesiones WhatsApp)
CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    current_step TEXT DEFAULT 'idle',
    area TEXT,
    selected_faq_id TEXT,
    context TEXT DEFAULT '{}',
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    last_activity TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Tabla de hits de FAQ (métricas de autoservicio)
CREATE TABLE IF NOT EXISTS faq_hits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    faq_id TEXT NOT NULL,
    area TEXT NOT NULL,
    resolved INTEGER DEFAULT 0,
    phone TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

-- Notas internas de IT (visibles solo para el equipo)
CREATE TABLE IF NOT EXISTS internal_notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ticket_id INTEGER NOT NULL,
    agent_id INTEGER,
    agent_name TEXT,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')),
    FOREIGN KEY (ticket_id) REFERENCES tickets(id),
    FOREIGN KEY (agent_id) REFERENCES agents(id)
);

-- Insertar los 4 agentes IT iniciales
INSERT OR IGNORE INTO agents (id, name) VALUES (1, 'Agente 1');
INSERT OR IGNORE INTO agents (id, name) VALUES (2, 'Agente 2');
INSERT OR IGNORE INTO agents (id, name) VALUES (3, 'Agente 3');
INSERT OR IGNORE INTO agents (id, name) VALUES (4, 'Agente 4');

-- ═══════════════════════════════════════════════════════════════
-- MÓDULO: REQUERIMIENTOS TECNOLÓGICOS E INCIDENCIAS
-- ═══════════════════════════════════════════════════════════════

-- Solicitudes de equipos tecnológicos (requerimientos) y
-- equipos con fallas enviados desde las sedes (incidencias).
CREATE TABLE IF NOT EXISTS tech_requests (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    request_number   TEXT UNIQUE NOT NULL,
    type             TEXT NOT NULL CHECK(type IN ('requerimiento','incidencia')),

    -- Datos del solicitante
    requester_name   TEXT NOT NULL,
    cedula           TEXT NOT NULL,
    cargo            TEXT NOT NULL,
    sede             TEXT NOT NULL,

    -- Detalle de la solicitud
    description      TEXT NOT NULL,
    quantity         INTEGER DEFAULT 1,

    -- Solo para incidencias
    equipment_name   TEXT,
    equipment_serial TEXT,

    -- Gestión
    status           TEXT DEFAULT 'pendiente'
                         CHECK(status IN ('pendiente','en_revision','en_proceso','completado','rechazado')),
    priority         TEXT DEFAULT 'media'
                         CHECK(priority IN ('baja','media','alta','critica')),
    assigned_to      INTEGER,
    resolution_notes TEXT,

    created_at       TEXT DEFAULT (datetime('now','localtime')),
    updated_at       TEXT DEFAULT (datetime('now','localtime')),
    completed_at     TEXT,

    FOREIGN KEY (assigned_to) REFERENCES agents(id)
);

-- Historial de cambios y notas internas de cada solicitud
CREATE TABLE IF NOT EXISTS tech_request_history (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id  INTEGER NOT NULL,
    agent_name  TEXT,
    action      TEXT NOT NULL,
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    FOREIGN KEY (request_id) REFERENCES tech_requests(id)
);

-- Ítems de un requerimiento tecnológico (múltiples equipos por solicitud)
CREATE TABLE IF NOT EXISTS tech_request_items (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    request_id     INTEGER NOT NULL,
    equipment_name TEXT    NOT NULL,
    quantity       INTEGER DEFAULT 1,
    serial         TEXT,
    FOREIGN KEY (request_id) REFERENCES tech_requests(id) ON DELETE CASCADE
);

-- ═══════════════════════════════════════════════════════════════
-- MÓDULO: RED DE PUNTOS (sedes administrables desde el panel)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS sedes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ciudad      TEXT NOT NULL,
    nombre_punto TEXT NOT NULL,
    activo      INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_sedes_ciudad ON sedes(ciudad);
CREATE INDEX IF NOT EXISTS idx_sedes_activo ON sedes(activo);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_area ON tickets(area);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_assigned ON tickets(assigned_to);
CREATE INDEX IF NOT EXISTS idx_messages_ticket ON messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_conversations_phone ON conversations(phone);
CREATE INDEX IF NOT EXISTS idx_faq_hits_area       ON faq_hits(area);
CREATE INDEX IF NOT EXISTS idx_tech_req_type       ON tech_requests(type);
CREATE INDEX IF NOT EXISTS idx_tech_req_status     ON tech_requests(status);
CREATE INDEX IF NOT EXISTS idx_tech_req_sede       ON tech_requests(sede);
CREATE INDEX IF NOT EXISTS idx_tech_req_history    ON tech_request_history(request_id);
CREATE INDEX IF NOT EXISTS idx_tr_items_request   ON tech_request_items(request_id);

-- ═══════════════════════════════════════════════════════════════
-- MÓDULO: FAQs PERSONALIZADAS (gestionadas desde el panel)
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS custom_faqs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    area        TEXT NOT NULL DEFAULT 'general',
    title       TEXT NOT NULL,
    keywords    TEXT NOT NULL DEFAULT '[]',   -- JSON array de strings
    category    TEXT DEFAULT 'general',
    solution    TEXT NOT NULL,
    active      INTEGER DEFAULT 1,
    created_at  TEXT DEFAULT (datetime('now','localtime')),
    updated_at  TEXT DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_custom_faqs_area ON custom_faqs(area);

-- ═══════════════════════════════════════════════════════════════
-- MÓDULO: MONITOREO DE EQUIPOS
-- ═══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS agentes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  hostname     TEXT NOT NULL,
  mac_address  TEXT UNIQUE NOT NULL,
  ip           TEXT,
  os_name      TEXT,
  os_version   TEXT,
  cpu_model    TEXT,
  cpu_cores    INTEGER,
  cpu_ghz      REAL,
  ram_total    INTEGER,
  disk_model   TEXT,
  disk_total   INTEGER,
  gpu          TEXT,
  sede         TEXT,
  apodo        TEXT,
  api_key      TEXT UNIQUE NOT NULL,
  estado       TEXT DEFAULT 'offline',
  last_seen    TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS metricas_agentes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  agente_id    INTEGER NOT NULL REFERENCES agentes(id) ON DELETE CASCADE,
  timestamp    TEXT DEFAULT (datetime('now')),
  cpu_percent  REAL,
  ram_used     REAL,
  disk_used    INTEGER,
  uptime       INTEGER
);

CREATE INDEX IF NOT EXISTS idx_metricas_agente ON metricas_agentes(agente_id, timestamp DESC);
