import express from 'express';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import { wrap } from '../utils/async-handler.js';
import { logAudit } from '../audit/audit-logger.js';
import { buscarPersonas, listarPersonas, asignadosA, elementosPorId } from './paz-salvo-model.js';
import { generarActaPazSalvo, textoCertificacion } from './paz-salvo-acta.js';

const router = express.Router();
const canRead = [requireAuth, requirePermission('inventario:read')];
const actor = (req) => req.user?.username || req.session?.username || 'sistema';
const texto = (v, max = 200) => String(v ?? '').trim().slice(0, max);

/** Listado paginado de personas con equipos asignados (categoría "Personas" de Inventario). */
router.get('/api/inventario/personas', ...canRead, wrap(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const todas = await listarPersonas(db, { q: req.query.search, area: req.query.area, tipo: req.query.tipo });
  res.json({
    personas: todas.slice((page - 1) * limit, page * limit),
    total: todas.length, page, limit, total_pages: Math.ceil(todas.length / limit),
  });
}));

router.get('/api/inventario/paz-salvo/personas', ...canRead, wrap(async (req, res) => {
  res.json({ personas: await buscarPersonas(db, req.query.q) });
}));

router.get('/api/inventario/paz-salvo/asignados', ...canRead, wrap(async (req, res) => {
  const { cedula, nombre } = req.query;
  if (!texto(cedula) && !texto(nombre)) return res.status(400).json({ error: 'Indica la cédula o el nombre.' });
  res.json({ elementos: await asignadosA(db, { cedula, nombre }) });
}));

/** Genera el acta de devolución / paz y salvo. No cambia nada en el inventario. */
router.post('/api/inventario/paz-salvo/acta', ...canRead, wrap(async (req, res) => {
  const b = req.body || {};
  const persona = {
    nombre: texto(b.nombre), cedula: texto(b.cedula, 30), cargo: texto(b.cargo),
    area: texto(b.area), fecha_retiro: texto(b.fecha_retiro, 10),
  };
  if (!persona.nombre) return res.status(400).json({ error: 'El nombre del colaborador es obligatorio.' });
  const seleccion = Array.isArray(b.elementos) ? b.elementos.slice(0, 200) : [];
  const elementos = await elementosPorId(db, seleccion);
  const observaciones = texto(b.observaciones, 1000);

  const docx = generarActaPazSalvo(persona, elementos, observaciones);
  const { pazYSalvo } = textoCertificacion(persona, elementos);
  await logAudit(actor(req), pazYSalvo ? 'Paz y salvo generado' : 'Acta de devolución con pendientes generada',
    'paz_salvo', null, persona.cedula || null, {
      nombre: persona.nombre, elementos: elementos.length,
      pendientes: elementos.filter(e => !e.devuelto).map(e => `${e.tipo} ${e.placa || e.serial}`.trim()),
    });

  const archivo = `Paz y salvo - ${persona.nombre}.docx`.replace(/[\\/:*?"<>|]/g, '');
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition', `attachment; filename="paz-y-salvo.docx"; filename*=UTF-8''${encodeURIComponent(archivo)}`);
  res.send(docx);
}));

export default router;
