import { showToast } from '../../ui/components.js';

const esc = str => String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

export function openExportPanel() {
  document.getElementById('inv-sidebar-nav').style.display    = 'none';
  document.getElementById('inv-sidebar-footer').style.display = 'none';
  document.getElementById('inv-export-panel').style.display   = 'flex';
  _loadPuntos();
}

export function closeExportPanel() {
  document.getElementById('inv-sidebar-nav').style.display    = '';
  document.getElementById('inv-sidebar-footer').style.display = '';
  document.getElementById('inv-export-panel').style.display   = 'none';
}

async function _loadPuntos() {
  const sel = document.getElementById('inv-exp-area');
  try {
    const res  = await fetch('/api/inventario/puntos');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    const puntos = data.puntos || [];
    sel.innerHTML = `<option value="">— Todos los puntos —</option>` +
      puntos.map(p => `<option value="${esc(p)}">${esc(p)}</option>`).join('');
  } catch (err) {
    console.error('_loadPuntos:', err);
    sel.innerHTML = '<option value="">Error al cargar puntos</option>';
  }
}

export async function doExport(formato, btn) {
  const area    = document.getElementById('inv-exp-area').value;
  const tipoVal = document.getElementById('inv-exp-tipo').value;
  const [apiTab, categoria] = tipoVal ? tipoVal.split(':') : ['', ''];

  const params = new URLSearchParams();
  if (area)      params.set('area',      area);
  if (apiTab)    params.set('apiTab',    apiTab);
  if (categoria) params.set('categoria', categoria);

  const origHTML = btn.innerHTML;
  btn.disabled   = true;
  btn.textContent = 'Generando…';

  try {
    const res = await fetch(`/api/inventario/reporte?${params}`);
    if (!res.ok) throw new Error('Error al obtener datos');
    const data = await res.json();

    if (!data.total) { showToast('Sin datos para exportar.', 'error'); return; }

    if (formato === 'pdf') _exportPDF(data);
    else await _exportExcel(data);
  } catch (err) {
    showToast(err.message || 'Error al exportar.', 'error');
  } finally {
    btn.disabled  = false;
    btn.innerHTML = origHTML;
  }
}

const _EQUIPO_THEAD = `<tr><th>Placa</th><th>Equipo</th><th>Serial</th><th>Procesador</th><th>RAM</th><th>Disco</th><th>S/N Cargador</th><th>Área</th><th>Responsable</th><th>F. Compra</th></tr>`;

function _equipoRow(e) {
  return `<tr>
    <td class="mono">${esc(e.placa||'—')}</td>
    <td>${esc(e.marca||'')}&nbsp;<span class="sub">${esc(e.nombre_equipo||'')}</span></td>
    <td class="mono">${esc(e.serial||'—')}</td>
    <td style="font-size:9.5px">${esc(e.procesador||'—')}</td>
    <td>${e.ram ? `${esc(e.ram)} <span class="sub">${esc(e.tipo_ram||'')}</span>` : '—'}</td>
    <td>${e.cap_disco ? `${esc(e.cap_disco)} <span class="sub">${esc(e.tipo_disco||'')}</span>` : '—'}</td>
    <td class="mono" style="font-size:9px">${esc(e.serial_cargador||'—')}</td>
    <td>${esc(e.area||'—')}</td>
    <td>${esc(e.responsable||'—')}</td>
    <td>${esc(e.fecha_compra||'—')}</td>
  </tr>`;
}

function _exportPDF(data) {
  const fecha  = new Date().toLocaleDateString('es-CO', { year:'numeric', month:'long', day:'numeric' });
  const titulo = data.area ? `Inventario TI — ${data.area}` : 'Inventario TI — Todos los puntos';

  const resumenRows = data.resumen.map(r =>
    `<tr><td style="text-transform:capitalize">${r.categoria}</td><td class="num">${r.count}</td></tr>`
  ).join('');

  const bycat = {};
  data.equipos.forEach(e => { const k = e.categoria || 'otros'; if (!bycat[k]) bycat[k] = []; bycat[k].push(e); });
  const CAT_LABEL = {
    computadores:'Computadores', impresoras:'Impresoras', escaner:'Escáneres',
    televisores:'Televisores', monitores:'Monitores', tablets:'Tablets',
    perifericos:'Periféricos', otros:'Otros',
  };
  const equipoSections = Object.entries(bycat).map(([cat, items]) => `
<h2>${CAT_LABEL[cat] || cat} (${items.length})</h2>
<table><thead>${_EQUIPO_THEAD}</thead><tbody>${items.map(_equipoRow).join('')}</tbody></table>`).join('');

  const celularRows = data.celulares.map(c =>
    `<tr>
      <td class="mono">${esc(c.imei||'—')}</td>
      <td class="mono">${esc(c.imei2||'—')}</td>
      <td>${esc(c.modelo||c.equipo||'—')}</td>
      <td>${c.almacenamiento ? `${esc(c.almacenamiento)} <span class="sub">${esc(c.ram||'')}</span>` : '—'}</td>
      <td>${esc(c.nombre_completo||'—')}</td>
      <td>${esc(c.cedula||'—')}</td>
      <td>${esc(c.area||'—')}</td>
      <td>${esc(c.ciudad||'—')}</td>
      <td>${esc(c.estado||'—')}</td>
      <td>${esc(c.operador||'—')}</td>
      <td>${esc(c.fecha_entrega||'—')}</td>
    </tr>`
  ).join('');

  const upsRows = data.ups.map(u =>
    `<tr>
      <td class="mono">${esc(u.placa||'—')}</td>
      <td>${esc(u.marca||'—')}</td>
      <td>${esc(u.nombre_equipo||'—')}</td>
      <td class="mono">${esc(u.serial||'—')}</td>
      <td>${esc(u.area||'—')}</td>
      <td>${esc(u.voltaje||'—')}</td>
      <td>${esc(u.fecha_compra||'—')}</td>
      <td>${esc(u.fecha_despacho||'—')}</td>
    </tr>`
  ).join('');

  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<title>${titulo}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,sans-serif;font-size:11px;color:#111827;padding:24px}
h1{font-size:17px;font-weight:700;color:#4f46e5;margin-bottom:3px}
.meta{font-size:11px;color:#6b7280;margin-bottom:20px}
h2{font-size:12px;font-weight:700;color:#374151;text-transform:uppercase;letter-spacing:.6px;
   margin:18px 0 7px;border-bottom:2px solid #e5e7eb;padding-bottom:4px}
table{width:100%;border-collapse:collapse;margin-bottom:4px;font-size:10.5px}
th{background:#f3f4f6;padding:5px 7px;text-align:left;border:1px solid #e5e7eb;font-size:9.5px;
   font-weight:700;text-transform:uppercase;letter-spacing:.4px}
td{padding:4px 7px;border:1px solid #e5e7eb;vertical-align:top}
tr:nth-child(even) td{background:#f9fafb}
.num{text-align:right;font-weight:700}
.mono{font-family:monospace;font-size:10px}
.sub{color:#6b7280;font-size:10px}
.rsm{width:260px}
@media print{body{padding:0}@page{size:A4 landscape;margin:12mm}}
</style></head><body>
<h1>${titulo}</h1>
<p class="meta">Generado el ${fecha}&nbsp;·&nbsp;Total: ${data.total} dispositivos</p>

<h2>Resumen por categoría</h2>
<table class="rsm">
  <thead><tr><th>Categoría</th><th>Cant.</th></tr></thead>
  <tbody>${resumenRows}<tr style="font-weight:700"><td>Total</td><td class="num">${data.total}</td></tr></tbody>
</table>

${equipoSections}

${data.celulares.length ? `<h2>Celulares (${data.celulares.length})</h2>
<table><thead><tr><th>IMEI</th><th>IMEI2</th><th>Modelo</th><th>Almac./RAM</th><th>Asignado a</th><th>Cédula</th><th>Área</th><th>Ciudad</th><th>Estado</th><th>Operador</th><th>F. Entrega</th></tr></thead>
<tbody>${celularRows}</tbody></table>` : ''}

${data.ups.length ? `<h2>UPS (${data.ups.length})</h2>
<table><thead><tr><th>Placa</th><th>Marca</th><th>Equipo</th><th>Serial</th><th>Área</th><th>Voltaje</th><th>F. Compra</th><th>F. Despacho</th></tr></thead>
<tbody>${upsRows}</tbody></table>` : ''}

</body></html>`;

  const w = window.open('', '_blank', 'width=960,height=720');
  w.document.write(html);
  w.document.close();
  setTimeout(() => w.print(), 600);
}

async function _exportExcel(data) {
  if (!window.XLSX) {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js';
      s.onload = resolve; s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  const wb = window.XLSX.utils.book_new();

  const resumenAOA = [
    ['Categoría', 'Cantidad'],
    ...data.resumen.map(r => [r.categoria, r.count]),
    [],
    ['TOTAL', data.total],
  ];
  window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(resumenAOA), 'Resumen');

  const _ECOLS = ['Placa','Marca','Equipo','Serial','Procesador','RAM','Tipo RAM','Disco','Tipo Disco','S/N Cargador','Área','Responsable','F. Compra'];
  const _erow  = e => [e.placa,e.marca,e.nombre_equipo,e.serial,e.procesador,e.ram,e.tipo_ram,e.cap_disco,e.tipo_disco,e.serial_cargador,e.area,e.responsable,e.fecha_compra];
  const _CAT_SHEET = { computadores:'Computadores', impresoras:'Impresoras', escaner:'Escaneres',
    televisores:'Televisores', monitores:'Monitores', tablets:'Tablets', perifericos:'Perifericos', otros:'Otros' };
  const byCat = {};
  data.equipos.forEach(e => { const k = e.categoria||'otros'; if (!byCat[k]) byCat[k] = []; byCat[k].push(e); });
  Object.entries(byCat).forEach(([cat, items]) => {
    const rows = [_ECOLS, ...items.map(_erow)];
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(rows), _CAT_SHEET[cat] || cat);
  });

  if (data.celulares.length) {
    const rows = [
      ['IMEI','IMEI2','Modelo','Asignado a','Cédula','Área','Ciudad','Estado','Operador','Almacenamiento','RAM','F. Entrega'],
      ...data.celulares.map(c => [c.imei,c.imei2,c.modelo||c.equipo,c.nombre_completo,c.cedula,c.area,c.ciudad,c.estado,c.operador,c.almacenamiento,c.ram,c.fecha_entrega]),
    ];
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(rows), 'Celulares');
  }

  if (data.ups.length) {
    const rows = [
      ['Placa','Marca','Equipo','Serial','Área','Voltaje','F. Compra','F. Despacho'],
      ...data.ups.map(u => [u.placa,u.marca,u.nombre_equipo,u.serial,u.area,u.voltaje,u.fecha_compra,u.fecha_despacho]),
    ];
    window.XLSX.utils.book_append_sheet(wb, window.XLSX.utils.aoa_to_sheet(rows), 'UPS');
  }

  const fecha  = new Date().toISOString().slice(0, 10);
  const nombre = data.area ? `inventario-${data.area}-${fecha}` : `inventario-todos-${fecha}`;
  window.XLSX.writeFile(wb, `${nombre}.xlsx`);
}
