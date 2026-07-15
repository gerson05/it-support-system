import { Router } from 'express';
import db from '../config/database.js';
import { complete, isEnabled, isEmbeddingEnabled, getEmbedding, getProviderInfo } from './llm-provider.js';
import { requireAuth, requirePermission } from '../auth/auth-middleware.js';
import { wrap } from '../utils/async-handler.js';

const router = Router();
const canRead = [requireAuth, requirePermission('tickets:read')];
const canEdit = [requireAuth, requirePermission('despacho:edit')];

// ── Helpers ───────────────────────────────────────────────────────────────────

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na  += a[i] * a[i];
    nb  += b[i] * b[i];
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

function keywordScore(item, terms) {
  const hay = `${item.titulo} ${item.descripcion} ${item.solucion} ${item.keywords}`.toLowerCase();
  return terms.reduce((s, t) => s + (hay.split(t).length - 1), 0);
}

function embeddingText(item) {
  return `${item.titulo} ${item.descripcion} ${item.solucion} ${item.keywords}`;
}

async function semanticSearch(query, limit = 5) {
  const queryVec = await getEmbedding(query);
  const items = db.prepare('SELECT * FROM kb_items WHERE activo = 1 AND embedding IS NOT NULL').all();
  return items
    .map(item => ({ ...item, _score: cosineSim(queryVec, JSON.parse(item.embedding)) }))
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);
}

function keywordSearch(query, limit = 5) {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  if (!terms.length) return [];
  const all = db.prepare('SELECT * FROM kb_items WHERE activo = 1').all();
  return all
    .map(item => ({ ...item, _score: keywordScore(item, terms) }))
    .filter(i => i._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, limit);
}

async function hybridSearch(query, limit = 5) {
  if (isEmbeddingEnabled()) {
    try {
      const results = await semanticSearch(query, limit);
      if (results.length > 0) return results;
    } catch (e) {
      console.warn('[AI] Semantic search failed, fallback to keyword:', e.message);
    }
  }
  return keywordSearch(query, limit);
}

function storeEmbeddingAsync(id, text) {
  if (!isEmbeddingEnabled()) return;
  setImmediate(async () => {
    try {
      const vec = await getEmbedding(text);
      db.prepare('UPDATE kb_items SET embedding=? WHERE id=?').run(JSON.stringify(vec), id);
    } catch (e) {
      console.warn(`[AI] Embedding gen failed for kb_item ${id}:`, e.message);
    }
  });
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.get('/api/ai/status', requireAuth, (req, res) => {
  res.json(getProviderInfo());
});

router.get('/api/ai/kb', ...canRead, wrap(async (req, res) => {
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
}));

router.get('/api/ai/kb/search', ...canRead, wrap(async (req, res) => {
  const { q, limit = 5 } = req.query;
  if (!q?.trim()) return res.json([]);
  const results = await hybridSearch(q.trim(), parseInt(limit));
  res.json(results);
}));

router.post('/api/ai/kb', ...canEdit, wrap(async (req, res) => {
  const { categoria, titulo, descripcion, solucion, comandos = '[]', keywords = '', fuente = 'manual' } = req.body;
  if (!categoria || !titulo || !descripcion || !solucion)
    return res.status(400).json({ error: 'categoria, titulo, descripcion y solucion son requeridos.' });
  const r = db.prepare(`
    INSERT INTO kb_items (categoria,titulo,descripcion,solucion,comandos,keywords,fuente)
    VALUES (?,?,?,?,?,?,?)
  `).run(categoria, titulo, descripcion, solucion,
         typeof comandos === 'string' ? comandos : JSON.stringify(comandos),
         keywords, fuente);
  storeEmbeddingAsync(r.lastInsertRowid, `${titulo} ${descripcion} ${solucion} ${keywords}`);
  res.json({ id: r.lastInsertRowid });
}));

router.put('/api/ai/kb/:id', ...canEdit, wrap(async (req, res) => {
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

  const updated = db.prepare('SELECT * FROM kb_items WHERE id=?').get(parseInt(req.params.id));
  if (updated) storeEmbeddingAsync(updated.id, embeddingText(updated));

  res.json({ ok: true });
}));

router.delete('/api/ai/kb/:id', ...canEdit, wrap(async (req, res) => {
  db.prepare('UPDATE kb_items SET activo=0 WHERE id=?').run(parseInt(req.params.id));
  res.json({ ok: true });
}));

router.post('/api/ai/kb/reindex', ...canEdit, wrap(async (req, res) => {
  if (!isEmbeddingEnabled()) {
    return res.status(400).json({ error: 'Embeddings no disponibles. Configura LLM_PROVIDER=ollama en .env' });
  }
  const items = db.prepare('SELECT * FROM kb_items WHERE activo = 1').all();
  const upd   = db.prepare('UPDATE kb_items SET embedding=? WHERE id=?');
  let ok = 0, failed = 0;
  for (const item of items) {
    try {
      const vec = await getEmbedding(embeddingText(item));
      upd.run(JSON.stringify(vec), item.id);
      ok++;
    } catch (e) {
      console.warn(`[AI] Reindex failed for item ${item.id}:`, e.message);
      failed++;
    }
  }
  res.json({ ok, failed, total: items.length });
}));

router.post('/api/ai/analyze', ...canRead, wrap(async (req, res) => {
  const { problema, ticket_id } = req.body;
  if (!problema?.trim()) return res.status(400).json({ error: 'problema requerido.' });

  const kbResults = await hybridSearch(problema.trim(), 3);

  let aiAnalysis = null;
  if (isEnabled()) {
    const kbContext = kbResults.map(k =>
      `[${k.categoria.toUpperCase()}] ${k.titulo}: ${k.solucion}`
    ).join('\n');

    const system = `Eres un técnico de soporte IT experto. Analiza el problema del usuario y sugiere la mejor solución basándote en el knowledge base disponible. Responde en español, de forma concisa y práctica. Si hay un comando o script aplicable, menciónalo. No inventes soluciones que no estén en el contexto.`;
    const user   = `Problema reportado: "${problema}"\n\nSoluciones disponibles en el sistema:\n${kbContext || 'Sin coincidencias en la base de conocimiento.'}\n\nProporciona: 1) Diagnóstico probable, 2) Pasos de solución recomendados, 3) Si alguna solución del knowledge base aplica directamente.`;

    aiAnalysis = await complete(system, user, { maxTokens: 512 }).catch(e => `Error IA: ${e.message}`);
  }

  if (ticket_id) {
    db.prepare(`
      INSERT INTO ai_ticket_analysis (ticket_id, problema, kb_ids, ai_response, created_at)
      VALUES (?,?,?,?,datetime('now','localtime'))
    `).run(ticket_id, problema, JSON.stringify(kbResults.map(k => k.id)), aiAnalysis || null);
  }

  res.json({ kb: kbResults, ai: aiAnalysis });
}));

export default router;
