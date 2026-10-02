/**
 * Lectura de los Excel que exporta Mantis (perfiles, bodegas, comprobantes).
 * Acepta .xls (BIFF), .xlsx y exportaciones HTML con extensión .xls: SheetJS
 * detecta el formato por el contenido, no por la extensión.
 */
import * as XLSX from 'xlsx';

/** Texto en mayúsculas, sin tildes ni Ñ, con espacios simples. */
export function norm(s) {
  return String(s ?? '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim();
}

/** Filas de la primera hoja como arreglos de celdas. */
export function readSheetRows(buffer) {
  // raw: no interpretar textos (SheetJS lee "01/02/2019" como fecha de EE. UU. → 2 de enero);
  // las fechas en texto se interpretan después como día/mes/año.
  // .xlsx empieza con "PK" (zip) y .xls con D0 CF 11 E0 (OLE); lo demás es texto (CSV/HTML) y se decodifica como UTF-8
  const binario = buffer.length > 4 && (buffer.readUInt16BE(0) === 0x504b || buffer.readUInt32BE(0) === 0xd0cf11e0);
  const wb = binario
    ? XLSX.read(buffer, { type: 'buffer', raw: true })
    : XLSX.read(buffer.toString('utf-8').replace(/^﻿/, ''), { type: 'string', raw: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, blankrows: false, defval: '' });
}

/**
 * Ubica la fila de encabezados que contiene todas las columnas requeridas
 * (los exports de Mantis traen un título y filas vacías antes).
 * Devuelve { headerIndex, col: { clave: índice } }.
 */
function locateColumns(rows, required, optional = {}, label) {
  const wanted = { ...required, ...optional };
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const cells = rows[i].map(norm);
    const col = {};
    for (const [key, header] of Object.entries(wanted)) {
      const idx = cells.indexOf(norm(header));
      if (idx >= 0) col[key] = idx;
    }
    if (Object.keys(required).every(k => k in col)) return { headerIndex: i, col };
  }
  const faltan = Object.values(required).join('", "');
  throw Object.assign(
    new Error(`El archivo no parece ser de ${label}: no se encontraron las columnas "${faltan}".`),
    { code: 'BAD_FILE' },
  );
}

const str = (v) => String(v ?? '').trim();
const int = (v) => {
  const n = parseInt(String(v ?? '').trim(), 10);
  return Number.isFinite(n) ? n : null;
};

export function parsePerfiles(rows) {
  const { headerIndex, col } = locateColumns(rows,
    { codigo: 'Código del Perfil', nombre: 'Nombre del Perfil' }, {}, 'perfiles');
  return rows.slice(headerIndex + 1)
    .map(r => ({ codigo: int(r[col.codigo]), nombre: str(r[col.nombre]) }))
    .filter(p => p.codigo !== null && p.nombre);
}

export function parseBodegas(rows) {
  const { headerIndex, col } = locateColumns(rows,
    { codigo: 'Codigo Bodega', nombre: 'Nombre Bodega', estado: 'Estado' },
    { ciudad: 'Ciudad', centro_costo: 'Centro de costo', punto: 'Bodega Punto Dispensación' },
    'bodegas');
  return rows.slice(headerIndex + 1)
    .map(r => ({
      codigo:             int(r[col.codigo]),
      nombre:             str(r[col.nombre]),
      ciudad:             col.ciudad !== undefined ? str(r[col.ciudad]) : '',
      estado:             str(r[col.estado]).toUpperCase(),
      punto_dispensacion: col.punto !== undefined && str(r[col.punto]).toUpperCase() === 'S' ? 1 : 0,
      centro_costo:       col.centro_costo !== undefined ? str(r[col.centro_costo]) : '',
    }))
    .filter(b => b.codigo !== null && b.nombre);
}

export function parseComprobantes(rows) {
  const { headerIndex, col } = locateColumns(rows,
    { codigo: 'Tipo de Comprobante', nombre: 'Comprobante' },
    { fuente: 'Fuente', estado: 'Estado' },
    'comprobantes');
  return rows.slice(headerIndex + 1)
    .map(r => ({
      codigo: str(r[col.codigo]),
      nombre: str(r[col.nombre]),
      fuente: col.fuente !== undefined ? str(r[col.fuente]) : '',
      estado: col.estado !== undefined ? str(r[col.estado]) : '',
    }))
    .filter(c => c.codigo && c.nombre);
}

export const PARSERS = {
  perfiles:     parsePerfiles,
  bodegas:      parseBodegas,
  comprobantes: parseComprobantes,
};
