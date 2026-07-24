/**
 * despacho-detail.js
 *
 * Handles:
 *  - openDetailModal(id)
 *  - renderActaSection(d, actaInfo)
 *  - renderConfirmacionSection(d, conf)
 *  - setupConfCopy(container)
 */
import { showToast, createLoadingSpinner, copyToClipboard } from '../../ui/components.js';
import { iconClose, iconDocument, iconEdit, iconLink, iconCopy } from '../../utils/icons.js';
import { AREA_MAPPINGS } from '../../core/app.js';
import {
  fetchDespacho, fetchActaInfo, fetchConfirmacion,
  articulosList, actaBadge,
} from './despacho-helpers.js';
import { printDespacho, openRotuloModal } from './despacho-rotulo.js';
import { openEditDespachoModal } from './despacho-edit.js';

const _esc = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

export function openDetailModal(id) {
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
    const [actaInfo, confInfo] = await Promise.all([
      fetchActaInfo('despacho', d.id),
      d.requiere_acta ? Promise.resolve({ token: null, confirmed: false }) : fetchConfirmacion(d.id),
    ]);
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
          ${d.cedula ? `<div style="font-size:11px;color:var(--text-3);">CC ${d.cedula}</div>` : ''}
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

      ${d.requiere_acta ? `
      <div style="margin-bottom:20px;">
        <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;margin-bottom:6px;">Acta</div>
        <div id="acta-section">${renderActaSection(d, actaInfo)}</div>
      </div>` : `
      <div style="margin-bottom:20px;">
        <div style="font-size:11px;font-weight:600;color:var(--text-3);text-transform:uppercase;margin-bottom:6px;">Confirmación de entrega</div>
        <div id="conf-section">${renderConfirmacionSection(d, confInfo)}</div>
      </div>`}

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
    body.querySelector('#btn-open-actas-panel')?.addEventListener('click', () => {
      window.location.hash = `#gestion?tab=actas&focus=${d.id}`;
      overlay.remove();
    });
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

    if (!d.requiere_acta) {
      const confSection = body.querySelector('#conf-section');
      const genBtn = confSection?.querySelector('#conf-gen-btn');
      if (genBtn) {
        genBtn.onclick = async () => {
          genBtn.disabled = true; genBtn.textContent = 'Generando…';
          try {
            const res  = await fetch(`/api/despachos/${d.id}/confirmacion`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            const newConf = await fetchConfirmacion(d.id);
            confSection.innerHTML = renderConfirmacionSection(d, newConf);
            setupConfCopy(confSection);
            showToast('Enlace generado. Compártelo con el destinatario.', 'success');
          } catch (e) {
            showToast(e.message, 'error');
            genBtn.disabled = false;
            genBtn.innerHTML = `${iconLink(12)} Generar enlace de confirmación`;
          }
        };
      }
      setupConfCopy(confSection);
    }

    // Tracking section
    const tkRes = await fetch(`/api/tracking/by-despacho/${d.id}`).then(r => r.ok ? r.json() : { token: null });
    if (tkRes.token) {
      const trackingSection = document.createElement('div');
      trackingSection.style.cssText = 'margin-top:20px;padding-top:16px;border-top:1px solid var(--glass-border);';
      trackingSection.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <h4 style="font-size:13px;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;">
            Tracking del paquete
          </h4>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <a href="/api/tracking/${tkRes.token}/qr" download="QR-${d.numero}.png"
             class="btn btn-secondary btn-small" style="text-decoration:none;font-size:12px;padding:5px 12px;">
             ⬇ QR del paquete
          </a>
          <a href="#trazabilidad" onclick="this.closest('.modal-overlay')?.remove()"
             class="btn btn-secondary btn-small" style="text-decoration:none;font-size:12px;padding:5px 12px;">
             🗺️ Ver timeline completo
          </a>
          <button id="btn-rotulo" class="btn btn-secondary btn-small" style="font-size:12px;padding:5px 12px;">
            🖨️ Rótulo
          </button>
        </div>`;
      overlay.querySelector('#modal-body').appendChild(trackingSection);
      trackingSection.querySelector('#btn-rotulo').onclick = () => openRotuloModal(tkRes.token, d.numero, d.destinatario);
    }

  }).catch(e => {
    overlay.querySelector('#modal-body').innerHTML = `<div style="color:var(--danger);padding:20px;text-align:center;">${_esc(e.message)}</div>`;
  });
}

export function renderConfirmacionSection(d, conf = { token: null, confirmed: false, confirmed_at: null }) {
  if (conf.confirmed) {
    const fecha = conf.confirmed_at ? new Date(conf.confirmed_at).toLocaleString('es-CO') : '';
    const signer = conf.signed_by ? ` por <strong>${conf.signed_by}</strong>` : ' por el destinatario';
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:#d1fae5;border-radius:8px;border:1px solid #6ee7b7;">
        <span style="font-size:18px;">✅</span>
        <div>
          <div style="font-weight:600;color:#065f46;font-size:13px;">Recepción confirmada${signer}</div>
          <div style="font-size:12px;color:#047857;">${fecha}</div>
        </div>
      </div>`;
  }

  if (conf.token) {
    const url = conf.url || `${location.origin}/confirmar/${conf.token}`;
    return `
      <div style="padding:10px 14px;background:var(--surface-3);border-radius:8px;border:1px solid var(--border);">
        <div style="font-size:12px;font-weight:500;color:var(--text-2);margin-bottom:8px;display:flex;align-items:center;gap:5px;">${iconLink(12)} Enlace de confirmación activo — pendiente de respuesta</div>
        <div style="display:flex;gap:6px;align-items:center;">
          <input id="conf-link-input" type="text" readonly value="${url}"
            style="flex:1;padding:6px 9px;border:1px solid var(--border);border-radius:5px;background:var(--surface);color:var(--text);font-size:11px;font-family:monospace;">
          <button id="conf-copy-btn" style="padding:6px 10px;border:1px solid var(--border);border-radius:5px;background:var(--surface-2);color:var(--text-2);font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;">${iconCopy(11)} Copiar</button>
        </div>
      </div>`;
  }

  return `
    <div style="padding:10px 14px;background:var(--surface-2);border-radius:8px;border:1px solid var(--border);">
      <div style="font-size:12px;color:var(--text-3);margin-bottom:10px;">Genera un enlace para que el destinatario confirme que recibió los artículos.</div>
      <button id="conf-gen-btn" class="btn btn-secondary" style="font-size:12px;padding:7px 14px;display:inline-flex;align-items:center;gap:5px;">${iconLink(12)} Generar enlace de confirmación</button>
    </div>`;
}

export function renderActaSection(d, actaInfo = { token: null }) {
  if (!d.requiere_acta) return '';

  const firmante = actaInfo.uploaded && actaInfo.signed_by
    ? `<div style="font-size:12px;color:var(--text-2);margin-top:6px;">Firmó: <strong>${actaInfo.signed_by}</strong>${actaInfo.signed_role ? ` · ${actaInfo.signed_role}` : ''}</div>`
    : '';

  return `
    <div style="padding:12px 14px;background:var(--surface-2);border-radius:8px;border:1px solid var(--border);">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:8px;">
        <div style="display:flex;align-items:center;gap:8px;">${actaBadge(d)}</div>
        <button id="btn-open-actas-panel" class="btn btn-secondary" style="font-size:12px;padding:7px 14px;display:inline-flex;align-items:center;gap:5px;">${iconLink(12)} Abrir gestión de acta</button>
      </div>
      <div style="font-size:13px;color:var(--text-2);line-height:1.5;">
        ${actaInfo.token
          ? (actaInfo.uploaded
            ? `El acta ya fue subida. ${actaInfo.uploaded_at ? `Recibida el ${new Date(actaInfo.uploaded_at).toLocaleString('es-CO')}.` : ''}${firmante}`
            : 'Ya existe un enlace de firma para este despacho. La regeneración y la subida se gestionan en la pestaña de actas.')
          : 'Aún no existe un enlace de firma. Desde la pestaña de actas puedes generarlo y compartirlo.'}
      </div>
    </div>`;
}

export function setupConfCopy(container) {
  const copyBtn = container?.querySelector('#conf-copy-btn');
  const input   = container?.querySelector('#conf-link-input');
  if (!copyBtn || !input) return;
  copyBtn.onclick = async () => {
    const ok = await copyToClipboard(input.value);
    if (ok) showToast('Enlace copiado', 'success');
    else showToast('No se pudo copiar', 'error');
  };
}

