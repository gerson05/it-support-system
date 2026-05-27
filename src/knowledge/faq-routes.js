/**
 * API REST para gestionar FAQs personalizadas desde el panel.
 */
import express from 'express';
import db from '../config/database.js';
import { faqs as staticFaqs } from './faq-data.js';

const router = express.Router();

/* ─ GET /api/faqs — Lista todas las FAQs (estáticas + personalizadas) ─ */
router.get('/api/faqs', (req, res) => {
  try {
    const { area } = req.query;

    // FAQs estáticas (read-only)
    const system = (area
      ? staticFaqs.filter(f => f.area === area || f.area === 'general')
      : staticFaqs
    ).map(f => ({ ...f, source: 'system' }));

    // FAQs personalizadas (editables)
    const customQuery = area
      ? `SELECT * FROM custom_faqs WHERE area IN (?,?) ORDER BY id DESC`
      : `SELECT * FROM custom_faqs ORDER BY id DESC`;
    const customRows = area
      ? db.prepare(customQuery).all(area, 'general')
      : db.prepare(customQuery).all();

    const custom = customRows.map(r => ({
      ...r,
      keywords: JSON.parse(r.keywords || '[]'),
      source: 'custom',
    }));

    // Stats de uso (faq_hits)
    const hitsRows = db.prepare(`
      SELECT faq_id, COUNT(*) as total, SUM(resolved) as resolved
      FROM faq_hits GROUP BY faq_id
    `).all();
    const hitsMap = {};
    hitsRows.forEach(h => { hitsMap[h.faq_id] = { total: h.total, resolved: h.resolved || 0 }; });

    const enriched = (items) => items.map(f => ({
      ...f,
      hits:     hitsMap[String(f.id)]?.total    || 0,
      resolved: hitsMap[String(f.id)]?.resolved || 0,
    }));

    res.json({ system: enriched(system), custom: enriched(custom) });
  } catch (err) {
    console.error('Error en GET /api/faqs:', err);
    res.status(500).json({ error: 'Error al obtener FAQs.' });
  }
});

/* ─ POST /api/faqs — Crear FAQ personalizada ─ */
router.post('/api/faqs', (req, res) => {
  try {
    const { area = 'general', title, keywords = [], category = 'general', solution } = req.body;

    if (!title?.trim() || !solution?.trim()) {
      return res.status(400).json({ error: 'Título y solución son requeridos.' });
    }

    const result = db.prepare(`
      INSERT INTO custom_faqs (area, title, keywords, category, solution)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      area.trim(),
      title.trim(),
      JSON.stringify(Array.isArray(keywords) ? keywords : []),
      category.trim(),
      solution.trim(),
    );

    const created = db.prepare('SELECT * FROM custom_faqs WHERE id=?').get(result.lastInsertRowid);
    res.status(201).json({ ...created, keywords: JSON.parse(created.keywords) });
  } catch (err) {
    console.error('Error en POST /api/faqs:', err);
    res.status(500).json({ error: 'Error al crear FAQ.' });
  }
});

/* ─ PUT /api/faqs/:id — Actualizar FAQ personalizada ─ */
router.put('/api/faqs/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { area, title, keywords, category, solution, active } = req.body;

    const existing = db.prepare('SELECT * FROM custom_faqs WHERE id=?').get(id);
    if (!existing) return res.status(404).json({ error: 'FAQ personalizada no encontrada.' });

    db.prepare(`
      UPDATE custom_faqs SET
        area      = ?,
        title     = ?,
        keywords  = ?,
        category  = ?,
        solution  = ?,
        active    = ?,
        updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      (area    ?? existing.area).trim(),
      (title   ?? existing.title).trim(),
      JSON.stringify(Array.isArray(keywords) ? keywords : JSON.parse(existing.keywords || '[]')),
      (category ?? existing.category).trim(),
      (solution ?? existing.solution).trim(),
      active !== undefined ? (active ? 1 : 0) : existing.active,
      id,
    );

    const updated = db.prepare('SELECT * FROM custom_faqs WHERE id=?').get(id);
    res.json({ ...updated, keywords: JSON.parse(updated.keywords) });
  } catch (err) {
    console.error('Error en PUT /api/faqs/:id:', err);
    res.status(500).json({ error: 'Error al actualizar FAQ.' });
  }
});

/* ─ DELETE /api/faqs/:id — Eliminar FAQ personalizada ─ */
router.delete('/api/faqs/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const result = db.prepare('DELETE FROM custom_faqs WHERE id=?').run(id);
    if (result.changes === 0) return res.status(404).json({ error: 'FAQ no encontrada.' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error en DELETE /api/faqs/:id:', err);
    res.status(500).json({ error: 'Error al eliminar FAQ.' });
  }
});

export default router;
