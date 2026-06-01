import express from 'express';
import { readSheet, saveFarmacias } from './sheets-service.js';

const router = express.Router();

/* ── GET /api/farmacias
   Devuelve todos los departamentos con municipios y farmacias parseadas ── */
router.get('/api/farmacias', async (req, res) => {
  try {
    const data = await readSheet();
    res.json(data);
  } catch (err) {
    console.error('[Farmacias] GET error:', err.message);
    res.status(500).json({ error: 'No se pudo leer el directorio de farmacias.' });
  }
});

/* ── PUT /api/farmacias/punto
   Edita los campos de una farmacia existente en un municipio.
   Body: { sheetRow, municipioNombre, index, nombre, direccion, correo, horario, telefono, mapsUrl } ── */
router.put('/api/farmacias/punto', async (req, res) => {
  try {
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
    res.json({ ok: true });
  } catch (err) {
    console.error('[Farmacias] PUT error:', err.message);
    res.status(500).json({ error: 'No se pudo guardar el cambio.' });
  }
});

/* ── POST /api/farmacias/punto
   Agrega una farmacia nueva a un municipio.
   Body: { sheetRow, municipioNombre, nombre, direccion, correo, horario, telefono, mapsUrl } ── */
router.post('/api/farmacias/punto', async (req, res) => {
  try {
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
  } catch (err) {
    console.error('[Farmacias] POST error:', err.message);
    res.status(500).json({ error: 'No se pudo agregar la farmacia.' });
  }
});

/* ── DELETE /api/farmacias/punto
   Elimina una farmacia de un municipio por índice.
   Body: { sheetRow, municipioNombre, index } ── */
router.delete('/api/farmacias/punto', async (req, res) => {
  try {
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
  } catch (err) {
    console.error('[Farmacias] DELETE error:', err.message);
    res.status(500).json({ error: 'No se pudo eliminar la farmacia.' });
  }
});

export default router;
