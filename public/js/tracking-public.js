const token = location.pathname.split('/').pop();
const root  = document.getElementById('app-root');

let _sedes  = [];
let _cargos = [];
let _pkg    = null;

const style = document.createElement('style');
style.textContent = `
  body { background: #0f172a; }
  .pf-wrap { max-width: 480px; margin: 0 auto; padding: 0 0 40px; }
  .pf-header {
    background: linear-gradient(135deg,#1e1b4b,#312e81);
    padding: 24px 20px 28px; color: #fff;
  }
  .pf-badge {
    display:inline-flex;align-items:center;gap:6px;
    background:rgba(255,255,255,.15);padding:4px 10px;
    border-radius:99px;font-size:11px;font-weight:600;margin-bottom:12px;
  }
  .pf-num { font-size:22px;font-weight:800;letter-spacing:-.5px;margin-bottom:4px; }
  .pf-sub { font-size:13px;opacity:.8; }
  .pf-body { padding:16px; display:flex; flex-direction:column; gap:14px; }
  .pf-card {
    background:#1e293b;border:1px solid rgba(255,255,255,.08);
    border-radius:12px;padding:14px 16px;
  }
  .pf-card-title {
    font-size:11px;font-weight:700;color:#6366f1;text-transform:uppercase;
    letter-spacing:.06em;margin-bottom:12px;display:flex;align-items:center;gap:6px;
  }
  .pf-label { font-size:12px;font-weight:600;color:#94a3b8;margin-bottom:5px;display:block; }
  .pf-input {
    width:100%;padding:10px 12px;border:1.5px solid rgba(255,255,255,.1);
    border-radius:8px;font-size:14px;color:#e2e8f0;background:#0f172a;outline:none;
    transition:border-color .2s;
  }
  .pf-input:focus { border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,.15); }
  .pf-row { display:flex;flex-direction:column;gap:12px; }
  .pf-photo-btn {
    width:100%;padding:20px;border:2px dashed rgba(99,102,241,.4);
    border-radius:10px;background:rgba(99,102,241,.06);color:#818cf8;
    font-size:13px;font-weight:600;display:flex;flex-direction:column;
    align-items:center;gap:6px;cursor:pointer;transition:all .2s;
  }
  .pf-photo-btn:hover { border-color:rgba(99,102,241,.7);background:rgba(99,102,241,.1); }
  .pf-photo-preview {
    width:100%;max-height:200px;object-fit:cover;border-radius:8px;
    border:1px solid rgba(255,255,255,.1);display:none;margin-top:8px;
  }
  .pf-check-row {
    display:flex;align-items:flex-start;gap:10px;
    padding:8px 0;border-bottom:1px solid rgba(255,255,255,.05);
  }
  .pf-check-row:last-child { border-bottom:none; }
  .pf-check-row input[type=checkbox] { width:18px;height:18px;margin-top:2px;accent-color:#6366f1;flex-shrink:0; }
  .pf-check-label { font-size:13px;color:#e2e8f0;flex:1; }
  .pf-check-qty { font-size:11px;color:#64748b;margin-top:2px; }
  .pf-check-obs { width:100%;margin-top:6px;padding:7px 10px;border:1px solid rgba(255,255,255,.08);border-radius:6px;background:#0f172a;color:#94a3b8;font-size:12px;resize:none; }
  .pf-submit {
    width:100%;padding:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);
    border:none;border-radius:10px;color:#fff;font-size:15px;font-weight:700;
    cursor:pointer;box-shadow:0 4px 14px rgba(99,102,241,.4);transition:all .2s;
  }
  .pf-submit:disabled { background:#334155;color:#475569;cursor:not-allowed;box-shadow:none; }
  .pf-final-toggle {
    display:flex;align-items:center;gap:10px;padding:12px;
    background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.2);
    border-radius:8px;cursor:pointer;
  }
  .pf-final-toggle input[type=checkbox] { width:18px;height:18px;accent-color:#10b981;flex-shrink:0; }
  .pf-final-toggle label { font-size:13px;color:#6ee7b7;font-weight:500;cursor:pointer; }
  .pf-final-section { display:none; }
  .pf-final-section.visible { display:flex;flex-direction:column;gap:12px; }
  .pf-info-row { display:flex;justify-content:space-between;font-size:13px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,.05); }
  .pf-info-row:last-child { border-bottom:none; }
  .pf-info-key { color:#64748b; }
  .pf-info-val { font-weight:500;max-width:200px;text-align:right; }
  .pf-estado {
    display:inline-flex;align-items:center;gap:5px;padding:3px 10px;
    border-radius:99px;font-size:11px;font-weight:600;
  }
  .estado-creado    { background:rgba(100,116,139,.2);color:#94a3b8; }
  .estado-en_transito { background:rgba(245,158,11,.15);color:#f59e0b; }
  .estado-en_sede   { background:rgba(99,102,241,.15);color:#818cf8; }
  .estado-entregado { background:rgba(16,185,129,.15);color:#10b981; }
  .estado-devuelto  { background:rgba(239,68,68,.15);color:#f87171; }
  .success-wrap {
    max-width:480px;margin:0 auto;padding:40px 20px;
    display:flex;flex-direction:column;align-items:center;text-align:center;
  }
  .success-icon {
    width:80px;height:80px;border-radius:50%;
    background:linear-gradient(135deg,#10b981,#059669);
    display:flex;align-items:center;justify-content:center;font-size:36px;
    margin-bottom:20px;box-shadow:0 8px 24px rgba(16,185,129,.4);
  }
  .sede-search-wrap { position:relative; }
  .sede-dropdown {
    position:absolute;top:100%;left:0;right:0;z-index:100;
    background:#1e293b;border:1px solid rgba(99,102,241,.3);border-radius:8px;
    max-height:220px;overflow-y:auto;display:none;
    box-shadow:0 8px 20px rgba(0,0,0,.4);
  }
  .sede-dropdown.open { display:block; }
  .sede-option {
    padding:10px 14px;font-size:13px;color:#e2e8f0;cursor:pointer;
    border-bottom:1px solid rgba(255,255,255,.05);transition:background .1s;
  }
  .sede-option:hover, .sede-option.selected { background:rgba(99,102,241,.15); }
  .sede-option .opt-ciudad { font-size:11px;color:#64748b;margin-top:1px; }
  .sede-option-free { padding:10px 14px;font-size:13px;color:#818cf8;cursor:pointer;font-style:italic; }
  .sede-option-free:hover { background:rgba(99,102,241,.1); }
`;
document.head.appendChild(style);

function estadoBadge(e) {
  return `<span class="pf-estado estado-${e}">${{
    creado:'📦 Creado', en_transito:'🚚 En tránsito', en_sede:'📍 En sede',
    entregado:'✅ Entregado', devuelto:'↩️ Devuelto',
  }[e] || e}</span>`;
}

function showError(msg) {
  root.innerHTML = `
    <div style="max-width:480px;margin:40px auto;padding:20px;text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;">❌</div>
      <div style="font-size:18px;font-weight:700;margin-bottom:8px;">Enlace no válido</div>
      <div style="font-size:13px;color:#64748b;">${msg}</div>
    </div>`;
}

function showDelivered() {
  root.innerHTML = `
    <div style="max-width:480px;margin:40px auto;padding:20px;text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;">✅</div>
      <div style="font-size:18px;font-weight:700;margin-bottom:8px;">Paquete ya entregado</div>
      <div style="font-size:13px;color:#64748b;">Este paquete ya fue recibido en su destino final.</div>
    </div>`;
}

function showSuccess(data) {
  root.innerHTML = `
    <div class="success-wrap">
      <div class="success-icon">✓</div>
      <div style="font-size:22px;font-weight:800;margin-bottom:8px;">¡Recepción registrada!</div>
      <div style="font-size:14px;color:#64748b;margin-bottom:28px;line-height:1.6;">
        El equipo IT ha sido notificado.<br>Tu evidencia quedó guardada correctamente.
      </div>
      <div style="background:#1e293b;border:1px solid rgba(255,255,255,.08);border-radius:12px;padding:16px;width:100%;text-align:left;">
        <div style="font-size:11px;font-weight:700;color:#10b981;text-transform:uppercase;letter-spacing:.06em;margin-bottom:10px;">Resumen</div>
        ${Object.entries({
          'Paquete': _pkg?.numero || token,
          'Estado': data.estado?.replace('_', ' '),
          'Fecha y hora': new Date().toLocaleString('es-CO'),
        }).map(([k, v]) => `
          <div style="display:flex;justify-content:space-between;font-size:13px;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.05);">
            <span style="color:#64748b;">${k}</span>
            <span style="font-weight:600;">${v}</span>
          </div>`).join('')}
      </div>
      ${data.acta_disponible ? `
        <a href="/api/tracking/public/${token}/acta-final"
           style="margin-top:20px;padding:12px 24px;background:linear-gradient(135deg,#10b981,#059669);border-radius:10px;color:#fff;font-size:14px;font-weight:700;text-decoration:none;display:inline-flex;align-items:center;gap:8px;">
          📄 Descargar Acta de Recepción
        </a>` : ''}
      <div style="margin-top:20px;font-size:11px;color:#334155;">
        🔒 Este registro no puede modificarse una vez enviado.
      </div>
    </div>`;
}

function buildSedeSearch(containerId, onSelect) {
  const wrap = document.getElementById(containerId);
  if (!wrap) return;
  wrap.innerHTML = `
    <input class="pf-input" id="sede-input" placeholder="Buscar sede o farmacia…" autocomplete="off">
    <div class="sede-dropdown" id="sede-dropdown"></div>
    <input type="hidden" id="sede-id-hidden">
  `;
  const input    = wrap.querySelector('#sede-input');
  const dropdown = wrap.querySelector('#sede-dropdown');
  const hiddenId = wrap.querySelector('#sede-id-hidden');

  function render(q) {
    const q2 = q.toLowerCase();
    const filtered = _sedes.filter(s =>
      s.nombre_punto.toLowerCase().includes(q2) || s.ciudad.toLowerCase().includes(q2)
    ).slice(0, 15);
    dropdown.innerHTML = filtered.map(s => `
      <div class="sede-option" data-id="${s.id}" data-nombre="${s.nombre_punto} · ${s.ciudad}">
        ${s.nombre_punto}
        <div class="opt-ciudad">${s.ciudad}</div>
      </div>`).join('') +
      `<div class="sede-option-free" data-free="1">✏️ Escribir ubicación manualmente: "${q || '…'}"</div>`;
    dropdown.classList.add('open');
  }

  input.addEventListener('input', () => render(input.value));
  input.addEventListener('focus', () => render(input.value));

  dropdown.addEventListener('click', e => {
    const opt  = e.target.closest('.sede-option');
    const free = e.target.closest('.sede-option-free');
    if (opt) {
      input.value   = opt.dataset.nombre;
      hiddenId.value = opt.dataset.id;
      dropdown.classList.remove('open');
      onSelect({ id: opt.dataset.id, nombre: opt.dataset.nombre });
    } else if (free) {
      hiddenId.value = '';
      dropdown.classList.remove('open');
      onSelect({ id: null, nombre: input.value });
    }
  });

  document.addEventListener('click', e => {
    if (!wrap.contains(e.target)) dropdown.classList.remove('open');
  });

  return { getValue: () => input.value, getId: () => hiddenId.value };
}

function renderForm() {
  const articulos = _pkg.articulos || [];

  root.innerHTML = `
    <div class="pf-wrap">
      <div class="pf-header">
        <div class="pf-badge">📦 Seguimiento de Paquete</div>
        <div class="pf-num">${_pkg.numero}</div>
        <div class="pf-sub">Destino: ${_pkg.sede_destino || _pkg.destinatario}</div>
      </div>
      <div class="pf-body">
        <div class="pf-card">
          <div class="pf-card-title">ℹ️ Información del despacho</div>
          <div class="pf-info-row"><span class="pf-info-key">Remitente</span><span class="pf-info-val">${_pkg.eventos?.[0]?.recibido_por || 'IT'}</span></div>
          <div class="pf-info-row"><span class="pf-info-key">Artículos</span><span class="pf-info-val">${articulos.length} ítem(s)</span></div>
          <div class="pf-info-row"><span class="pf-info-key">Estado actual</span><span class="pf-info-val">${estadoBadge(_pkg.estado)}</span></div>
        </div>
        <div class="pf-card">
          <div class="pf-card-title">✓ Confirmar recepción</div>
          <div class="pf-row">
            <div>
              <label class="pf-label">¿Quién te entregó el paquete? *</label>
              <input class="pf-input" id="entregado-por" placeholder="Nombre del mensajero o agente…">
            </div>
            <div>
              <label class="pf-label">Tu nombre completo *</label>
              <input class="pf-input" id="recibido-por" placeholder="Tu nombre…">
            </div>
            <div>
              <label class="pf-label">Ubicación de recepción *</label>
              <div class="sede-search-wrap" id="sede-search-container"></div>
            </div>
            <div>
              <label class="pf-label">Observaciones (opcional)</label>
              <input class="pf-input" id="observaciones" placeholder="Estado del embalaje, novedades…">
            </div>
          </div>
        </div>
        <div class="pf-final-toggle" id="final-toggle-wrap">
          <input type="checkbox" id="es-entrega-final">
          <label for="es-entrega-final">Soy el destinatario final / esta es la entrega definitiva</label>
        </div>
        <div class="pf-card pf-final-section" id="final-section">
          <div class="pf-card-title">📋 Confirmación de entrega final</div>
          <div class="pf-row">
            <div>
              <label class="pf-label">Tu cargo en la empresa *</label>
              <input class="pf-input" id="cargo-receptor" list="cargos-list" placeholder="Escribe o selecciona tu cargo…">
              <datalist id="cargos-list">
                ${_cargos.map(c => `<option value="${c}">`).join('')}
              </datalist>
            </div>
          </div>
          ${articulos.length > 0 ? `
            <div style="margin-top:14px;">
              <div class="pf-card-title">📦 Artículos a confirmar</div>
              ${articulos.map((a, i) => `
                <div class="pf-check-row">
                  <input type="checkbox" id="item-${i}" data-idx="${i}" checked>
                  <div style="flex:1;">
                    <div class="pf-check-label">${a.nombre || a.descripcion || 'Artículo'}</div>
                    <div class="pf-check-qty">Cantidad: ${a.cantidad || 1}</div>
                    <textarea class="pf-check-obs" id="item-obs-${i}" rows="1"
                      placeholder="Observación (opcional)…"></textarea>
                  </div>
                </div>`).join('')}
            </div>` : ''}
        </div>
        <div class="pf-card">
          <div class="pf-card-title">📷 Fotografía de evidencia *</div>
          <label class="pf-photo-btn" for="foto-input">
            <span style="font-size:28px;">📷</span>
            <span>Tomar foto o subir imagen</span>
            <span style="font-size:11px;opacity:.6;">JPG/PNG · máx 5 MB</span>
          </label>
          <input type="file" id="foto-input" accept="image/jpeg,image/png,image/webp" style="display:none;">
          <img id="foto-preview" class="pf-photo-preview" alt="Preview">
        </div>
        <button class="pf-submit" id="btn-submit" disabled>Registrar recepción</button>
        <div style="text-align:center;font-size:11px;color:#334155;">
          Mi Farmacia · Sistema IT · Registro seguro
        </div>
      </div>
    </div>`;

  let sedeSeleccionada = { id: null, nombre: '' };
  buildSedeSearch('sede-search-container', val => { sedeSeleccionada = val; checkReady(); });

  const finalToggle  = document.getElementById('es-entrega-final');
  const finalSection = document.getElementById('final-section');
  finalToggle.addEventListener('change', () => {
    finalSection.classList.toggle('visible', finalToggle.checked);
  });

  const fotoInput   = document.getElementById('foto-input');
  const fotoPreview = document.getElementById('foto-preview');
  fotoInput.addEventListener('change', () => {
    const f = fotoInput.files[0];
    if (f) {
      fotoPreview.src = URL.createObjectURL(f);
      fotoPreview.style.display = 'block';
    }
    checkReady();
  });

  ['recibido-por', 'entregado-por'].forEach(id =>
    document.getElementById(id).addEventListener('input', checkReady));

  function checkReady() {
    const ok = document.getElementById('recibido-por').value.trim() &&
               document.getElementById('entregado-por').value.trim() &&
               sedeSeleccionada.nombre.trim() &&
               fotoInput.files.length > 0;
    document.getElementById('btn-submit').disabled = !ok;
  }

  document.getElementById('btn-submit').addEventListener('click', async () => {
    const btn = document.getElementById('btn-submit');
    btn.disabled = true;
    btn.textContent = 'Enviando…';

    const isFinal = finalToggle.checked;
    const fd = new FormData();
    fd.append('recibido_por',  document.getElementById('recibido-por').value.trim());
    fd.append('entregado_por', document.getElementById('entregado-por').value.trim());
    fd.append('ubicacion',     sedeSeleccionada.nombre.trim());
    if (sedeSeleccionada.id) fd.append('sede_id', sedeSeleccionada.id);
    fd.append('observaciones', document.getElementById('observaciones').value.trim());
    fd.append('foto', fotoInput.files[0]);

    let endpoint = `/api/tracking/public/${token}/evento`;

    if (isFinal) {
      endpoint = `/api/tracking/public/${token}/entrega-final`;
      fd.append('cargo_receptor', document.getElementById('cargo-receptor')?.value?.trim() || '');

      if (_pkg.articulos?.length > 0) {
        const items = _pkg.articulos.map((a, i) => ({
          item_index: i,
          equipment_name: a.nombre || a.descripcion || 'Artículo',
          cantidad: a.cantidad || 1,
          recibido_conforme: document.getElementById(`item-${i}`)?.checked ? 1 : 0,
          observacion_item: document.getElementById(`item-obs-${i}`)?.value?.trim() || null,
        }));
        fd.append('items', JSON.stringify(items));
      }
    }

    try {
      const res  = await fetch(endpoint, { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al registrar');
      showSuccess(data);
    } catch (err) {
      alert('Error: ' + err.message);
      btn.disabled = false;
      btn.textContent = 'Registrar recepción';
    }
  });
}

async function init() {
  try {
    const [pkgRes, sedesRes] = await Promise.all([
      fetch(`/api/tracking/public/${token}`),
      fetch('/api/tracking/public/sedes'),
    ]);

    if (!pkgRes.ok) {
      showError('Este enlace no existe o no es válido. Contacta al equipo IT.');
      return;
    }

    _pkg   = await pkgRes.json();
    const sedesData = await sedesRes.json();
    _sedes  = sedesData.sedes  || [];
    _cargos = sedesData.cargos || [];

    if (_pkg.estado === 'entregado') { showDelivered(); return; }
    if (_pkg.estado === 'devuelto') { showError('Este paquete fue marcado como devuelto.'); return; }

    renderForm();
  } catch (err) {
    showError('No se pudo cargar la información. Verifica tu conexión.');
  }
}

init();
