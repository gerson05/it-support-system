/**
 * Enlaza cada bodega con su comprobante de DISPENSACION. El Excel de Mantis no trae
 * esa relación explícita, así que se deduce en este orden:
 *   1. "numero": el nombre del comprobante empieza con el código de la bodega
 *                ("581 MI FARMACIA PASOANCHO" → bodega 581).
 *   2. "nombre": el nombre (sin el número inicial) es idéntico.
 *   3. "similitud": nombre o centro de costo muy parecidos (≥ 0.85) y sin empate cercano.
 * Lo que no cruce queda sin comprobante para asignarlo a mano desde el panel.
 */
import { norm } from './catalog-parser.js';

const MIN_SCORE  = 0.85;
const MIN_MARGIN = 0.03;
const sinNumero  = (s) => norm(s).replace(/^\d+\s+/, '');

/** Similitud de Dice sobre bigramas (0..1). */
export function similarity(a, b) {
  const x = norm(a).replace(/ /g, ''), y = norm(b).replace(/ /g, '');
  if (!x || !y) return 0;
  if (x === y) return 1;
  const grams = (s) => {
    const m = new Map();
    for (let i = 0; i < s.length - 1; i++) { const g = s.slice(i, i + 2); m.set(g, (m.get(g) || 0) + 1); }
    return m;
  };
  const gx = grams(x), gy = grams(y);
  let inter = 0;
  for (const [g, n] of gx) inter += Math.min(n, gy.get(g) || 0);
  return (2 * inter) / (x.length - 1 + y.length - 1);
}

/**
 * @param {Array<{codigo:number,nombre:string,centro_costo?:string}>} bodegas
 * @param {Array<{codigo:string,nombre:string,fuente?:string,estado?:string}>} comprobantes
 * @returns {Map<number, {comprobante:string, origen:'numero'|'nombre'|'similitud'}>}
 */
export function linkComprobantes(bodegas, comprobantes) {
  // Solo comprobantes de dispensación; los activos tienen prioridad sobre los inactivos
  const disp = comprobantes
    .filter(c => norm(c.fuente) === 'DISPENSACION')
    .sort((a, b) => (norm(a.estado) === 'ACTIVO' ? 0 : 1) - (norm(b.estado) === 'ACTIVO' ? 0 : 1));

  const byNumber = new Map();
  const byName   = new Map();
  for (const c of disp) {
    const m = norm(c.nombre).match(/^(\d+) /);
    if (m && !byNumber.has(+m[1])) byNumber.set(+m[1], c);
    const key = sinNumero(c.nombre);
    if (key && !byName.has(key)) byName.set(key, c);
  }

  const result = new Map();
  for (const b of bodegas) {
    const n = byNumber.get(b.codigo);
    if (n) { result.set(b.codigo, { comprobante: n.codigo, origen: 'numero' }); continue; }

    const e = byName.get(sinNumero(b.nombre));
    if (e) { result.set(b.codigo, { comprobante: e.codigo, origen: 'nombre' }); continue; }

    const keys = [b.nombre, b.centro_costo].filter(Boolean).map(sinNumero);
    let best = null, second = 0;
    for (const c of disp) {
      const cn = sinNumero(c.nombre);
      const score = Math.max(...keys.map(k => similarity(k, cn)));
      if (!best || score > best.score) { second = best ? best.score : 0; best = { c, score }; }
      else if (score > second) second = score;
    }
    if (best && best.score >= MIN_SCORE && best.score - second >= MIN_MARGIN) {
      result.set(b.codigo, { comprobante: best.c.codigo, origen: 'similitud' });
    }
  }
  return result;
}
