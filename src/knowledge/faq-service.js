/**
 * Servicio unificado de FAQs.
 * Combina las FAQs estáticas (faq-data.js) con las personalizadas almacenadas en la BD.
 */
import { searchFaqs as searchStaticFaqs, getFaqsByArea } from './faq-data.js';

/** Normaliza texto: minúsculas, sin tildes, sin puntuación */
const _norm = str =>
  str.toLowerCase()
     .normalize('NFD').replace(/[̀-ͯ]/g, '')
     .replace(/[¿?¡!.,;:()]/g, ' ')
     .trim();

/**
 * Busca en FAQs estáticas + personalizadas de la BD.
 * Si no hay query, devuelve todas ordenadas por área.
 */
export function searchFaqsAll(db, area, query) {
  // 1. FAQs estáticas (ya scoradas)
  const staticResults = searchStaticFaqs(area, query);

  // 2. FAQs personalizadas desde la BD
  let customResults = [];
  try {
    const rows = db.prepare(
      `SELECT * FROM custom_faqs WHERE area IN (?,?) AND active=1 ORDER BY id DESC`
    ).all(area, 'general');

    if (!query) {
      customResults = rows.map(r => ({
        ...r,
        keywords: _parseKeywords(r.keywords),
        score: 0,
      }));
    } else {
      const cleanQuery = _norm(query);
      const queryWords = cleanQuery.split(/\s+/).filter(w => w.length > 3);

      customResults = rows.map(faq => {
        let score = 0;
        const titleClean  = _norm(faq.title);
        const keywords    = _parseKeywords(faq.keywords);

        if (titleClean.includes(cleanQuery)) score += 15;

        keywords.forEach(kw => {
          const kwClean = _norm(kw);
          if (cleanQuery.includes(kwClean) || kwClean.includes(cleanQuery)) { score += 5; return; }
          queryWords.forEach(w => { if (kwClean.includes(w) || w.includes(kwClean)) score += 2; });
        });

        queryWords.forEach(w => { if (titleClean.includes(w)) score += 3; });

        return { ...faq, keywords, score };
      }).filter(f => f.score > 0);
    }
  } catch (e) {
    // La tabla puede no existir aún en instancias muy antiguas
    console.warn('[FaqService] custom_faqs no disponible:', e.message);
  }

  // 3. Combinar: custom primero (siempre más recientes/relevantes), luego estáticas
  const merged = [...customResults, ...staticResults];
  return merged.sort((a, b) => b.score - a.score);
}

/** Obtiene todas las FAQs de un área (para listar en el panel) */
export function getAllFaqsForArea(db, area) {
  const staticFaqs = getFaqsByArea(area).map(f => ({ ...f, source: 'system' }));
  let customFaqs = [];
  try {
    customFaqs = db.prepare(
      `SELECT * FROM custom_faqs WHERE area=? ORDER BY id DESC`
    ).all(area).map(r => ({
      ...r,
      keywords: _parseKeywords(r.keywords),
      source: 'custom',
    }));
  } catch {}
  return { custom: customFaqs, system: staticFaqs };
}

function _parseKeywords(raw) {
  try { return JSON.parse(raw || '[]'); } catch { return []; }
}
