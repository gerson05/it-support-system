import { Router } from 'express';
import db from '../config/database.js';
import { complete, isEnabled, getProviderInfo } from './llm-provider.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';

const router = Router();
const canRead = [requireAuth, requirePermission('tickets:read')];
const canEdit = [requireAuth, requirePermission('despacho:edit')];

/* GET /api/ai/status — estado del proveedor LLM */
router.get('/api/ai/status', requireAuth, (req, res) => {
  res.json(getProviderInfo());
});

/* GET /api/ai/kb — listar todos los items del knowledge base */
router.get('/api/ai/kb', ...canRead, (req, res) => {
  try {
    const { categoria, q } = req.query;
    let sql = 'SELECT * FROM kb_items WHERE activo = 1';
    const params = [];
    if (categoria) { sql += ' AND categoria = ?'; params.push(categoria); }
    if (q) {
      sql += ' AND (titulo LIKE ? OR descripcion LIKE ? OR keywords LIKE ?)';
      const like = `%${q}%`;
      params.push(like, like, like);
    }
    sql += ' ORDER BY categoria, titulo';
    res.json(db.prepare(sql).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* GET /api/ai/kb/search — búsqueda por palabras clave (RAG retrieval) */
router.get('/api/ai/kb/search', ...canRead, (req, res) => {
  try {
    const { q, limit = 5 } = req.query;
    if (!q?.trim()) return res.json([]);

    const terms = q.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    if (!terms.length) return res.json([]);

    const all = db.prepare('SELECT * FROM kb_items WHERE activo = 1').all();

    const scored = all.map(item => {
      const haystack = `${item.titulo} ${item.descripcion} ${item.solucion} ${item.keywords}`.toLowerCase();
      const score = terms.reduce((s, t) => s + (haystack.split(t).length - 1), 0);
      return { ...item, _score: score };
    })
    .filter(i => i._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, parseInt(limit));

    res.json(scored);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* POST /api/ai/kb — crear item */
router.post('/api/ai/kb', ...canEdit, (req, res) => {
  try {
    const { categoria, titulo, descripcion, solucion, comandos = '[]', keywords = '', fuente = 'manual' } = req.body;
    if (!categoria || !titulo || !descripcion || !solucion)
      return res.status(400).json({ error: 'categoria, titulo, descripcion y solucion son requeridos.' });
    const r = db.prepare(`
      INSERT INTO kb_items (categoria,titulo,descripcion,solucion,comandos,keywords,fuente)
      VALUES (?,?,?,?,?,?,?)
    `).run(categoria, titulo, descripcion, solucion,
           typeof comandos === 'string' ? comandos : JSON.stringify(comandos),
           keywords, fuente);
    res.json({ id: r.lastInsertRowid });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* PUT /api/ai/kb/:id — actualizar item */
router.put('/api/ai/kb/:id', ...canEdit, (req, res) => {
  try {
    const { categoria, titulo, descripcion, solucion, comandos, keywords, activo } = req.body;
    const fields = [], params = [];
    if (categoria   !== undefined) { fields.push('categoria=?');   params.push(categoria); }
    if (titulo      !== undefined) { fields.push('titulo=?');      params.push(titulo); }
    if (descripcion !== undefined) { fields.push('descripcion=?'); params.push(descripcion); }
    if (solucion    !== undefined) { fields.push('solucion=?');    params.push(solucion); }
    if (comandos    !== undefined) { fields.push('comandos=?');    params.push(typeof comandos === 'string' ? comandos : JSON.stringify(comandos)); }
    if (keywords    !== undefined) { fields.push('keywords=?');    params.push(keywords); }
    if (activo      !== undefined) { fields.push('activo=?');      params.push(activo ? 1 : 0); }
    if (!fields.length) return res.status(400).json({ error: 'Nada que actualizar.' });
    fields.push("updated_at=datetime('now','localtime')");
    params.push(parseInt(req.params.id));
    db.prepare(`UPDATE kb_items SET ${fields.join(',')} WHERE id=?`).run(...params);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* DELETE /api/ai/kb/:id — desactivar item */
router.delete('/api/ai/kb/:id', ...canEdit, (req, res) => {
  try {
    db.prepare("UPDATE kb_items SET activo=0 WHERE id=?").run(parseInt(req.params.id));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

/* POST /api/ai/analyze — analizar ticket/problema y sugerir solución */
router.post('/api/ai/analyze', ...canRead, async (req, res) => {
  try {
    const { problema, ticket_id, agente_id } = req.body;
    if (!problema?.trim()) return res.status(400).json({ error: 'problema requerido.' });

    // 1. Buscar en knowledge base (siempre disponible sin LLM)
    const terms = problema.toLowerCase().split(/\s+/).filter(t => t.length > 2);
    const all = db.prepare('SELECT * FROM kb_items WHERE activo = 1').all();
    const kbResults = all.map(item => {
      const hay = `${item.titulo} ${item.descripcion} ${item.solucion} ${item.keywords}`.toLowerCase();
      const score = terms.reduce((s, t) => s + (hay.split(t).length - 1), 0);
      return { ...item, _score: score };
    }).filter(i => i._score > 0).sort((a, b) => b._score - a._score).slice(0, 3);

    // 2. Si LLM disponible, enriquecer con análisis
    let aiAnalysis = null;
    if (isEnabled()) {
      const kbContext = kbResults.map(k =>
        `[${k.categoria.toUpperCase()}] ${k.titulo}: ${k.solucion}`
      ).join('\n');

      const system = `Eres un técnico de soporte IT experto. Analiza el problema del usuario y sugiere la mejor solución basándote en el knowledge base disponible. Responde en español, de forma concisa y práctica. Si hay un comando o script aplicable, menciónalo. No inventes soluciones que no estén en el contexto.`;

      const user = `Problema reportado: "${problema}"\n\nSoluciones disponibles en el sistema:\n${kbContext || 'Sin coincidencias en la base de conocimiento.'}\n\nProporciona: 1) Diagnóstico probable, 2) Pasos de solución recomendados, 3) Si alguna solución del knowledge base aplica directamente.`;

      aiAnalysis = await complete(system, user, { maxTokens: 512 }).catch(e => `Error IA: ${e.message}`);
    }

    // 3. Guardar en historial si viene de un ticket
    if (ticket_id) {
      db.prepare(`
        INSERT INTO ai_ticket_analysis (ticket_id, problema, kb_ids, ai_response, created_at)
        VALUES (?,?,?,?,datetime('now','localtime'))
      `).run(ticket_id, problema,
             JSON.stringify(kbResults.map(k => k.id)),
             aiAnalysis || null);
    }

    res.json({ kb: kbResults, ai: aiAnalysis });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
