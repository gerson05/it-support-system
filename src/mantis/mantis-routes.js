import express from 'express';
import multer from 'multer';
import db from '../config/database.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import { wrap } from '../utils/async-handler.js';
import { logAudit } from '../audit/audit-logger.js';
import { readSheetRows, PARSERS } from './catalog-parser.js';
import {
  TIPOS, importCatalog, searchPerfiles, searchBodegas, catalogStatus,
  bodegasSinComprobante, setComprobanteManual,
} from './catalog-model.js';

const router = express.Router();

// Buscar en catálogos: quien crea empleados. Cargar Excel / corregir comprobantes: quien los edita.
const canSearch = [requireAuth, requirePermission('employees:create')];
const canManage = [requireAuth, requirePermission('employees:edit')];

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/api/mantis/perfiles', ...canSearch, wrap(async (req, res) => {
  res.json(await searchPerfiles(db, req.query.q));
}));

router.get('/api/mantis/bodegas', ...canSearch, wrap(async (req, res) => {
  res.json(await searchBodegas(db, req.query.q));
}));

router.get('/api/mantis/catalogos', ...canSearch, wrap(async (req, res) => {
  res.json(await catalogStatus(db));
}));

router.get('/api/mantis/bodegas/sin-comprobante', ...canManage, wrap(async (req, res) => {
  res.json(await bodegasSinComprobante(db));
}));

router.put('/api/mantis/bodegas/:codigo/comprobante', ...canManage, wrap(async (req, res) => {
  try {
    const result = await setComprobanteManual(db, Number(req.params.codigo), req.body?.comprobante);
    await logAudit(req.user?.username || 'IT', 'Comprobante asignado a bodega', 'mantis_bodega',
      result.codigo, String(result.codigo), { comprobante: result.comprobante });
    res.json({ ok: true, ...result });
  } catch (err) {
    if (err.code === 'NOT_FOUND') return res.status(404).json({ error: err.message });
    if (err.code === 'BAD_COMPROBANTE') return res.status(400).json({ error: err.message });
    throw err;
  }
}));

/** Carga un Excel exportado de Mantis: tipo = perfiles | bodegas | comprobantes. */
router.post('/api/mantis/catalogos/:tipo', ...canManage, upload.single('file'), wrap(async (req, res) => {
  const { tipo } = req.params;
  if (!TIPOS.includes(tipo)) return res.status(400).json({ error: 'Tipo de catálogo inválido.' });
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo.' });

  let items;
  try {
    items = PARSERS[tipo](readSheetRows(req.file.buffer));
  } catch (err) {
    const msg = err.code === 'BAD_FILE' ? err.message : 'No se pudo leer el archivo. Verifica que sea el Excel exportado de Mantis.';
    return res.status(400).json({ error: msg });
  }
  if (!items.length) return res.status(400).json({ error: 'El archivo no tiene filas con datos.' });

  const result = await importCatalog(db, tipo, items, {
    archivo: req.file.originalname,
    usuario: req.user?.username,
  });
  await logAudit(req.user?.username || 'IT', `Catálogo Mantis cargado: ${tipo}`, 'mantis_catalogo', null, tipo,
    { archivo: req.file.originalname, filas: result.filas });

  res.json({ ok: true, ...result, estado: await catalogStatus(db) });
}));

export default router;
