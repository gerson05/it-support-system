/**
 * tech-request-acta.js
 *
 * Handles the Acta generation and Signature/Firma flow for Tech Requests:
 *  - openActaModal(req, onSuccess)  — Renders the custom Acta info table, accessories, and downloads .docx
 *  - setupFirmaSection(container, req)  — Handles obtaining signature link, direct upload, and live polling
 */

import { showToast, copyToClipboard } from '../../ui/components.js';
import { state } from '../../core/app.js';
import {
  iconDocument, iconClose, iconInfo, iconPackage, iconDownload,
  iconLink, iconCopy, iconUpload, iconRefresh
} from '../../utils/icons.js';

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

async function fetchActaInfoTR(entityId) {
  try {
    const res = await fetch(`/api/actas/info/tech_request/${entityId}`);
    if (!res.ok) return { token: null };
    return res.json();
  } catch { return { token: null }; }
}

export function openActaModal(req, onSuccess) {
  const isInc = req.type === 'incidencia';
  const actaOverlay = document.getElementById('acta-modal-overlay');
  if (!actaOverlay) return;

  // Inyectar estilos para los inputs de la tabla del acta
  if (!document.getElementById('acta-modal-styles')) {
    const st = document.createElement('style');
    st.id = 'acta-modal-styles';
    st.textContent = `
      .acta-td-input {
        width:100%; padding:6px 8px;
        background:rgba(255,255,255,.05);
        border:1px solid rgba(255,255,255,.09);
        border-radius:6px; color:#e2e8f0; font-size:12px;
        box-sizing:border-box; transition:border-color .2s,box-shadow .2s;
      }
      .acta-td-input:focus {
        outline:none;
        border-color:rgba(16,185,129,.6);
        box-shadow:0 0 0 3px rgba(16,185,129,.12);
        background:rgba(16,185,129,.06);
      }
      .acta-td-input::placeholder { color:rgba(180,190,210,.3); }
      .acta-item-row { transition: background .15s; }
      .acta-item-row:hover { background:rgba(16,185,129,.04); }
      .acta-item-row:last-child td { border-bottom:none !important; }
    `;
    document.head.appendChild(st);
  }

  // Renderizar tabla con equipos (requerimiento: lista de items; incidencia: equipo afectado)
  const tbody = document.getElementById('acta-items-table');
  if (!tbody) return;

  const tableItems = (isInc && (!req.items || req.items.length === 0))
    ? [{ equipment_name: req.equipment_name || 'Equipo', quantity: 1, serial: req.equipment_serial || '' }]
    : (req.items || []);

  if (tableItems.length > 0) {
    tbody.innerHTML = tableItems.map((item, idx) => {
      const nameParts = (item.equipment_name || '').split(' ');
      const possibleBrand = nameParts.length > 1 ? nameParts[0] : item.equipment_name || '';
      const rowBg = idx % 2 === 0 ? 'rgba(255,255,255,.02)' : 'transparent';
      return `
        <tr class="acta-item-row" style="background:${rowBg};border-bottom:1px solid rgba(255,255,255,.05);">
          <td style="padding:8px 12px;">
            <span style="font-size:12px;color:#e2e8f0;font-weight:500;">${escHtml(item.equipment_name)}</span>
          </td>
          <td style="padding:8px;text-align:center;">
            <span style="display:inline-block;min-width:28px;padding:2px 8px;background:rgba(99,102,241,.15);color:#818cf8;border-radius:99px;font-size:12px;font-weight:700;">${item.quantity}</span>
          </td>
          <td style="padding:6px 8px;">
            <input type="text" class="acta-item-marca acta-td-input" data-idx="${idx}"
              value="${escHtml(possibleBrand)}"
              placeholder="Marca…">
          </td>
          <td style="padding:6px 8px;">
            <input type="text" class="acta-item-modelo acta-td-input" data-idx="${idx}"
              value="${escHtml(item.equipment_name || '')}"
              placeholder="Modelo…">
          </td>
          <td style="padding:6px 8px;">
            <input type="text" class="acta-item-serial acta-td-input" data-idx="${idx}"
              value="${escHtml(item.serial || '')}"
              placeholder="Serial…">
          </td>
        </tr>
      `;
    }).join('');
  }

  actaOverlay.style.display = 'flex';
  document.getElementById('acta-items-table').__tableItems = tableItems;

  const closeActa = () => { actaOverlay.style.display = 'none'; };
  const modalClose = document.getElementById('acta-modal-close');
  const modalCancel = document.getElementById('acta-modal-cancel');
  if (modalClose) modalClose.onclick = closeActa;
  if (modalCancel) modalCancel.onclick = closeActa;
  actaOverlay.onclick = e => { if (e.target === actaOverlay) closeActa(); };

  const downloadBtn = document.getElementById('acta-btn-download');
  if (downloadBtn) {
    downloadBtn.onclick = async () => {
      const accesorios = document.getElementById('acta-accesorios').value.trim();
      const obs        = document.getElementById('acta-obs').value.trim();

      // Recolectar datos de TODOS los equipos editados
      const items = Array.from(document.querySelectorAll('.acta-item-marca')).map((el, idx) => ({
        idx,
        marca: el.value.trim(),
        modelo: document.querySelector(`.acta-item-modelo[data-idx="${idx}"]`)?.value.trim() || '',
        serial: document.querySelector(`.acta-item-serial[data-idx="${idx}"]`)?.value.trim() || '',
      }));

      // Validar que al menos marca y modelo estén en el primer equipo
      if (!items[0]?.marca || !items[0]?.modelo) {
        showToast('Completa al menos Marca y Modelo del primer equipo', 'error');
        return;
      }

      downloadBtn.textContent = '⏳ Generando…';
      downloadBtn.disabled = true;

      try {
        const res = await fetch(`/api/tech-requests/${req.id}/acta`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            items,  // Array de { idx, marca, modelo, serial }
            accesorios,
            observaciones: obs,
            agentName: state.currentUser?.username || 'Soporte IT',
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Error al generar');
        }

        // Descargar el archivo
        const blob     = await res.blob();
        const url      = URL.createObjectURL(blob);
        const filename = res.headers.get('Content-Disposition')
          ?.match(/filename="?([^"]+)"?/)?.[1]
          || `Acta_${req.request_number}.docx`;

        const a = document.createElement('a');
        a.href     = url;
        a.download = decodeURIComponent(filename);
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast('✅ Acta descargada correctamente', 'success');
        closeActa();

        // Registrar en historial
        await fetch(`/api/tech-requests/${req.id}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agentName: state.currentUser?.username || 'IT',
            content: `Acta de entrega generada — ${items.length} equipo(s): ${items.map(i => [i.marca, i.modelo].filter(Boolean).join(' ')).join(', ')}`,
          }),
        });

        if (onSuccess) onSuccess();

      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        downloadBtn.innerHTML = `${iconDownload(13)} Descargar Acta (.docx)`;
        downloadBtn.disabled = false;
      }
    };
  }
}

function renderFirmaContent(actaInfo, req) {
  if (actaInfo.token && actaInfo.uploaded) {
    return `
      <div style="display:flex;align-items:center;gap:10px;padding:10px 14px;background:rgba(16,185,129,.1);border-radius:8px;border:1px solid rgba(16,185,129,.3);margin-bottom:10px;">
        <span style="font-size:18px;">✅</span>
        <div style="flex:1;">
          <div style="font-weight:600;color:#6ee7b7;font-size:13px;">Acta firmada recibida</div>
          <div style="font-size:12px;color:#94a3b8;">${actaInfo.uploaded_at ? new Date(actaInfo.uploaded_at).toLocaleString('es-CO') : ''}</div>
        </div>
        <div style="display:flex;gap:6px;align-items:center;">
          <a href="/api/actas/download/${actaInfo.token}" style="padding:6px 12px;background:#059669;color:#fff;border-radius:6px;font-size:12px;font-weight:500;text-decoration:none;display:inline-flex;align-items:center;gap:5px;">${iconDownload(12)} Descargar</a>
          <button id="btn-reupload-acta-tr" class="btn btn-secondary btn-small" style="font-size:12px;padding:6px 12px;display:inline-flex;align-items:center;gap:4px;">${iconRefresh(12)} Reemplazar</button>
        </div>
      </div>
      <input type="file" id="acta-upload-file-tr" accept=".pdf,.docx" style="display:none;">`;
  }
  if (actaInfo.token && !actaInfo.uploaded) {
    return `
      <div style="font-size:12px;font-weight:500;color:#94a3b8;margin-bottom:8px;display:flex;align-items:center;gap:5px;">${iconLink(12)} Link activo — pendiente de subida por el receptor</div>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;">
        <input type="text" readonly value="${actaInfo.url || ''}"
          style="flex:1;padding:6px 9px;border:1px solid rgba(255,255,255,.1);border-radius:5px;background:#0f172a;color:#e2e8f0;font-size:11px;font-family:monospace;">
        <button id="btn-copy-link-tr" style="padding:6px 10px;border:1px solid rgba(255,255,255,.1);border-radius:5px;background:#1e293b;color:#94a3b8;font-size:11px;cursor:pointer;white-space:nowrap;display:inline-flex;align-items:center;gap:4px;">${iconCopy(11)} Copiar</button>
      </div>
      <div style="display:flex;align-items:center;gap:15px;flex-wrap:wrap;margin-bottom:8px;">
        <img src="/api/actas/qr/${actaInfo.token}" alt="QR" style="width:100px;height:100px;border-radius:6px;background:#fff;padding:4px;display:block;">
        <div style="display:flex;flex-direction:column;gap:8px;">
          <button id="btn-direct-upload-tr" class="btn btn-secondary btn-small" style="gap:5px;display:inline-flex;align-items:center;font-size:12px;padding:6px 12px;">${iconUpload(12)} Subir Acta Firmada</button>
          <button id="btn-regen-link-tr" style="font-size:11px;color:#64748b;background:none;border:none;cursor:pointer;text-decoration:underline;text-align:left;display:inline-flex;align-items:center;gap:4px;">${iconRefresh(11)} Regenerar link</button>
        </div>
      </div>
      <input type="file" id="acta-upload-file-tr" accept=".pdf,.docx" style="display:none;">`;
  }
  return `
    <div style="font-size:13px;color:#64748b;margin-bottom:10px;">Genera el acta, compártela con el receptor y solicita que la suba firmada.</div>
    <button id="btn-get-firma-link" style="padding:8px 16px;background:rgba(99,102,241,.15);border:1px solid rgba(99,102,241,.3);border-radius:8px;color:#818cf8;font-size:13px;font-weight:500;cursor:pointer;display:inline-flex;align-items:center;gap:6px;">${iconLink(13)} Obtener link de firma</button>`;
}

export async function setupFirmaSection(container, req) {
  const section = container.querySelector('#firma-section');
  if (!section) return;

  const content = container.querySelector('#firma-content');
  if (!content) return;

  async function refresh() {
    const actaInfo = await fetchActaInfoTR(req.id);
    content.innerHTML = renderFirmaContent(actaInfo, req);
    wireButtons(actaInfo);
  }

  function wireButtons(actaInfo) {
    const btnGet = content.querySelector('#btn-get-firma-link');
    if (btnGet) {
      btnGet.onclick = async () => {
        btnGet.disabled = true; btnGet.textContent = 'Generando…';
        try {
          const res = await fetch('/api/actas/token', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_type: 'tech_request', entity_id: req.id, entity_ref: req.request_number }),
          });
          if (!res.ok) throw new Error((await res.json()).error);
          await refresh();
          showToast('Link generado. Compártelo con el receptor.', 'success');
        } catch (e) {
          showToast(e.message, 'error');
          btnGet.disabled = false;
          btnGet.innerHTML = `${iconLink(13)} Obtener link de firma`;
        }
      };
    }

    const btnCopy = content.querySelector('#btn-copy-link-tr');
    if (btnCopy) {
      const input = content.querySelector('input[readonly]');
      btnCopy.onclick = async () => {
        const ok = await copyToClipboard(input?.value || '');
        if (ok) {
          showToast('Link copiado', 'success');
        } else {
          showToast('No se pudo copiar el link', 'error');
        }
      };
    }

    const btnRegen = content.querySelector('#btn-regen-link-tr');
    if (btnRegen) {
      btnRegen.onclick = async () => {
        if (!confirm('¿Regenerar el link? El link anterior dejará de funcionar.')) return;
        btnRegen.textContent = 'Regenerando…';
        try {
          const res = await fetch('/api/actas/token', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ entity_type: 'tech_request', entity_id: req.id, entity_ref: req.request_number }),
          });
          if (!res.ok) throw new Error((await res.json()).error);
          await refresh();
          showToast('Link regenerado', 'success');
        } catch (e) {
          showToast(e.message, 'error');
          btnRegen.innerHTML = `${iconRefresh(11)} Regenerar link`;
        }
      };
    }

    // ── Subida directa y reemplazo de acta ───────────────────────────
    const fileInput = content.querySelector('#acta-upload-file-tr');
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

      const uploadBtn = content.querySelector('#btn-direct-upload-tr') || content.querySelector('#btn-reupload-acta-tr');
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
        await refresh();
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

    content.querySelector('#btn-direct-upload-tr')?.addEventListener('click', () => fileInput?.click());
    content.querySelector('#btn-reupload-acta-tr')?.addEventListener('click', () => fileInput?.click());

    // ── Auto-polling: detecta cuando el receptor sube el acta ─────────
    if (actaInfo.token && !actaInfo.uploaded) {
      const pollTimer = setInterval(async () => {
        if (!document.contains(content)) { clearInterval(pollTimer); return; }
        try {
          const newInfo = await fetchActaInfoTR(req.id);
          if (newInfo.uploaded) {
            clearInterval(pollTimer);
            content.innerHTML = renderFirmaContent(newInfo, req);
            wireButtons(newInfo);
            showToast('✅ ¡Acta firmada recibida automáticamente!', 'success');
          }
        } catch { /* ignorar errores de red */ }
      }, 8000);
    }
  }

  await refresh();
}
