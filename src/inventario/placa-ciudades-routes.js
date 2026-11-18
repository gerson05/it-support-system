/**
 * Ciudades / puntos para la placa AF-{CÓDIGO}{NNN}, creados desde Inventario.
 * Se guardan en placa_ciudades dentro del grupo (departamento o ciudad) elegido
 * y el código de 3 letras sale del nombre sin repetir uno que ya exista.
 */
import express from 'express';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import { logAudit } from '../audit/audit-logger.js';
import { wrap } from '../utils/async-handler.js';
import { SEDE_CODES, getSedeCode, normSede, sugerirCodigo } from './sede-codes.js';
import { PLACA_GRUPOS } from '../../public/js/features/inventario/placa-ciudades.js';

const router = express.Router();
const PERMISOS = ['full', 'inventario:create', 'inventario:edit'];
const puedeCrear = (req, res, next) => ((req.permissions ?? []).some(p => PERMISOS.includes(p))
  ? next() : res.status(403).json({ error: 'Acceso denegado.' }));
const canRead   = [requireAuth, requirePermission('inventario:read')];
const canCreate = [requireAuth, puedeCrear];
const limpio = (v, max = 80) => String(v ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

const VALORES_BASE = PLACA_GRUPOS.flatMap(g => g.opts.map(([v]) => normSede(v)));
const CODIGOS_BASE = new Set([...Object.values(SEDE_CODES), ...VALORES_BASE.map(getSedeCode)]);

/** Códigos que ya no se pueden usar: lista fija, creados antes y los que ya tienen placas. */
async function codigosOcupados() {
  const ocupados = new Set(CODIGOS_BASE);
  for (const r of await db.prepare('SELECT codigo FROM placa_ciudades').all()) ocupados.add(r.codigo);
  for (const t of ['inventario_equipos', 'inventario_celulares', 'inventario_ups']) {
    try {
      const rows = await db.prepare(`SELECT DISTINCT SUBSTR(placa, 4, 3) AS c FROM ${t} WHERE placa LIKE 'AF-%'`).all();
      for (const r of rows) if (r.c) ocupados.add(String(r.c).toUpperCase());
    } catch { /* tabla sin placa */ }
  }
  return ocupados;
}

router.get('/api/inventario/placa-ciudades', ...canRead, wrap(async (_req, res) => {
  res.json(await db.prepare('SELECT id, grupo, nombre, valor, codigo FROM placa_ciudades ORDER BY grupo, nombre').all());
}));

router.get('/api/inventario/placa-ciudades/sugerir', ...canRead, wrap(async (req, res) => {
  res.json({ codigo: sugerirCodigo(limpio(req.query.nombre), await codigosOcupados()) });
}));

router.post('/api/inventario/placa-ciudades', ...canCreate, wrap(async (req, res) => {
  const nombre = limpio(req.body?.nombre);
  const grupo  = limpio(req.body?.grupo);
  if (!nombre || !grupo) return res.status(400).json({ error: 'Nombre y grupo son obligatorios.' });

  const valor = normSede(nombre);
  const creadas = await db.prepare('SELECT valor FROM placa_ciudades').all();
  if (VALORES_BASE.includes(valor) || creadas.some(r => r.valor === valor))
    return res.status(409).json({ error: `"${nombre}" ya existe en la lista.` });

  const ocupados = await codigosOcupados();
  let codigo = limpio(req.body?.codigo, 3).toUpperCase();
  if (codigo) {
    if (!/^[A-Z0-9]{3}$/.test(codigo)) return res.status(400).json({ error: 'El código debe tener 3 letras o números.' });
    if (ocupados.has(codigo)) return res.status(409).json({ error: `El código ${codigo} ya está en uso.` });
  } else {
    codigo = sugerirCodigo(nombre, ocupados);
    if (!codigo) return res.status(400).json({ error: 'No se pudo generar un código; escríbelo manualmente.' });
  }

  const actor = req.user?.username || 'sistema';
  const r = await db.prepare('INSERT INTO placa_ciudades (grupo, nombre, valor, codigo, usuario) VALUES (?, ?, ?, ?, ?)')
    .run(grupo, nombre, valor, codigo, actor);
  await logAudit(actor, 'Ciudad de placa creada', 'placa_ciudad', r.lastInsertRowid, nombre, { grupo, codigo });
  res.status(201).json({ id: r.lastInsertRowid, grupo, nombre, valor, codigo });
}));

export default router;
