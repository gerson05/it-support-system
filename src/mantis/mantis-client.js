/**
 * Conexión con Mantis para crear usuarios. Hoy no hay acceso a su API, así que el
 * envío queda deshabilitado y el panel muestra la ficha para copiar los datos a mano.
 *
 * Cuando habiliten la API: configurar MANTIS_API_URL (+ MANTIS_API_TOKEN) e implementar
 * createUser() con el contrato real. El resto del flujo (formulario, estados, botón
 * "Enviar a Mantis") ya usa esta interfaz.
 */

/** Datos que pide Mantis para crear un usuario. */
export function buildMantisPayload(emp) {
  return {
    usuario:         emp.usuario,
    identificacion:  emp.cedula,
    nombre:          emp.nombre_completo,
    codigo_perfil:   emp.perfil_codigo,
    clave:           emp.contraseña,
    bodega:          emp.bodega_codigo,
    comprobante:     emp.comprobante,
  };
}

export function isMantisConfigured() {
  return Boolean(process.env.MANTIS_API_URL);
}

export async function createUser(payload) {
  if (!isMantisConfigured()) {
    throw Object.assign(
      new Error('La integración con Mantis aún no está configurada. Crea el usuario en Mantis con la ficha y márcalo como creado.'),
      { code: 'MANTIS_NOT_CONFIGURED' },
    );
  }
  // TODO(mantis-api): reemplazar por la llamada real cuando se tenga la documentación de la API.
  throw Object.assign(new Error('Cliente de Mantis no implementado.'), { code: 'MANTIS_NOT_IMPLEMENTED', payload });
}
