/**
 * Registra requerimientos, incidencias y despachos en Google Sheets.
 * Usa el mismo patrón que farmacias: Apps Script como proxy HTTP.
 *
 * Variables de entorno requeridas:
 *   REGISTROS_SCRIPT_URL  — URL del Apps Script desplegado como Web App
 *   REGISTROS_SHEET_URL   — URL pública del Google Sheet (para abrir en el botón)
 */

const SCRIPT_URL = process.env.REGISTROS_SCRIPT_URL;
const TIMESTAMP_TZ = 'America/Bogota';

function timestamp() {
  return new Date().toLocaleString('es-CO', {
    timeZone:  TIMESTAMP_TZ,
    year:      'numeric', month:  '2-digit', day:    '2-digit',
    hour:      '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

/** Envía payload al Apps Script, siguiendo redirect si lo hay (igual que farmacias). */
async function postToScript(payload) {
  if (!SCRIPT_URL) {
    console.warn('[sheets-logger] REGISTROS_SCRIPT_URL no configurado — se omite Google Sheets.');
    return;
  }

  const body = JSON.stringify(payload);
  const first = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    redirect: 'manual',
  });

  if (first.status === 301 || first.status === 302) {
    const location = first.headers.get('location');
    await fetch(location, { method: 'GET' });
  }
}

/* ── API pública ──────────────────────────────────────────────────────── */

export async function logTechRequestSheet(data) {
  const {
    tipo, numero, requester_name, cedula, cargo, sede,
    description, priority,
    equipment_name, equipment_serial,
    items = [],
  } = data;

  let equipoStr = '';
  if (equipment_name)
    equipoStr = equipment_serial ? `${equipment_name} | S/N: ${equipment_serial}` : equipment_name;

  let descStr = description || '';
  if (tipo === 'REQUERIMIENTO' && items.length > 0) {
    const resumen = items
      .map(i => `${i.equipment_name} (×${i.quantity}${i.serial ? `, S/N:${i.serial}` : ''})`)
      .join(' · ');
    descStr += descStr ? ` — ${resumen}` : resumen;
  }

  await postToScript({
    fecha:         timestamp(),
    tipo:          tipo.toUpperCase(),
    numero,
    solicitante:   requester_name || '',
    cedula:        cedula         || '',
    cargo:         cargo          || '',
    sede:          sede           || '',
    area:          '',
    descripcion:   descStr,
    prioridad:     priority       || '',
    estado:        'pendiente',
    ultima_act:    timestamp(),
    equipo:        equipoStr,
    requiere_acta: '',
    nro_acta:      '',
    agente:        '',
    observaciones: '',
  });
}

export async function logDespachoSheet(data) {
  const {
    numero, destinatario, sede, area,
    articulos, observaciones,
    requiere_acta, acta_numero, agente,
  } = data;

  let articulosStr = '';
  try {
    const arts = Array.isArray(articulos) ? articulos : JSON.parse(articulos || '[]');
    articulosStr = arts
      .filter(a => a.nombre)
      .map(a => {
        const extra = [];
        if (a.marca) extra.push(`Marca: ${a.marca}`);
        if (a.modelo) extra.push(`Mod: ${a.modelo}`);
        if (a.serial) extra.push(`S/N: ${a.serial}`);
        if (a.descripcion) extra.push(a.descripcion);
        const extraStr = extra.length > 0 ? `, ${extra.join(', ')}` : '';
        return `${a.nombre} (×${a.cantidad || 1}${extraStr})`;
      })
      .join(' · ');
  } catch {
    articulosStr = String(articulos || '');
  }

  await postToScript({
    fecha:         timestamp(),
    tipo:          'DESPACHO',
    numero,
    solicitante:   destinatario   || '',
    cedula:        '',
    cargo:         '',
    sede:          sede           || '',
    area:          area           || '',
    descripcion:   articulosStr,
    prioridad:     '',
    estado:        '',
    ultima_act:    '',
    equipo:        '',
    requiere_acta: requiere_acta  ? 'Sí' : 'No',
    nro_acta:      acta_numero    || '',
    agente:        agente         || '',
    observaciones: observaciones  || '',
  });
}

export async function updateTechRequestSheet(request_number, newStatus) {
  await postToScript({
    action:     'update',
    numero:     request_number,
    estado:     newStatus,
    ultima_act: timestamp(),
  });
}
