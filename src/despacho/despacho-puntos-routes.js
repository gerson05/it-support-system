/**
 * Crear sede (punto o bodega) desde Despachos.
 * Queda en la misma tabla `puntos` que administra "Red de Puntos", así aparece
 * en todos los buscadores de sede. Basta con poder crear despachos.
 */
import express from 'express';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import { logAudit } from '../audit/audit-logger.js';
import { wrap } from '../utils/async-handler.js';

const router = express.Router();
const canCreate = [requireAuth, requirePermission('despacho:create')];
const limpio = (v, max = 120) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);
/** Para comparar: sin tildes, sin mayúsculas y sin espacios repetidos ("Jamundí" = "JAMUNDI"). */
const clave = (v) => limpio(v).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

router.post('/api/despachos/puntos', ...canCreate, wrap(async (req, res) => {
  const nombre = limpio(req.body?.nombre);
  let ciudad   = limpio(req.body?.ciudad, 60).toUpperCase();
  const tipo   = req.body?.tipo === 'bodega' ? 'bodega' : 'punto';
  if (!nombre || !ciudad) return res.status(400).json({ error: 'Nombre y ciudad son obligatorios.' });

  const todos = await db.prepare('SELECT id, nombre, ciudad, tipo, activo FROM puntos').all();
  // Si la ciudad ya existe escrita de otra forma, se usa como está guardada (no se duplica la ciudad)
  ciudad = todos.find(p => clave(p.ciudad) === clave(ciudad))?.ciudad || ciudad;

  // Si ya existe con ese nombre en esa ciudad, se reutiliza (y se reactiva si estaba inactiva)
  const existente = todos.find(p => clave(p.nombre) === clave(nombre) && clave(p.ciudad) === clave(ciudad));
  if (existente) {
    if (!existente.activo) await db.prepare('UPDATE puntos SET activo = 1 WHERE id = ?').run(existente.id);
    return res.json({ ...existente, activo: 1, existia: true });
  }

  const r = await db.prepare('INSERT INTO puntos (nombre, ciudad, tipo) VALUES (?, ?, ?)').run(nombre, ciudad, tipo);
  const actor = req.user?.username || 'sistema';
  await logAudit(actor, 'Sede creada desde Despachos', 'punto', r.lastInsertRowid, nombre, { ciudad, tipo });
  res.status(201).json({ id: r.lastInsertRowid, nombre, ciudad, tipo, activo: 1, existia: false });
}));

export default router;
