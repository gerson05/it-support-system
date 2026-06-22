// public/js/reuniones-admin.js
import { showToast } from './components.js';

const esc = s => String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

const TIPO_LABELS = {
  interna: 'Interna',
  con_sede: 'Con Sede',
  con_proveedor: 'Con Proveedor',
  formacion: 'Formación',
};

const TIPO_COLORS = {
  interna:       'rgba(99,102,241,.7)',
  con_sede:      'rgba(16,185,129,.7)',
  con_proveedor: 'rgba(234,179,8,.7)',
  formacion:     'rgba(239,68,68,.7)',
};

function isoToLocal(iso) {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

function weekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}

function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function dateToISO(date) {
  return date.toISOString().slice(0,10);
}

function fmtDate(date) {
  return date.toLocaleDateString('es-CO', { weekday:'short', day:'numeric', month:'short' });
}

export async function renderReuniones(container) {
  container.innerHTML = `
    <div style="margin-bottom:20px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;">
      <div>
        <h2 style="font-size:20px;font-weight:700;letter-spacing:-.4px;margin:0 0 4px;">Calendario</h2>
        <p style="color:var(--text-3);font-size:13px;margin:0;">Reuniones del equipo y sedes</p>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button id="btn-gestion-salas" style="padding:6px 14px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-2);font-size:12px;cursor:pointer;">⚙ Gestionar salas</button>
        <button id="btn-nueva-reunion" class="btn btn-primary">+ Nueva reunión</button>
      </div>
    </div>
    <div id="cal-nav" style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
      <button id="cal-prev" style="padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-2);font-size:13px;cursor:pointer;">←</button>
      <span id="cal-week-label" style="font-size:14px;font-weight:600;flex:1;text-align:center;"></span>
      <button id="cal-today" style="padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-2);font-size:12px;cursor:pointer;">Hoy</button>
      <button id="cal-next" style="padding:6px 12px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-2);font-size:13px;cursor:pointer;">→</button>
    </div>
    <div id="cal-grid" style="overflow-x:auto;"></div>`;

  let currentWeek = weekStart(new Date());
  let salas = [];
  let reuniones = [];

  async function loadSalas() {
    const res = await fetch('/api/reuniones/salas');
    const data = await res.json();
    salas = data.salas || [];
  }

  async function loadReuniones() {
    const fecha = dateToISO(currentWeek);
    const res = await fetch(`/api/reuniones?fecha=${fecha}`);
    const data = await res.json();
    reuniones = data.reuniones || [];
  }

  async function refresh() {
    await Promise.all([loadSalas(), loadReuniones()]);
    renderGrid();
  }

  function renderGrid() {
    const days = Array.from({length:7}, (_,i) => addDays(currentWeek, i));
    document.getElementById('cal-week-label').textContent =
      `${fmtDate(days[0])} — ${fmtDate(days[6])}`;

    const hours = Array.from({length:14}, (_,i) => i + 7); // 07:00 - 20:00
    const slotH = 48; // px per hour

    if (!salas.length) {
      document.getElementById('cal-grid').innerHTML =
        `<div style="text-align:center;padding:40px;color:var(--text-3);">No hay salas configuradas. Crea una sala primero.</div>`;
      return;
    }

    const colW = Math.max(120, Math.floor(700 / (days.length * salas.length)));

    let html = `<div style="display:flex;min-width:${60 + days.length * salas.length * colW}px;">`;

    // Hour column
    html += `<div style="width:60px;flex-shrink:0;padding-top:40px;">`;
    hours.forEach(h => {
      html += `<div style="height:${slotH}px;font-size:11px;color:var(--text-3);padding:2px 4px;border-top:1px solid rgba(255,255,255,.05);">${String(h).padStart(2,'0')}:00</div>`;
    });
    html += `</div>`;

    // Day + sala columns
    days.forEach(day => {
      const dateStr = dateToISO(day);
      const isToday = dateStr === dateToISO(new Date());
      salas.forEach(sala => {
        const dayReuniones = reuniones.filter(r => {
          return r.sala_id === sala.id && r.fecha_inicio.startsWith(dateStr) && r.estado === 'activa';
        });

        html += `<div style="flex:1;min-width:${colW}px;border-left:1px solid rgba(255,255,255,.06);">`;
        // Header
        html += `<div style="height:40px;padding:4px 6px;background:${isToday ? 'rgba(99,102,241,.1)' : 'transparent'};border-bottom:1px solid rgba(255,255,255,.06);">
          <div style="font-size:11px;font-weight:700;color:${isToday ? 'var(--primary)' : 'var(--text-2)'};">${fmtDate(day)}</div>
          <div style="font-size:10px;color:var(--text-3);">${esc(sala.nombre)}</div>
        </div>`;
        // Slots
        html += `<div style="position:relative;height:${slotH * hours.length}px;">`;
        // Click areas
        hours.forEach(h => {
          const slotIso = `${dateStr}T${String(h).padStart(2,'0')}:00:00`;
          html += `<div class="cal-slot" data-sala="${sala.id}" data-inicio="${slotIso}"
            style="position:absolute;top:${(h-7)*slotH}px;left:0;right:0;height:${slotH}px;
            border-top:1px solid rgba(255,255,255,.04);cursor:pointer;"
            onmouseenter="this.style.background='rgba(99,102,241,.06)'"
            onmouseleave="this.style.background=''"></div>`;
        });
        // Events
        dayReuniones.forEach(r => {
          const hStart = new Date(r.fecha_inicio);
          const hEnd   = new Date(r.fecha_fin);
          const top    = ((hStart.getHours() + hStart.getMinutes()/60) - 7) * slotH;
          const height = ((hEnd - hStart) / 3600000) * slotH;
          const color  = TIPO_COLORS[r.tipo] || 'rgba(99,102,241,.7)';
          html += `<div class="cal-event" data-id="${r.id}"
            style="position:absolute;top:${top}px;left:2px;right:2px;height:${Math.max(height-2,20)}px;
            background:${color};border-radius:4px;padding:3px 5px;cursor:pointer;overflow:hidden;z-index:1;">
            <div style="font-size:11px;font-weight:600;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(r.titulo)}</div>
            <div style="font-size:10px;color:rgba(255,255,255,.8);">${isoToLocal(r.fecha_inicio)}–${isoToLocal(r.fecha_fin)}</div>
          </div>`;
        });
        html += `</div></div>`;
      });
    });

    html += `</div>`;
    const grid = document.getElementById('cal-grid');
    grid.innerHTML = html;

    grid.querySelectorAll('.cal-slot').forEach(el => {
      el.addEventListener('click', () => {
        openCrearModal(salas, {
          sala_id: parseInt(el.dataset.sala),
          fecha_inicio: el.dataset.inicio,
          fecha_fin: new Date(new Date(el.dataset.inicio).getTime() + 60*60000).toISOString().slice(0,19),
        }, refresh);
      });
    });

    grid.querySelectorAll('.cal-event').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        const r = reuniones.find(x => x.id === parseInt(el.dataset.id));
        if (r) openDetalleModal(r, salas, refresh);
      });
    });
  }

  container.querySelector('#cal-prev').addEventListener('click', () => {
    currentWeek = addDays(currentWeek, -7);
    refresh();
  });
  container.querySelector('#cal-next').addEventListener('click', () => {
    currentWeek = addDays(currentWeek, 7);
    refresh();
  });
  container.querySelector('#cal-today').addEventListener('click', () => {
    currentWeek = weekStart(new Date());
    refresh();
  });
  container.querySelector('#btn-nueva-reunion').addEventListener('click', () => {
    openCrearModal(salas, {}, refresh);
  });
  container.querySelector('#btn-gestion-salas').addEventListener('click', () => {
    openGestionSalasModal(refresh);
  });

  await refresh();
}

// ── Modal crear/editar reunión ───────────────────────────────────────────────

function openCrearModal(salas, prefill = {}, onSave) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;';

  const toLocalInput = iso => iso ? iso.slice(0,16) : '';
  const toISO = local => local ? new Date(local).toISOString().slice(0,19) : '';

  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:12px;padding:28px;width:100%;max-width:520px;box-shadow:0 20px 60px rgba(0,0,0,.4);max-height:90vh;overflow-y:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
        <h2 style="margin:0;font-size:17px;font-weight:700;">Nueva reunión</h2>
        <button id="cr-x" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:20px;">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">TÍTULO *</label>
          <input id="cr-titulo" type="text" placeholder="Ej: Reunión semanal IT"
            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">SALA *</label>
            <select id="cr-sala" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
              <option value="">-- Seleccionar --</option>
              ${salas.map(s => `<option value="${s.id}" ${prefill.sala_id === s.id ? 'selected':''}>${esc(s.nombre)}</option>`).join('')}
            </select>
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">TIPO *</label>
            <select id="cr-tipo" style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
              ${Object.entries(TIPO_LABELS).map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}
            </select>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">INICIO *</label>
            <input id="cr-inicio" type="datetime-local" value="${toLocalInput(prefill.fecha_inicio)}"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
          <div>
            <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">FIN *</label>
            <input id="cr-fin" type="datetime-local" value="${toLocalInput(prefill.fecha_fin)}"
              style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
          </div>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">ORGANIZADOR *</label>
          <input id="cr-org-nombre" type="text" placeholder="Nombre del organizador"
            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">CORREO ORGANIZADOR <span style="font-weight:400;color:var(--text-3);">(opcional)</span></label>
          <input id="cr-org-correo" type="email" placeholder="correo@ejemplo.com"
            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;">
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">PARTICIPANTES <span style="font-weight:400;color:var(--text-3);">(un correo por línea, opcional)</span></label>
          <textarea id="cr-participantes" rows="3" placeholder="participante1@ejemplo.com&#10;participante2@ejemplo.com"
            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;resize:vertical;"></textarea>
        </div>
        <div>
          <label style="display:block;font-size:12px;font-weight:600;color:var(--text-2);margin-bottom:4px;">DESCRIPCIÓN / AGENDA <span style="font-weight:400;color:var(--text-3);">(opcional)</span></label>
          <textarea id="cr-desc" rows="3"
            style="width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;box-sizing:border-box;resize:vertical;"></textarea>
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:20px;">
        <button id="cr-cancel" style="padding:8px 16px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-3);font-size:13px;cursor:pointer;">Cancelar</button>
        <button id="cr-save" class="btn btn-primary">Crear reunión</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#cr-x').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#cr-cancel').addEventListener('click', () => overlay.remove());

  overlay.querySelector('#cr-save').addEventListener('click', async () => {
    const btn = overlay.querySelector('#cr-save');
    const sala_id  = parseInt(overlay.querySelector('#cr-sala').value);
    const titulo   = overlay.querySelector('#cr-titulo').value.trim();
    const tipo     = overlay.querySelector('#cr-tipo').value;
    const inicioLocal = overlay.querySelector('#cr-inicio').value;
    const finLocal    = overlay.querySelector('#cr-fin').value;
    const org_nombre  = overlay.querySelector('#cr-org-nombre').value.trim();
    const org_correo  = overlay.querySelector('#cr-org-correo').value.trim();
    const partic = overlay.querySelector('#cr-participantes').value
      .split('\n').map(s => s.trim()).filter(Boolean);
    const desc = overlay.querySelector('#cr-desc').value.trim();

    if (!sala_id || !titulo || !inicioLocal || !finLocal || !org_nombre) {
      showToast('Completa los campos obligatorios', 'error'); return;
    }

    const fecha_inicio = toISO(inicioLocal);
    const fecha_fin    = toISO(finLocal);

    btn.disabled = true; btn.textContent = 'Creando…';
    try {
      const res = await fetch('/api/reuniones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sala_id, titulo, tipo, fecha_inicio, fecha_fin,
          organizador_nombre: org_nombre, organizador_correo: org_correo,
          participantes: partic, descripcion: desc }),
      });
      const data = await res.json();
      if (!res.ok) { showToast(data.error || 'Error al crear', 'error'); return; }
      showToast(data.meet_link_generado ? '✅ Reunión creada · Meet link generado' : '✅ Reunión creada', 'success');
      overlay.remove();
      onSave?.();
    } catch { showToast('Error de red', 'error'); }
    finally { btn.disabled = false; btn.textContent = 'Crear reunión'; }
  });

  setTimeout(() => overlay.querySelector('#cr-titulo')?.focus(), 50);
}

// ── Modal detalle ────────────────────────────────────────────────────────────

function openDetalleModal(reunion, salas, onUpdate) {
  const sala = salas.find(s => s.id === reunion.sala_id);
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;';

  const fmtDateTime = iso => {
    const d = new Date(iso);
    return d.toLocaleString('es-CO', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' });
  };

  const participantes = JSON.parse(reunion.participantes || '[]');

  overlay.innerHTML = `
    <div style="background:var(--surface);border-radius:12px;padding:28px;width:100%;max-width:480px;box-shadow:0 20px 60px rgba(0,0,0,.4);">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
        <div>
          <span style="font-size:11px;padding:3px 8px;border-radius:12px;background:${TIPO_COLORS[reunion.tipo]};color:#fff;font-weight:600;">${TIPO_LABELS[reunion.tipo]}</span>
          <h2 style="margin:8px 0 4px;font-size:17px;font-weight:700;">${esc(reunion.titulo)}</h2>
        </div>
        <button id="det-x" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:20px;flex-shrink:0;">✕</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:13px;">
        <div><span style="color:var(--text-3);">📍 Sala:</span> <strong>${esc(sala?.nombre || '-')}</strong></div>
        <div><span style="color:var(--text-3);">🕐 Inicio:</span> <strong>${fmtDateTime(reunion.fecha_inicio)}</strong></div>
        <div><span style="color:var(--text-3);">🕐 Fin:</span> <strong>${fmtDateTime(reunion.fecha_fin)}</strong></div>
        <div><span style="color:var(--text-3);">👤 Organizador:</span> <strong>${esc(reunion.organizador_nombre)}</strong>${reunion.organizador_correo ? ` (${esc(reunion.organizador_correo)})` : ''}</div>
        ${participantes.length ? `<div><span style="color:var(--text-3);">👥 Participantes:</span> ${participantes.map(esc).join(', ')}</div>` : ''}
        ${reunion.descripcion ? `<div><span style="color:var(--text-3);">📋 Agenda:</span> ${esc(reunion.descripcion)}</div>` : ''}
        ${reunion.estado === 'cancelada' ? `<div style="color:#f87171;font-weight:600;">❌ Cancelada</div>` : ''}
      </div>
      ${reunion.meet_link && reunion.estado === 'activa' ? `
        <a href="${esc(reunion.meet_link)}" target="_blank" rel="noopener"
          style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:16px;padding:10px;
          background:rgba(16,185,129,.12);border:1px solid rgba(16,185,129,.3);border-radius:8px;
          color:#34d399;font-weight:600;font-size:13px;text-decoration:none;">
          🎥 Unirse a Google Meet
        </a>` : reunion.estado === 'activa' ? `
        <div style="margin-top:16px;padding:10px;background:rgba(255,255,255,.04);border-radius:8px;
          font-size:12px;color:var(--text-3);text-align:center;">Sin link de Meet (Google Calendar no configurado)</div>` : ''}
      ${reunion.estado === 'activa' ? `
        <div style="display:flex;gap:8px;margin-top:20px;">
          <button id="det-cancel" style="flex:1;padding:8px;border:1px solid rgba(239,68,68,.3);border-radius:6px;background:rgba(239,68,68,.1);color:#f87171;font-size:13px;cursor:pointer;">Cancelar reunión</button>
        </div>` : ''}
    </div>`;

  document.body.appendChild(overlay);
  overlay.querySelector('#det-x').addEventListener('click', () => overlay.remove());

  overlay.querySelector('#det-cancel')?.addEventListener('click', async () => {
    if (!confirm('¿Cancelar esta reunión?')) return;
    const res = await fetch(`/api/reuniones/${reunion.id}`, { method: 'DELETE' });
    if (res.ok) { showToast('Reunión cancelada', 'success'); overlay.remove(); onUpdate?.(); }
    else { const d = await res.json(); showToast(d.error || 'Error', 'error'); }
  });
}

// ── Modal gestión de salas ───────────────────────────────────────────────────

function openGestionSalasModal(onUpdate) {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;';

  async function render() {
    const res = await fetch('/api/reuniones/salas');
    const { salas } = await res.json();

    overlay.innerHTML = `
      <div style="background:var(--surface);border-radius:12px;padding:28px;width:100%;max-width:440px;box-shadow:0 20px 60px rgba(0,0,0,.4);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2 style="margin:0;font-size:17px;font-weight:700;">Salas</h2>
          <button id="gs-x" style="background:none;border:none;cursor:pointer;color:var(--text-3);font-size:20px;">✕</button>
        </div>
        <div id="gs-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:16px;">
          ${salas.map(s => `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--surface-2);border-radius:8px;">
              <span style="flex:1;font-size:13px;">${esc(s.nombre)}</span>
              ${s.descripcion ? `<span style="font-size:11px;color:var(--text-3);">${esc(s.descripcion)}</span>` : ''}
              <button class="gs-del" data-id="${s.id}" style="padding:3px 8px;border:1px solid rgba(239,68,68,.3);border-radius:5px;background:rgba(239,68,68,.1);color:#f87171;font-size:11px;cursor:pointer;">✕</button>
            </div>`).join('') || '<div style="color:var(--text-3);font-size:13px;text-align:center;">Sin salas aún</div>'}
        </div>
        <div style="display:flex;gap:8px;">
          <input id="gs-nombre" type="text" placeholder="Nombre de la sala"
            style="flex:1;padding:8px 10px;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--text);font-size:13px;">
          <button id="gs-add" class="btn btn-primary" style="white-space:nowrap;">+ Agregar</button>
        </div>
      </div>`;

    overlay.querySelector('#gs-x').addEventListener('click', () => { overlay.remove(); onUpdate?.(); });

    overlay.querySelectorAll('.gs-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        await fetch(`/api/reuniones/salas/${btn.dataset.id}`, { method: 'DELETE' });
        await render();
      });
    });

    overlay.querySelector('#gs-add').addEventListener('click', async () => {
      const nombre = overlay.querySelector('#gs-nombre').value.trim();
      if (!nombre) return;
      const res = await fetch('/api/reuniones/salas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre }),
      });
      if (res.ok) { showToast('Sala creada', 'success'); await render(); }
      else { const d = await res.json(); showToast(d.error, 'error'); }
    });
  }

  document.body.appendChild(overlay);
  render();
}
