import express from 'express';
import { readSheet, saveFarmacias } from './sheets-service.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import { wrap } from '../utils/async-handler.js';

const router = express.Router();

router.get('/api/farmacias', requireAuth, requirePermission('farmacias:read'), wrap(async (req, res) => {
  const data = await readSheet();
  res.json(data);
}));

router.put('/api/farmacias/punto', requireAuth, requirePermission('farmacias:edit'), wrap(async (req, res) => {
  const { municipioNombre, nombre, direccion, correo, horario, telefono, mapsUrl } = req.body;
  const sheetRow = Number(req.body.sheetRow);
  const index    = req.body.index !== undefined ? Number(req.body.index) : undefined;
  if (!sheetRow || index === undefined || !municipioNombre) {
    return res.status(400).json({ error: 'sheetRow, municipioNombre e index son obligatorios.' });
  }

  const data  = await readSheet();
  const muni  = data.flatMap(d => d.municipios).find(m => m.sheetRow === sheetRow);
  if (!muni) return res.status(404).json({ error: 'Municipio no encontrado.' });

  if (index < 0 || index >= muni.farmacias.length) {
    return res.status(404).json({ error: 'Farmacia no encontrada en ese índice.' });
  }
  muni.farmacias[index] = { ...muni.farmacias[index], nombre, direccion, correo, horario, telefono, mapsUrl };

  await saveFarmacias(sheetRow, municipioNombre, muni.farmacias);
  console.log(`[Farmacias] PUT ok — sheetRow:${sheetRow} municipio:${municipioNombre}`);
  res.json({ ok: true });
}));

router.post('/api/farmacias/punto', requireAuth, requirePermission('farmacias:create'), wrap(async (req, res) => {
  const { municipioNombre, nombre, direccion, correo, horario, telefono, mapsUrl } = req.body;
  const sheetRow = Number(req.body.sheetRow);
  if (!sheetRow || !municipioNombre || !nombre) {
    return res.status(400).json({ error: 'sheetRow, municipioNombre y nombre son obligatorios.' });
  }

  const data  = await readSheet();
  const muni  = data.flatMap(d => d.municipios).find(m => m.sheetRow === sheetRow);
  if (!muni) return res.status(404).json({ error: 'Municipio no encontrado.' });

  muni.farmacias.push({ index: muni.farmacias.length, nombre, direccion, correo, horario, telefono, mapsUrl });
  await saveFarmacias(sheetRow, municipioNombre, muni.farmacias);
  res.json({ ok: true });
}));

router.delete('/api/farmacias/punto', requireAuth, requirePermission('farmacias:delete'), wrap(async (req, res) => {
  const { municipioNombre } = req.body;
  const sheetRow = Number(req.body.sheetRow);
  const index    = Number(req.body.index);
  if (!sheetRow || index === undefined || !municipioNombre) {
    return res.status(400).json({ error: 'sheetRow, municipioNombre e index son obligatorios.' });
  }

  const data  = await readSheet();
  const muni  = data.flatMap(d => d.municipios).find(m => m.sheetRow === sheetRow);
  if (!muni) return res.status(404).json({ error: 'Municipio no encontrado.' });
  if (index < 0 || index >= muni.farmacias.length) {
    return res.status(404).json({ error: 'Farmacia no encontrada en ese índice.' });
  }

  muni.farmacias.splice(index, 1);
  muni.farmacias.forEach((f, i) => { f.index = i; });

  await saveFarmacias(sheetRow, municipioNombre, muni.farmacias);
  res.json({ ok: true });
}));

export default router;
