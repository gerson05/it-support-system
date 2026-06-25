import path      from 'path';
import fs        from 'fs';
import QRCode    from 'qrcode';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH  = path.resolve(__dirname, '../../uploads/rotulo-imgs/unique_0_id10.png');
const LOGO_B64   = fs.existsSync(LOGO_PATH)
  ? 'data:image/png;base64,' + fs.readFileSync(LOGO_PATH).toString('base64')
  : '';

function labelHtml(destino, qrB64, numero, emite, tipo, cajasN, dd, mm, aaaa) {
  return `
  <div class="label">
    <div class="lbl-top">
      <div class="lbl-logo">
        ${LOGO_B64 ? `<img src="${LOGO_B64}" alt="MedivalleSF">` : '<span style="font-size:11px;font-weight:700;color:#1e3a5f;">MedivalleSF S.A.S</span>'}
      </div>
      <div class="lbl-title"><div>FORMATO PARA DESPACHO</div><div style="font-size:13px;font-weight:500;letter-spacing:2px;opacity:.85;margin-top:4px;">POR FAVOR ESCANEE EL QR</div></div>
      <div class="lbl-qr-top">
        <img src="${qrB64}" alt="QR">
        <div class="qr-num">${numero}</div>
      </div>
    </div>
    <div class="lbl-data">
      <div class="lbl-row fecha-row">
        <div class="lk">FECHA</div>
        <div class="lv fecha-wrap">
          <div class="fecha-col"><div class="f-sub">DÍA</div><div class="f-val">${dd}</div></div>
          <div class="fecha-col"><div class="f-sub">MES</div><div class="f-val">${mm}</div></div>
          <div class="fecha-col last"><div class="f-sub">AÑO</div><div class="f-val">${aaaa}</div></div>
        </div>
      </div>
      <div class="lbl-row dest-row">
        <div class="lk">DESTINO</div>
        <div class="lv dest">${destino}</div>
      </div>
      <div class="lbl-row remite-row">
        <div class="lk">REMITE</div>
        <div class="lv remite">${emite}</div>
      </div>
      <div class="lbl-row no-border cajas-row">
        <div class="lk">CAJAS</div>
        <div class="lv cajas-num">${cajasN}</div>
        <div class="lk lk-desc">DESCRIPCIÓN</div>
        <div class="lv tipo">${tipo}</div>
      </div>
    </div>
  </div>`;
}

function labelHtmlCompact(destino, qrB64, numero, emite, tipo, cajasN, dd, mm, aaaa, wMM, hMM) {
  const qrMM = Math.min(Math.round(hMM * 0.27), 22);
  return `
  <div class="label-c">
    <div class="lc-head">
      <div class="lc-logo">
        ${LOGO_B64 ? `<img src="${LOGO_B64}" alt="logo">` : '<span class="lc-brand">MedivalleSF S.A.S</span>'}
      </div>
      <div class="lc-title"><div>FORMATO PARA DESPACHO</div><div style="font-size:${Math.max(6, Math.round(hMM * 0.07))}px;font-weight:500;opacity:.85;margin-top:1mm;">POR FAVOR ESCANEE EL QR</div></div>
      <div class="lc-qr">
        <img src="${qrB64}" style="width:${qrMM}mm;height:${qrMM}mm;">
        <div class="qr-num">${numero}</div>
      </div>
    </div>
    <div class="lc-dest">${destino}</div>
    <div class="lc-fecha">
      <span style="font-size:${Math.max(7, Math.round(hMM * 0.075))}px;color:#555;font-weight:600;">FECHA</span>
      <span>${dd} / ${mm} / ${aaaa}</span>
    </div>
    <div class="lc-foot">
      <div class="lc-fcell">
        <div class="lc-key">DESCRIPCIÓN</div>
        <div class="lc-val lc-tipo">${tipo}</div>
      </div>
      <div class="lc-fsep"></div>
      <div class="lc-fcell lc-fcell-grow">
        <div class="lc-key">REMITE</div>
        <div class="lc-val">${emite}</div>
      </div>
      <div class="lc-fsep"></div>
      <div class="lc-fcell lc-cajas">
        <div class="lc-key">CAJAS</div>
        <div class="lc-val lc-cajas-num">${cajasN}</div>
      </div>
    </div>
  </div>`;
}

const NORMAL_CSS = `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;background:#f0f4f8}
.topbar{background:#1e3a5f;color:#fff;padding:10px 18px;display:flex;align-items:center;gap:14px;position:sticky;top:0;z-index:20}
.topbar strong{font-size:15px}
.topbar span{opacity:.8;font-size:13px;flex:1}
.topbar button{background:#fff;color:#1e3a5f;border:none;padding:7px 18px;font-size:13px;font-weight:700;cursor:pointer;border-radius:4px}
.topbar button:hover{background:#dde8f8}
.page{padding:10mm;background:#fff;max-width:210mm;margin:14px auto;box-shadow:0 2px 10px rgba(0,0,0,.18)}
.grid{display:flex;flex-direction:column;gap:10mm}
.label{border:2.5px solid #1e3a5f;page-break-inside:avoid;break-inside:avoid;width:100%}
.lbl-top{display:flex;align-items:stretch;border-bottom:2px solid #1e3a5f;min-height:90px}
.lbl-logo{width:140px;min-width:140px;display:flex;align-items:center;justify-content:center;padding:8px 12px;background:#fff;border-right:2px solid #1e3a5f}
.lbl-logo img{max-width:120px;max-height:72px;object-fit:contain}
.lbl-title{flex:1;background:#fff;color:#1e3a5f;display:flex;align-items:center;justify-content:center;text-align:center;font-size:20px;font-weight:700;letter-spacing:5px;text-transform:uppercase;padding:10px 8px;line-height:1.3}
.lbl-qr-top{width:120px;min-width:120px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6px 8px;background:#fff;border-left:2px solid #1e3a5f;gap:4px}
.lbl-qr-top img{width:80px;height:80px}
.qr-num{font-size:7px;color:#666;text-align:center;word-break:break-all;font-family:monospace}
.lbl-data{width:100%}
.lbl-row{border-bottom:1.5px solid #888;display:flex;align-items:stretch}
.lbl-row.no-border{border-bottom:none}
.lk{font-weight:700;background:#fff;border-right:1.5px solid #888;width:90px;min-width:90px;font-size:11px;text-transform:uppercase;letter-spacing:.6px;color:#000;display:flex;align-items:center;justify-content:center;text-align:center;padding:4px 6px;line-height:1.3}
.lv{font-weight:700;color:#000;flex:1;padding:6px 12px;display:flex;align-items:center;text-transform:uppercase}
.fecha-row{min-height:80px}
.fecha-wrap{display:flex;padding:0;flex:1}
.fecha-col{flex:1;text-align:center;border-right:1.5px solid #888;padding:6px 4px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px}
.fecha-col.last{border-right:none}
.f-sub{font-size:10px;color:#444;font-weight:600;text-transform:uppercase;letter-spacing:.6px}
.f-val{font-size:44px;font-weight:900;color:#000;line-height:1}
.dest-row{min-height:90px}
.dest{font-size:22px!important;color:#000!important;font-weight:900!important;text-transform:uppercase!important;line-height:1.25;word-break:break-word}
.remite-row{min-height:55px}
.remite{font-size:14px!important;color:#000!important;font-weight:600!important;text-transform:uppercase!important}
.cajas-row{min-height:55px}
.cajas-num{flex:0 0 70px!important;min-width:70px!important;max-width:70px;border-right:1.5px solid #888;justify-content:center;font-size:32px!important;color:#000!important;padding:4px 0!important}
.lk-desc{border-left:none;width:110px;min-width:110px}
.tipo{font-size:17px!important;color:#000!important;font-weight:700!important;text-transform:uppercase!important}
@media print{
  @page{size:A4 portrait;margin:8mm}
  body{background:#fff}
  .topbar{display:none}
  .page{box-shadow:none;margin:0;padding:0;max-width:none}
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
}`;

function buildLabelCss(wMM, hMM) {
  return `
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;background:#f0f4f8}
.topbar{background:#1e3a5f;color:#fff;padding:8px 16px;display:flex;align-items:center;gap:12px;position:sticky;top:0;z-index:20}
.topbar strong{font-size:14px}
.topbar span{opacity:.8;font-size:12px;flex:1}
.topbar button{background:#fff;color:#1e3a5f;border:none;padding:6px 14px;font-size:12px;font-weight:700;cursor:pointer;border-radius:4px}
.topbar button:hover{background:#dde8f8}
.print-area{background:#fff;width:fit-content;max-width:98vw;margin:14px auto;padding:4mm;box-shadow:0 2px 10px rgba(0,0,0,.18);display:flex;flex-direction:column;gap:3mm}
.label-c{border:1.5px solid #1e3a5f;page-break-inside:avoid;break-inside:avoid;width:${wMM - 4}mm;min-height:${hMM - 4}mm;display:flex;flex-direction:column;overflow:hidden}
.lc-head{display:flex;align-items:stretch;border-bottom:1.5px solid #1e3a5f;flex-shrink:0;min-height:${Math.round(hMM * 0.27)}mm;max-height:${Math.round(hMM * 0.35)}mm}
.lc-logo{flex:0 0 auto;display:flex;align-items:center;justify-content:center;padding:1.5mm 2mm;border-right:1.5px solid #1e3a5f;min-width:18mm;max-width:28mm}
.lc-logo img{max-height:${Math.round(hMM * 0.22)}mm;max-width:26mm;object-fit:contain}
.lc-brand{font-size:8px;font-weight:700;color:#1e3a5f;text-align:center}
.lc-title{flex:1;background:#fff;color:#1e3a5f;display:flex;align-items:center;justify-content:center;text-align:center;font-weight:700;letter-spacing:2px;text-transform:uppercase;font-size:${Math.max(7, Math.round(hMM * 0.085))}px;padding:2mm;line-height:1.2}
.lc-qr{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.5mm 2mm;border-left:1.5px solid #1e3a5f;gap:1mm}
.qr-num{font-size:6px;color:#555;text-align:center;word-break:break-all;font-family:monospace;max-width:${Math.round(hMM * 0.27)}mm}
.lc-dest{flex:0 0 auto;min-height:${Math.round(hMM * 0.26)}mm;max-height:${Math.round(hMM * 0.32)}mm;overflow:hidden;font-size:${Math.max(10, Math.round(hMM * 0.16))}px;font-weight:900;text-transform:uppercase;color:#000;padding:2mm 3mm;display:flex;align-items:center;border-bottom:1.5px solid #888;word-break:break-word;line-height:1.1}
.lc-fecha{flex-shrink:0;padding:2mm 3mm;border-bottom:1.5px solid #1e3a5f;font-size:${Math.max(12, Math.round(hMM * 0.145))}px;font-weight:700;color:#000;letter-spacing:1px;display:flex;align-items:center;gap:3mm}
.lc-foot{display:flex;flex-shrink:0;min-height:${Math.round(hMM * 0.30)}mm}
.lc-fcell{display:flex;flex-direction:column;justify-content:center;padding:1.5mm 2.5mm;flex:1}
.lc-fcell-grow{flex:2}
.lc-cajas{flex:0 0 auto;min-width:12mm;align-items:center;padding:1mm 2.5mm}
.lc-fsep{width:1.5px;background:#888;flex-shrink:0}
.lc-key{font-size:${Math.max(9, Math.round(hMM * 0.11))}px;font-weight:700;text-transform:uppercase;letter-spacing:.4px;color:#555;margin-bottom:.8mm}
.lc-val{font-size:${Math.max(12, Math.round(hMM * 0.145))}px;font-weight:700;text-transform:uppercase;color:#000;line-height:1.1}
.lc-tipo{font-size:${Math.max(13, Math.round(hMM * 0.165))}px!important}
.lc-cajas-num{font-size:${Math.max(16, Math.round(hMM * 0.27))}px!important;text-align:center}
@media print{
  @page{size:${wMM}mm ${hMM}mm;margin:2mm}
  body{background:#fff}
  .topbar{display:none!important}
  .print-area{margin:0;padding:0;box-shadow:none;gap:0;width:auto}
  *{-webkit-print-color-adjust:exact!important;print-color-adjust:exact!important}
}`;
}

/**
 * @param {object} row        - { token, numero, destinatario, sede_destino, fecha }
 * @param {object} options    - query params: modo, tipo_articulo, remite, remitente, cajas, sedes, printer, label_size
 * @param {string} trackingUrl - full public URL for QR
 * @param {Array}  sedesActivas - [{ nombre_punto }] for modo='todos'
 * @returns {Promise<string>} HTML page
 */
export async function generateRotuloHtml(row, options = {}, trackingUrl, sedesActivas = []) {
  const {
    modo          = 'single',
    tipo_articulo = 'ARTÍCULO',
    remite        = 'DPTO. DE SISTEMAS',
    remitente     = '',
    cajas         = '1',
    sedes         = '',
    printer       = 'normal',
    label_size    = '10x8',
  } = options;

  const qrBuf = await QRCode.toBuffer(trackingUrl, { type: 'png', width: 220, margin: 1 });
  const qrB64 = `data:image/png;base64,${qrBuf.toString('base64')}`;

  let dd, mm, aaaa;
  if (row.fecha && /^\d{4}-\d{2}-\d{2}/.test(row.fecha)) {
    [aaaa, mm, dd] = row.fecha.slice(0, 10).split('-');
  } else {
    const now = new Date();
    dd   = String(now.getDate()).padStart(2, '0');
    mm   = String(now.getMonth() + 1).padStart(2, '0');
    aaaa = String(now.getFullYear());
  }

  let destinations;
  if (modo === 'todos') {
    destinations = sedesActivas.map(s => s.nombre_punto).filter(Boolean);
    if (!destinations.length) destinations = [row.sede_destino || row.destinatario || '—'];
  } else if (modo === 'custom' && sedes) {
    destinations = sedes.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
    if (!destinations.length) destinations = [row.sede_destino || row.destinatario || '—'];
  } else {
    destinations = [row.sede_destino || row.destinatario || '—'];
  }

  const tipo        = (tipo_articulo || 'ARTÍCULO').toUpperCase();
  const emiteBase   = (remite || 'DPTO. DE SISTEMAS').toUpperCase();
  const emiteNombre = remitente ? remitente.toUpperCase() : '';
  const emite       = emiteNombre ? `${emiteBase} · ${emiteNombre}` : emiteBase;
  const cajasN      = parseInt(cajas) || 1;
  const numero      = row.numero || '';
  const isLabel     = printer === 'etiqueta';

  let wMM = 100, hMM = 80;
  if (isLabel) {
    const parts = label_size.split('x').map(Number);
    if (parts.length === 2 && parts[0] > 0 && parts[1] > 0) {
      wMM = Math.round(parts[0] * 10);
      hMM = Math.round(parts[1] * 10);
    }
  }

  const labelsHtml = destinations.map(d =>
    isLabel
      ? labelHtmlCompact(d, qrB64, numero, emite, tipo, cajasN, dd, mm, aaaa, wMM, hMM)
      : labelHtml(d, qrB64, numero, emite, tipo, cajasN, dd, mm, aaaa)
  ).join('\n');

  const css = isLabel ? buildLabelCss(wMM, hMM) : NORMAL_CSS;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Rótulos · ${numero}</title>
<style>${css}</style>
</head>
<body>
<div class="topbar">
  <strong>Rótulos de Despacho · ${numero}</strong>
  <span>${destinations.length} rótulo(s) &nbsp;·&nbsp; ${tipo}${isLabel ? ` &nbsp;·&nbsp; ${wMM / 10}×${hMM / 10} cm` : ''}</span>
  <button onclick="window.print()">🖨&nbsp; Imprimir</button>
  <button onclick="window.close()" style="background:#c0ccdd">Cerrar</button>
</div>
${isLabel
  ? `<div class="print-area">\n${labelsHtml}\n</div>`
  : `<div class="page">\n  <div class="grid">\n${labelsHtml}\n  </div>\n</div>`}
</body>
</html>`;
}
