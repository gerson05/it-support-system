import express from 'express';
import path from 'path';
import fs from 'fs';
import QRCode from 'qrcode';
import { fileURLToPath } from 'url';
import db from '../config/database.js';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadLogo() {
  const candidates = [
    path.resolve(__dirname, '../../uploads/rotulo-imgs/unique_0_id10.png'),
    path.resolve(__dirname, '../tech-requests/assets/logo-medivalle.png'),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return 'data:image/png;base64,' + fs.readFileSync(p).toString('base64');
  }
  return null;
}
const LOGO_B64 = loadLogo();

function findByToken(token) {
  const lookups = [
    { tabla: 'inventario_equipos',   tipo: 'Equipo',   idField: 'placa',       nameField: 'nombre_equipo' },
    { tabla: 'inventario_celulares', tipo: 'Celular',  idField: 'imei',        nameField: 'equipo'        },
    { tabla: 'inventario_ups',       tipo: 'UPS',      idField: 'placa',       nameField: 'nombre_equipo' },
  ];
  for (const meta of lookups) {
    const row = db.prepare(`SELECT * FROM ${meta.tabla} WHERE qr_token=?`).get(token);
    if (row) return { ...row, _meta: meta };
  }
  return null;
}

function getBaseUrl(req) {
  return process.env.PUBLIC_TUNNEL_URL || `${req.protocol}://${req.headers.host}`;
}

function esc(v) { return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function fieldRow(label, value) {
  if (!value || value === '—') return '';
  return `<div class="field"><span class="fl">${label}</span><span class="fv">${esc(value)}</span></div>`;
}

function section(title, rows) {
  const content = rows.filter(Boolean).join('');
  if (!content) return '';
  return `<div class="section-hdr">${title}</div>${content}`;
}

/* ── Página pública de detalle ───────────────────────────────────────── */
router.get('/activo/:token', (req, res) => {
  const item = findByToken(req.params.token);
  if (!item) {
    return res.status(404).send(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>No encontrado</title>
    <style>body{font-family:sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;background:#f1f5f9}
    .box{background:#fff;padding:40px;border-radius:16px;text-align:center;color:#64748b}</style></head>
    <body><div class="box"><h2>Equipo no encontrado</h2><p>El código QR no corresponde a ningún activo registrado.</p></div></body></html>`);
  }

  const { _meta } = item;
  const placa = item[_meta.idField] || '—';

  // Secciones por tipo
  let sections = '';
  if (_meta.tabla === 'inventario_equipos') {
    sections =
      section('Identificación', [
        fieldRow('Placa', item.placa),
        fieldRow('Serial', item.serial),
        fieldRow('Serial cargador', item.serial_cargador),
      ]) +
      section('Equipo', [
        fieldRow('Nombre', item.nombre_equipo),
        fieldRow('Marca', item.marca),
        fieldRow('Procesador', item.procesador),
        fieldRow('RAM', item.ram ? `${item.ram}${item.tipo_ram ? ' ' + item.tipo_ram : ''}` : null),
        fieldRow('Disco', item.cap_disco ? `${item.cap_disco}${item.tipo_disco ? ' ' + item.tipo_disco : ''}` : null),
        fieldRow('Fecha de compra', item.fecha_compra),
      ]) +
      section('Asignación', [
        fieldRow('Área', item.area),
        fieldRow('Responsable', item.responsable),
      ]);
  } else if (_meta.tabla === 'inventario_celulares') {
    sections =
      section('Identificación', [
        fieldRow('IMEI', item.imei),
        fieldRow('IMEI 2', item.imei2),
        fieldRow('Línea', item.linea),
        fieldRow('Operador', item.operador),
      ]) +
      section('Equipo', [
        fieldRow('Modelo', item.modelo),
        fieldRow('Equipo', item.equipo),
        fieldRow('Almacenamiento', item.almacenamiento),
        fieldRow('RAM', item.ram),
        fieldRow('Accesorio', item.accesorio),
        fieldRow('Estado', item.estado),
      ]) +
      section('Asignación', [
        fieldRow('Usuario', item.nombre_completo),
        fieldRow('Cédula', item.cedula),
        fieldRow('Área', item.area),
        fieldRow('Ciudad', item.ciudad),
        fieldRow('Entregado por', item.entregado_por),
        fieldRow('Fecha entrega', item.fecha_entrega),
      ]);
  } else {
    sections =
      section('Identificación', [
        fieldRow('Placa', item.placa),
        fieldRow('Serial', item.serial),
      ]) +
      section('Equipo', [
        fieldRow('Nombre', item.nombre_equipo),
        fieldRow('Marca', item.marca),
        fieldRow('Voltaje', item.voltaje),
        fieldRow('Fecha de compra', item.fecha_compra),
        fieldRow('Fecha despacho', item.fecha_despacho),
      ]) +
      section('Asignación', [
        fieldRow('Área', item.area),
      ]);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Activo ${esc(placa)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f1f5f9;min-height:100vh;display:flex;align-items:flex-start;justify-content:center;padding:20px}
.card{background:#fff;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,.1);max-width:440px;width:100%;overflow:hidden;margin:auto}
.hdr{background:#1e3a5f;padding:20px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px}
.hdr-logo img{max-height:40px;max-width:130px;object-fit:contain;filter:brightness(0) invert(1)}
.hdr-brand{color:#fff;font-size:15px;font-weight:700;letter-spacing:.5px}
.hdr-right{text-align:right}
.hdr-tipo{display:inline-block;padding:2px 10px;border-radius:99px;background:rgba(255,255,255,.2);color:#fff;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px}
.placa-bar{background:#f0f4f8;border-bottom:1px solid #e2e8f0;padding:14px 24px;text-align:center}
.placa{font-size:22px;font-weight:800;color:#1e3a5f;letter-spacing:2px;word-break:break-all;font-family:monospace}
.placa-sub{font-size:11px;color:#94a3b8;margin-top:3px;text-transform:uppercase;letter-spacing:.5px}
.body{padding:0 0 8px}
.section-hdr{padding:10px 24px 4px;font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.8px;background:#f8fafc;border-top:1px solid #f1f5f9;border-bottom:1px solid #f1f5f9;margin-top:4px}
.field{display:flex;justify-content:space-between;align-items:baseline;padding:9px 24px;border-bottom:1px solid #f8fafc}
.fl{font-size:12px;font-weight:500;color:#64748b;flex-shrink:0;margin-right:12px}
.fv{font-size:13px;font-weight:600;color:#1e293b;text-align:right;word-break:break-word}
.footer{padding:12px 24px;text-align:center;font-size:11px;color:#94a3b8;border-top:1px solid #f1f5f9}
</style>
</head>
<body>
<div class="card">
  <div class="hdr">
    <div class="hdr-logo">
      ${LOGO_B64 ? `<img src="${LOGO_B64}" alt="MedivalleSF">` : '<div class="hdr-brand">MedivalleSF S.A.S</div>'}
    </div>
    <div class="hdr-right">
      <div class="hdr-tipo">${esc(_meta.tipo)}</div>
    </div>
  </div>
  <div class="placa-bar">
    <div class="placa">${esc(placa)}</div>
    <div class="placa-sub">Activo fijo · ${esc(_meta.tipo)}</div>
  </div>
  <div class="body">${sections}</div>
  <div class="footer">MedivalleSF S.A.S · Información de activo fijo</div>
</div>
</body>
</html>`);
});

/* ── QR PNG (para mostrar en modal de detalle) ───────────────────────── */
router.get('/activo/:token/qr', async (req, res) => {
  const item = findByToken(req.params.token);
  if (!item) return res.status(404).end();
  const url = `${getBaseUrl(req)}/activo/${req.params.token}`;
  const png = await QRCode.toBuffer(url, { type: 'png', width: 300, margin: 2 });
  res.setHeader('Content-Type', 'image/png');
  res.send(png);
});

/* ── API JSON para modal de detalle en panel ─────────────────────────── */
router.get('/api/inventario/activo/:token', (req, res) => {
  const item = findByToken(req.params.token);
  if (!item) return res.status(404).json({ error: 'No encontrado' });
  res.json(item);
});

/* ── Etiqueta imprimible 50×25mm ─────────────────────────────────────── */
router.get('/activo/:token/etiqueta', async (req, res) => {
  const item = findByToken(req.params.token);
  if (!item) return res.status(404).send('<h2>No encontrado</h2>');

  const { _meta } = item;
  const identifier = item.placa || item.imei || item[_meta.idField] || '—';
  const placa      = item[_meta.placaField] || identifier;

  const qrUrl  = `${getBaseUrl(req)}/activo/${req.params.token}`;
  const qrB64  = await QRCode.toDataURL(qrUrl, { width: 220, margin: 1 });
  const fsz    = identifier.length > 14 ? '4.5pt' : identifier.length > 10 ? '5.5pt' : '7pt';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Etiqueta ${placa}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
@page{size:50mm 25mm;margin:0}
html,body{width:50mm;height:25mm;background:#fff;overflow:hidden}
.label{width:50mm;height:25mm;display:flex;border:0.3mm solid #1e3a5f;font-family:Arial,sans-serif}
.qr-half{width:25mm;height:25mm;display:flex;align-items:center;justify-content:center;padding:1mm;flex-shrink:0;border-right:0.3mm solid #1e3a5f}
.qr-half img{width:23mm;height:23mm}
.info-half{width:25mm;height:25mm;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:1.5mm 1mm}
.logo-wrap{flex:1;display:flex;align-items:center;justify-content:center;width:100%}
.logo-wrap img{max-width:22mm;max-height:10mm;object-fit:contain}
.logo-text{font-size:5pt;font-weight:700;color:#1e3a5f;text-align:center;line-height:1.3}
.divider{width:80%;height:0.3mm;background:#1e3a5f;flex-shrink:0}
.serial-wrap{flex:1;display:flex;align-items:center;justify-content:center;width:100%}
.serial{font-size:${fsz};font-weight:800;color:#1e3a5f;text-align:center;word-break:break-all;line-height:1.2}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
</style>
</head>
<body>
<div class="label">
  <div class="qr-half">
    <img src="${qrB64}" alt="QR">
  </div>
  <div class="info-half">
    <div class="logo-wrap">
      ${LOGO_B64
        ? `<img src="${LOGO_B64}" alt="MedivalleSF">`
        : `<div class="logo-text">MedivalleSF<br>S.A.S</div>`}
    </div>
    <div class="divider"></div>
    <div class="serial-wrap">
      <div class="serial">${identifier}</div>
    </div>
  </div>
</div>
<script>if(!new URLSearchParams(location.search).has('preview'))window.onload=()=>window.print()</script>
</body>
</html>`);
});

export default router;
