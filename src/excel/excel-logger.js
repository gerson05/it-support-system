/**
 * Registra requerimientos, incidencias y despachos en un Excel compartido.
 * Archivo: exports/registros-IT.xlsx
 */
import ExcelJS from 'exceljs';
import path    from 'path';
import { existsSync, mkdirSync } from 'fs';

const FILE_PATH  = path.join(process.cwd(), 'exports', 'registros-IT.xlsx');
const SHEET_NAME = 'Registros IT';

/* ── Columnas ─────────────────────────────────────────────────────────── */
const COLS = [
  { header: 'Fecha / Hora',              key: 'fecha',         width: 22 },
  { header: 'Tipo',                       key: 'tipo',          width: 16 },
  { header: 'Número',                     key: 'numero',        width: 24 },
  { header: 'Solicitante / Destinatario', key: 'solicitante',   width: 30 },
  { header: 'Cédula',                     key: 'cedula',        width: 16 },
  { header: 'Cargo',                      key: 'cargo',         width: 24 },
  { header: 'Sede / Punto',              key: 'sede',          width: 24 },
  { header: 'Área',                       key: 'area',          width: 18 },
  { header: 'Descripción / Artículos',   key: 'descripcion',   width: 50 },
  { header: 'Prioridad',                  key: 'prioridad',     width: 13 },
  { header: 'Estado',                     key: 'estado',        width: 16 },
  { header: 'Última Actualización',      key: 'ultima_act',    width: 22 },
  { header: 'Equipo / Serial',           key: 'equipo',        width: 28 },
  { header: 'Requiere Acta',             key: 'requiere_acta', width: 15 },
  { header: 'Nro. Acta',                 key: 'nro_acta',      width: 20 },
  { header: 'Agente',                     key: 'agente',        width: 22 },
  { header: 'Observaciones',             key: 'observaciones', width: 40 },
];

/* Color de celda Tipo según valor */
const TIPO_STYLE = {
  REQUERIMIENTO: { bg: 'FF3B82F6', font: 'FFFFFFFF' },
  INCIDENCIA:    { bg: 'FFF97316', font: 'FFFFFFFF' },
  DESPACHO:      { bg: 'FF10B981', font: 'FFFFFFFF' },
};

/* Color de celda Estado según valor */
const ESTADO_STYLE = {
  pendiente:    { bg: 'FF64748B', font: 'FFFFFFFF' },
  en_proceso:   { bg: 'FF3B82F6', font: 'FFFFFFFF' },
  completado:   { bg: 'FF10B981', font: 'FFFFFFFF' },
  cancelado:    { bg: 'FFEF4444', font: 'FFFFFFFF' },
  en_espera:    { bg: 'FF8B5CF6', font: 'FFFFFFFF' },
};

/* ── Helpers ──────────────────────────────────────────────────────────── */
function setupSheet(ws) {
  ws.columns = COLS;

  const hdr = ws.getRow(1);
  hdr.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  hdr.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } };
  hdr.alignment = { vertical: 'middle', horizontal: 'center' };
  hdr.height    = 22;
  hdr.commit();

  ws.views = [{ state: 'frozen', ySplit: 1 }];
}

function styleRow(row, tipo) {
  const s = TIPO_STYLE[tipo] ?? { bg: 'FFE2E8F0', font: 'FF0F172A' };

  row.eachCell({ includeEmpty: true }, cell => {
    cell.border = {
      top:    { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left:   { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right:  { style: 'thin', color: { argb: 'FFE2E8F0' } },
    };
    cell.alignment = { vertical: 'middle', wrapText: false };
  });

  const tipoCell = row.getCell('tipo');
  tipoCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.bg } };
  tipoCell.font      = { bold: true, color: { argb: s.font }, size: 10 };
  tipoCell.alignment = { horizontal: 'center', vertical: 'middle' };

  row.height = 18;
  row.commit();
}

function timestamp() {
  return new Date().toLocaleString('es-CO', {
    timeZone:  'America/Bogota',
    year:      'numeric', month:  '2-digit', day:    '2-digit',
    hour:      '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  });
}

/**
 * Actualiza Estado y Última Actualización en la fila del request_number dado.
 * @param {string} request_number  Ej: RQ-20250604-001
 * @param {string} newStatus       Ej: 'completado'
 */
export async function updateTechRequestRow(request_number, newStatus) {
  if (!existsSync(FILE_PATH)) return;

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(FILE_PATH);
  const ws = wb.getWorksheet(SHEET_NAME);
  if (!ws) return;

  /* Mapear nombre de columna → índice leyendo la fila de encabezados */
  const colMap = {};
  ws.getRow(1).eachCell((cell, col) => { colMap[cell.value] = col; });

  const numeroCol   = colMap['Número'];
  const estadoCol   = colMap['Estado'];
  const ultimaCol   = colMap['Última Actualización'];
  if (!numeroCol || !estadoCol) return;

  /* Buscar la fila con el número de solicitud */
  let found = false;
  ws.eachRow((row, rowNum) => {
    if (rowNum === 1 || found) return;
    if (row.getCell(numeroCol).value === request_number) {
      found = true;

      const estadoCell = row.getCell(estadoCol);
      estadoCell.value = newStatus;
      const s = ESTADO_STYLE[newStatus] ?? { bg: 'FFE2E8F0', font: 'FF0F172A' };
      estadoCell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: s.bg } };
      estadoCell.font      = { bold: true, color: { argb: s.font }, size: 10 };
      estadoCell.alignment = { horizontal: 'center', vertical: 'middle' };

      if (ultimaCol) row.getCell(ultimaCol).value = timestamp();

      row.commit();
    }
  });

  if (found) await wb.xlsx.writeFile(FILE_PATH);
}

async function appendRow(rowData) {
  const dir = path.dirname(FILE_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const wb = new ExcelJS.Workbook();
  let ws;

  if (existsSync(FILE_PATH)) {
    await wb.xlsx.readFile(FILE_PATH);
    ws = wb.getWorksheet(SHEET_NAME);
    if (!ws) { ws = wb.addWorksheet(SHEET_NAME); setupSheet(ws); }
  } else {
    ws = wb.addWorksheet(SHEET_NAME);
    setupSheet(ws);
  }

  const row = ws.addRow(rowData);
  styleRow(row, rowData.tipo);
  await wb.xlsx.writeFile(FILE_PATH);
}

/* ── API pública ──────────────────────────────────────────────────────── */

/**
 * Registra un requerimiento o incidencia.
 * @param {object} data  Campos del tech-request (tipo, numero, requester_name, …)
 */
export async function logTechRequest(data) {
  const {
    tipo, numero, requester_name, cedula, cargo, sede,
    description, priority,
    equipment_name, equipment_serial,
    items = [],
  } = data;

  let equipoStr = '';
  if (equipment_name) {
    equipoStr = equipment_serial
      ? `${equipment_name} | S/N: ${equipment_serial}`
      : equipment_name;
  }

  let descStr = description || '';
  if (tipo === 'REQUERIMIENTO' && items.length > 0) {
    const resumen = items
      .map(i => `${i.equipment_name} (×${i.quantity}${i.serial ? `, S/N:${i.serial}` : ''})`)
      .join(' · ');
    descStr += descStr ? ` — ${resumen}` : resumen;
  }

  await appendRow({
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

/**
 * Registra un despacho / traslado.
 * @param {object} data  Campos del despacho (numero, destinatario, articulos, …)
 */
export async function logDespacho(data) {
  const {
    numero, destinatario, sede, area,
    articulos, observaciones,
    requiere_acta, acta_numero, agente,
  } = data;

  let articulosStr = '';
  try {
    const arts = Array.isArray(articulos)
      ? articulos
      : JSON.parse(articulos || '[]');
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

  await appendRow({
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
    equipo:        '',
    requiere_acta: requiere_acta  ? 'Sí' : 'No',
    nro_acta:      acta_numero    || '',
    agente:        agente         || '',
    observaciones: observaciones  || '',
  });
}
