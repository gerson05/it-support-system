# Reuniones Calendar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Módulo completo de calendario de reuniones con múltiples salas, conflict check en servidor, link Google Meet automático, y acceso público vía formulario con token.

**Architecture:** SQLite como source of truth. Google Calendar API se usa solo como side-effect para generar Meet links al crear eventos — si falla, la reunión se guarda igual con `meet_link = null`. Rutas internas protegidas con `requireAuth`; rutas públicas sin auth, identificadas por `token_externo` UUID.

**Tech Stack:** Node.js + better-sqlite3 (DatabaseSync) + googleapis (ya instalado) + vanilla JS (lucide icons, mismo CSS/patrón del resto del app)

---

## File Map

| Acción | Archivo | Responsabilidad |
|--------|---------|-----------------|
| Modify | `src/config/database.js` | Migrations: tablas `salas`, `reuniones`, permisos |
| Create | `src/reuniones/calendar-service.js` | Google Calendar API — crear/cancelar eventos con Meet |
| Create | `src/reuniones/reuniones-routes.js` | Todas las rutas API (internas + públicas) |
| Modify | `server.js` | Importar y registrar reunionesRouter |
| Modify | `.env.example` | Vars `GOOGLE_CALENDAR_ID`, `GOOGLE_SERVICE_ACCOUNT_*` |
| Create | `public/js/reuniones-admin.js` | Vista admin: grid semana + modales crear/ver |
| Modify | `public/js/app.js` | Agregar import + `case '#reuniones'` + `show('nav-reuniones')` |
| Modify | `public/index.html` | Nav item Calendario |
| Create | `public/reuniones.html` | Página pública standalone (como `/rastrear`) |
| Create | `public/js/reuniones-public.js` | Formulario público multi-paso |

---

## Task 1: DB Migration — tablas salas + reuniones + permisos

**Files:**
- Modify: `src/config/database.js` — agregar al array `migrations`

- [ ] **Step 1: Agregar migrations al array en database.js**

Abre `src/config/database.js`. Busca la línea:
```javascript
  `ALTER TABLE sedes ADD COLUMN tracking_token TEXT`,
];
```
Reemplázala con:
```javascript
  `ALTER TABLE sedes ADD COLUMN tracking_token TEXT`,

  // ── Calendario de Reuniones ──────────────────────────────────────────────
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
```

- [ ] **Step 2: Verificar migraciones en arranque**

```bash
cd "C:\Users\equipo sitemas 1\.gemini\antigravity\scratch\it-tickets"
node -e "import('./src/config/database.js').then(m => { const db = m.default; console.log('salas:', db.prepare('SELECT COUNT(*) as n FROM salas').get()); console.log('reuniones:', db.prepare('SELECT COUNT(*) as n FROM reuniones').get()); })"
```
Expected: `salas: { n: 0 }  reuniones: { n: 0 }` (sin error)

- [ ] **Step 3: Commit**

```bash
git add src/config/database.js
git commit -m "feat(reuniones): add salas + reuniones tables and permissions migration"
```

---

## Task 2: Google Calendar Service

**Files:**
- Create: `src/reuniones/calendar-service.js`
- Modify: `.env.example`

- [ ] **Step 1: Crear calendar-service.js**

```javascript
// src/reuniones/calendar-service.js
import { google } from 'googleapis';
import crypto from 'node:crypto';
import fs from 'node:fs';

function getAuth() {
  try {
    const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_JSON;
    const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;
    let credentials;
    if (keyJson)      credentials = JSON.parse(keyJson);
    else if (keyPath) credentials = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    else return null;
    return new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/calendar'],
    });
  } catch (e) {
    console.error('[Calendar] Auth setup error:', e.message);
    return null;
  }
}

export async function crearEventoConMeet({ titulo, inicio, fin, participantes = [], descripcion = '' }) {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const auth = getAuth();
  if (!calendarId || !auth) {
    console.warn('[Calendar] GOOGLE_CALENDAR_ID or credentials not set — skipping Meet link');
    return { meetLink: null, eventId: null };
  }
  try {
    const calendar = google.calendar({ version: 'v3', auth });
    const res = await calendar.events.insert({
      calendarId,
      conferenceDataVersion: 1,
      requestBody: {
        summary: titulo,
        description,
        start: { dateTime: inicio, timeZone: 'America/Bogota' },
        end:   { dateTime: fin,   timeZone: 'America/Bogota' },
        attendees: participantes
          .filter(p => typeof p === 'string' && p.includes('@'))
          .map(p => ({ email: p.trim() })),
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' },
          },
        },
      },
    });
    const event = res.data;
    const meetLink = event.conferenceData?.entryPoints
      ?.find(e => e.entryPointType === 'video')?.uri || null;
    return { meetLink, eventId: event.id };
  } catch (e) {
    console.error('[Calendar] Error creating event:', e.message);
    return { meetLink: null, eventId: null };
  }
}

export async function cancelarEvento(eventId) {
  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const auth = getAuth();
  if (!calendarId || !auth || !eventId) return;
  try {
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({ calendarId, eventId });
  } catch (e) {
    console.error('[Calendar] Error deleting event:', e.message);
  }
}
```

- [ ] **Step 2: Agregar vars a .env.example**

Abre `.env.example`. Al final agrega:
```
# ── Calendario de Reuniones (Google Meet) ───────────────────────────────────
GOOGLE_CALENDAR_ID=xxx@group.calendar.google.com
# Una de las dos opciones para credenciales:
GOOGLE_SERVICE_ACCOUNT_KEY_PATH=./config/service-account.json
# GOOGLE_SERVICE_ACCOUNT_KEY_JSON={"type":"service_account",...}
```

- [ ] **Step 3: Verificar import del servicio sin credenciales (debe no crashear)**

```bash
node -e "import('./src/reuniones/calendar-service.js').then(() => console.log('OK'))"
```
Expected: `OK` (sin error, aunque sin credenciales)

- [ ] **Step 4: Commit**

```bash
git add src/reuniones/calendar-service.js .env.example
git commit -m "feat(reuniones): add Google Calendar service for Meet link generation"
```

---

## Task 3: Backend Routes — salas CRUD + reuniones internas

**Files:**
- Create: `src/reuniones/reuniones-routes.js`
- Modify: `server.js`

- [ ] **Step 1: Crear reuniones-routes.js con salas CRUD**

```javascript
// src/reuniones/reuniones-routes.js
import express from 'express';
import crypto from 'node:crypto';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import { crearEventoConMeet, cancelarEvento } from './calendar-service.js';

const router = express.Router();

const TIPOS = ['interna', 'con_sede', 'con_proveedor', 'formacion'];

function conflicto(sala_id, inicio, fin, excludeId = null) {
  let sql = `SELECT id FROM reuniones
    WHERE sala_id = ? AND estado = 'activa'
      AND fecha_inicio < ? AND fecha_fin > ?`;
  const params = [sala_id, fin, inicio];
  if (excludeId) { sql += ' AND id != ?'; params.push(excludeId); }
  return db.prepare(sql).get(...params);
}

// ── Salas ────────────────────────────────────────────────────────────────────

router.get('/api/reuniones/salas', requireAuth, requirePermission('reuniones:read'), (req, res) => {
  try {
    const salas = db.prepare('SELECT * FROM salas WHERE activo = 1 ORDER BY nombre').all();
    res.json({ salas });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/reuniones/salas', requireAuth, requirePermission('reuniones:create'), (req, res) => {
  try {
    const { nombre, descripcion = '' } = req.body;
    if (!nombre?.trim()) return res.status(400).json({ error: 'Nombre requerido.' });
    const r = db.prepare('INSERT INTO salas (nombre, descripcion) VALUES (?, ?)').run(nombre.trim(), descripcion.trim());
    res.status(201).json({ id: r.lastInsertRowid });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.put('/api/reuniones/salas/:id', requireAuth, requirePermission('reuniones:edit'), (req, res) => {
  try {
    const { nombre, descripcion, activo } = req.body;
    const fields = [], vals = [];
    if (nombre      !== undefined) { fields.push('nombre=?');      vals.push(nombre.trim()); }
    if (descripcion !== undefined) { fields.push('descripcion=?'); vals.push(descripcion.trim()); }
    if (activo      !== undefined) { fields.push('activo=?');      vals.push(activo ? 1 : 0); }
    if (!fields.length) return res.status(400).json({ error: 'Nada que actualizar.' });
    vals.push(parseInt(req.params.id));
    db.prepare(`UPDATE salas SET ${fields.join(',')} WHERE id=?`).run(...vals);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/api/reuniones/salas/:id', requireAuth, requirePermission('reuniones:delete'), (req, res) => {
  try {
    db.prepare('UPDATE salas SET activo=0 WHERE id=?').run(parseInt(req.params.id));
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Reuniones (internas) ─────────────────────────────────────────────────────

router.get('/api/reuniones', requireAuth, requirePermission('reuniones:read'), (req, res) => {
  try {
    const { sala_id, fecha, tipo, estado } = req.query;
    const where = [], params = [];
    if (sala_id) { where.push('sala_id = ?'); params.push(parseInt(sala_id)); }
    if (tipo)    { where.push('tipo = ?');    params.push(tipo); }
    if (estado)  { where.push('estado = ?');  params.push(estado); }
    if (fecha) {
      where.push("date(fecha_inicio) >= ? AND date(fecha_inicio) <= date(?, '+6 days')");
      params.push(fecha, fecha);
    }
    const W = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const rows = db.prepare(`SELECT * FROM reuniones ${W} ORDER BY fecha_inicio`).all(...params);
    res.json({ reuniones: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/reuniones', requireAuth, requirePermission('reuniones:create'), async (req, res) => {
  try {
    const {
      sala_id, titulo, tipo, fecha_inicio, fecha_fin,
      organizador_nombre, organizador_correo = '', participantes = [],
      descripcion = '', sede_id = null,
    } = req.body;

    if (!sala_id || !titulo?.trim() || !tipo || !fecha_inicio || !fecha_fin || !organizador_nombre?.trim())
      return res.status(400).json({ error: 'Campos requeridos: sala_id, titulo, tipo, fecha_inicio, fecha_fin, organizador_nombre.' });
    if (!TIPOS.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido.' });

    const ahora = new Date().toISOString();
    if (fecha_inicio <= ahora) return res.status(400).json({ error: 'No se pueden crear reuniones en el pasado.' });

    const durMin = (new Date(fecha_fin) - new Date(fecha_inicio)) / 60000;
    if (durMin < 15)        return res.status(400).json({ error: 'Duración mínima: 15 minutos.' });
    if (durMin > 8 * 60)    return res.status(400).json({ error: 'Duración máxima: 8 horas.' });

    if (conflicto(sala_id, fecha_inicio, fecha_fin))
      return res.status(409).json({ error: 'La sala ya tiene una reunión en ese horario.' });

    const { meetLink, eventId } = await crearEventoConMeet({
      titulo: titulo.trim(), inicio: fecha_inicio, fin: fecha_fin,
      participantes, descripcion,
    });

    const token = crypto.randomUUID();
    const r = db.prepare(`
      INSERT INTO reuniones
        (sala_id, titulo, tipo, fecha_inicio, fecha_fin, organizador_nombre, organizador_correo,
         participantes, descripcion, sede_id, meet_link, google_event_id, token_externo)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      parseInt(sala_id), titulo.trim(), tipo, fecha_inicio, fecha_fin,
      organizador_nombre.trim(), organizador_correo.trim(),
      JSON.stringify(Array.isArray(participantes) ? participantes : []),
      descripcion.trim(), sede_id || null, meetLink, eventId, token,
    );

    const reunion = db.prepare('SELECT * FROM reuniones WHERE id=?').get(r.lastInsertRowid);
    res.status(201).json({ reunion, meet_link_generado: !!meetLink });
  } catch (e) {
    console.error('[Reuniones] POST error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.put('/api/reuniones/:id', requireAuth, requirePermission('reuniones:edit'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const existing = db.prepare('SELECT * FROM reuniones WHERE id=?').get(id);
    if (!existing) return res.status(404).json({ error: 'Reunión no encontrada.' });
    if (existing.estado === 'cancelada') return res.status(400).json({ error: 'No se puede editar una reunión cancelada.' });

    const {
      sala_id, titulo, tipo, fecha_inicio, fecha_fin,
      organizador_nombre, organizador_correo, participantes, descripcion, sede_id,
    } = req.body;

    const nSala   = sala_id      !== undefined ? parseInt(sala_id)      : existing.sala_id;
    const nInicio = fecha_inicio !== undefined ? fecha_inicio            : existing.fecha_inicio;
    const nFin    = fecha_fin    !== undefined ? fecha_fin               : existing.fecha_fin;

    if (fecha_inicio || fecha_fin || sala_id) {
      const durMin = (new Date(nFin) - new Date(nInicio)) / 60000;
      if (durMin < 15)     return res.status(400).json({ error: 'Duración mínima: 15 minutos.' });
      if (durMin > 8 * 60) return res.status(400).json({ error: 'Duración máxima: 8 horas.' });
      if (conflicto(nSala, nInicio, nFin, id))
        return res.status(409).json({ error: 'La sala ya tiene una reunión en ese horario.' });
    }

    const fields = [], vals = [];
    if (sala_id            !== undefined) { fields.push('sala_id=?');            vals.push(nSala); }
    if (titulo             !== undefined) { fields.push('titulo=?');             vals.push(titulo.trim()); }
    if (tipo               !== undefined) { fields.push('tipo=?');               vals.push(tipo); }
    if (fecha_inicio       !== undefined) { fields.push('fecha_inicio=?');       vals.push(fecha_inicio); }
    if (fecha_fin          !== undefined) { fields.push('fecha_fin=?');          vals.push(fecha_fin); }
    if (organizador_nombre !== undefined) { fields.push('organizador_nombre=?'); vals.push(organizador_nombre.trim()); }
    if (organizador_correo !== undefined) { fields.push('organizador_correo=?'); vals.push(organizador_correo.trim()); }
    if (participantes      !== undefined) { fields.push('participantes=?');      vals.push(JSON.stringify(participantes)); }
    if (descripcion        !== undefined) { fields.push('descripcion=?');        vals.push(descripcion.trim()); }
    if (sede_id            !== undefined) { fields.push('sede_id=?');            vals.push(sede_id || null); }

    if (!fields.length) return res.status(400).json({ error: 'Nada que actualizar.' });
    vals.push(id);
    db.prepare(`UPDATE reuniones SET ${fields.join(',')} WHERE id=?`).run(...vals);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/api/reuniones/:id', requireAuth, requirePermission('reuniones:delete'), async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const r = db.prepare('SELECT google_event_id FROM reuniones WHERE id=?').get(id);
    if (!r) return res.status(404).json({ error: 'Reunión no encontrada.' });
    db.prepare("UPDATE reuniones SET estado='cancelada' WHERE id=?").run(id);
    if (r.google_event_id) await cancelarEvento(r.google_event_id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Rutas públicas ───────────────────────────────────────────────────────────

router.get('/api/reuniones/public/salas', (req, res) => {
  try {
    const salas = db.prepare('SELECT id, nombre, descripcion FROM salas WHERE activo=1 ORDER BY nombre').all();
    res.json({ salas });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/reuniones/public/disponibilidad', (req, res) => {
  try {
    const { sala_id, fecha } = req.query;
    if (!sala_id || !fecha) return res.status(400).json({ error: 'sala_id y fecha requeridos.' });
    const slots = db.prepare(`
      SELECT id, titulo, fecha_inicio, fecha_fin
      FROM reuniones
      WHERE sala_id = ? AND estado = 'activa' AND date(fecha_inicio) = ?
      ORDER BY fecha_inicio
    `).all(parseInt(sala_id), fecha);
    res.json({ ocupados: slots });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post('/api/reuniones/public', async (req, res) => {
  try {
    const {
      sala_id, titulo, tipo, fecha_inicio, fecha_fin,
      organizador_nombre, organizador_correo = '', participantes = [],
      descripcion = '', sede_id = null,
    } = req.body;

    if (!sala_id || !titulo?.trim() || !tipo || !fecha_inicio || !fecha_fin || !organizador_nombre?.trim())
      return res.status(400).json({ error: 'Campos requeridos: sala_id, titulo, tipo, fecha_inicio, fecha_fin, organizador_nombre.' });
    if (!TIPOS.includes(tipo)) return res.status(400).json({ error: 'Tipo inválido.' });

    const ahora = new Date().toISOString();
    if (fecha_inicio <= ahora) return res.status(400).json({ error: 'No se pueden crear reuniones en el pasado.' });

    const durMin = (new Date(fecha_fin) - new Date(fecha_inicio)) / 60000;
    if (durMin < 15)     return res.status(400).json({ error: 'Duración mínima: 15 minutos.' });
    if (durMin > 8 * 60) return res.status(400).json({ error: 'Duración máxima: 8 horas.' });

    if (conflicto(sala_id, fecha_inicio, fecha_fin))
      return res.status(409).json({ error: 'La sala ya tiene una reunión en ese horario.' });

    const { meetLink, eventId } = await crearEventoConMeet({
      titulo: titulo.trim(), inicio: fecha_inicio, fin: fecha_fin,
      participantes, descripcion,
    });

    const token = crypto.randomUUID();
    const r = db.prepare(`
      INSERT INTO reuniones
        (sala_id, titulo, tipo, fecha_inicio, fecha_fin, organizador_nombre, organizador_correo,
         participantes, descripcion, sede_id, meet_link, google_event_id, token_externo)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    `).run(
      parseInt(sala_id), titulo.trim(), tipo, fecha_inicio, fecha_fin,
      organizador_nombre.trim(), organizador_correo.trim(),
      JSON.stringify(Array.isArray(participantes) ? participantes : []),
      descripcion.trim(), sede_id || null, meetLink, eventId, token,
    );

    const reunion = db.prepare('SELECT * FROM reuniones WHERE id=?').get(r.lastInsertRowid);
    res.status(201).json({ ok: true, token_externo: token, meet_link: meetLink, reunion });
  } catch (e) {
    console.error('[Reuniones public] POST error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

router.get('/api/reuniones/public/:token', (req, res) => {
  try {
    const r = db.prepare(`
      SELECT r.*, s.nombre as sala_nombre
      FROM reuniones r JOIN salas s ON s.id = r.sala_id
      WHERE r.token_externo = ?
    `).get(req.params.token);
    if (!r) return res.status(404).json({ error: 'Reunión no encontrada.' });
    res.json({ reunion: r });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.delete('/api/reuniones/public/:token', async (req, res) => {
  try {
    const r = db.prepare('SELECT id, google_event_id, estado FROM reuniones WHERE token_externo=?').get(req.params.token);
    if (!r) return res.status(404).json({ error: 'Reunión no encontrada.' });
    if (r.estado === 'cancelada') return res.status(400).json({ error: 'Ya estaba cancelada.' });
    db.prepare("UPDATE reuniones SET estado='cancelada' WHERE id=?").run(r.id);
    if (r.google_event_id) await cancelarEvento(r.google_event_id);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
```

- [ ] **Step 2: Registrar router en server.js**

Abre `server.js`. Después de `import reqRouter from './src/requerimientos/req-routes.js';` agrega:
```javascript
import reunionesRouter from './src/reuniones/reuniones-routes.js';
```

Después de `app.use(reqRouter);` agrega:
```javascript
app.use(reunionesRouter);
```

- [ ] **Step 3: Verificar rutas arrancando servidor**

```bash
node server.js &
curl http://localhost:3000/api/reuniones/public/salas
```
Expected: `{"salas":[]}` (array vacío, sin error 500)

```bash
kill %1
```

- [ ] **Step 4: Commit**

```bash
git add src/reuniones/reuniones-routes.js server.js
git commit -m "feat(reuniones): add all API routes — salas CRUD, reuniones CRUD, public endpoints"
```

---

## Task 4: Frontend Admin — grid semana + modales

**Files:**
- Create: `public/js/reuniones-admin.js`
- Modify: `public/js/app.js`
- Modify: `public/index.html`

- [ ] **Step 1: Crear reuniones-admin.js**

```javascript
// public/js/reuniones-admin.js
import { showToast } from './components.js';

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const TIPO_LABELS = {
  interna: 'Interna',
  con_sede: 'Con Sede',
  con_proveedor: 'Con Proveedor',
  formacion: 'Formación',
};

const TIPO_COLORS = {
  interna:       'rgba(99,102,241,.7)',
  con_sede:      'rgba(16,185,129,.7)',
  con_proveedor: 'rgba(234,179,8,.7)',
  formacion:     'rgba(239,68,68,.7)',
};

function isoToLocal(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function weekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function dateToISO(date) {
  return date.toISOString().slice(0,10);
}

function fmtDate(date) {
  return date.toLocaleDateString('es-CO', { weekday:'short', day:'numeric', month:'short' });
}

export async function renderReuniones(container) {
  container.innerHTML = `
    <div style="margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div>
        <h2 style="font-size:20px;font-weight:700;letter-spacing:-.4px;margin:0 0 4px;">Calendario</h2>
        <p style="color:var(--text-3);font-size:13px;margin:0;">Reuniones del equipo y sedes</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button id="btn-gestion-salas" style="padding:6px 14px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-2);font-size:12px;cursor:pointer;">⚙ Gestionar salas</button>
        <button id="btn-nueva-reunion" class="btn btn-primary">+ Nueva reunión</button>
      </div>
    </div>
    <div id="cal-nav" style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
      <button id="cal-prev" style="padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-2);font-size:13px;cursor:pointer;">←</button>
      <span id="cal-week-label" style="font-size:14px;font-weight:600;flex:1;text-align:center;"></span>
      <button id="cal-today" style="padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-2);font-size:12px;cursor:pointer;">Hoy</button>
      <button id="cal-next" style="padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-2);font-size:13px;cursor:pointer;">→</button>
    </div>
    <div id="cal-grid" style="overflow-x:auto;"></div>`;

  let currentWeek = weekStart(new Date());
  let salas = [];
  let reuniones = [];

  async function loadSalas() {
    const res = await fetch('/api/reuniones/salas');
    const data = await res.json();
    salas = data.salas || [];
  }

  async function loadReuniones() {
    const fecha = dateToISO(currentWeek);
    const res = await fetch(`/api/reuniones?fecha=${fecha}`);
    const data = await res.json();
    reuniones = data.reuniones || [];
  }

  async function refresh() {
    await Promise.all([loadSalas(), loadReuniones()]);
    renderGrid();
  }

  function renderGrid() {
    const days = Array.from({length:7}, (_,i) => addDays(currentWeek, i));
    document.getElementById('cal-week-label').textContent =
      `${fmtDate(days[0])} — ${fmtDate(days[6])}`;

    const hours = Array.from({length:14}, (_,i) => i + 7); // 07:00 - 20:00
    const slotH = 48; // px per hour

    if (!salas.length) {
      document.getElementById('cal-grid').innerHTML =
        `<div style="text-align:center;padding:40px;color:var(--text-3);">No hay salas configuradas. Crea una sala primero.</div>`;
      return;
    }

    const colW = Math.max(120, Math.floor(700 / (days.length * salas.length)));

    let html = `<div style="display:flex;min-width:${60 + days.length * salas.length * colW}px;">`;

    // Hour column
    html += `<div style="width:60px;flex-shrink:0;padding-top:40px;">`;
    hours.forEach(h => {
      html += `<div style="height:${slotH}px;font-size:11px;color:var(--text-3);padding:2px 4px;border-top:1px solid rgba(255,255,255,.05);">${String(h).padStart(2,'0')}:00</div>`;
    });
    html += `</div>`;

    // Day + sala columns
    days.forEach(day => {
      const dateStr = dateToISO(day);
      const isToday = dateStr === dateToISO(new Date());
      salas.forEach(sala => {
        const dayReuniones = reuniones.filter(r => {
          return r.sala_id === sala.id && r.fecha_inicio.startsWith(dateStr) && r.estado === 'activa';
        });

        html += `<div style="flex:1;min-width:${colW}px;border-left:1px solid rgba(255,255,255,.06);">`;
        // Header
        html += `<div style="height:40px;padding:4px 6px;background:${isToday ? 'rgba(99,102,241,.1)' : 'transparent'};border-bottom:1px solid rgba(255,255,255,.06);">
          <div style="font-size:11px;font-weight:700;color:${isToday ? 'var(--primary)' : 'var(--text-2)'};">${fmtDate(day)}</div>
          <div style="font-size:10px;color:var(--text-3);">${esc(sala.nombre)}</div>
        </div>`;
        // Slots
        html += `<div style="position:relative;height:${slotH * hours.length}px;">`;
        // Click areas
        hours.forEach(h => {
          const slotIso = `${dateStr}T${String(h).padStart(2,'0')}:00:00`;
          html += `<div class="cal-slot" data-sala="${sala.id}" data-inicio="${slotIso}"
            style="position:absolute;top:${(h-7)*slotH}px;left:0;right:0;height:${slotH}px;
            border-top:1px solid rgba(255,255,255,.04);cursor:pointer;"
            onmouseenter="this.style.background='rgba(99,102,241,.06)'"
            onmouseleave="this.style.background=''"></div>`;
        });
        // Events
        dayReuniones.forEach(r => {
          const hStart = new Date(r.fecha_inicio);
          const hEnd   = new Date(r.fecha_fin);
          const top    = ((hStart.getHours() + hStart.getMinutes()/60) - 7) * slotH;
          const height = ((hEnd - hStart) / 3600000) * slotH;
          const color  = TIPO_COLORS[r.tipo] || 'rgba(99,102,241,.7)';
          html += `<div class="cal-event" data-id="${r.id}"
            style="position:absolute;top:${top}px;left:2px;right:2px;height:${Math.max(height-2,20)}px;
            background:${color};border-radius:4px;padding:3px 5px;cursor:pointer;overflow:hidden;z-index:1;">
            <div style="font-size:11px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(r.titulo)}</div>
            <div style="font-size:10px;color:rgba(255,255,255,.8);">${isoToLocal(r.fecha_inicio)}–${isoToLocal(r.fecha_fin)}</div>
          </div>`;
        });
        html += `</div></div>`;
      });
    });

    html += `</div>`;
    const grid = document.getElementById('cal-grid');
    grid.innerHTML = html;

    grid.querySelectorAll('.cal-slot').forEach(el => {
      el.addEventListener('click', () => {
        openCrearModal(salas, {
          sala_id: parseInt(el.dataset.sala),
          fecha_inicio: el.dataset.inicio,
          fecha_fin: new Date(new Date(el.dataset.inicio).getTime() + 60*60000).toISOString().slice(0,19),
        }, refresh);
      });
    });

    grid.querySelectorAll('.cal-event').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const r = reuniones.find(x => x.id === parseInt(el.dataset.id));
        if (r) openDetalleModal(r, salas, refresh);
      });
    });
  }

  container.querySelector('#cal-prev').addEventListener('click', () => {
    currentWeek = addDays(currentWeek, -7);
    refresh();
  });
  container.querySelector('#cal-next').addEventListener('click', () => {
    currentWeek = addDays(currentWeek, 7);
    refresh();
  });
  container.querySelector('#cal-today').addEventListener('click', () => {
    currentWeek = weekStart(new Date());
    refresh();
  });
  container.querySelector('#btn-nueva-reunion').addEventListener('click', () => {
    openCrearModal(salas, {}, refresh);
  });
  container.querySelector('#btn-gestion-salas').addEventListener('click', () => {
    openGestionSalasModal(refresh);
  });

  await refresh();
}

// ── Modal crear/editar reunión ───────────────────────────────────────────────

function openCrearModal(salas, prefill = {}, onSave) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;';

  const toLocalInput = iso => iso ? iso.slice(0,16) : '';
  const toISO = local => local ? new Date(local).toISOString().slice(0,19) : '';

  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:12px;padding:28px;width:100%;max-width:520px;box-shadow:0 20px 60px rgba(0,0,0,.4);max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h2 style="margin:0;font-size:17px;font-weight:700;">Nueva reunión</h2>
        <button id="cr-x" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:20px;">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">TÍTULO *</label>
          <input id="cr-titulo" type="text" placeholder="Ej: Reunión semanal IT"
            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">SALA *</label>
            <select id="cr-sala" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
              <option value="">-- Seleccionar --</option>
              ${salas.map(s => `<option value="${s.id}" ${prefill.sala_id === s.id ? 'selected':''}>${esc(s.nombre)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">TIPO *</label>
            <select id="cr-tipo" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
              ${Object.entries(TIPO_LABELS).map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">INICIO *</label>
            <input id="cr-inicio" type="datetime-local" value="${toLocalInput(prefill.fecha_inicio)}"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">FIN *</label>
            <input id="cr-fin" type="datetime-local" value="${toLocalInput(prefill.fecha_fin)}"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">ORGANIZADOR *</label>
          <input id="cr-org-nombre" type="text" placeholder="Nombre del organizador"
            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">CORREO ORGANIZADOR <span style="font-weight:400;color:var(--text-3);">(opcional)</span></label>
          <input id="cr-org-correo" type="email" placeholder="correo@ejemplo.com"
            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">PARTICIPANTES <span style="font-weight:400;color:var(--text-3);">(un correo por línea, opcional)</span></label>
          <textarea id="cr-participantes" rows="3" placeholder="participante1@ejemplo.com&#10;participante2@ejemplo.com"
            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;resize:vertical;"></textarea>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">DESCRIPCIÓN / AGENDA <span style="font-weight:400;color:var(--text-3);">(opcional)</span></label>
          <textarea id="cr-desc" rows="3"
            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;resize:vertical;"></textarea>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px;">
        <button id="cr-cancel" style="padding:8px 16px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-3);font-size:13px;cursor:pointer;">Cancelar</button>
        <button id="cr-save" class="btn btn-primary">Crear reunión</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#cr-x').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#cr-cancel').addEventListener('click', () => overlay.remove());

  overlay.querySelector('#cr-save').addEventListener('click', async () => {
    const btn = overlay.querySelector('#cr-save');
    const sala_id  = parseInt(overlay.querySelector('#cr-sala').value);
    const titulo   = overlay.querySelector('#cr-titulo').value.trim();
    const tipo     = overlay.querySelector('#cr-tipo').value;
    const inicioLocal = overlay.querySelector('#cr-inicio').value;
    const finLocal    = overlay.querySelector('#cr-fin').value;
    const org_nombre  = overlay.querySelector('#cr-org-nombre').value.trim();
    const org_correo  = overlay.querySelector('#cr-org-correo').value.trim();
    const partic = overlay.querySelector('#cr-participantes').value
      .split('\n').map(s => s.trim()).filter(Boolean);
    const desc = overlay.querySelector('#cr-desc').value.trim();

    if (!sala_id || !titulo || !inicioLocal || !finLocal || !org_nombre) {
      showToast('Completa los campos obligatorios', 'error'); return;
    }

    const fecha_inicio = toISO(inicioLocal);
    const fecha_fin    = toISO(finLocal);

    btn.disabled = true; btn.textContent = 'Creando…';
    try {
      const res = await fetch('/api/reuniones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sala_id, titulo, tipo, fecha_inicio, fecha_fin,
          organizador_nombre: org_nombre, organizador_correo: org_correo,
          participantes: partic, descripcion: desc }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Error al crear', 'error'); return; }
      showToast(data.meet_link_generado ? '✅ Reunión creada · Meet link generado' : '✅ Reunión creada', 'success');
      overlay.remove();
      onSave?.();
    } catch { showToast('Error de red', 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Crear reunión'; }
  });

  setTimeout(() => overlay.querySelector('#cr-titulo')?.focus(), 50);
}

// ── Modal detalle ────────────────────────────────────────────────────────────

function openDetalleModal(reunion, salas, onUpdate) {
  const sala = salas.find(s => s.id === reunion.sala_id);
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;';

  const fmtDateTime = iso => {
    const d = new Date(iso);
    return d.toLocaleString('es-CO', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
  };

  const participantes = JSON.parse(reunion.participantes || '[]');

  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:12px;padding:28px;width:100%;max-width:480px;box-shadow:0 20px 60px rgba(0,0,0,.4);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
        <div>
          <span style="font-size:11px;padding:3px 8px;border-radius:12px;background:${TIPO_COLORS[reunion.tipo]};color:#fff;font-weight:600;">${TIPO_LABELS[reunion.tipo]}</span>
          <h2 style="margin:8px 0 4px;font-size:17px;font-weight:700;">${esc(reunion.titulo)}</h2>
        </div>
        <button id="det-x" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:20px;flex-shrink:0;">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;">
        <div><span style="color:var(--text-3);">📍 Sala:</span> <strong>${esc(sala?.nombre || '-')}</strong></div>
        <div><span style="color:var(--text-3);">🕐 Inicio:</span> <strong>${fmtDateTime(reunion.fecha_inicio)}</strong></div>
        <div><span style="color:var(--text-3);">🕐 Fin:</span> <strong>${fmtDateTime(reunion.fecha_fin)}</strong></div>
        <div><span style="color:var(--text-3);">👤 Organizador:</span> <strong>${esc(reunion.organizador_nombre)}</strong>${reunion.organizador_correo ? ` (${esc(reunion.organizador_correo)})` : ''}</div>
        ${participantes.length ? `<div><span style="color:var(--text-3);">👥 Participantes:</span> ${participantes.map(esc).join(', ')}</div>` : ''}
        ${reunion.descripcion ? `<div><span style="color:var(--text-3);">📋 Agenda:</span> ${esc(reunion.descripcion)}</div>` : ''}
        ${reunion.estado === 'cancelada' ? `<div style="color:#f87171;font-weight:600;">❌ Cancelada</div>` : ''}
      </div>
      ${reunion.meet_link && reunion.estado === 'activa' ? `
        <a href="${esc(reunion.meet_link)}" target="_blank" rel="noopener"
          style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:16px;padding:10px;
          background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.3);border-radius:8px;
          color:#34d399;font-weight:600;font-size:13px;text-decoration:none;">
          🎥 Unirse a Google Meet
        </a>` : reunion.estado === 'activa' ? `
        <div style="margin-top:16px;padding:10px;background:rgba(255,255,255,.04);border-radius:8px;
          font-size:12px;color:var(--text-3);text-align:center;">Sin link de Meet (Google Calendar no configurado)</div>` : ''}
      ${reunion.estado === 'activa' ? `
        <div style="display:flex;gap:8px;margin-top:20px;">
          <button id="det-cancel" style="flex:1;padding:8px;border:1px solid rgba(239,68,68,.3);border-radius:6px;background:rgba(239,68,68,.1);color:#f87171;font-size:13px;cursor:pointer;">Cancelar reunión</button>
        </div>` : ''}
    </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#det-x').addEventListener('click', () => overlay.remove());

  overlay.querySelector('#det-cancel')?.addEventListener('click', async () => {
    if (!confirm('¿Cancelar esta reunión?')) return;
    const res = await fetch(`/api/reuniones/${reunion.id}`, { method: 'DELETE' });
    if (res.ok) { showToast('Reunión cancelada', 'success'); overlay.remove(); onUpdate?.(); }
    else { const d = await res.json(); showToast(d.error || 'Error', 'error'); }
  });
}

// ── Modal gestión de salas ───────────────────────────────────────────────────

function openGestionSalasModal(onUpdate) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;';

  async function render() {
    const res = await fetch('/api/reuniones/salas');
    const { salas } = await res.json();

    overlay.innerHTML = `
      <div style="background:var(--surface);border-radius:12px;padding:28px;width:100%;max-width:440px;box-shadow:0 20px 60px rgba(0,0,0,.4);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2 style="margin:0;font-size:17px;font-weight:700;">Salas</h2>
          <button id="gs-x" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:20px;">✕</button>
        </div>
        <div id="gs-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
          ${salas.map(s => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface-2);border-radius:8px;">
              <span style="flex:1;font-size:13px;">${esc(s.nombre)}</span>
              ${s.descripcion ? `<span style="font-size:11px;color:var(--text-3);">${esc(s.descripcion)}</span>` : ''}
              <button class="gs-del" data-id="${s.id}" style="padding:3px 8px;border:1px solid rgba(239,68,68,.3);border-radius:5px;background:rgba(239,68,68,.1);color:#f87171;font-size:11px;cursor:pointer;">✕</button>
            </div>`).join('') || '<div style="color:var(--text-3);font-size:13px;text-align:center;">Sin salas aún</div>'}
        </div>
        <div style="display:flex;gap:8px;">
          <input id="gs-nombre" type="text" placeholder="Nombre de la sala"
            style="flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;">
          <button id="gs-add" class="btn btn-primary" style="white-space:nowrap;">+ Agregar</button>
        </div>
      </div>`;

    overlay.querySelector('#gs-x').addEventListener('click', () => { overlay.remove(); onUpdate?.(); });

    overlay.querySelectorAll('.gs-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        await fetch(`/api/reuniones/salas/${btn.dataset.id}`, { method: 'DELETE' });
        await render();
      });
    });

    overlay.querySelector('#gs-add').addEventListener('click', async () => {
      const nombre = overlay.querySelector('#gs-nombre').value.trim();
      if (!nombre) return;
      const res = await fetch('/api/reuniones/salas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      });
      if (res.ok) { showToast('Sala creada', 'success'); await render(); }
      else { const d = await res.json(); showToast(d.error, 'error'); }
    });
  }

  document.body.appendChild(overlay);
  render();
}
```

- [ ] **Step 2: Agregar ruta en app.js**

En `public/js/app.js`, agrega import al inicio (junto al resto):
```javascript
import { renderReuniones } from './reuniones-admin.js';
```

En la función `_firstAccessibleHash()`, después de `if (can('sedes:read')) return '#sedes';` agrega:
```javascript
  if (can('reuniones:read'))     return '#reuniones';
```

En la función `router()`, dentro del `switch`, después del `case '#sedes':` block agrega:
```javascript
      case '#reuniones':
        if (state.currentUser && !can('reuniones:read')) { window.location.hash = _firstAccessibleHash(); break; }
        state.currentPage = 'reuniones';
        document.getElementById('nav-reuniones')?.classList.add('active');
        renderReuniones(appContainer);
        break;
```

Después de `if (can('sedes:read')) show('nav-sedes');` en la función que muestra nav items agrega:
```javascript
    if (can('reuniones:read'))     show('nav-reuniones');
```

- [ ] **Step 3: Agregar nav item en index.html**

En `public/index.html`, después del nav item de `nav-sedes` agrega:
```html
      <a href="#reuniones" class="menu-item" id="nav-reuniones" style="display:none;">
        <span class="menu-icon"><i data-lucide="calendar" class="lucide"></i></span>
        <span class="menu-label">Calendario</span>
      </a>
```

- [ ] **Step 4: Verificar en browser**

Arranca el servidor y navega a `http://localhost:3000`. Verifica:
- "Calendario" aparece en el sidebar (si el usuario tiene `reuniones:read`)
- Clic en Calendario muestra el grid semanal
- Si no hay salas: mensaje "No hay salas configuradas"
- Botón "Gestionar salas" abre modal y permite crear una sala
- Con sala creada: grid muestra columnas
- Clic en slot vacío abre modal de crear reunión
- Al crear reunión aparece en el grid

- [ ] **Step 5: Commit**

```bash
git add public/js/reuniones-admin.js public/js/app.js public/index.html
git commit -m "feat(reuniones): add admin calendar view — week grid, create/detail/cancel modals"
```

---

## Task 5: Página pública de reservas

**Files:**
- Create: `public/reuniones.html`
- Create: `public/js/reuniones-public.js`

- [ ] **Step 1: Crear reuniones-public.js**

```javascript
// public/js/reuniones-public.js

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const TIPO_LABELS = {
  interna: 'Interna',
  con_sede: 'Con Sede',
  con_proveedor: 'Con Proveedor',
  formacion: 'Formación',
};

let salas = [];
let step = 1;
const data = {
  sala_id: null, fecha: '', hora_inicio: '', hora_fin: '',
  titulo: '', tipo: 'interna', organizador_nombre: '', organizador_correo: '',
  participantes: '', descripcion: '', sede_id: null,
};

async function init() {
  const res = await fetch('/api/reuniones/public/salas');
  const json = await res.json();
  salas = json.salas || [];
  renderStep();
}

function renderStep() {
  const container = document.getElementById('app');
  container.innerHTML = '';
  if (step === 1) renderStep1(container);
  else if (step === 2) renderStep2(container);
  else if (step === 3) renderStep3(container);
  else if (step === 4) renderStep4(container);
}

function renderStep1(container) {
  container.innerHTML = `
    <h2 style="font-size:18px;font-weight:700;margin-bottom:20px;">1. Elige sala y horario</h2>
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div>
        <label class="field-label">SALA *</label>
        <select id="p-sala" class="field-input">
          <option value="">-- Seleccionar sala --</option>
          ${salas.map(s => `<option value="${s.id}" ${data.sala_id == s.id ? 'selected':''}>${esc(s.nombre)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="field-label">FECHA *</label>
        <input id="p-fecha" type="date" value="${data.fecha}" min="${new Date().toISOString().slice(0,10)}" class="field-input">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <label class="field-label">HORA INICIO *</label>
          <select id="p-hinicio" class="field-input">
            ${horaOpts(data.hora_inicio)}
          </select>
        </div>
        <div>
          <label class="field-label">HORA FIN *</label>
          <select id="p-hfin" class="field-input">
            ${horaOpts(data.hora_fin)}
          </select>
        </div>
      </div>
      <div id="p-disponibilidad" style="font-size:12px;color:var(--text-muted);"></div>
      <button id="p-next1" class="btn-primary-pub">Siguiente →</button>
    </div>`;

  const salaEl  = document.getElementById('p-sala');
  const fechaEl = document.getElementById('p-fecha');

  async function checkDisponibilidad() {
    const sid = salaEl.value;
    const f   = fechaEl.value;
    if (!sid || !f) return;
    const res = await fetch(`/api/reuniones/public/disponibilidad?sala_id=${sid}&fecha=${f}`);
    const { ocupados } = await res.json();
    const div = document.getElementById('p-disponibilidad');
    if (!ocupados.length) { div.innerHTML = '✅ Sala disponible en esa fecha'; return; }
    div.innerHTML = `<span style="color:#f87171;">⚠ Horarios ocupados:</span> ` +
      ocupados.map(o => `${new Date(o.fecha_inicio).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}–${new Date(o.fecha_fin).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}`).join(', ');
  }

  salaEl.addEventListener('change', checkDisponibilidad);
  fechaEl.addEventListener('change', checkDisponibilidad);

  document.getElementById('p-next1').addEventListener('click', () => {
    data.sala_id     = parseInt(salaEl.value);
    data.fecha       = document.getElementById('p-fecha').value;
    data.hora_inicio = document.getElementById('p-hinicio').value;
    data.hora_fin    = document.getElementById('p-hfin').value;
    if (!data.sala_id || !data.fecha || !data.hora_inicio || !data.hora_fin) {
      showErr('Completa todos los campos'); return;
    }
    if (data.hora_fin <= data.hora_inicio) {
      showErr('La hora de fin debe ser posterior al inicio'); return;
    }
    step = 2; renderStep();
  });
}

function renderStep2(container) {
  container.innerHTML = `
    <h2 style="font-size:18px;font-weight:700;margin-bottom:20px;">2. Datos de la reunión</h2>
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div>
        <label class="field-label">TÍTULO *</label>
        <input id="p-titulo" type="text" value="${esc(data.titulo)}" class="field-input" placeholder="Ej: Reunión mensual equipo">
      </div>
      <div>
        <label class="field-label">TIPO *</label>
        <select id="p-tipo" class="field-input">
          ${Object.entries(TIPO_LABELS).map(([v,l]) => `<option value="${v}" ${data.tipo===v?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="field-label">TU NOMBRE *</label>
        <input id="p-org-nombre" type="text" value="${esc(data.organizador_nombre)}" class="field-input" placeholder="Nombre del organizador">
      </div>
      <div>
        <label class="field-label">TU CORREO <span style="font-weight:400;color:#9ca3af;">(opcional, para recibir el link)</span></label>
        <input id="p-org-correo" type="email" value="${esc(data.organizador_correo)}" class="field-input" placeholder="correo@ejemplo.com">
      </div>
      <div>
        <label class="field-label">PARTICIPANTES <span style="font-weight:400;color:#9ca3af;">(un correo por línea, opcional)</span></label>
        <textarea id="p-partic" rows="3" class="field-input" placeholder="participante@ejemplo.com">${esc(data.participantes)}</textarea>
      </div>
      <div>
        <label class="field-label">DESCRIPCIÓN / AGENDA <span style="font-weight:400;color:#9ca3af;">(opcional)</span></label>
        <textarea id="p-desc" rows="3" class="field-input" placeholder="Temas a tratar...">${esc(data.descripcion)}</textarea>
      </div>
      <div style="display:flex;gap:8px;">
        <button id="p-back2" class="btn-sec-pub">← Anterior</button>
        <button id="p-next2" class="btn-primary-pub" style="flex:1;">Siguiente →</button>
      </div>
    </div>`;

  document.getElementById('p-back2').addEventListener('click', () => { step = 1; renderStep(); });
  document.getElementById('p-next2').addEventListener('click', () => {
    data.titulo             = document.getElementById('p-titulo').value.trim();
    data.tipo               = document.getElementById('p-tipo').value;
    data.organizador_nombre = document.getElementById('p-org-nombre').value.trim();
    data.organizador_correo = document.getElementById('p-org-correo').value.trim();
    data.participantes      = document.getElementById('p-partic').value.trim();
    data.descripcion        = document.getElementById('p-desc').value.trim();
    if (!data.titulo || !data.organizador_nombre) { showErr('Título y nombre son obligatorios'); return; }
    step = 3; renderStep();
  });
}

function renderStep3(container) {
  const sala = salas.find(s => s.id === data.sala_id);
  container.innerHTML = `
    <h2 style="font-size:18px;font-weight:700;margin-bottom:20px;">3. Confirmar</h2>
    <div style="background:#1e1e2e;border-radius:10px;padding:16px;margin-bottom:20px;font-size:13px;display:flex;flex-direction:column;gap:8px;">
      <div><span style="color:#9ca3af;">📋 Título:</span> <strong>${esc(data.titulo)}</strong></div>
      <div><span style="color:#9ca3af;">📍 Sala:</span> <strong>${esc(sala?.nombre || '')}</strong></div>
      <div><span style="color:#9ca3af;">📅 Fecha:</span> <strong>${data.fecha}</strong></div>
      <div><span style="color:#9ca3af;">🕐 Horario:</span> <strong>${data.hora_inicio} – ${data.hora_fin}</strong></div>
      <div><span style="color:#9ca3af;">🏷 Tipo:</span> <strong>${TIPO_LABELS[data.tipo]}</strong></div>
      <div><span style="color:#9ca3af;">👤 Organizador:</span> <strong>${esc(data.organizador_nombre)}</strong></div>
    </div>
    <div style="display:flex;gap:8px;">
      <button id="p-back3" class="btn-sec-pub">← Anterior</button>
      <button id="p-submit" class="btn-primary-pub" style="flex:1;">✓ Agendar reunión</button>
    </div>`;

  document.getElementById('p-back3').addEventListener('click', () => { step = 2; renderStep(); });
  document.getElementById('p-submit').addEventListener('click', async () => {
    const btn = document.getElementById('p-submit');
    btn.disabled = true; btn.textContent = 'Agendando…';
    try {
      const fecha_inicio = `${data.fecha}T${data.hora_inicio}:00`;
      const fecha_fin    = `${data.fecha}T${data.hora_fin}:00`;
      const participantes = data.participantes.split('\n').map(s => s.trim()).filter(Boolean);
      const res = await fetch('/api/reuniones/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sala_id: data.sala_id, titulo: data.titulo, tipo: data.tipo,
          fecha_inicio, fecha_fin,
          organizador_nombre: data.organizador_nombre,
          organizador_correo: data.organizador_correo,
          participantes, descripcion: data.descripcion,
        }),
      });
      const json = await res.json();
      if (!res.ok) { showErr(json.error || 'Error al agendar'); btn.disabled = false; btn.textContent = '✓ Agendar reunión'; return; }
      window._reunionResult = json;
      step = 4; renderStep();
    } catch { showErr('Error de red'); btn.disabled = false; btn.textContent = '✓ Agendar reunión'; }
  });
}

function renderStep4(container) {
  const result = window._reunionResult || {};
  const token  = result.token_externo;
  const cancelUrl = `${location.origin}/reuniones.html?token=${token}`;

  container.innerHTML = `
    <div style="text-align:center;padding:20px 0;">
      <div style="font-size:48px;margin-bottom:12px;">✅</div>
      <h2 style="font-size:20px;font-weight:700;margin-bottom:8px;">¡Reunión agendada!</h2>
      <p style="color:#9ca3af;font-size:13px;margin-bottom:20px;">Guarda este link para cancelar si es necesario.</p>
    </div>
    ${result.meet_link ? `
      <a href="${esc(result.meet_link)}" target="_blank" rel="noopener"
        style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;
        background:#064e3b;border:1px solid #059669;border-radius:8px;
        color:#34d399;font-weight:600;font-size:14px;text-decoration:none;margin-bottom:12px;">
        🎥 Unirse a Google Meet
      </a>
      <button id="p-copy-meet" style="width:100%;padding:8px;border:1px solid #374151;border-radius:8px;background:#1f2937;color:#9ca3af;font-size:12px;cursor:pointer;margin-bottom:16px;">
        Copiar link de Meet
      </button>` : ''}
    <div style="background:#1e1e2e;border-radius:10px;padding:14px;margin-bottom:16px;font-size:12px;">
      <div style="color:#9ca3af;margin-bottom:6px;">Link para cancelar tu reunión:</div>
      <div style="word-break:break-all;color:#818cf8;">${esc(cancelUrl)}</div>
    </div>
    <button id="p-copy-cancel" style="width:100%;padding:8px;border:1px solid #374151;border-radius:8px;background:#1f2937;color:#9ca3af;font-size:12px;cursor:pointer;">
      Copiar link de cancelación
    </button>`;

  document.getElementById('p-copy-cancel')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(cancelUrl);
    document.getElementById('p-copy-cancel').textContent = '✓ Copiado';
  });
  document.getElementById('p-copy-meet')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(result.meet_link);
    document.getElementById('p-copy-meet').textContent = '✓ Copiado';
  });
}

function renderCancelView(token) {
  fetch(`/api/reuniones/public/${token}`)
    .then(r => r.json())
    .then(({ reunion, error }) => {
      const container = document.getElementById('app');
      if (error || !reunion) {
        container.innerHTML = `<div style="text-align:center;color:#f87171;">Reunión no encontrada.</div>`;
        return;
      }
      const sala = reunion.sala_nombre || '';
      container.innerHTML = `
        <h2 style="font-size:18px;font-weight:700;margin-bottom:16px;">Tu reunión</h2>
        <div style="background:#1e1e2e;border-radius:10px;padding:16px;margin-bottom:20px;font-size:13px;display:flex;flex-direction:column;gap:8px;">
          <div><strong>${esc(reunion.titulo)}</strong></div>
          <div><span style="color:#9ca3af;">Sala:</span> ${esc(sala)}</div>
          <div><span style="color:#9ca3af;">Inicio:</span> ${new Date(reunion.fecha_inicio).toLocaleString('es-CO')}</div>
          <div><span style="color:#9ca3af;">Estado:</span> <span style="color:${reunion.estado==='activa'?'#34d399':'#f87171'}">${reunion.estado}</span></div>
        </div>
        ${reunion.meet_link && reunion.estado === 'activa' ? `
          <a href="${esc(reunion.meet_link)}" target="_blank" rel="noopener"
            style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;
            background:#064e3b;border:1px solid #059669;border-radius:8px;
            color:#34d399;font-weight:600;font-size:14px;text-decoration:none;margin-bottom:16px;">
            🎥 Unirse a Google Meet
          </a>` : ''}
        ${reunion.estado === 'activa' ? `
          <button id="p-cancelar" style="width:100%;padding:10px;border:1px solid rgba(239,68,68,.3);border-radius:8px;background:rgba(239,68,68,.1);color:#f87171;font-size:13px;cursor:pointer;">
            Cancelar esta reunión
          </button>` : ''}`;

      document.getElementById('p-cancelar')?.addEventListener('click', async () => {
        if (!confirm('¿Cancelar esta reunión?')) return;
        const res = await fetch(`/api/reuniones/public/${token}`, { method: 'DELETE' });
        if (res.ok) { renderCancelView(token); }
      });
    });
}

function horaOpts(selected) {
  let opts = '';
  for (let h = 7; h < 20; h++) {
    for (const m of [0, 30]) {
      const val = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      opts += `<option value="${val}" ${selected === val ? 'selected':''}>${val}</option>`;
    }
  }
  return opts;
}

function showErr(msg) {
  let el = document.getElementById('p-err');
  if (!el) {
    el = document.createElement('div');
    el.id = 'p-err';
    el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#7f1d1d;color:#fca5a5;padding:10px 20px;border-radius:8px;font-size:13px;z-index:9999;';
    document.body.appendChild(el);
    setTimeout(() => el?.remove(), 3000);
  }
  el.textContent = msg;
}

// ── Boot ─────────────────────────────────────────────────────────────────────

const params = new URLSearchParams(location.search);
const token  = params.get('token');
if (token) {
  document.addEventListener('DOMContentLoaded', () => renderCancelView(token));
} else {
  document.addEventListener('DOMContentLoaded', init);
}
```

- [ ] **Step 2: Crear reuniones.html**

Crea `public/reuniones.html` modelado en `public/rastrear.html`:
```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agendar Reunión</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f0f1a;
      color: #e2e8f0;
      min-height: 100vh;
      display: flex;
      align-items: flex-start;
      justify-content: center;
      padding: 24px 16px;
    }
    .card {
      background: #1a1a2e;
      border: 1px solid rgba(255,255,255,.08);
      border-radius: 14px;
      padding: 28px;
      width: 100%;
      max-width: 520px;
    }
    .logo {
      font-size: 13px;
      font-weight: 700;
      color: #818cf8;
      letter-spacing: .5px;
      margin-bottom: 24px;
      text-transform: uppercase;
    }
    .field-label {
      display: block;
      font-size: 11px;
      font-weight: 700;
      color: #9ca3af;
      margin-bottom: 4px;
      letter-spacing: .3px;
    }
    .field-input {
      width: 100%;
      padding: 9px 11px;
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 7px;
      background: rgba(255,255,255,.05);
      color: #e2e8f0;
      font-size: 13px;
      font-family: inherit;
      outline: none;
    }
    .field-input:focus { border-color: #6366f1; }
    .btn-primary-pub {
      width: 100%;
      padding: 10px;
      background: #6366f1;
      border: none;
      border-radius: 8px;
      color: #fff;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      font-family: inherit;
    }
    .btn-primary-pub:hover { background: #4f46e5; }
    .btn-primary-pub:disabled { opacity: .6; cursor: not-allowed; }
    .btn-sec-pub {
      padding: 10px 16px;
      background: rgba(255,255,255,.06);
      border: 1px solid rgba(255,255,255,.1);
      border-radius: 8px;
      color: #9ca3af;
      font-size: 13px;
      cursor: pointer;
      font-family: inherit;
    }
    select.field-input option { background: #1a1a2e; }
    textarea.field-input { resize: vertical; }
  </style>
</head>
<body>
  <div class="card">
    <div class="logo">IT Support · Calendario</div>
    <div id="app">Cargando…</div>
  </div>
  <script type="module" src="/js/reuniones-public.js"></script>
</body>
</html>
```

- [ ] **Step 3: Verificar flujo público**

Arranca el servidor. Navega a `http://localhost:3000/reuniones.html`:
- Paso 1: selector de sala y fecha — verifica que aparecen las salas creadas
- Selecciona sala + fecha → cambia a "Disponibilidad: ✅" si libre
- Avanza al paso 2 → llena datos
- Paso 3 → confirmar → crea reunión → muestra Meet link y link de cancelación
- Copia el link de cancelación y ábrelo → muestra detalle + botón cancelar

- [ ] **Step 4: Commit**

```bash
git add public/reuniones.html public/js/reuniones-public.js
git commit -m "feat(reuniones): add public booking page with 4-step flow and cancel-by-token"
```

---

## Self-Review

**Spec coverage:**
- ✅ Múltiples salas — `salas` table + gestión modal
- ✅ Conflict check en servidor — `conflicto()` helper, verificado en POST interno y público, y en PUT
- ✅ Google Meet automático — `crearEventoConMeet()`, degradación elegante si falla
- ✅ Acceso admin (requireAuth) — todas las rutas `/api/reuniones` y `/api/reuniones/salas`
- ✅ Acceso externo (token) — rutas `/api/reuniones/public/*`
- ✅ Campos: título, sala, fechas, organizador, participantes, descripción, tipo, sede_id
- ✅ Duración mínima 15 min, máxima 8h — validado en servidor
- ✅ No reuniones en el pasado — validado en servidor
- ✅ Vista semana con grid — `renderReuniones()` en reuniones-admin.js
- ✅ Modal crear/detalle/cancelar — `openCrearModal()`, `openDetalleModal()`
- ✅ Permisos granulares — ids 37-40 en migrations
- ✅ token_externo nunca expira — sin TTL en DB ni en queries
- ✅ Cancelación por token cancela evento Google — `cancelarEvento()` en DELETE /public/:token

**Placeholder scan:** Ninguno.

**Type consistency:**
- `crearEventoConMeet` signature consistente entre calendar-service.js y sus llamadores
- `conflicto(sala_id, inicio, fin, excludeId)` consistente entre POST y PUT
- `token_externo` como UUID generado con `crypto.randomUUID()` — consistente
