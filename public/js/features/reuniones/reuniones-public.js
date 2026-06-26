// public/js/reuniones-public.js

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const TIPO_LABELS = {
  interna: 'Interna',
  con_sede: 'Con Sede',
  con_proveedor: 'Con Proveedor',
  formacion: 'Formación',
};

let salas = [];
let step = 1;
const data = {
  sala_id: null, fecha: '', hora_inicio: '', hora_fin: '',
  titulo: '', tipo: 'interna', organizador_nombre: '', organizador_correo: '',
  participantes: '', descripcion: '', sede_id: null,
};

async function init() {
  try {
    const res = await fetch('/api/reuniones/public/salas');
    const json = await res.json();
    salas = json.salas || [];
  } catch {
    document.getElementById('app').innerHTML =
      '<div style="color:var(--danger);text-align:center;padding:20px;">Error al cargar las salas. Recarga la página.</div>';
    return;
  }
  renderStep();
}

function renderStep() {
  const container = document.getElementById('app');
  container.innerHTML = '';
  if (step === 1) renderStep1(container);
  else if (step === 2) renderStep2(container);
  else if (step === 3) renderStep3(container);
  else if (step === 4) renderStep4(container);
}

function renderStep1(container) {
  container.innerHTML = `
    <h2 style="font-size:18px;font-weight:700;margin-bottom:20px;">1. Elige sala y horario</h2>
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div>
        <label class="field-label">SALA *</label>
        <select id="p-sala" class="field-input">
          <option value="">-- Seleccionar sala --</option>
          ${salas.map(s => `<option value="${s.id}" ${data.sala_id == s.id ? 'selected':''}>${esc(s.nombre)}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="field-label">FECHA *</label>
        <input id="p-fecha" type="date" value="${data.fecha}" min="${new Date().toISOString().slice(0,10)}" class="field-input">
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div>
          <label class="field-label">HORA INICIO *</label>
          <select id="p-hinicio" class="field-input">
            ${horaOpts(data.hora_inicio)}
          </select>
        </div>
        <div>
          <label class="field-label">HORA FIN *</label>
          <select id="p-hfin" class="field-input">
            ${horaOpts(data.hora_fin)}
          </select>
        </div>
      </div>
      <div id="p-disponibilidad" style="font-size:12px;color:#9ca3af;min-height:18px;"></div>
      <button id="p-next1" class="btn-primary-pub">Siguiente →</button>
    </div>`;

  const salaEl  = document.getElementById('p-sala');
  const fechaEl = document.getElementById('p-fecha');

  async function checkDisponibilidad() {
    const sid = salaEl.value;
    const f   = fechaEl.value;
    if (!sid || !f) return;
    try {
      const res = await fetch(`/api/reuniones/public/disponibilidad?sala_id=${sid}&fecha=${f}`);
      const { ocupados } = await res.json();
      const div = document.getElementById('p-disponibilidad');
      if (!div) return;
      if (!ocupados.length) { div.innerHTML = '✅ Sala disponible en esa fecha'; return; }
      div.innerHTML = `<span style="color:var(--danger);">⚠ Horarios ocupados:</span> ` +
        ocupados.map(o => `${new Date(o.fecha_inicio).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}–${new Date(o.fecha_fin).toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}`).join(', ');
    } catch {}
  }

  salaEl.addEventListener('change', checkDisponibilidad);
  fechaEl.addEventListener('change', checkDisponibilidad);

  document.getElementById('p-next1').addEventListener('click', () => {
    data.sala_id     = parseInt(salaEl.value) || null;
    data.fecha       = document.getElementById('p-fecha').value;
    data.hora_inicio = document.getElementById('p-hinicio').value;
    data.hora_fin    = document.getElementById('p-hfin').value;
    if (!data.sala_id || !data.fecha || !data.hora_inicio || !data.hora_fin) {
      showErr('Completa todos los campos'); return;
    }
    if (data.hora_fin <= data.hora_inicio) {
      showErr('La hora de fin debe ser posterior al inicio'); return;
    }
    step = 2; renderStep();
  });
}

function renderStep2(container) {
  container.innerHTML = `
    <h2 style="font-size:18px;font-weight:700;margin-bottom:20px;">2. Datos de la reunión</h2>
    <div style="display:flex;flex-direction:column;gap:14px;">
      <div>
        <label class="field-label">TÍTULO *</label>
        <input id="p-titulo" type="text" value="${esc(data.titulo)}" class="field-input" placeholder="Ej: Reunión mensual equipo">
      </div>
      <div>
        <label class="field-label">TIPO *</label>
        <select id="p-tipo" class="field-input">
          ${Object.entries(TIPO_LABELS).map(([v,l]) => `<option value="${v}" ${data.tipo===v?'selected':''}>${l}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="field-label">TU NOMBRE *</label>
        <input id="p-org-nombre" type="text" value="${esc(data.organizador_nombre)}" class="field-input" placeholder="Nombre del organizador">
      </div>
      <div>
        <label class="field-label">TU CORREO <span style="font-weight:400;color:#9ca3af;">(opcional, para recibir el link)</span></label>
        <input id="p-org-correo" type="email" value="${esc(data.organizador_correo)}" class="field-input" placeholder="correo@ejemplo.com">
      </div>
      <div>
        <label class="field-label">PARTICIPANTES <span style="font-weight:400;color:#9ca3af;">(un correo por línea, opcional)</span></label>
        <textarea id="p-partic" rows="3" class="field-input" placeholder="participante@ejemplo.com">${esc(data.participantes)}</textarea>
      </div>
      <div>
        <label class="field-label">DESCRIPCIÓN / AGENDA <span style="font-weight:400;color:#9ca3af;">(opcional)</span></label>
        <textarea id="p-desc" rows="3" class="field-input" placeholder="Temas a tratar...">${esc(data.descripcion)}</textarea>
      </div>
      <div style="display:flex;gap:8px;">
        <button id="p-back2" class="btn-sec-pub">← Anterior</button>
        <button id="p-next2" class="btn-primary-pub" style="flex:1;">Siguiente →</button>
      </div>
    </div>`;

  document.getElementById('p-back2').addEventListener('click', () => { step = 1; renderStep(); });
  document.getElementById('p-next2').addEventListener('click', () => {
    data.titulo             = document.getElementById('p-titulo').value.trim();
    data.tipo               = document.getElementById('p-tipo').value;
    data.organizador_nombre = document.getElementById('p-org-nombre').value.trim();
    data.organizador_correo = document.getElementById('p-org-correo').value.trim();
    data.participantes      = document.getElementById('p-partic').value.trim();
    data.descripcion        = document.getElementById('p-desc').value.trim();
    if (!data.titulo || !data.organizador_nombre) { showErr('Título y nombre son obligatorios'); return; }
    step = 3; renderStep();
  });
}

function renderStep3(container) {
  const sala = salas.find(s => s.id === data.sala_id);
  container.innerHTML = `
    <h2 style="font-size:18px;font-weight:700;margin-bottom:20px;">3. Confirmar</h2>
    <div style="background:#1e1e2e;border-radius:10px;padding:16px;margin-bottom:20px;font-size:13px;display:flex;flex-direction:column;gap:8px;">
      <div><span style="color:#9ca3af;">📋 Título:</span> <strong>${esc(data.titulo)}</strong></div>
      <div><span style="color:#9ca3af;">📍 Sala:</span> <strong>${esc(sala?.nombre || '')}</strong></div>
      <div><span style="color:#9ca3af;">📅 Fecha:</span> <strong>${data.fecha}</strong></div>
      <div><span style="color:#9ca3af;">🕐 Horario:</span> <strong>${data.hora_inicio} – ${data.hora_fin}</strong></div>
      <div><span style="color:#9ca3af;">🏷 Tipo:</span> <strong>${TIPO_LABELS[data.tipo]}</strong></div>
      <div><span style="color:#9ca3af;">👤 Organizador:</span> <strong>${esc(data.organizador_nombre)}</strong></div>
    </div>
    <div style="display:flex;gap:8px;">
      <button id="p-back3" class="btn-sec-pub">← Anterior</button>
      <button id="p-submit" class="btn-primary-pub" style="flex:1;">✓ Agendar reunión</button>
    </div>`;

  document.getElementById('p-back3').addEventListener('click', () => { step = 2; renderStep(); });
  document.getElementById('p-submit').addEventListener('click', async () => {
    const btn = document.getElementById('p-submit');
    btn.disabled = true; btn.textContent = 'Agendando…';
    try {
      const fecha_inicio = `${data.fecha}T${data.hora_inicio}:00`;
      const fecha_fin    = `${data.fecha}T${data.hora_fin}:00`;
      const participantes = data.participantes.split('\n').map(s => s.trim()).filter(Boolean);
      const res = await fetch('/api/reuniones/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sala_id: data.sala_id, titulo: data.titulo, tipo: data.tipo,
          fecha_inicio, fecha_fin,
          organizador_nombre: data.organizador_nombre,
          organizador_correo: data.organizador_correo,
          participantes, descripcion: data.descripcion,
        }),
      });
      const json = await res.json();
      if (!res.ok) { showErr(json.error || 'Error al agendar'); btn.disabled = false; btn.textContent = '✓ Agendar reunión'; return; }
      window._reunionResult = json;
      step = 4; renderStep();
    } catch { showErr('Error de red'); btn.disabled = false; btn.textContent = '✓ Agendar reunión'; }
  });
}

function renderStep4(container) {
  const result = window._reunionResult || {};
  const token  = result.token_externo;
  const cancelUrl = `${location.origin}/reuniones.html?token=${token}`;

  container.innerHTML = `
    <div style="text-align:center;padding:20px 0;">
      <div style="font-size:48px;margin-bottom:12px;">✅</div>
      <h2 style="font-size:20px;font-weight:700;margin-bottom:8px;">¡Reunión agendada!</h2>
      <p style="color:#9ca3af;font-size:13px;margin-bottom:20px;">Guarda este link para cancelar si es necesario.</p>
    </div>
    ${result.meet_link ? `
      <a href="${esc(result.meet_link)}" target="_blank" rel="noopener"
        style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;
        background:#064e3b;border:1px solid #059669;border-radius:8px;
        color:#34d399;font-weight:600;font-size:14px;text-decoration:none;margin-bottom:12px;">
        🎥 Unirse a Google Meet
      </a>
      <button id="p-copy-meet" style="width:100%;padding:8px;border:1px solid #374151;border-radius:8px;background:#1f2937;color:#9ca3af;font-size:12px;cursor:pointer;margin-bottom:16px;">
        Copiar link de Meet
      </button>` : ''}
    <div style="background:#1e1e2e;border-radius:10px;padding:14px;margin-bottom:16px;font-size:12px;">
      <div style="color:#9ca3af;margin-bottom:6px;">Link para cancelar tu reunión:</div>
      <div style="word-break:break-all;color:#818cf8;">${esc(cancelUrl)}</div>
    </div>
    <button id="p-copy-cancel" style="width:100%;padding:8px;border:1px solid #374151;border-radius:8px;background:#1f2937;color:#9ca3af;font-size:12px;cursor:pointer;">
      Copiar link de cancelación
    </button>`;

  document.getElementById('p-copy-cancel')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(cancelUrl).catch(() => {});
    document.getElementById('p-copy-cancel').textContent = '✓ Copiado';
  });
  document.getElementById('p-copy-meet')?.addEventListener('click', () => {
    navigator.clipboard?.writeText(result.meet_link).catch(() => {});
    document.getElementById('p-copy-meet').textContent = '✓ Copiado';
  });
}

function renderCancelView(token) {
  const container = document.getElementById('app');
  container.innerHTML = '<div style="color:#9ca3af;font-size:13px;">Cargando…</div>';

  fetch(`/api/reuniones/public/${token}`)
    .then(r => r.json())
    .then(({ reunion, error }) => {
      if (error || !reunion) {
        container.innerHTML = `<div style="text-align:center;color:var(--danger);padding:20px;">Reunión no encontrada.</div>`;
        return;
      }
      const sala = reunion.sala_nombre || '-';
      container.innerHTML = `
        <h2 style="font-size:18px;font-weight:700;margin-bottom:16px;">Tu reunión</h2>
        <div style="background:#1e1e2e;border-radius:10px;padding:16px;margin-bottom:20px;font-size:13px;display:flex;flex-direction:column;gap:8px;">
          <div><strong>${esc(reunion.titulo)}</strong></div>
          <div><span style="color:#9ca3af;">Sala:</span> ${esc(sala)}</div>
          <div><span style="color:#9ca3af;">Inicio:</span> ${new Date(reunion.fecha_inicio).toLocaleString('es-CO')}</div>
          <div><span style="color:#9ca3af;">Estado:</span> <span style="color:${reunion.estado==='activa'?'#34d399':'#f87171'}">${reunion.estado}</span></div>
        </div>
        ${reunion.meet_link && reunion.estado === 'activa' ? `
          <a href="${esc(reunion.meet_link)}" target="_blank" rel="noopener"
            style="display:flex;align-items:center;justify-content:center;gap:8px;padding:12px;
            background:#064e3b;border:1px solid #059669;border-radius:8px;
            color:#34d399;font-weight:600;font-size:14px;text-decoration:none;margin-bottom:16px;">
            🎥 Unirse a Google Meet
          </a>` : ''}
        ${reunion.estado === 'activa' ? `
          <button id="p-cancelar" style="width:100%;padding:10px;border:1px solid rgba(239,68,68,.3);border-radius:8px;background:rgba(239,68,68,.1);color:var(--danger);font-size:13px;cursor:pointer;font-family:inherit;">
            Cancelar esta reunión
          </button>` : '<div style="text-align:center;color:var(--danger);font-size:13px;margin-top:8px;">Esta reunión ya fue cancelada.</div>'}`;

      document.getElementById('p-cancelar')?.addEventListener('click', async () => {
        if (!confirm('¿Seguro que quieres cancelar esta reunión?')) return;
        const res = await fetch(`/api/reuniones/public/${token}`, { method: 'DELETE' });
        if (res.ok) { renderCancelView(token); }
        else { const d = await res.json(); showErr(d.error || 'Error al cancelar'); }
      });
    })
    .catch(() => {
      container.innerHTML = `<div style="text-align:center;color:var(--danger);padding:20px;">Error al cargar la reunión.</div>`;
    });
}

function horaOpts(selected) {
  let opts = '';
  for (let h = 7; h < 20; h++) {
    for (const m of [0, 30]) {
      const val = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      opts += `<option value="${val}" ${selected === val ? 'selected':''}>${val}</option>`;
    }
  }
  return opts;
}

function showErr(msg) {
  const existing = document.getElementById('p-err');
  if (existing) existing.remove();
  const el = document.createElement('div');
  el.id = 'p-err';
  el.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#7f1d1d;color:var(--danger);padding:10px 20px;border-radius:8px;font-size:13px;z-index:9999;white-space:nowrap;';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el?.remove(), 3500);
}

// ── Boot ─────────────────────────────────────────────────────────────────────

const params = new URLSearchParams(location.search);
const token  = params.get('token');
if (token) {
  document.addEventListener('DOMContentLoaded', () => renderCancelView(token));
} else {
  document.addEventListener('DOMContentLoaded', init);
}
