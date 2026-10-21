// Campos que antes se pedían dos veces en el formulario y ahora son uno solo.
// Se guardan en ambas columnas para no romper exportaciones, búsquedas e importaciones.

const limpio = (v) => (v === undefined || v === null ? '' : String(v).trim());

/** Computadores: "Responsable" y "Nombre completo del destinatario" son el mismo dato. */
export function destinatarioDe(body = {}) {
  return limpio(body.nombre_completo) || limpio(body.responsable) || null;
}

/** Celulares: "Línea" y "Número de teléfono" son el mismo dato. */
export function telefonoDe(body = {}) {
  return limpio(body.numero_telefono) || limpio(body.linea) || null;
}
