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

    if (tipo !== undefined && !TIPOS.includes(tipo))
      return res.status(400).json({ error: 'Tipo inválido.' });

    if (fecha_inicio !== undefined || fecha_fin !== undefined || sala_id !== undefined) {
      const durMin = (new Date(nFin) - new Date(nInicio)) / 60000;
      if (durMin < 15)     return res.status(400).json({ error: 'Duración mínima: 15 minutos.' });
      if (durMin > 8 * 60) return res.status(400).json({ error: 'Duración máxima: 8 horas.' });
      if (conflicto(nSala, nInicio, nFin, id))
        return res.status(409).json({ error: 'La sala ya tiene una reunión en ese horario.' });
    }

    const fields = [], vals = [];
    if (sala_id            !== undefined) { fields.push('sala_id=?');            vals.push(nSala); }
    if (titulo !== undefined) {
      if (!titulo.trim()) return res.status(400).json({ error: 'Título no puede quedar vacío.' });
      fields.push('titulo=?'); vals.push(titulo.trim());
    }
    if (tipo               !== undefined) { fields.push('tipo=?');               vals.push(tipo); }
    if (fecha_inicio       !== undefined) { fields.push('fecha_inicio=?');       vals.push(fecha_inicio); }
    if (fecha_fin          !== undefined) { fields.push('fecha_fin=?');          vals.push(fecha_fin); }
    if (organizador_nombre !== undefined) {
      if (!organizador_nombre.trim()) return res.status(400).json({ error: 'Organizador no puede quedar vacío.' });
      fields.push('organizador_nombre=?'); vals.push(organizador_nombre.trim());
    }
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
