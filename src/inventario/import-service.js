import os from 'os';

/* ── URL helper ── */
export function getBaseUrl(req) {
  if (process.env.PUBLIC_TUNNEL_URL) return process.env.PUBLIC_TUNNEL_URL;
  const host = req.headers.host || '';
  const isLocal = /^(localhost|127\.|::1)/i.test(host);
  if (isLocal) {
    const port = host.split(':')[1] || '3000';
    for (const addrs of Object.values(os.networkInterfaces())) {
      for (const a of addrs) {
        if (a.family === 'IPv4' && !a.internal) return `${req.protocol}://${a.address}:${port}`;
      }
    }
  }
  return `${req.protocol}://${host}`;
}

/* ── Header normalizer ── */
export function normalizeHeader(h) {
  return String(h ?? '')
    .normalize('NFD')
    .replace(/\p{Mn}/gu, '')              // diacritics
    .replace(/[​-‍ ﻿­]/g, '')  // invisible/non-breaking
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')   // punctuation/symbols → space
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/* ── Column maps ── */
export const EQUIPOS_COLMAP = {
  placa:           ['placa'],
  marca:           ['marca'],
  nombre_equipo:   ['nombre de equipo', 'nombre equipo'],
  serial:          ['serial/emei', 'serial', 's/n', 'serial/imei'],
  procesador:      ['procesador'],
  ram:             ['ram'],
  tipo_ram:        ['tipo de ram', 'tipo ram'],
  cap_disco:       ['capacidad disco', 'cap disco'],
  tipo_disco:      ['tipo de disco', 'tipo disco'],
  serial_cargador: ['serial cargador'],
  area:            ['area'],
  responsable:     ['responsable'],
  fecha_compra:    ['fecha de compra', 'fecha compra'],
};

export const UPS_COLMAP = {
  placa:          ['placa'],
  marca:          ['marca'],
  nombre_equipo:  ['nombre de equipo', 'nombre equipo'],
  serial:         ['serial', 's/n', 'serial/emei'],
  area:           ['area'],
  voltaje:        ['voltaje'],
  fecha_compra:   ['fecha de compra', 'fecha compra'],
  fecha_despacho: ['fecha de despacho', 'fecha despacho', 'despacho'],
};

export const CELULARES_COLMAP = {
  fecha_registro:  ['fecha'],
  area:            ['area'],
  ciudad:          ['ciudad'],
  nombre_completo: ['nombre completo'],
  cedula:          ['cedula'],
  linea:           ['linea'],
  operador:        ['operador'],
  equipo:          ['equipo'],
  almacenamiento:  ['alm', 'almacenamiento'],
  ram:             ['ram'],
  modelo:          ['modelo'],
  imei:            ['imei'],
  imei2:           ['imei 2', 'imei2'],
  estado:          ['estado'],
  accesorio:       ['accesorio'],
  fecha_entrega:   ['fecha de entrega'],
  entregado_por:   ['entregado por'],
};

/* ── Mapping builder ── */
export function buildMapping(headers, colmap) {
  const mapping = {};
  for (const h of headers) {
    const norm = normalizeHeader(h);
    let matched = null;
    for (const [field, aliases] of Object.entries(colmap)) {
      if (aliases.includes(norm)) { matched = field; break; }
    }
    mapping[h] = matched;
  }
  return mapping;
}

/* ── Cell value extractor ── */
export function cellText(raw) {
  if (raw === null || raw === undefined) return '';
  if (raw instanceof Date) return raw.toISOString().slice(0, 10);
  if (typeof raw === 'object' && 'result' in raw) return String(raw.result ?? '').trim();
  if (typeof raw === 'object' && 'text'   in raw) return String(raw.text   ?? '').trim();
  return String(raw).trim();
}
