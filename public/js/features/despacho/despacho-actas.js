import { showToast, createEmptyState, createLoadingSpinner, copyToClipboard } from '../../ui/components.js';
import { iconCopy, iconDownload, iconExternalLink, iconLink, iconRefresh, iconSearch, iconEye,
         iconClose, iconDocument, iconChevronLeft, iconChevronRight } from '../../utils/icons.js';
import { openDetailModal } from './despacho-detail.js';

const PER_PAGE = 25;

let _publicUrlCache = null;
async function getPublicBase() {
  if (_publicUrlCache) return _publicUrlCache;
  try {
    const r = await fetch('/api/public-url');
    const d = await r.json();
    if (d.url) _publicUrlCache = d.url.replace(/\/$/, '');
  } catch {}
  return _publicUrlCache;
}

function escHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString('es-CO');
}

function isActaFirmada(acta) {
  return Boolean(
    acta.acta_estado === 'firmada' ||
    acta.acta_firmada_real ||
    acta.uploaded_at ||
    acta.filename ||
    acta.filepath ||
    acta.signed_by ||
    acta.signed_role ||
    acta.despacho_acta_firmada
  );
}

function getFirmanteLabel(acta) {
  if (acta.signed_by) return acta.signed_by;
  if (acta.firmante_display) return acta.firmante_display;
  if (isActaFirmada(acta)) return 'Firmada';
  return 'Pendiente de firma';
}

function actaStatusBadge(acta) {
  if (isActaFirmada(acta)) {
    return `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:600;background:rgba(16,185,129,.12);color:var(--success);border:1px solid rgba(16,185,129,.25);">Firmada</span>`;
  }
  if (acta.token) {
    return `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:600;background:rgba(245,158,11,.12);color:var(--warning);border:1px solid rgba(245,158,11,.25);">Pendiente</span>`;
  }
  return `<span style="display:inline-flex;align-items:center;gap:5px;padding:3px 9px;border-radius:99px;font-size:11px;font-weight:600;background:var(--surface-2);color:var(--text-3);border:1px solid var(--border);">Sin link</span>`;
}

async function fetchActas(params = {}) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/actas?${qs}`);
  if (!res.ok) throw new Error('No se pudieron cargar las actas');
  return res.json();
}

async function createActaToken(acta) {
  const res = await fetch('/api/actas/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      entity_type: 'despacho',
      entity_id: acta.entity_id,
      entity_ref: acta.despacho_acta_numero || acta.entity_ref || acta.despacho_numero,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || 'No se pudo generar el enlace');
  return json;
}

async function copyLink(value) {
  const ok = await copyToClipboard(value);
  if (ok) showToast('Enlace copiado', 'success');
  else showToast('No se pudo copiar', 'error');
}

export function renderDespachoActasPanel(container, { focusId = null } = {}) {
  container.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div class="card" style="padding:16px 18px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;">
          <div>
            <h3 style="margin:0;font-size:16px;font-weight:700;color:var(--text);">Actas de entrega</h3>
            <p style="margin:3px 0 0;font-size:12px;color:var(--text-3);">Gestiona enlaces, firmantes y archivos asociados a cada despacho.</p>
          </div>
          <button id="btn-refresh-actas" class="btn btn-secondary" style="padding:7px 12px;font-size:12px;display:inline-flex;align-items:center;gap:6px;">${iconRefresh(12)} Actualizar</button>
        </div>
        <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;align-items:center;">
          <div style="flex:1;min-width:200px;position:relative;">
            <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--text-3);">${iconSearch(12)}</span>
            <input id="actas-search" type="text" placeholder="Buscar acta, despacho o destinatario…"
              style="width:100%;padding:9px 9px 9px 30px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px;">
          </div>
          <select id="actas-status" style="padding:9px 10px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px;cursor:pointer;">
            <option value="">Todas</option>
            <option value="pending">Pendientes</option>
            <option value="uploaded">Firmadas</option>
          </select>
        </div>
      </div>
      <div id="actas-list-wrap" class="card" style="padding:0;overflow:hidden;min-height:240px;">
        ${createLoadingSpinner()}
      </div>
      <div id="actas-pagination" style="display:flex;justify-content:center;align-items:center;gap:6px;flex-wrap:wrap;min-height:32px;"></div>
    </div>`;

  const listWrap = container.querySelector('#actas-list-wrap');
  const searchInput = container.querySelector('#actas-search');
  const statusSelect = container.querySelector('#actas-status');
  const refreshBtn = container.querySelector('#btn-refresh-actas');

  let actas         = [];
  let _total        = 0;
  let _page         = 1;
  let loadSeq       = 0;
  let _didFocusScroll = false;

  function buildParams() {
    const params = { entity_type: 'despacho', limit: PER_PAGE, page: _page };
    const q = searchInput.value.trim();
    if (q) params.q = q;
    if (statusSelect.value) params.status = statusSelect.value;
    return params;
  }

  async function openActaModal(acta) {
    const existing = document.getElementById('acta-detail-modal');
    if (existing) existing.remove();

    const base = await getPublicBase();
    const publicUrl = acta.token
      ? `${base || location.origin}/firmar/${acta.token}`
      : '';
    const overlay = document.createElement('div');
    overlay.id = 'acta-detail-modal';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:2000;display:flex;align-items:flex-start;justify-content:center;padding:24px 16px;overflow-y:auto;';

    overlay.innerHTML = `
      <div style="background:var(--surface);border-radius:14px;width:100%;max-width:540px;margin:auto;box-shadow:0 24px 64px rgba(0,0,0,.5);overflow:hidden;">
        <div style="padding:18px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;">
          <div>
            <div style="font-size:16px;font-weight:800;color:var(--text);">${escHtml(acta.despacho_acta_numero || acta.entity_ref || acta.despacho_numero || 'Acta')}</div>
            <div style="font-size:12px;color:var(--text-3);margin-top:2px;">${escHtml(acta.despacho_destinatario || '—')}</div>
          </div>
          <div style="display:flex;align-items:center;gap:10px;">
            ${actaStatusBadge(acta)}
            <button id="acta-modal-close" style="background:none;border:none;color:var(--text-3);cursor:pointer;padding:4px;display:flex;align-items:center;">${iconClose(16)}</button>
          </div>
        </div>

        <div style="padding:18px 20px;display:grid;grid-template-columns:1fr 1fr;gap:10px;border-bottom:1px solid var(--border);">
          ${[
            ['Despacho', acta.despacho_numero || '—'],
            ['Destinatario', acta.despacho_destinatario || '—'],
            ['Fecha', acta.despacho_fecha || '—'],
            ['Sede', acta.despacho_sede || '—'],
          ].map(([label, value]) => `
            <div style="padding:9px 11px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);">
              <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">${label}</div>
              <div style="font-size:13px;color:var(--text);font-weight:500;">${escHtml(value)}</div>
            </div>`).join('')}
        </div>

        <div style="padding:14px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;">
          <div style="flex:1;">
            <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">Firmante</div>
            <div style="font-size:14px;color:var(--text);font-weight:600;">${escHtml(getFirmanteLabel(acta))}</div>
            ${acta.signed_role ? `<div style="font-size:12px;color:var(--text-3);">${escHtml(acta.signed_role)}</div>` : ''}
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:7px;">
            <button id="modal-btn-despacho" class="btn btn-secondary" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:7px 12px;">${iconEye(12)} Ver despacho</button>
            ${acta.token ? `<a href="${publicUrl}" target="_blank" rel="noreferrer" class="btn btn-secondary" style="text-decoration:none;display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:7px 12px;">${iconExternalLink(12)} Abrir firma</a>` : ''}
          </div>
        </div>

        <div style="padding:16px 20px;">
          ${acta.token ? `
            <div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px;margin-bottom:10px;">${iconLink(11)} Enlace de firma</div>
            <div style="display:flex;gap:6px;align-items:center;margin-bottom:12px;flex-wrap:wrap;">
              <input type="text" readonly value="${publicUrl}"
                style="flex:1;min-width:0;padding:8px 10px;border:1px solid var(--border);border-radius:7px;background:var(--surface-2);color:var(--text-2);font-size:11px;font-family:monospace;overflow:hidden;text-overflow:ellipsis;">
              <button id="modal-btn-copy" class="btn btn-secondary" style="display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:7px 12px;white-space:nowrap;">${iconCopy(12)} Copiar</button>
              <button id="modal-btn-regen" class="btn btn-secondary" style="display:inline-flex;align-items:center;gap:5px;font-size:12px;padding:7px 12px;white-space:nowrap;">${iconRefresh(12)} ${acta.uploaded_at ? 'Reactivar' : 'Regenerar'}</button>
            </div>
            <div style="display:flex;gap:12px;align-items:flex-start;">
              <img src="/api/actas/qr/${acta.token}" alt="QR" style="width:80px;height:80px;border-radius:8px;background:#fff;padding:3px;flex-shrink:0;">
              <div style="font-size:12px;color:var(--text-3);line-height:1.5;padding-top:2px;">Comparte este enlace con quien debe firmar. Si ya fue subida, puedes generar otro enlace.</div>
            </div>
          ` : `
            <div style="padding:14px;border:1px dashed var(--border);border-radius:10px;background:var(--surface-2);">
              <div style="font-size:12px;color:var(--text-2);margin-bottom:10px;">No se ha generado enlace de firma para este despacho.</div>
              <button id="modal-btn-create" class="btn btn-primary" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:7px 14px;">${iconLink(12)} Obtener link de firma</button>
            </div>
          `}
          ${acta.filename ? `
            <div style="margin-top:14px;padding:12px 14px;border:1px solid var(--border);border-radius:10px;background:var(--surface-2);">
              <div style="font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;margin-bottom:4px;">Archivo cargado</div>
              <div style="font-size:13px;color:var(--text);margin-bottom:8px;">${escHtml(acta.filename)}</div>
              <a href="/api/actas/download/${acta.token}" class="btn btn-secondary" style="display:inline-flex;align-items:center;gap:6px;font-size:12px;padding:6px 12px;text-decoration:none;">${iconDownload(12)} Descargar</a>
            </div>` : ''}
        </div>
      </div>`;

    document.body.appendChild(overlay);
    const close = () => overlay.remove();
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    overlay.querySelector('#acta-modal-close').addEventListener('click', close);
    overlay.querySelector('#modal-btn-despacho')?.addEventListener('click', () => { close(); openDetailModal(Number(acta.entity_id)); });
    overlay.querySelector('#modal-btn-copy')?.addEventListener('click', async () => {
      try { await copyLink(publicUrl); } catch { showToast('No se pudo copiar', 'error'); }
    });
    overlay.querySelector('#modal-btn-regen')?.addEventListener('click', async () => {
      if (!confirm('¿Regenerar el enlace? El anterior dejará de funcionar.')) return;
      try { await createActaToken(acta); close(); await refresh(); showToast('Enlace actualizado', 'success'); } catch (e) { showToast(e.message, 'error'); }
    });
    overlay.querySelector('#modal-btn-create')?.addEventListener('click', async () => {
      try { await createActaToken(acta); close(); await refresh(); showToast('Link de firma generado', 'success'); } catch (e) { showToast(e.message, 'error'); }
    });
  }

  function renderPagination() {
    const totalPages = Math.ceil(_total / PER_PAGE);
    const pgWrap = listWrap.parentElement?.querySelector('#actas-pagination');
    if (!pgWrap) return;
    if (totalPages <= 1) { pgWrap.innerHTML = ''; return; }

    let html = `<button class="btn btn-small btn-secondary" id="pg-prev" ${_page === 1 ? 'disabled' : ''}
      style="display:inline-flex;align-items:center;gap:4px;">${iconChevronLeft(13)}</button>`;

    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || Math.abs(i - _page) <= 1) {
        html += `<button class="btn btn-small ${i === _page ? 'btn-primary' : 'btn-secondary'}" data-p="${i}">${i}</button>`;
      } else if (Math.abs(i - _page) === 2) {
        html += `<span style="padding:0 2px;color:var(--text-3);font-size:12px;">…</span>`;
      }
    }
    html += `<button class="btn btn-small btn-secondary" id="pg-next" ${_page === totalPages ? 'disabled' : ''}
      style="display:inline-flex;align-items:center;gap:4px;">${iconChevronRight(13)}</button>`;
    html += `<span style="font-size:12px;color:var(--text-3);margin-left:4px;">${_total} actas</span>`;

    pgWrap.innerHTML = html;
    pgWrap.querySelector('#pg-prev')?.addEventListener('click', () => { _page--; refresh(); });
    pgWrap.querySelector('#pg-next')?.addEventListener('click', () => { _page++; refresh(); });
    pgWrap.querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => { _page = parseInt(b.dataset.p); refresh(); }));
  }

  function renderList() {
    if (!actas.length) {
      listWrap.innerHTML = createEmptyState('No hay actas para mostrar', iconDocument(32));
      return;
    }

    const thStyle = 'padding:10px 14px;text-align:left;font-size:10px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:.5px;white-space:nowrap;';
    listWrap.innerHTML = `
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:var(--surface-2);border-bottom:2px solid var(--border);">
              <th style="${thStyle}width:8px;padding:10px 0 10px 14px;"></th>
              <th style="${thStyle}">Estado</th>
              <th style="${thStyle}">Acta</th>
              <th style="${thStyle}">Destinatario</th>
              <th style="${thStyle}">Despacho</th>
              <th style="${thStyle}">Sede</th>
              <th style="${thStyle}">Firmante</th>
              <th style="${thStyle}">Fecha</th>
            </tr>
          </thead>
          <tbody>
            ${actas.map(acta => {
              const firmada   = isActaFirmada(acta);
              const hasPending = !firmada && acta.token;
              const dotColor  = firmada ? 'var(--success)' : hasPending ? 'var(--warning)' : 'var(--border)';
              const rowBg     = firmada ? 'rgba(16,185,129,.03)' : hasPending ? 'rgba(245,158,11,.025)' : '';
              return `
                <tr data-acta-id="${acta.entity_id}"
                    style="border-bottom:1px solid var(--border);cursor:pointer;background:${rowBg};transition:background .12s;"
                    onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background='${rowBg}'">
                  <td style="padding:11px 0 11px 12px;vertical-align:middle;">
                    <span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${dotColor};flex-shrink:0;"></span>
                  </td>
                  <td style="padding:11px 14px;vertical-align:middle;">${actaStatusBadge(acta)}</td>
                  <td style="padding:11px 14px;vertical-align:middle;">
                    <div style="font-size:12px;font-weight:700;color:var(--primary);font-family:monospace;white-space:nowrap;">${escHtml(acta.despacho_acta_numero || acta.entity_ref || '—')}</div>
                  </td>
                  <td style="padding:11px 14px;vertical-align:middle;max-width:180px;">
                    <div style="font-size:13px;font-weight:600;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(acta.despacho_destinatario || '—')}</div>
                  </td>
                  <td style="padding:11px 14px;vertical-align:middle;">
                    <div style="font-size:12px;color:var(--text-2);font-family:monospace;white-space:nowrap;">${escHtml(acta.despacho_numero || '—')}</div>
                  </td>
                  <td style="padding:11px 14px;vertical-align:middle;">
                    <div style="font-size:12px;color:var(--text-3);white-space:nowrap;">${escHtml(acta.despacho_sede || '—')}</div>
                  </td>
                  <td style="padding:11px 14px;vertical-align:middle;max-width:160px;">
                    <div style="font-size:12px;color:var(--text);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escHtml(getFirmanteLabel(acta))}</div>
                    ${acta.signed_role ? `<div style="font-size:11px;color:var(--text-3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escHtml(acta.signed_role)}</div>` : ''}
                  </td>
                  <td style="padding:11px 14px;vertical-align:middle;">
                    <div style="font-size:11px;color:var(--text-3);white-space:nowrap;">${escHtml(acta.despacho_fecha || '—')}</div>
                  </td>
                </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>`;

    listWrap.querySelectorAll('tr[data-acta-id]').forEach(row => {
      row.addEventListener('click', () => {
        const acta = actas.find(a => Number(a.entity_id) === Number(row.dataset.actaId));
        if (acta) openActaModal(acta);
      });
    });
  }

  async function refresh() {
    const seq = ++loadSeq;
    listWrap.innerHTML = createLoadingSpinner();
    try {
      const json = await fetchActas(buildParams());
      if (seq !== loadSeq) return;
      actas  = json.actas  || [];
      _total = json.total  ?? actas.length;
      renderList();
      renderPagination();
      if (focusId && !_didFocusScroll) {
        _didFocusScroll = true;
        const row = listWrap.querySelector(`tr[data-acta-id="${focusId}"]`);
        if (row) {
          row.style.outline = '2px solid var(--primary)';
          row.style.outlineOffset = '-2px';
          row.scrollIntoView({ behavior: 'smooth', block: 'center' });
          setTimeout(() => { row.style.outline = ''; row.style.outlineOffset = ''; }, 2500);
        }
      }
    } catch (e) {
      if (seq !== loadSeq) return;
      listWrap.innerHTML = `<div style="padding:24px;color:var(--danger);text-align:center;">${escHtml(e.message)}</div>`;
    }
  }

  function resetAndRefresh() { _page = 1; refresh(); }

  refreshBtn.addEventListener('click', refresh);
  searchInput.addEventListener('input', resetAndRefresh);
  statusSelect.addEventListener('change', resetAndRefresh);

  refresh();
}
