import { state, AREA_MAPPINGS, formatDate } from './app.js';
import { showToast, createLoadingSpinner, createEmptyState, attachSedeSearch, copyToClipboard } from './components.js';
import { iconEdit, iconDocument, iconClose, iconLink, iconUpload, iconRefresh, iconDownload, iconCopy, iconSave, iconNote } from './icons.js';

function _timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  const old = h >= 8;
  const label = h > 0 ? `hace ${h}h ${m}m` : `hace ${m}m`;
  return { label, old };
}

/* ── Helpers ─────────────────────────────────────────────────────────── */

function actaBadge(d) {
  if (!d.requiere_acta) {
    return `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:500;background:var(--surface-2);color:var(--text-3);border:1px solid var(--border);">No requiere</span>`;
  }
  if (d.acta_firmada) {
    return `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:500;background:#d1fae5;color:#065f46;border:1px solid #6ee7b7;">Firmada ✓</span>`;
  }
  return `<span style="display:inline-block;padding:2px 9px;border-radius:99px;font-size:11px;font-weight:500;background:#fef3c7;color:#92400e;border:1px solid #fcd34d;">Pendiente firma</span>`;
}

function articulosCount(d) {
  try {
    const arr = JSON.parse(d.articulos || '[]');
    const total = arr.reduce((s, a) => s + (parseInt(a.cantidad) || 1), 0);
    return `${arr.length} ítem(s) · ${total} ud.`;
  } catch { return '—'; }
}

function articulosList(d) {
  try {
    const arr = JSON.parse(d.articulos || '[]');
    if (!arr.length) return '<em style="color:var(--text-3);">Sin artículos</em>';
    return arr.map(a => `
      <div style="display:flex;flex-direction:column;gap:4px;padding:8px 0;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:baseline;gap:10px;">
          <span style="font-weight:600;min-width:32px;color:var(--primary);">${a.cantidad}×</span>
          <span style="font-weight:500;color:var(--text);">${a.nombre}</span>
          ${a.descripcion ? `<span style="font-size:12px;color:var(--text-3);">${a.descripcion}</span>` : ''}
        </div>
        ${(a.marca || a.modelo || a.serial) ? `
        <div style="display:flex;gap:12px;font-size:11px;color:var(--text-3);padding-left:42px;">
          ${a.marca ? `<span><strong>Marca:</strong> ${a.marca}</span>` : ''}
          ${a.modelo ? `<span><strong>Modelo:</strong> ${a.modelo}</span>` : ''}
          ${a.serial ? `<span><strong>Serial:</strong> ${a.serial}</span>` : ''}
        </div>` : ''}
      </div>`).join('');
  } catch { return '<em style="color:var(--text-3);">Error al leer artículos</em>'; }
}

/* ── API calls ──────────────────────────────────────────────────────── */

async function fetchDespachos(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/despachos?${qs}`);
  if (!res.ok) throw new Error('Error al cargar despachos');
  return res.json();
}

async function fetchDespacho(id) {
  const res = await fetch(`/api/despachos/${id}`);
  if (!res.ok) throw new Error('Despacho no encontrado');
  return res.json();
}

async function createDespacho(data) {
  const res = await fetch('/api/despachos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Error al crear despacho');
  return json;
}

async function updateDespacho(id, data) {
  const res = await fetch(`/api/despachos/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'Error al actualizar');
  return json;
}

async function fetchActaInfo(entityType, entityId) {
  try {
    const res = await fetch(`/api/actas/info/${entityType}/${entityId}`);
    if (!res.ok) return { token: null };
    return res.json();
  } catch { return { token: null }; }
}

/* ── Print view ─────────────────────────────────────────────────────── */

function printDespacho(d) {
  let arts = [];
  try { arts = JSON.parse(d.articulos || '[]'); } catch {}
  const artRows = arts.map(a => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #ccc;">
        <strong>${a.nombre}</strong>
        ${a.descripcion ? `<br><small style="color:#555;">${a.descripcion}</small>` : ''}
      </td>
      <td style="padding:6px 10px;border:1px solid #ccc;text-align:center;">${a.marca || '—'}</td>
      <td style="padding:6px 10px;border:1px solid #ccc;text-align:center;">${a.modelo || '—'}</td>
      <td style="padding:6px 10px;border:1px solid #ccc;text-align:center;">${a.serial || '—'}</td>
      <td style="padding:6px 10px;border:1px solid #ccc;text-align:center;">${a.cantidad}</td>
    </tr>`).join('');

  const win = window.open('', '_blank');
  win.document.write(`<!DOCTYPE html><html lang="es"><head>
    <meta charset="UTF-8">
    <title>Despacho ${d.numero}</title>
    <style>
      body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:30px;max-width:700px;margin:0 auto;}
      h1{font-size:18px;margin:0;} h2{font-size:13px;font-weight:normal;margin:2px 0 0;}
      .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #333;padding-bottom:12px;margin-bottom:18px;}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 20px;margin-bottom:18px;}
      .meta dt{font-weight:600;font-size:11px;color:#555;text-transform:uppercase;margin:0;}
      .meta dd{margin:0 0 4px;font-size:13px;}
      table{width:100%;border-collapse:collapse;margin-bottom:18px;}
      th{background:#f0f0f0;padding:6px 10px;border:1px solid #ccc;text-align:left;font-size:12px;}
      .firma{margin-top:40px;display:flex;gap:60px;}
      .firma div{flex:1;border-top:1px solid #555;padding-top:6px;font-size:11px;color:#555;}
      @media print{body{padding:10px;}}
    </style>
  </head><body>
    <div class="header">
      <div>
        <h1>Mi Farmacia — IT</h1>
        <h2>Comprobante de Despacho</h2>
      </div>
      <div style="text-align:right;">
        <div style="font-size:18px;font-weight:700;letter-spacing:1px;">${d.numero}</div>
        <div style="font-size:12px;color:#555;">${d.fecha || ''}</div>
      </div>
    </div>
    <dl class="meta">
      <dt>Destinatario</dt><dd>${d.destinatario}</dd>
      <dt>Sede</dt><dd>${d.sede || '—'}</dd>
      <dt>Área</dt><dd>${d.area ? (AREA_MAPPINGS[d.area]?.label || d.area) : '—'}</dd>
      <dt>Agente</dt><dd>${d.agente || '—'}</dd>
      ${d.ticket_id ? `<dt>Ticket vinculado</dt><dd>#${d.ticket_id}</dd>` : ''}
      ${d.acta_numero ? `<dt>N° Acta</dt><dd>${d.acta_numero}</dd>` : ''}
    </dl>
    <table>
      <thead><tr>
        <th>Artículo</th><th style="width:100px;text-align:center;">Marca</th><th style="width:100px;text-align:center;">Modelo</th><th style="width:120px;text-align:center;">Serial</th><th style="width:70px;text-align:center;">Cantidad</th>
      </tr></thead>
      <tbody>${artRows}</tbody>
    </table>
    ${d.observaciones ? `<p style="font-size:12px;color:#555;"><strong>Observaciones:</strong> ${d.observaciones}</p>` : ''}
    ${d.requiere_acta ? `
    <div class="firma">
      <div>Firma del Receptor<br><br>${d.destinatario}</div>
      <div>Firma del Agente IT<br><br>${d.agente || 'Agente IT'}</div>
    </div>` : ''}
  </body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

/* ── Detail Modal ───────────────────────────────────────────────────── */

function openDetailModal(id) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;';

  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:12px;padding:28px;width:100%;max-width:620px;margin:auto 0;box-shadow:0 20px 60px rgba(0,0,0,.4);position:relative;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
        <h2 style="margin:0;font-size:17px;font-weight:700;color:var(--text);">Detalle de Despacho</h2>
        <button id="modal-close" style="background:none;border:none;cursor:pointer;color:var(--text-3);">${iconClose(18)}</button>
      </div>
      <div id="modal-body">${createLoadingSpinner()}</div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#modal-close').onclick = () => overlay.remove();
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  fetchDespacho(id).then(async d => {
    const actaInfo = await fetchActaInfo('despacho', d.id);
    const body = overlay.querySelector('#modal-body');
    body.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px 20px;margin-bottom:18px;">
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;margin-bottom:3px;">Número</div>
          <div style="font-family:monospace;font-size:15px;font-weight:700;color:var(--primary);">${d.numero}</div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;margin-bottom:3px;">Fecha</div>
          <div style="font-size:13px;color:var(--text);">${d.fecha || '—'}</div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;margin-bottom:3px;">Destinatario</div>
          <div style="font-size:13px;color:var(--text);font-weight:500;">${d.destinatario}</div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;margin-bottom:3px;">Sede</div>
          <div style="font-size:13px;color:var(--text);">${d.sede || '—'}</div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;margin-bottom:3px;">Área</div>
          <div style="font-size:13px;color:var(--text);">${d.area ? (AREA_MAPPINGS[d.area]?.label || d.area) : '—'}</div>
        </div>
        <div>
          <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;margin-bottom:3px;">Agente</div>
          <div style="font-size:13px;color:var(--text);">${d.agente || '—'}</div>
        </div>
        ${d.ticket_id ? `<div>
          <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;margin-bottom:3px;">Ticket vinculado</div>
          <div style="font-size:13px;color:var(--text);">#${d.ticket_id}</div>
        </div>` : ''}
      </div>

      <div style="margin-bottom:16px;">
        <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;margin-bottom:8px;">Artículos</div>
        <div style="border:1px solid var(--border);border-radius:8px;padding:4px 12px;">
          ${articulosList(d)}
        </div>
      </div>

      ${d.observaciones ? `
      <div style="margin-bottom:16px;">
        <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;margin-bottom:4px;">Observaciones</div>
        <div style="font-size:13px;color:var(--text-2);background:var(--surface-2);border-radius:6px;padding:10px 12px;">${d.observaciones}</div>
      </div>` : ''}

      <div style="margin-bottom:20px;">
        <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;margin-bottom:6px;">Acta</div>
        <div id="acta-section">
          ${renderActaSection(d, actaInfo)}
        </div>
      </div>

      <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:16px;border-top:1px solid var(--border);">
        <button id="btn-print" class="btn btn-secondary" style="gap:6px;display:inline-flex;align-items:center;">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
          Imprimir
        </button>
        <button id="btn-acta-word" class="btn btn-secondary" style="gap:6px;display:inline-flex;align-items:center;">${iconDocument(13)} Acta Word</button>
        <button id="btn-edit-despacho" class="btn btn-secondary" style="gap:6px;display:inline-flex;align-items:center;">${iconEdit(13)} Editar</button>
        <button id="btn-close-modal" class="btn btn-secondary">Cerrar</button>
      </div>`;

    body.querySelector('#btn-print').onclick = () => printDespacho(d);
    body.querySelector('#btn-close-modal').onclick = () => overlay.remove();
    body.querySelector('#btn-edit-despacho').onclick = () => {
      overlay.remove();
      openEditDespachoModal(d.id, () => document.querySelector('#btn-refresh-despachos')?.click());
    };
    body.querySelector('#btn-acta-word').onclick = async () => {
      const btn = body.querySelector('#btn-acta-word');
      btn.textContent = 'Generando…'; btn.disabled = true;
      try {
        const res = await fetch(`/api/despachos/${d.id}/acta-word`, { method: 'POST' });
        if (!res.ok) throw new Error((await res.json()).error || 'Error');
        const blob = await res.blob();
        const filename = res.headers.get('Content-Disposition')?.match(/filename="?([^"]+)"?/)?.[1] || `Acta_${d.numero}.docx`;
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob); a.download = decodeURIComponent(filename);
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        showToast('✅ Acta descargada', 'success');
      } catch(e) { showToast(e.message, 'error'); }
      finally { btn.innerHTML = `${iconDocument(13)} Acta Word`; btn.disabled = false; }
    };

    // Acta interaction
    setupActaInteraction(body, d, actaInfo, overlay);

  }).catch(e => {
    overlay.querySelector('#modal-body').innerHTML = `<div style="color:#f87171;padding:20px;text-align:center;">${e.message}</div>`;
  });
}

function renderActaSection(d, actaInfo = { token: null }) {
  if (!d.requiere_acta) {
    return `<div style="display:flex;align-items:center;gap:8px;">${actaBadge(d)}<span style="font-size:12px;color:var(--text-3);">Este despacho no requiere acta de entrega.</span></div>`;
  }

  let firmaSection = '';
  if (actaInfo.token && actaInfo.uploaded) {
    firmaSection = `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#d1fae5;border-radius:8px;border:1px solid #6ee7b7;margin-bottom:10px;">
        <span style="font-size:18px;">✅</span>
        <div style="flex:1;">
          <div style="font-weight:600;color:#065f46;font-size:13px;">Acta firmada recibida</div>
          <div style="font-size:12px;color:#047857;">${actaInfo.uploaded_at ? new Date(actaInfo.uploaded_at).toLocaleString('es-CO') : ''}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <a id="btn-download-acta" href="/api/actas/download/${actaInfo.token}" style="padding:6px 12px;background:#059669;color:#fff;border:none;border-radius:6px;font-size:12px;font-weight:500;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;gap:5px;">${iconDownload(12)} Descargar</a>
          <button id="btn-reupload-acta" class="btn btn-secondary btn-small" style="font-size:12px;padding:6px 12px;display:inline-flex;align-items:center;gap:4px;">${iconRefresh(12)} Reemplazar</button>
        </div>
      </div>
      <input type="file" id="acta-direct-upload-file" accept=".pdf,.docx" style="display:none;">`;
  } else if (actaInfo.token && !actaInfo.uploaded) {
    firmaSection = `
      <div style="padding:10px 14px;background:var(--surface-3);border-radius:8px;border:1px solid var(--border);margin-bottom:10px;">
        <div style="font-size:12px;font-weight:500;color:var(--text-2);margin-bottom:8px;display:flex;align-items:center;gap:5px;">${iconLink(12)} Link de firma activo — pendiente de subida</div>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;">
          <input id="link-firma-input" type="text" readonly value="${actaInfo.url || ''}"
            style="flex:1;padding:6px 9px;border:1px solid var(--border);border-radius:5px;background:var(--surface);color:var(--text);font-size:11px;font-family:monospace;">
          <button id="btn-copy-link" style="padding:6px 10px;border:1px solid var(--border);border-radius:5px;background:var(--surface-2);color:var(--text-2);font-size:11px;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;">${iconCopy(11)} Copiar</button>
        </div>
        <div style="display:flex;align-items:center;gap:15px;flex-wrap:wrap;margin-bottom:8px;">
          <img src="/api/actas/qr/${actaInfo.token}" alt="QR" style="width:100px;height:100px;border-radius:6px;background:#fff;padding:4px;display:block;">
          <div style="display:flex;flex-direction:column;gap:8px;">
            <button id="btn-direct-upload" class="btn btn-secondary btn-small" style="gap:5px;display:inline-flex;align-items:center;font-size:12px;padding:6px 12px;">${iconUpload(12)} Subir Acta Firmada</button>
            <button id="btn-regen-link" style="font-size:11px;color:var(--text-3);background:none;border:none;cursor:pointer;text-decoration:underline;text-align:left;display:inline-flex;align-items:center;gap:4px;">${iconRefresh(11)} Regenerar link</button>
          </div>
        </div>
      </div>
      <input type="file" id="acta-direct-upload-file" accept=".pdf,.docx" style="display:none;">`;
  } else {
    firmaSection = `
      <div style="margin-bottom:10px;">
        <button id="btn-get-link" class="btn btn-secondary" style="font-size:12px;padding:7px 14px;display:inline-flex;align-items:center;gap:5px;">${iconLink(12)} Obtener link de firma</button>
      </div>`;
  }

  if (d.acta_firmada) {
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#d1fae5;border-radius:8px;border:1px solid #6ee7b7;">
        <span style="font-size:18px;">✓</span>
        <div>
          <div style="font-weight:600;color:#065f46;font-size:13px;">Acta marcada como firmada</div>
          ${d.acta_numero ? `<div style="font-size:12px;color:#047857;">N° ${d.acta_numero}</div>` : ''}
        </div>
      </div>
      ${firmaSection}`;
  }

  return `
    <div style="padding:12px 14px;background:var(--surface-2);border-radius:8px;border:1px solid var(--border);">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">${actaBadge(d)}</div>
      ${firmaSection}
      <div style="display:flex;gap:8px;align-items:center;">
        <input id="input-acta-numero" type="text" placeholder="N° de acta (opcional)" value="${d.acta_numero || ''}"
          style="flex:1;padding:7px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;">
        <button id="btn-firmar" class="btn btn-primary" style="white-space:nowrap;">Marcar como firmada</button>
      </div>
    </div>`;
}

function setupActaInteraction(body, d, actaInfo = { token: null }, overlay) {
  const btnFirmar = body.querySelector('#btn-firmar');
  if (btnFirmar) {
    btnFirmar.onclick = async () => {
      const actaNumero = body.querySelector('#input-acta-numero')?.value.trim() || null;
      btnFirmar.disabled = true;
      btnFirmar.textContent = 'Guardando…';
      try {
        await updateDespacho(d.id, { acta_firmada: 1, acta_numero: actaNumero, agente: state.currentAgent.name });
        showToast('Acta marcada como firmada', 'success');
        overlay.remove();
        document.querySelector('#btn-refresh-despachos')?.click();
      } catch (e) {
        showToast(e.message, 'error');
        btnFirmar.disabled = false;
        btnFirmar.textContent = 'Marcar como firmada';
      }
    };
  }

  const btnGetLink = body.querySelector('#btn-get-link');
  if (btnGetLink) {
    btnGetLink.onclick = async () => {
      btnGetLink.disabled = true;
      btnGetLink.textContent = 'Generando…';
      try {
        const res = await fetch('/api/actas/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_type: 'despacho', entity_id: d.id, entity_ref: d.acta_numero || d.numero }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const newActaInfo = await fetchActaInfo('despacho', d.id);
        body.querySelector('#acta-section').innerHTML = renderActaSection(d, newActaInfo);
        setupActaInteraction(body, d, newActaInfo, overlay);
        showToast('Link generado. Compártelo con el receptor.', 'success');
      } catch (e) {
        showToast(e.message, 'error');
        btnGetLink.disabled = false;
        btnGetLink.innerHTML = `${iconLink(12)} Obtener link de firma`;
      }
    };
  }

  const btnCopyLink = body.querySelector('#btn-copy-link');
  if (btnCopyLink) {
    btnCopyLink.onclick = async () => {
      const input = body.querySelector('#link-firma-input');
      if (!input) return;
      const ok = await copyToClipboard(input.value);
      if (ok) {
        showToast('Link copiado al portapapeles', 'success');
      } else {
        showToast('No se pudo copiar el link', 'error');
      }
    };
  }

  const btnRegen = body.querySelector('#btn-regen-link');
  if (btnRegen) {
    btnRegen.onclick = async () => {
      if (!confirm('¿Regenerar el link? El link anterior dejará de funcionar.')) return;
      btnRegen.textContent = 'Regenerando…';
      try {
        const res = await fetch('/api/actas/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ entity_type: 'despacho', entity_id: d.id, entity_ref: d.acta_numero || d.numero }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        const newActaInfo = await fetchActaInfo('despacho', d.id);
        body.querySelector('#acta-section').innerHTML = renderActaSection(d, newActaInfo);
        setupActaInteraction(body, d, newActaInfo, overlay);
        showToast('Link regenerado', 'success');
      } catch (e) {
        showToast(e.message, 'error');
        btnRegen.textContent = '🔄 Regenerar link';
      }
    };
  }

  // ── Subida directa y reemplazo de acta ───────────────────────────
  const fileInput = body.querySelector('#acta-direct-upload-file');
  const handleUpload = async (file) => {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['pdf', 'docx'].includes(ext)) {
      showToast('Solo se aceptan archivos PDF o DOCX.', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('El archivo supera el límite de 10 MB.', 'error');
      return;
    }

    const fd = new FormData();
    fd.append('acta', file);

    const uploadBtn = body.querySelector('#btn-direct-upload') || body.querySelector('#btn-reupload-acta');
    const originalText = uploadBtn ? uploadBtn.textContent : '';
    if (uploadBtn) {
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'Subiendo…';
    }

    try {
      const res = await fetch(`/api/actas/upload/${actaInfo.token}`, { method: 'POST', body: fd });
      const resData = await res.json();
      if (!res.ok) throw new Error(resData.error || 'Error al subir el archivo');

      showToast('✅ Acta subida correctamente', 'success');
      d.acta_firmada = 1;
      const newActaInfo = await fetchActaInfo('despacho', d.id);
      body.querySelector('#acta-section').innerHTML = renderActaSection(d, newActaInfo);
      setupActaInteraction(body, d, newActaInfo, overlay);
      document.querySelector('#btn-refresh-despachos')?.click();
    } catch (e) {
      showToast(e.message, 'error');
      if (uploadBtn) {
        uploadBtn.disabled = false;
        uploadBtn.textContent = originalText;
      }
    }
  };

  if (fileInput) {
    fileInput.onchange = () => {
      if (fileInput.files[0]) handleUpload(fileInput.files[0]);
    };
  }

  body.querySelector('#btn-direct-upload')?.addEventListener('click', () => fileInput?.click());
  body.querySelector('#btn-reupload-acta')?.addEventListener('click', () => fileInput?.click());

  // ── Auto-polling: detecta cuando el receptor sube el acta ────────────
  // Sólo corre cuando el link está activo pero el acta aún no fue recibida.
  if (actaInfo.token && !actaInfo.uploaded) {
    const pollTimer = setInterval(async () => {
      // Si el cuerpo del modal ya no está en el DOM (se cerró), detener.
      if (!document.contains(body)) { clearInterval(pollTimer); return; }
      try {
        const newInfo = await fetchActaInfo('despacho', d.id);
        if (newInfo.uploaded) {
          clearInterval(pollTimer);
          d.acta_firmada = 1;
          const section = body.querySelector('#acta-section');
          if (section) {
            section.innerHTML = renderActaSection(d, newInfo);
            setupActaInteraction(body, d, newInfo, overlay);
          }
          showToast('✅ ¡Acta firmada recibida automáticamente!', 'success');
          document.querySelector('#btn-refresh-despachos')?.click();
        }
      } catch { /* ignorar errores de red */ }
    }, 8000);
  }
}

/* ── Create Modal ────────────────────────────────────────────────────── */

async function openCreateModal(onSuccess) {
  const areaOptions = Object.entries(AREA_MAPPINGS)
    .map(([val, { label }]) => `<option value="${val}">${label}</option>`)
    .join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;';

  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:12px;padding:28px;width:100%;max-width:640px;margin:auto 0;box-shadow:0 20px 60px rgba(0,0,0,.4);position:relative;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;">
        <h2 style="margin:0;font-size:17px;font-weight:700;color:var(--text);">Nuevo Despacho</h2>
        <button id="create-modal-close" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:20px;line-height:1;">✕</button>
      </div>

      <form id="form-despacho" autocomplete="off">

        <!-- Banner borrador -->
        <div id="borrador-banner" style="display:none;margin-bottom:16px;padding:10px 14px;border-radius:8px;border:1px solid var(--border);background:var(--surface-2);">
          <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;">
            <span id="borrador-banner-text" style="font-size:13px;color:var(--text-2);"></span>
            <div style="display:flex;gap:8px;flex-shrink:0;">
              <button type="button" id="btn-restaurar-borrador" style="padding:5px 12px;border:1px solid var(--primary);border-radius:6px;background:var(--primary-light);color:var(--primary);font-size:12px;font-weight:500;cursor:pointer;">Restaurar</button>
              <button type="button" id="btn-descartar-borrador" style="padding:5px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface-3);color:var(--text-3);font-size:12px;cursor:pointer;">Descartar</button>
            </div>
          </div>
        </div>

        <!-- Destinatario / Sede / Area -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div style="grid-column:1/-1;">
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">Destinatario *</label>
            <input name="destinatario" required type="text" placeholder="Nombre del receptor"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">Sede</label>
            <input name="sede" type="text" placeholder="Ej. Sede Norte"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">Área</label>
            <select name="area"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
              <option value="">Selecciona área...</option>
              ${areaOptions}
            </select>
          </div>
        </div>

        <!-- Artículos -->
        <div style="margin-bottom:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <label style="font-size:12px;font-weight:600;color:var(--text-2);">Artículos *</label>
            <button type="button" id="btn-add-articulo" style="font-size:12px;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-2);cursor:pointer;">+ Agregar fila</button>
          </div>
          <div id="articulos-list" style="display:flex;flex-direction:column;gap:6px;">
            ${buildArticuloRow(0, true)}
          </div>
        </div>

        <!-- Observaciones -->
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">Observaciones</label>
          <textarea name="observaciones" rows="2" placeholder="Notas adicionales…"
            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;resize:vertical;box-sizing:border-box;"></textarea>
        </div>

        <!-- Requiere acta -->
        <div style="margin-bottom:8px;display:flex;align-items:center;gap:10px;">
          <input type="checkbox" id="check-requiere-acta" name="requiere_acta" style="width:16px;height:16px;cursor:pointer;">
          <label for="check-requiere-acta" style="font-size:13px;font-weight:500;color:var(--text);cursor:pointer;">¿Requiere acta de entrega?</label>
        </div>
        <div id="acta-info" style="margin-bottom:14px;display:none;padding:9px 12px;background:var(--surface-2);border-radius:7px;border:1px solid var(--border);">
          <span style="font-size:12px;color:var(--text-2);">✔ Se generará un número de acta automáticamente al crear el despacho.</span>
        </div>

        <!-- Ticket vinculado -->
        <div style="margin-bottom:20px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">
            Ticket vinculado <span style="font-weight:400;color:var(--text-3);">(opcional)</span>
          </label>
          <input id="ticket-search-input" type="text" placeholder="Buscar por #ID o descripción…"
            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
          <input type="hidden" id="ticket-id-hidden" name="ticket_id">
          <div id="ticket-search-results" style="display:none;margin-top:4px;border:1px solid var(--border);border-radius:8px;background:var(--surface);max-height:200px;overflow-y:auto;box-shadow:0 4px 16px rgba(0,0,0,.15);"></div>
          <div id="ticket-selected-info" style="display:none;margin-top:6px;padding:7px 10px;background:var(--surface-2);border-radius:6px;border:1px solid var(--border);font-size:12px;color:var(--text-2);display:flex;align-items:center;justify-content:space-between;gap:8px;">
            <span id="ticket-selected-label"></span>
            <button type="button" id="btn-clear-ticket" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:14px;line-height:1;padding:0;">✕</button>
          </div>
        </div>

        <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:16px;border-top:1px solid var(--border);">
          <button type="button" id="btn-cancel-create" class="btn btn-secondary">Cancelar</button>
          <button type="button" id="btn-guardar-borrador" class="btn btn-secondary">💾 Guardar borrador</button>
          <button type="submit" class="btn btn-primary" id="btn-submit-despacho">Crear Despacho</button>
        </div>

      </form>
    </div>`;

  document.body.appendChild(overlay);
  attachSedeSearch(overlay.querySelector('input[name="sede"]'));

  // ── Formateo uniforme de campos al salir (blur) ─────────────────
  const _tc  = s => (s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const _sc  = s => { const v = (s || '').trim(); return v ? v.charAt(0).toUpperCase() + v.slice(1) : v; };

  overlay.querySelector('[name="destinatario"]').addEventListener('blur', e => {
    e.target.value = _tc(e.target.value.trim());
  });
  overlay.querySelector('[name="observaciones"]').addEventListener('blur', e => {
    e.target.value = _sc(e.target.value);
  });

  const closeModal = () => overlay.remove();
  overlay.querySelector('#create-modal-close').onclick = closeModal;
  overlay.querySelector('#btn-cancel-create').onclick = closeModal;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });

  // Dynamic article rows
  let rowCount = 1;

  function wireRow(row) {
    row.querySelector('.btn-remove-row')?.addEventListener('click', function () {
      this.closest('.articulo-row').remove();
    });
    row.querySelector('.btn-dup-row')?.addEventListener('click', function () {
      const curr = this.closest('.articulo-row');
      const nombre = curr.querySelector('[data-field="nombre"]').value;
      const descripcion = curr.querySelector('[data-field="descripcion"]').value;
      const marca = curr.querySelector('[data-field="marca"]').value;
      const modelo = curr.querySelector('[data-field="modelo"]').value;
      const div = document.createElement('div');
      div.innerHTML = buildArticuloRow(rowCount++, false);
      const newRow = div.firstElementChild;
      curr.insertAdjacentElement('afterend', newRow);
      newRow.querySelector('[data-field="nombre"]').value = nombre;
      newRow.querySelector('[data-field="descripcion"]').value = descripcion;
      newRow.querySelector('[data-field="marca"]').value = marca;
      newRow.querySelector('[data-field="modelo"]').value = modelo;
      wireRow(newRow);
      newRow.querySelector('[data-field="nombre"]')?.focus();
    });
    // Formateo Title Case al salir de campos descriptivos
    ['nombre','marca','modelo'].forEach(field => {
      row.querySelector(`[data-field="${field}"]`)?.addEventListener('blur', e => {
        e.target.value = _tc(e.target.value.trim());
      });
    });
  }

  // ── Borrador helpers ─────────────────────────────────────────────
  function serializarFormulario() {
    const rows = overlay.querySelectorAll('.articulo-row');
    const articulos = [];
    for (const row of rows) {
      const nombre = row.querySelector('[data-field="nombre"]').value.trim();
      const cantidad = parseInt(row.querySelector('[data-field="cantidad"]').value) || 1;
      const descripcion = row.querySelector('[data-field="descripcion"]').value.trim();
      const marca = row.querySelector('[data-field="marca"]').value.trim();
      const modelo = row.querySelector('[data-field="modelo"]').value.trim();
      const serial = row.querySelector('[data-field="serial"]').value.trim();
      if (nombre) articulos.push({ nombre, cantidad, descripcion, marca, modelo, serial });
    }
    const fd = new FormData(overlay.querySelector('#form-despacho'));
    return {
      agente:        state.currentAgent.name,
      destinatario:  fd.get('destinatario')  || '',
      sede:          fd.get('sede')           || '',
      area:          fd.get('area')           || '',
      articulos,
      observaciones: fd.get('observaciones') || '',
      requiere_acta: overlay.querySelector('#check-requiere-acta').checked ? 1 : 0,
      ticket_id:     fd.get('ticket_id') ? parseInt(fd.get('ticket_id')) : null,
    };
  }

  function restaurarArticulos(articulos) {
    const list = overlay.querySelector('#articulos-list');
    list.innerHTML = '';
    rowCount = 0;
    const items = articulos.length ? articulos : [{ nombre: '', cantidad: 1, descripcion: '', marca: '', modelo: '', serial: '' }];
    items.forEach((art, idx) => {
      const div = document.createElement('div');
      div.innerHTML = buildArticuloRow(rowCount++, idx === 0);
      const row = div.firstElementChild;
      list.appendChild(row);
      row.querySelector('[data-field="nombre"]').value      = art.nombre      || '';
      row.querySelector('[data-field="cantidad"]').value    = art.cantidad    || 1;
      row.querySelector('[data-field="descripcion"]').value = art.descripcion || '';
      row.querySelector('[data-field="marca"]').value       = art.marca       || '';
      row.querySelector('[data-field="modelo"]').value      = art.modelo      || '';
      row.querySelector('[data-field="serial"]').value      = art.serial      || '';
      wireRow(row);
    });
  }

  overlay.querySelector('#btn-add-articulo').onclick = () => {
    const list = overlay.querySelector('#articulos-list');
    const div = document.createElement('div');
    div.innerHTML = buildArticuloRow(rowCount++, false);
    const row = div.firstElementChild;
    list.appendChild(row);
    wireRow(row);
    row.querySelector('[data-field="nombre"]')?.focus();
  };

  // Wire initial rows (from HTML string)
  overlay.querySelectorAll('.articulo-row').forEach(r => wireRow(r));

  // Show/hide acta info
  const checkAcata = overlay.querySelector('#check-requiere-acta');
  const actaInfo = overlay.querySelector('#acta-info');
  checkAcata.onchange = () => {
    actaInfo.style.display = checkAcata.checked ? 'block' : 'none';
  };

  // Sede autocomplete
  attachSedeSearch(overlay.querySelector('[name="sede"]'));

  // Ticket search
  const ticketSearchInput = overlay.querySelector('#ticket-search-input');
  const ticketResults = overlay.querySelector('#ticket-search-results');
  const ticketIdHidden = overlay.querySelector('#ticket-id-hidden');
  const ticketSelectedInfo = overlay.querySelector('#ticket-selected-info');
  const ticketSelectedLabel = overlay.querySelector('#ticket-selected-label');

  function selectTicket(t) {
    ticketIdHidden.value = t.id;
    ticketSearchInput.style.display = 'none';
    ticketResults.style.display = 'none';
    ticketSelectedInfo.style.display = 'flex';
    ticketSelectedLabel.textContent = `#${t.id} — ${t.description || t.subject || ''}`;
  }

  overlay.querySelector('#btn-clear-ticket').onclick = () => {
    ticketIdHidden.value = '';
    ticketSearchInput.value = '';
    ticketSearchInput.style.display = '';
    ticketSelectedInfo.style.display = 'none';
    ticketResults.style.display = 'none';
  };

  async function searchTickets(q) {
    const params = q ? `search=${encodeURIComponent(q)}&limit=8` : 'status_group=activos&limit=8';
    const res = await fetch(`/api/tickets?${params}`);
    const json = await res.json();
    return json.tickets || json.data || [];
  }

  function renderTicketResults(tickets) {
    if (!tickets.length) {
      ticketResults.innerHTML = `<div style="padding:10px 14px;font-size:12px;color:var(--text-3);">Sin resultados</div>`;
    } else {
      ticketResults.innerHTML = tickets.map(t => `
        <div class="ticket-result-row" data-id="${t.id}" data-desc="${(t.description || '').replace(/"/g, '&quot;')}"
          style="padding:9px 14px;cursor:pointer;font-size:12px;border-bottom:1px solid var(--border);display:flex;gap:8px;align-items:center;">
          <span style="font-family:monospace;font-weight:700;color:var(--primary);white-space:nowrap;">#${t.id}</span>
          <div style="overflow:hidden;flex:1;min-width:0;">
            <div style="color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.description || '—'}</div>
            ${t.requester_name ? `<div style="font-size:11px;color:var(--text-3);">${t.requester_name}</div>` : ''}
          </div>
          ${t.status ? `<span style="white-space:nowrap;font-size:11px;color:var(--text-3);padding:2px 7px;border:1px solid var(--border);border-radius:99px;">${t.status}</span>` : ''}
        </div>`).join('');
      ticketResults.querySelectorAll('.ticket-result-row').forEach(row => {
        row.onmouseenter = () => row.style.background = 'var(--surface-2)';
        row.onmouseleave = () => row.style.background = '';
        row.onclick = () => selectTicket({ id: row.dataset.id, description: row.dataset.desc });
      });
    }
    ticketResults.style.display = 'block';
  }

  // Load recent tickets on focus
  ticketSearchInput.addEventListener('focus', async () => {
    if (ticketIdHidden.value) return;
    const tickets = await searchTickets('');
    renderTicketResults(tickets);
  });

  let ticketSearchTimer;
  ticketSearchInput.addEventListener('input', () => {
    clearTimeout(ticketSearchTimer);
    ticketSearchTimer = setTimeout(async () => {
      const tickets = await searchTickets(ticketSearchInput.value.trim());
      renderTicketResults(tickets);
    }, 300);
  });

  document.addEventListener('click', function hideResults(e) {
    if (!overlay.contains(e.target)) return;
    if (!ticketSearchInput.contains(e.target) && !ticketResults.contains(e.target)) {
      ticketResults.style.display = 'none';
    }
  });

  // ── Lógica del borrador ──────────────────────────────────────────
  const banner    = overlay.querySelector('#borrador-banner');
  const bannerTxt = overlay.querySelector('#borrador-banner-text');

  async function guardarBorrador() {
    try {
      await fetch('/api/despachos/borrador', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(serializarFormulario()),
      });
      showToast('Borrador guardado ✓', 'success');
    } catch {
      showToast('No se pudo guardar el borrador', 'error');
    }
  }

  async function eliminarBorrador() {
    const agente = encodeURIComponent(state.currentAgent.name);
    await fetch(`/api/despachos/borrador?agente=${agente}`, { method: 'DELETE' }).catch(() => {});
  }

  overlay.querySelector('#btn-guardar-borrador').onclick = guardarBorrador;

  overlay.querySelector('#btn-descartar-borrador').onclick = async () => {
    await eliminarBorrador();
    banner.style.display = 'none';
  };

  // Consultar borrador al abrir
  try {
    const agente = encodeURIComponent(state.currentAgent.name);
    const data   = await fetch(`/api/despachos/borrador?agente=${agente}`)
      .then(r => r.ok ? r.json() : Promise.resolve({ borrador: null }));
    if (data.borrador) {
      const { label, old } = _timeAgo(data.borrador.updated_at);
      bannerTxt.textContent = `📝 Tienes un borrador guardado (${label})`;
      banner.style.display  = 'block';
      if (old) {
        banner.style.background  = 'rgba(245,158,11,0.08)';
        banner.style.borderColor = '#f59e0b';
        bannerTxt.style.color    = '#f59e0b';
      }

      overlay.querySelector('#btn-restaurar-borrador').onclick = () => {
        const b = data.borrador;
        overlay.querySelector('[name="destinatario"]').value  = b.destinatario  || '';
        overlay.querySelector('[name="sede"]').value          = b.sede          || '';
        overlay.querySelector('[name="observaciones"]').value = b.observaciones || '';
        const areaSelect = overlay.querySelector('[name="area"]');
        if (areaSelect) areaSelect.value = b.area || '';
        const chk = overlay.querySelector('#check-requiere-acta');
        chk.checked = !!b.requiere_acta;
        overlay.querySelector('#acta-info').style.display = chk.checked ? 'block' : 'none';
        restaurarArticulos(b.articulos || []);
        if (b.ticket_id) {
          overlay.querySelector('#ticket-id-hidden').value = b.ticket_id;
          overlay.querySelector('#ticket-search-input').style.display = 'none';
          overlay.querySelector('#ticket-selected-info').style.display = 'flex';
          overlay.querySelector('#ticket-selected-label').textContent = `#${b.ticket_id} (restaurado del borrador)`;
        }
        banner.style.display = 'none';
        showToast('Borrador restaurado', 'success');
      };
    }
  } catch { /* fallo silencioso */ }

  // Form submit
  overlay.querySelector('#form-despacho').onsubmit = async (e) => {
    e.preventDefault();
    const form = e.target;
    const fd = new FormData(form);

    // Collect articulos
    const rows = overlay.querySelectorAll('.articulo-row');
    const articulos = [];
    for (const row of rows) {
      const nombre = row.querySelector('[data-field="nombre"]').value.trim();
      const cantidad = parseInt(row.querySelector('[data-field="cantidad"]').value) || 1;
      const descripcion = row.querySelector('[data-field="descripcion"]').value.trim();
      const marca = row.querySelector('[data-field="marca"]').value.trim();
      const modelo = row.querySelector('[data-field="modelo"]').value.trim();
      const serial = row.querySelector('[data-field="serial"]').value.trim();
      if (nombre) articulos.push({ nombre, cantidad, descripcion, marca, modelo, serial });
    }
    if (!articulos.length) {
      showToast('Agrega al menos un artículo con nombre.', 'warning');
      return;
    }

    const payload = {
      destinatario: fd.get('destinatario'),
      sede: fd.get('sede') || null,
      area: fd.get('area') || null,
      articulos,
      observaciones: fd.get('observaciones') || null,
      requiere_acta: checkAcata.checked ? 1 : 0,
      ticket_id: fd.get('ticket_id') ? parseInt(fd.get('ticket_id')) : null,
      agente: state.currentAgent.name,
    };

    const btn = form.querySelector('#btn-submit-despacho');
    btn.disabled = true;
    btn.textContent = 'Creando…';

    try {
      const result = await createDespacho(payload);
      eliminarBorrador(); // background, sin await
      showToast(`Despacho ${result.numero} creado correctamente`, 'success');
      closeModal();
      if (onSuccess) onSuccess();
    } catch (err) {
      showToast(err.message, 'error');
      btn.disabled = false;
      btn.textContent = 'Crear Despacho';
    }
  };
}

function buildArticuloRow(idx, isFirst) {
  return `
    <div class="articulo-row" data-row="${idx}"
      style="border: 1px solid var(--border); border-radius: 8px; padding: 12px; margin-bottom: 8px; background: var(--surface-2); display: flex; flex-direction: column; gap: 8px; position: relative;">
      <div style="display: grid; grid-template-columns: 1fr 70px auto auto; gap: 8px; align-items: center;">
        <input data-field="nombre" type="text" placeholder="Nombre del artículo *" required
          style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;min-width:0;">
        <input data-field="cantidad" type="number" min="1" value="1"
          style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;text-align:center;">
        <button type="button" class="btn-dup-row"
          style="padding:6px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface-3);color:var(--text-2);cursor:pointer;font-size:13px;line-height:1;"
          title="Duplicar fila">📋</button>
        <button type="button" class="btn-remove-row"
          style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-3);color:#f87171;cursor:pointer;font-size:14px;line-height:1;${isFirst ? 'visibility:hidden;' : ''}"
          title="Eliminar fila">✕</button>
      </div>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px;">
        <input data-field="marca" type="text" placeholder="Marca (opcional)"
          style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;min-width:0;">
        <input data-field="modelo" type="text" placeholder="Modelo (opcional)"
          style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;min-width:0;">
        <input data-field="serial" type="text" placeholder="Serial (opcional)"
          style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;min-width:0;">
        <input data-field="descripcion" type="text" placeholder="Descripción (opcional)"
          style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;min-width:0;">
      </div>
    </div>`;
}

/* ── Main render ─────────────────────────────────────────────────────── */

export function renderDespacho(container) {
  container.innerHTML = `
    <div style="padding:24px;max-width:1100px;margin:0 auto;">

      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;flex-wrap:wrap;gap:12px;">
        <div>
          <h1 style="margin:0;font-size:22px;font-weight:700;color:var(--text);">Despacho</h1>
          <p style="margin:4px 0 0;font-size:13px;color:var(--text-3);">Gestión de despachos físicos de equipos y materiales IT</p>
        </div>
        <button id="btn-nuevo-despacho" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:7px;">
          <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Nuevo Despacho
        </button>
      </div>

      <!-- Filters -->
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;align-items:center;">
        <input id="filter-search" type="text" placeholder="Buscar por número, destinatario o sede…"
          style="flex:1;min-width:220px;max-width:340px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px;">
        <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text-2);cursor:pointer;padding:7px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);user-select:none;">
          <input type="checkbox" id="filter-pendiente-acta" style="width:14px;height:14px;">
          Solo pendientes de acta
        </label>
        <button id="btn-refresh-despachos" class="btn btn-secondary" style="padding:7px 14px;font-size:13px;">
          Actualizar
        </button>
      </div>

      <!-- Table -->
      <div class="card" style="padding:0;overflow:hidden;">
        <div id="despacho-table-wrap">
          ${createLoadingSpinner()}
        </div>
      </div>

    </div>`;

  let currentParams = {};

  function buildParams() {
    const search = container.querySelector('#filter-search').value.trim();
    const pendiente = container.querySelector('#filter-pendiente-acta').checked;
    const p = { limit: 50, offset: 0 };
    if (search) p.search = search;
    if (pendiente) { p.requiere_acta = 1; p.acta_firmada = 0; }
    return p;
  }

  async function loadTable() {
    const wrap = container.querySelector('#despacho-table-wrap');
    wrap.innerHTML = createLoadingSpinner();
    currentParams = buildParams();
    try {
      const { despachos, total } = await fetchDespachos(currentParams);
      renderTable(wrap, despachos, total);
    } catch (e) {
      wrap.innerHTML = `<div style="padding:30px;color:#f87171;text-align:center;">${e.message}</div>`;
    }
  }

  function renderTable(wrap, despachos, total) {
    if (!despachos.length) {
      wrap.innerHTML = createEmptyState('No se encontraron despachos', '📦');
      return;
    }
    wrap.innerHTML = `
      <div style="padding:12px 18px;font-size:12px;color:var(--text-3);border-bottom:1px solid var(--border);">
        ${total} despacho(s) en total
      </div>
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:var(--surface-2);border-bottom:1px solid var(--border);">
              <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;white-space:nowrap;">Número</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Fecha</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Destinatario</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Sede</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Artículos</th>
              <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Acta</th>
              <th style="padding:10px 14px;text-align:right;font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;">Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${despachos.map(d => `
              <tr style="border-bottom:1px solid var(--border);cursor:pointer;transition:background .15s;"
                  onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''"
                  onclick="document.dispatchEvent(new CustomEvent('open-despacho', {detail:${d.id}}))">
                <td style="padding:11px 14px;font-family:monospace;font-size:12px;font-weight:700;color:var(--primary);white-space:nowrap;">${d.numero}</td>
                <td style="padding:11px 14px;font-size:12px;color:var(--text-2);white-space:nowrap;">${d.fecha || '—'}</td>
                <td style="padding:11px 14px;font-size:13px;font-weight:500;color:var(--text);">${d.destinatario}</td>
                <td style="padding:11px 14px;font-size:12px;color:var(--text-2);">${d.sede || '—'}</td>
                <td style="padding:11px 14px;font-size:12px;color:var(--text-2);">${articulosCount(d)}</td>
                <td style="padding:11px 14px;">${actaBadge(d)}</td>
                <td style="padding:11px 14px;text-align:right;white-space:nowrap;">
                  <button class="btn btn-secondary" style="font-size:11px;padding:4px 10px;margin-right:4px;"
                    onclick="event.stopPropagation();document.dispatchEvent(new CustomEvent('open-despacho', {detail:${d.id}}))">Ver</button>
                  <button class="btn-despacho-edit" data-id="${d.id}"
                    style="font-size:11px;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-2);cursor:pointer;"
                    onclick="event.stopPropagation();">✏️ Editar</button>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;

    // Conectar botones Editar de la tabla
    wrap.querySelectorAll('.btn-despacho-edit').forEach(btn => {
      btn.addEventListener('click', () => openEditDespachoModal(parseInt(btn.dataset.id), loadTable));
    });
  }

  // Event listeners
  container.querySelector('#btn-nuevo-despacho').onclick = () => {
    openCreateModal(() => loadTable());
  };

  container.querySelector('#btn-refresh-despachos').onclick = () => loadTable();

  let searchTimer;
  container.querySelector('#filter-search').addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(loadTable, 350);
  });

  container.querySelector('#filter-pendiente-acta').addEventListener('change', loadTable);

  const openHandler = (e) => openDetailModal(e.detail);
  document.addEventListener('open-despacho', openHandler);

  // Clean up listener when navigating away — use MutationObserver on container
  const observer = new MutationObserver(() => {
    if (!document.body.contains(container.querySelector('#btn-nuevo-despacho'))) {
      document.removeEventListener('open-despacho', openHandler);
      observer.disconnect();
    }
  });
  observer.observe(container, { childList: true, subtree: false });

  // Initial load
  loadTable();
}

/* ═══════════════════════════════════════════════════
   MODAL EDITAR DESPACHO
   ═══════════════════════════════════════════════════ */

async function openEditDespachoModal(id, onSuccess) {
  let d;
  try { d = await fetchDespacho(id); }
  catch (err) { showToast(err.message, 'error'); return; }

  let articulos = [];
  try { articulos = JSON.parse(d.articulos || '[]'); } catch {}

  const areaOptions = Object.entries(AREA_MAPPINGS)
    .map(([v, { label }]) => `<option value="${v}" ${d.area === v ? 'selected' : ''}>${label}</option>`)
    .join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:1000;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;';
  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:16px;padding:32px;width:100%;max-width:680px;margin:auto 0;box-shadow:0 20px 60px rgba(0,0,0,.4);position:relative;">
      <div id="edit-modal-close" style="position:absolute;top:14px;right:14px;width:30px;height:30px;display:flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);cursor:pointer;color:var(--text-2);font-size:16px;">✕</div>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:22px;">
        <div style="width:40px;height:40px;background:linear-gradient(135deg,#f59e0b,#ea580c);border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">✏️</div>
        <div>
          <h2 style="margin:0;font-size:17px;font-weight:700;color:var(--text);">Editar Despacho</h2>
          <p style="margin:2px 0 0;font-size:12px;color:var(--text-3);">${d.numero} — modifica los datos y guarda los cambios</p>
        </div>
      </div>
      <form id="form-edit-despacho">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
          <div style="grid-column:1/-1;">
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">Destinatario *</label>
            <input name="destinatario" required type="text" value="${d.destinatario || ''}"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">Sede</label>
            <input name="sede" type="text" value="${d.sede || ''}"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">Área</label>
            <select name="area" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
              <option value="">Selecciona área...</option>${areaOptions}
            </select>
          </div>
        </div>
        <div style="margin-bottom:14px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <label style="font-size:12px;font-weight:600;color:var(--text-2);">Artículos *</label>
            <button type="button" id="btn-add-art-edit" style="font-size:12px;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-2);cursor:pointer;">+ Agregar fila</button>
          </div>
          <div id="arts-list-edit" style="display:flex;flex-direction:column;gap:6px;"></div>
        </div>
        <div style="margin-bottom:14px;">
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">Observaciones</label>
          <textarea name="observaciones" rows="2" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;resize:vertical;box-sizing:border-box;">${d.observaciones || ''}</textarea>
        </div>
        <div style="margin-bottom:20px;display:flex;align-items:center;gap:10px;">
          <input type="checkbox" id="edit-check-acta" name="requiere_acta" style="width:16px;height:16px;" ${d.requiere_acta ? 'checked' : ''}>
          <label for="edit-check-acta" style="font-size:13px;font-weight:500;color:var(--text);cursor:pointer;">¿Requiere acta de entrega?</label>
        </div>
        <div style="display:flex;gap:10px;justify-content:flex-end;padding-top:16px;border-top:1px solid var(--border);">
          <button type="button" id="btn-cancel-edit" class="btn btn-secondary">Cancelar</button>
          <button type="submit" id="btn-submit-edit" class="btn btn-primary" style="background:linear-gradient(135deg,#f59e0b,#ea580c);border:none;">💾 Guardar Cambios</button>
        </div>
      </form>
    </div>`;

  document.body.appendChild(overlay);
  attachSedeSearch(overlay.querySelector('input[name="sede"]'));

  const _tc = s => (s || '').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
  const _sc = s => { const v = (s || '').trim(); return v ? v.charAt(0).toUpperCase() + v.slice(1) : v; };
  overlay.querySelector('[name="destinatario"]').addEventListener('blur', e => { e.target.value = _tc(e.target.value.trim()); });
  overlay.querySelector('[name="observaciones"]').addEventListener('blur', e => { e.target.value = _sc(e.target.value); });

  let rowCount = 0;

  function buildArtRow(art = {}, isFirst = false) {
    const i = rowCount++;
    return `<div class="art-row-edit" style="border:1px solid var(--border);border-radius:8px;padding:12px;background:var(--surface-2);display:flex;flex-direction:column;gap:8px;">
      <div style="display:grid;grid-template-columns:1fr 70px auto auto;gap:8px;align-items:center;">
        <input data-field="nombre" type="text" value="${art.nombre||''}" placeholder="Nombre del artículo *" required style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;min-width:0;">
        <input data-field="cantidad" type="number" min="1" value="${art.cantidad||1}" style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;text-align:center;">
        <button type="button" class="btn-dup-art" style="padding:6px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface-3);color:var(--text-2);cursor:pointer;" title="Duplicar">📋</button>
        <button type="button" class="btn-rem-art" style="padding:6px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface-3);color:#f87171;cursor:pointer;${isFirst?'visibility:hidden;':''}" title="Eliminar">✕</button>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:8px;">
        <input data-field="marca"       type="text" value="${art.marca||''}"       placeholder="Marca"       style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;">
        <input data-field="modelo"      type="text" value="${art.modelo||''}"      placeholder="Modelo"      style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;">
        <input data-field="serial"      type="text" value="${art.serial||''}"      placeholder="Serial"      style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;">
        <input data-field="descripcion" type="text" value="${art.descripcion||''}" placeholder="Descripción" style="padding:7px 9px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:12px;">
      </div>
    </div>`;
  }

  function wireArtRow(row) {
    row.querySelector('.btn-rem-art')?.addEventListener('click', function() { this.closest('.art-row-edit').remove(); });
    row.querySelector('.btn-dup-art')?.addEventListener('click', function() {
      const curr = this.closest('.art-row-edit');
      const art  = { nombre: curr.querySelector('[data-field="nombre"]').value, cantidad: curr.querySelector('[data-field="cantidad"]').value, marca: curr.querySelector('[data-field="marca"]').value, modelo: curr.querySelector('[data-field="modelo"]').value, descripcion: curr.querySelector('[data-field="descripcion"]').value };
      const div  = document.createElement('div'); div.innerHTML = buildArtRow(art, false);
      const newRow = div.firstElementChild;
      curr.insertAdjacentElement('afterend', newRow);
      wireArtRow(newRow);
    });
    ['nombre','marca','modelo'].forEach(f => {
      row.querySelector(`[data-field="${f}"]`)?.addEventListener('blur', e => { e.target.value = _tc(e.target.value.trim()); });
    });
  }

  const list = overlay.querySelector('#arts-list-edit');
  (articulos.length ? articulos : [{}]).forEach((art, idx) => {
    const div = document.createElement('div'); div.innerHTML = buildArtRow(art, idx === 0);
    const row = div.firstElementChild; list.appendChild(row); wireArtRow(row);
  });

  overlay.querySelector('#btn-add-art-edit').onclick = () => {
    const div = document.createElement('div'); div.innerHTML = buildArtRow({}, false);
    const row = div.firstElementChild; list.appendChild(row); wireArtRow(row);
    row.querySelector('[data-field="nombre"]')?.focus();
  };

  const close = () => overlay.remove();
  overlay.querySelector('#edit-modal-close').onclick = close;
  overlay.querySelector('#btn-cancel-edit').onclick   = close;
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

  overlay.querySelector('#form-edit-despacho').onsubmit = async e => {
    e.preventDefault();
    const fd   = new FormData(e.target);
    const rows = overlay.querySelectorAll('.art-row-edit');
    const arts = [];
    for (const row of rows) {
      const nombre = row.querySelector('[data-field="nombre"]').value.trim();
      if (!nombre) continue;
      arts.push({ nombre, cantidad: parseInt(row.querySelector('[data-field="cantidad"]').value)||1, marca: row.querySelector('[data-field="marca"]').value.trim(), modelo: row.querySelector('[data-field="modelo"]').value.trim(), serial: row.querySelector('[data-field="serial"]').value.trim(), descripcion: row.querySelector('[data-field="descripcion"]').value.trim() });
    }
    if (!arts.length) { showToast('Agrega al menos un artículo.', 'warning'); return; }

    const btn = overlay.querySelector('#btn-submit-edit');
    btn.textContent = 'Guardando…'; btn.disabled = true;
    try {
      await updateDespacho(id, { destinatario: fd.get('destinatario'), sede: fd.get('sede')||null, area: fd.get('area')||null, articulos: arts, observaciones: fd.get('observaciones')||null, requiere_acta: overlay.querySelector('#edit-check-acta').checked ? 1 : 0, agente: state.currentAgent.name });
      showToast('✅ Despacho actualizado', 'success');
      close(); onSuccess();
    } catch (err) {
      showToast(err.message, 'error');
      btn.textContent = '💾 Guardar Cambios'; btn.disabled = false;
    }
  };
}

