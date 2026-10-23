/**
 * Paz y salvo: qué tiene asignado una persona en el inventario de Sistemas.
 * Busca en computadores (y demás categorías), celulares y UPS por cédula o nombre.
 * Solo consulta: no modifica el inventario.
 */

const TABLAS = {
  inventario_equipos:   { tipo: 'equipos',   nombre: "COALESCE(NULLIF(TRIM(nombre_completo), ''), TRIM(responsable))",
    categoria: 'categoria', serial: 'serial' },
  inventario_celulares: { tipo: 'celulares', nombre: 'TRIM(nombre_completo)', categoria: "'celulares'",
    serial: "COALESCE(NULLIF(imei, ''), serial)" },
  inventario_ups:       { tipo: 'ups',       nombre: 'TRIM(nombre_completo)', categoria: "'ups'", serial: 'serial' },
};

const CATEGORIA = {
  computadores: 'Computador', impresoras: 'Impresora', escaner: 'Escáner', televisores: 'Televisor',
  monitores: 'Monitor', tablets: 'Tablet', perifericos: 'Periférico',
};
/** Nombre en singular de cada tipo (para resúmenes y filtros). */
export const TIPOS = { ...CATEGORIA, celulares: 'Celular', ups: 'UPS' };

const limpio = (v) => String(v ?? '').trim();
const normCedula = (v) => limpio(v).replace(/[^0-9A-Za-z]/g, '');
const normNombre = (v) => limpio(v).toLowerCase().replace(/\s+/g, ' ');

/**
 * Todas las personas con algo asignado, agrupadas por cédula (o por nombre si no hay cédula).
 * Filtros: q (nombre, cédula, placa o serial/IMEI de algo que tenga), area (área o sede) y tipo
 * (categoría de equipo, 'celulares' o 'ups').
 */
export async function listarPersonas(db, { q, area, tipo } = {}) {
  const texto = limpio(q).toLowerCase();
  const zona = limpio(area).toLowerCase();
  const filtroTipo = limpio(tipo);
  // celulares / ups son tablas propias; cualquier otro tipo es una categoría de inventario_equipos
  const tablaDelTipo = filtroTipo === 'celulares' || filtroTipo === 'ups' ? filtroTipo : 'equipos';
  const personas = new Map();

  for (const [tabla, t] of Object.entries(TABLAS)) {
    if (filtroTipo && t.tipo !== tablaDelTipo) continue;
    const cond = [`(COALESCE(${t.nombre}, '') <> '' OR COALESCE(TRIM(cedula), '') <> '')`], params = [];
    if (texto) {
      cond.push(`(LOWER(COALESCE(${t.nombre}, '')) LIKE ? OR LOWER(COALESCE(cedula, '')) LIKE ?
        OR LOWER(COALESCE(placa, '')) LIKE ? OR LOWER(COALESCE(${t.serial}, '')) LIKE ?)`);
      params.push(...Array(4).fill(`%${texto}%`));
    }
    if (zona) {
      cond.push("(LOWER(COALESCE(area, '')) LIKE ? OR LOWER(COALESCE(ciudad, '')) LIKE ?)");
      params.push(`%${zona}%`, `%${zona}%`);
    }
    if (filtroTipo && t.tipo === 'equipos') { cond.push('categoria = ?'); params.push(filtroTipo); }

    const rows = await db.prepare(`
      SELECT ${t.nombre} AS nombre, TRIM(cedula) AS cedula, ${t.categoria} AS categoria, area, ciudad
      FROM ${tabla} WHERE ${cond.join(' AND ')}
    `).all(...params);
    for (const r of rows) {
      const clave = normCedula(r.cedula) || `n:${normNombre(r.nombre)}`;
      const p = personas.get(clave) || { cedula: normCedula(r.cedula), nombre: limpio(r.nombre), elementos: 0, resumen: {}, areas: [] };
      if (!p.nombre && r.nombre) p.nombre = limpio(r.nombre);
      p.elementos += 1;
      const etiqueta = TIPOS[r.categoria] || 'Equipo';
      p.resumen[etiqueta] = (p.resumen[etiqueta] || 0) + 1;
      for (const a of [limpio(r.area), limpio(r.ciudad)]) if (a && !p.areas.includes(a)) p.areas.push(a);
      personas.set(clave, p);
    }
  }
  // Registros antiguos sin cédula se suman a la persona con cédula del mismo nombre (si es única),
  // igual que hace asignadosA() al mostrar lo asignado.
  const conCedula = new Map();
  for (const p of personas.values()) {
    if (!p.cedula) continue;
    const n = normNombre(p.nombre);
    conCedula.set(n, conCedula.has(n) ? null : p);
  }
  for (const [clave, p] of personas) {
    const destino = !p.cedula && conCedula.get(normNombre(p.nombre));
    if (!destino) continue;
    destino.elementos += p.elementos;
    for (const [t, n] of Object.entries(p.resumen)) destino.resumen[t] = (destino.resumen[t] || 0) + n;
    for (const a of p.areas) if (!destino.areas.includes(a)) destino.areas.push(a);
    personas.delete(clave);
  }

  return [...personas.values()]
    .sort((a, b) => (a.nombre || '~').localeCompare(b.nombre || '~', 'es') || a.cedula.localeCompare(b.cedula));
}

/** Búsqueda rápida (ventana de paz y salvo): mínimo 3 caracteres, los que más tienen primero. */
export async function buscarPersonas(db, texto, limite = 20) {
  if (limpio(texto).length < 3) return [];
  return (await listarPersonas(db, { q: texto }))
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
