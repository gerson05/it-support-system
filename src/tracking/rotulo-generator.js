import path      from 'path';
import fs        from 'fs';
import QRCode    from 'qrcode';
import { fileURLToPath } from 'url';

const __dirname  = path.dirname(fileURLToPath(import.meta.url));
const LOGO_PATH  = path.resolve(__dirname, '../assets/medivalle-logo.png');
let _logoB64Cache = null;
function getLogoB64() {
  if (!_logoB64Cache) {
    _logoB64Cache = fs.existsSync(LOGO_PATH)
      ? 'data:image/png;base64,' + fs.readFileSync(LOGO_PATH).toString('base64')
      : '';
  }
  return _logoB64Cache;
}

function labelHtml(destino, qrB64, numero, emite, tipo, cajasN, dd, mm, aaaa, responsable) {
  return `
  <div class="label">
    <div class="lbl-top">
      <div class="lbl-logo">
        ${getLogoB64() ? `<img src="${getLogoB64()}" alt="MedivalleSF">` : '<span style="font-size:11px;font-weight:700;color:#1e3a5f;">MedivalleSF S.A.S</span>'}
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
      <div class="lbl-row recibe-row">
        <div class="lk">RECIBE</div>
        <div class="lv recibe">${responsable ? responsable.toUpperCase() : '—'}</div>
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

function labelHtmlCompact(destino, qrB64, numero, emite, tipo, cajasN, dd, mm, aaaa, wMM, hMM, responsable) {
  const qrMM = Math.min(Math.round(hMM * 0.27), 22);
  return `
  <div class="label-c">
    <div class="lc-head">
      <div class="lc-logo">
        ${getLogoB64() ? `<img src="${getLogoB64()}" alt="logo">` : '<span class="lc-brand">MedivalleSF S.A.S</span>'}
      </div>
      <div class="lc-title"><div>FORMATO PARA DESPACHO</div><div style="font-size:${Math.max(6, Math.round(hMM * 0.07))}px;font-weight:500;opacity:.85;margin-top:1mm;">POR FAVOR ESCANEE EL QR</div></div>
      <div class="lc-qr">
        <img src="${qrB64}" style="width:${qrMM}mm;height:${qrMM}mm;">
        <div class="qr-num">${numero}</div>
      </div>
    </div>
    <div class="lc-dest">${destino}</div>
    <div class="lc-recibe">
      <span style="font-size:${Math.max(7, Math.round(hMM * 0.075))}px;color:#555;font-weight:700;text-transform:uppercase;letter-spacing:.4px;">RECIBE</span>
      <span style="font-size:${Math.max(9, Math.round(hMM * 0.11))}px;font-weight:700;text-transform:uppercase;color:#000;">${responsable ? responsable.toUpperCase() : '—'}</span>
    </div>
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
.page{padding:10mm;background:#fff;max-width:216mm;margin:14px auto;box-shadow:0 2px 10px rgba(0,0,0,.18)}
.label-pair{display:flex;flex-direction:column;gap:8mm}
.label-pair+.label-pair{margin-top:14px}
.label{border:2.5px solid #1e3a5f;page-break-inside:avoid;break-inside:avoid;width:100%}
.lbl-top{display:flex;align-items:stretch;border-bottom:2px solid #1e3a5f;min-height:72px}
.lbl-logo{width:130px;min-width:130px;display:flex;align-items:center;justify-content:center;padding:6px 10px;background:#fff;border-right:2px solid #1e3a5f}
.lbl-logo img{max-width:110px;max-height:60px;object-fit:contain}
.lbl-title{flex:1;background:#fff;color:#1e3a5f;display:flex;align-items:center;justify-content:center;text-align:center;font-size:18px;font-weight:700;letter-spacing:4px;text-transform:uppercase;padding:8px;line-height:1.3}
.lbl-qr-top{width:100px;min-width:100px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:5px 7px;background:#fff;border-left:2px solid #1e3a5f;gap:3px}
.lbl-qr-top img{width:68px;height:68px}
.qr-num{font-size:7px;color:#666;text-align:center;word-break:break-all;font-family:monospace}
.lbl-data{width:100%}
.lbl-row{border-bottom:1.5px solid #888;display:flex;align-items:stretch}
.lbl-row.no-border{border-bottom:none}
.lk{font-weight:700;background:#fff;border-right:1.5px solid #888;width:80px;min-width:80px;font-size:10px;text-transform:uppercase;letter-spacing:.6px;color:#000;display:flex;align-items:center;justify-content:center;text-align:center;padding:3px 5px;line-height:1.3}
.lv{font-weight:700;color:#000;flex:1;padding:5px 10px;display:flex;align-items:center;text-transform:uppercase}
.fecha-row{min-height:62px}
.fecha-wrap{display:flex;padding:0;flex:1}
.fecha-col{flex:1;text-align:center;border-right:1.5px solid #888;padding:5px 3px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px}
.fecha-col.last{border-right:none}
.f-sub{font-size:9px;color:#444;font-weight:600;text-transform:uppercase;letter-spacing:.6px}
.f-val{font-size:36px;font-weight:900;color:#000;line-height:1}
.dest-row{min-height:72px}
.dest{font-size:20px!important;color:#000!important;font-weight:900!important;text-transform:uppercase!important;line-height:1.25;word-break:break-word}
.remite-row{min-height:44px}
.remite{font-size:13px!important;color:#000!important;font-weight:600!important;text-transform:uppercase!important}
.recibe-row{min-height:44px}
.recibe{font-size:13px!important;color:#000!important;font-weight:700!important;text-transform:uppercase!important}
.cajas-row{min-height:44px}
.cajas-num{flex:0 0 62px!important;min-width:62px!important;max-width:62px;border-right:1.5px solid #888;justify-content:center;font-size:28px!important;color:#000!important;padding:3px 0!important}
.lk-desc{border-left:none;width:100px;min-width:100px}
.tipo{font-size:15px!important;color:#000!important;font-weight:700!important;text-transform:uppercase!important}
@media print{
  @page{size:letter portrait;margin:8mm}
  body{background:#fff}
  .topbar{display:none}
  .page{box-shadow:none;margin:0;padding:0;max-width:none}
  .label-pair{page-break-after:always;break-after:page;gap:6mm}
  .label-pair:last-child{page-break-after:auto;break-after:auto}
  .label{max-height:125mm;overflow:hidden}
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
.lc-dest{flex:0 0 auto;min-height:${Math.round(hMM * 0.22)}mm;max-height:${Math.round(hMM * 0.28)}mm;overflow:hidden;font-size:${Math.max(10, Math.round(hMM * 0.16))}px;font-weight:900;text-transform:uppercase;color:#000;padding:2mm 3mm;display:flex;align-items:center;border-bottom:1.5px solid #888;word-break:break-word;line-height:1.1}
.lc-recibe{flex-shrink:0;padding:1.5mm 3mm;border-bottom:1.5px solid #888;display:flex;align-items:center;gap:3mm}
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
    responsable   = '',
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

  let bodyHtml;
  if (isLabel) {
    const labelsHtml = destinations.map(d =>
      labelHtmlCompact(d, qrB64, numero, emite, tipo, cajasN, dd, mm, aaaa, wMM, hMM, responsable)
    ).join('\n');
    bodyHtml = `<div class="print-area">\n${labelsHtml}\n</div>`;
  } else {
    // Normal printer: 2 labels per page on carta/letter.
    // Single destination → print 2 copies. Multiple → pair them up.
    const list = destinations.length === 1
      ? [destinations[0], destinations[0]]
      : destinations;
    const pairs = [];
    for (let i = 0; i < list.length; i += 2) {
      pairs.push(list.slice(i, i + 2));
    }
    const pairsHtml = pairs.map(pair => {
      const inner = pair.map(d =>
        labelHtml(d, qrB64, numero, emite, tipo, cajasN, dd, mm, aaaa, responsable)
      ).join('\n');
      return `  <div class="label-pair">\n${inner}\n  </div>`;
    }).join('\n');
    bodyHtml = `<div class="page">\n${pairsHtml}\n</div>`;
  }

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
${bodyHtml}
</body>
</html>`;
}
