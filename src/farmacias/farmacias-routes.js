import express from 'express';
import { readSheet, saveFarmacias, reconstructColB, insertMunicipio } from './sheets-service.js';
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

router.post('/api/farmacias/municipio', requireAuth, requirePermission('farmacias:create'), wrap(async (req, res) => {
  const { departamento, municipioNombre, nombre, direccion, correo, horario, telefono, mapsUrl } = req.body;
  if (!departamento || !municipioNombre || !nombre) {
    return res.status(400).json({ error: 'departamento, municipioNombre y nombre son obligatorios.' });
  }

  const data = await readSheet();
  const dept = data.find(d => d.nombre.trim().toLowerCase() === departamento.trim().toLowerCase());
  if (!dept) return res.status(404).json({ error: 'Departamento no encontrado.' });

  const yaExiste = dept.municipios.some(m => m.nombre.trim().toLowerCase() === municipioNombre.trim().toLowerCase());
  if (yaExiste) return res.status(409).json({ error: 'Ese municipio ya existe en el departamento.' });

  const afterRow = dept.municipios.length
    ? Math.max(...dept.municipios.map(m => m.sheetRow))
    : dept.sheetRow;

  // El consecutivo (columna A) es único y correlativo a lo largo de TODA la
  // hoja — no reinicia por departamento — así que hay que revisar todos los
  // municipios de todos los departamentos para hallar el próximo número libre.
  const nextNum = data.flatMap(d => d.municipios).reduce((max, m) => {
    const n = Number((m.keywords || []).find(k => /^\d+$/.test(k)));
    return Number.isFinite(n) && n > max ? n : max;
  }, 0) + 1;

  const nombreLimpio = municipioNombre.trim();
  const colA = `${nextNum}, ${nombreLimpio}, ${nombreLimpio.toLowerCase()}, ${nombreLimpio.toUpperCase()}`;
  const colB = await reconstructColB(municipioNombre, [{ nombre, direccion, correo, horario, telefono, mapsUrl }]);

  const newRow = await insertMunicipio(afterRow, colA, colB);
  console.log(`[Farmacias] Municipio creado — depto:${departamento} municipio:${municipioNombre} row:${newRow}`);
  res.json({ ok: true, sheetRow: newRow });
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
