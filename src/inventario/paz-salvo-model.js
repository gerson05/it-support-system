/**
 * Paz y salvo: qué tiene asignado una persona en el inventario de Sistemas.
 * Busca en computadores (y demás categorías), celulares y UPS por cédula o nombre.
 * Solo consulta: no modifica el inventario.
 */

const TABLAS = {
  inventario_equipos:   { tipo: 'equipos',   nombre: "COALESCE(NULLIF(TRIM(nombre_completo), ''), TRIM(responsable))" },
  inventario_celulares: { tipo: 'celulares', nombre: 'TRIM(nombre_completo)' },
  inventario_ups:       { tipo: 'ups',       nombre: 'TRIM(nombre_completo)' },
};

const CATEGORIA = {
  computadores: 'Computador', impresoras: 'Impresora', escaner: 'Escáner', televisores: 'Televisor',
  monitores: 'Monitor', tablets: 'Tablet', perifericos: 'Periférico',
};

const limpio = (v) => String(v ?? '').trim();
const normCedula = (v) => limpio(v).replace(/[^0-9A-Za-z]/g, '');
const normNombre = (v) => limpio(v).toLowerCase().replace(/\s+/g, ' ');

/** Personas (cédula + nombre) con algo asignado que coincidan con el texto buscado. */
export async function buscarPersonas(db, texto, limite = 20) {
  const q = limpio(texto);
  if (q.length < 3) return [];
  const patron = `%${q.toLowerCase()}%`;
  const personas = new Map();

  for (const [tabla, t] of Object.entries(TABLAS)) {
    const rows = await db.prepare(`
      SELECT ${t.nombre} AS nombre, TRIM(cedula) AS cedula, COUNT(*) AS n
      FROM ${tabla}
      WHERE LOWER(${t.nombre}) LIKE ? OR LOWER(TRIM(cedula)) LIKE ?
      GROUP BY ${t.nombre}, TRIM(cedula)
    `).all(patron, patron);
    for (const r of rows) {
      if (!limpio(r.nombre) && !limpio(r.cedula)) continue;
      const clave = normCedula(r.cedula) || `n:${normNombre(r.nombre)}`;
      const p = personas.get(clave) || { cedula: normCedula(r.cedula), nombre: limpio(r.nombre), elementos: 0 };
      if (!p.nombre && r.nombre) p.nombre = limpio(r.nombre);
      p.elementos += Number(r.n) || 0;
      personas.set(clave, p);
    }
  }
  return [...personas.values()]
    .sort((a, b) => b.elementos - a.elementos || a.nombre.localeCompare(b.nombre))
    .slice(0, limite);
}

/** Convierte una fila de cualquier tabla en un elemento uniforme para pantalla y acta. */
function aElemento(tabla, r) {
  const base = { tabla, id: r.id, placa: limpio(r.placa), area: limpio(r.area), sede: limpio(r.ciudad) };
  if (tabla === 'inventario_celulares') {
    return { ...base, tipo: 'Celular', descripcion: limpio(r.equipo) || limpio(r.modelo) || 'Celular',
      marca: '', modelo: limpio(r.modelo), serial: limpio(r.imei) || limpio(r.serial),
      detalle: limpio(r.numero_telefono || r.linea) ? `Tel. ${limpio(r.numero_telefono || r.linea)}` : '' };
  }
  if (tabla === 'inventario_ups') {
    return { ...base, tipo: 'UPS', descripcion: limpio(r.nombre_equipo) || 'UPS',
      marca: limpio(r.marca), modelo: limpio(r.modelo), serial: limpio(r.serial), detalle: '' };
  }
  return { ...base, tipo: CATEGORIA[r.categoria] || 'Equipo', descripcion: limpio(r.nombre_equipo) || 'Equipo',
    marca: limpio(r.marca), modelo: limpio(r.modelo), serial: limpio(r.serial),
    detalle: limpio(r.serial_cargador) ? `Cargador ${limpio(r.serial_cargador)}` : '' };
}

/**
 * Todo lo asignado a una persona. Con cédula busca por cédula y, además, los registros
 * sin cédula que tengan exactamente el mismo nombre (datos antiguos).
 */
export async function asignadosA(db, { cedula, nombre } = {}) {
  const ced = normCedula(cedula);
  const nom = normNombre(nombre);
  if (!ced && !nom) return [];
  const elementos = [];

  for (const [tabla, t] of Object.entries(TABLAS)) {
    const cond = [], params = [];
    if (ced) { cond.push("REPLACE(REPLACE(TRIM(cedula), '.', ''), ' ', '') = ?"); params.push(ced); }
    if (nom) {
      cond.push(ced
        ? `((cedula IS NULL OR TRIM(cedula) = '') AND LOWER(${t.nombre}) = ?)`
        : `LOWER(${t.nombre}) = ?`);
      params.push(nom);
    }
    const rows = await db.prepare(`SELECT * FROM ${tabla} WHERE ${cond.join(' OR ')} ORDER BY id`).all(...params);
    elementos.push(...rows.map(r => aElemento(tabla, r)));
  }
  return elementos;
}

/** Recupera del inventario los elementos elegidos (no se confía en los datos del navegador). */
export async function elementosPorId(db, seleccion = []) {
  const out = [];
  for (const s of seleccion) {
    if (!TABLAS[s?.tabla]) continue;
    const r = await db.prepare(`SELECT * FROM ${s.tabla} WHERE id = ?`).get(Number(s.id));
    if (r) out.push({ ...aElemento(s.tabla, r), devuelto: s.devuelto !== false, observacion: limpio(s.observacion).slice(0, 300) });
  }
  return out;
}

export const _test = { normCedula, normNombre, aElemento };
