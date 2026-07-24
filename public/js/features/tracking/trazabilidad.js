import { formatDate } from '../../core/app.js';

const _esc = s => String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

const ESTADOS = {
  creado:      { label: 'Creado',      cls: 'badge-pendiente', icon: '📦' },
  en_transito: { label: 'En tránsito', cls: 'badge-en_progreso', icon: '🚚' },
  en_sede:     { label: 'En sede',     cls: 'badge-en_espera', icon: '📍' },
  entregado:   { label: 'Entregado',   cls: 'badge-resuelto', icon: '✅' },
  devuelto:    { label: 'Devuelto',    cls: 'badge-critica', icon: '↩️' },
};

function estadoBadge(e) {
  const c = ESTADOS[e] || { label: e, cls: '', icon: '📦' };
  return `<span class="badge ${c.cls}">${c.icon} ${c.label}</span>`;
}

function progressPct(estado) {
  return { creado: 10, en_transito: 40, en_sede: 70, entregado: 100, devuelto: 0 }[estado] || 0;
}

function timeAgo(dt) {
  if (!dt) return '—';
  const diff = Date.now() - new Date(dt).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `hace ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h}h`;
  return `hace ${Math.floor(h / 24)}d`;
}

async function renderList(container, onDetail) {
  container.innerHTML = `
    <div style="margin-bottom:24px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;">
      <div>
        <h2 style="font-size:20px;font-weight:700;letter-spacing:-.4px;margin-bottom:4px;">Trazabilidad de Paquetes</h2>
        <p style="color:var(--text-muted);font-size:14px;">Seguimiento en tiempo real de despachos activos.</p>
      </div>
    </div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;">
      <input id="tl-search" type="text" placeholder="Buscar por número, destino…"
        style="flex:1;min-width:200px;padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:13px;">
      <select id="tl-estado"
        style="padding:8px 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text-muted);font-size:13px;">
        <option value="">Todos los estados</option>
        <option value="creado">Creado</option>
        <option value="en_transito">En tránsito</option>
        <option value="en_sede">En sede</option>
        <option value="entregado">Entregado</option>
        <option value="devuelto">Devuelto</option>
      </select>
    </div>
    <div class="card" style="padding:0;overflow:hidden;">
      <div id="tl-table-wrap">
        <div style="padding:40px;text-align:center;color:var(--text-muted);">Cargando…</div>
      </div>
    </div>`;

  const PAGE_SIZE = 20;
  let currentPage = 0;

  async function load() {
    const search = container.querySelector('#tl-search')?.value?.trim() || '';
    const estado = container.querySelector('#tl-estado')?.value || '';
    const qs = new URLSearchParams({ limit: PAGE_SIZE, offset: currentPage * PAGE_SIZE });
    if (search) qs.set('search', search);
    if (estado) qs.set('estado', estado);

    const wrap = container.querySelector('#tl-table-wrap');
    try {
      const res  = await fetch(`/api/tracking?${qs}`);
      const data = await res.json();

      if (!data.rows?.length) {
        wrap.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted);">No hay paquetes con seguimiento activo.</div>`;
        return;
      }

      const totalPages = Math.ceil(data.total / PAGE_SIZE);
      const from = currentPage * PAGE_SIZE + 1;
      const to   = Math.min(from + data.rows.length - 1, data.total);

      wrap.innerHTML = `
        <div style="padding:12px 18px;font-size:12px;color:var(--text-muted);border-bottom:1px solid var(--border);">
          ${data.total} paquete(s) · mostrando ${from}–${to}
        </div>
        <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;">
            <thead>
              <tr style="background:var(--surface-2);border-bottom:1px solid var(--border);">
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;">Número</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;">Destino</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;">Estado</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;">Último evento</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;">Progreso</th>
                <th style="padding:10px 14px;text-align:left;font-size:11px;font-weight:600;color:var(--text-muted);text-transform:uppercase;">Actualizado</th>
              </tr>
            </thead>
            <tbody>
              ${data.rows.map(r => {
                const pct = progressPct(r.estado);
                return `
                  <tr class="tr-tracking-row" data-token="${r.token}"
                    style="border-bottom:1px solid rgba(255,255,255,.04);cursor:pointer;transition:background .15s;"
                    onmouseover="this.style.background='var(--surface-2)'" onmouseout="this.style.background=''">
                    <td style="padding:12px 14px;font-family:monospace;font-size:12px;font-weight:700;color:var(--primary);">${r.numero}</td>
                    <td style="padding:12px 14px;font-size:13px;">${r.sede_destino || r.destinatario || '—'}</td>
                    <td style="padding:12px 14px;">${estadoBadge(r.estado)}</td>
                    <td style="padding:12px 14px;font-size:12px;color:var(--text-muted);">${r.ultimo_evento_ubicacion || '—'}</td>
                    <td style="padding:12px 14px;">
                      <div style="height:4px;background:rgba(255,255,255,.07);border-radius:99px;overflow:hidden;width:80px;">
                        <div style="height:100%;border-radius:99px;background:linear-gradient(90deg,#6366f1,#10b981);width:${pct}%;"></div>
                      </div>
                    </td>
                    <td style="padding:12px 14px;font-size:12px;color:var(--text-muted);">${timeAgo(r.ultimo_evento_at || r.updated_at)}</td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
        ${totalPages > 1 ? `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 18px;border-top:1px solid var(--border);flex-wrap:wrap;gap:8px;">
          <span style="font-size:12px;color:var(--text-muted);">Página ${currentPage + 1} de ${totalPages}</span>
          <div style="display:flex;gap:6px;">
            <button id="tl-prev" ${currentPage === 0 ? 'disabled' : ''}
              style="padding:5px 14px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-muted);font-size:12px;cursor:pointer;opacity:${currentPage === 0 ? '.4' : '1'};">
              ← Anterior
            </button>
            <button id="tl-next" ${currentPage >= totalPages - 1 ? 'disabled' : ''}
              style="padding:5px 14px;border:1px solid var(--border);border-radius:6px;background:var(--surface-2);color:var(--text-muted);font-size:12px;cursor:pointer;opacity:${currentPage >= totalPages - 1 ? '.4' : '1'};">
              Siguiente →
            </button>
          </div>
        </div>` : ''}`;

      wrap.querySelectorAll('.tr-tracking-row').forEach(row =>
        row.addEventListener('click', () => onDetail(row.dataset.token)));

      wrap.querySelector('#tl-prev')?.addEventListener('click', () => { currentPage--; load(); });
      wrap.querySelector('#tl-next')?.addEventListener('click', () => { currentPage++; load(); });
    } catch (e) {
      wrap.innerHTML = `<div style="padding:30px;color:var(--danger);text-align:center;">Error al cargar: ${_esc(e.message)}</div>`;
    }
  }

  let timer;
  container.querySelector('#tl-search').addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(() => { currentPage = 0; load(); }, 300);
  });
  container.querySelector('#tl-estado').addEventListener('change', () => { currentPage = 0; load(); });
  load();
}

async function renderDetail(container, token, onBack) {
  container.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-muted);">Cargando…</div>`;

  try {
    const res  = await fetch(`/api/tracking/${token}`);
    if (!res.ok) throw new Error('No encontrado');
    const t = await res.json();

    const STEP_LABELS = ['Creado', 'Despachado', 'En tránsito', 'En sede', 'Entregado'];
    const stepActive  = { creado: 0, en_transito: 2, en_sede: 3, entregado: 4, devuelto: 4 };
    const currentStep = stepActive[t.estado] ?? 0;

    container.innerHTML = `
      <div style="margin-bottom:20px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
        <button id="btn-back-tl"
          style="padding:6px 14px;border:1px solid var(--border);border-radius:7px;background:var(--surface-2);color:var(--text-muted);font-size:13px;cursor:pointer;">
          ← Volver
        </button>
        ${estadoBadge(t.estado)}
        <span style="font-size:18px;font-weight:700;">${t.numero} — Trazabilidad</span>
      </div>
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:20px;">
        ${t.sede_destino || t.destinatario} · ${formatDate(t.created_at)}
      </p>
      <div style="display:flex;margin-bottom:28px;overflow:hidden;border-radius:10px;">
        ${STEP_LABELS.map((label, i) => `
          <div style="flex:1;padding:10px 6px;text-align:center;font-size:11px;font-weight:600;
            ${i < currentStep ? 'background:rgba(16,185,129,.15);color:#6ee7b7;' :
              i === currentStep ? 'background:rgba(99,102,241,.2);color:#818cf8;' :
              'background:rgba(255,255,255,.03);color:#334155;'}
            ${i < STEP_LABELS.length - 1 ? 'border-right:1px solid rgba(255,255,255,.05);' : ''}">
            ${label}
          </div>`).join('')}
      </div>
      <div style="display:grid;grid-template-columns:1fr 300px;gap:24px;align-items:start;">
        <div class="card">
          <h4 style="font-size:13px;font-weight:700;color:var(--text-muted);margin-bottom:16px;text-transform:uppercase;letter-spacing:.05em;">
            Historial de movimientos
          </h4>
          ${t.eventos.map((e, idx) => {
            const isLast  = idx === t.eventos.length - 1;
            const isDone  = e.estado_paquete !== 'en_transito' || !isLast;
            const dotCls  = e.tipo === 'creacion' ? 'background:#6366f1;border-color:#6366f1;'
              : e.tipo === 'entrega_final' ? 'background:#10b981;border-color:#10b981;'
              : isDone ? 'background:#10b981;border-color:#10b981;' : 'background:#f59e0b;border-color:#f59e0b;';
            return `
              <div style="display:flex;gap:0;">
                <div style="display:flex;flex-direction:column;align-items:center;width:32px;flex-shrink:0;">
                  <div style="width:12px;height:12px;border-radius:50%;border:2px solid;margin-top:3px;${dotCls}"></div>
                  ${!isLast ? `<div style="width:2px;flex:1;min-height:20px;background:${isDone ? 'rgba(16,185,129,.3)' : 'rgba(255,255,255,.07)'};"></div>` : ''}
                </div>
                <div style="flex:1;padding:0 0 ${isLast ? 0 : 20}px 10px;">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4px;">
                    <span style="font-size:14px;font-weight:600;">
                      ${e.tipo === 'creacion' ? '📦 Despacho creado' :
                        e.tipo === 'entrega_final' ? '✅ Entrega final' :
                        `📍 Recibido en ${e.ubicacion}`}
                    </span>
                    <span style="font-size:11px;color:var(--text-muted);white-space:nowrap;">${formatDate(e.created_at)}</span>
                  </div>
                  <div style="font-size:13px;color:var(--text-muted);margin-bottom:6px;">
                    ${e.tipo === 'creacion'
                      ? `Creado por ${e.recibido_por}`
                      : `Recibido por <strong style="color:var(--text)">${e.recibido_por}</strong>${e.cargo_receptor ? ` (${e.cargo_receptor})` : ''} · Entregó: ${e.entregado_por}`}
                  </div>
                  ${e.observaciones ? `<div style="font-size:12px;color:#64748b;font-style:italic;">"${e.observaciones}"</div>` : ''}
                  ${e.foto_path && e.foto_path !== 'system' ? `
                    <img src="/api/tracking/fotos/${e.foto_filename}" alt="Evidencia"
                      style="width:60px;height:60px;object-fit:cover;border-radius:8px;margin-top:8px;cursor:pointer;border:1px solid rgba(255,255,255,.1);"
                      onclick="window.open('/api/tracking/fotos/${e.foto_filename}','_blank')">` : ''}
                </div>
              </div>`;
          }).join('')}
        </div>
        <div style="display:flex;flex-direction:column;gap:16px;">
          <div class="card">
            <h4 style="font-size:13px;font-weight:700;color:var(--text-muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em;">QR del paquete</h4>
            <img src="/api/tracking/${token}/qr" alt="QR" style="width:100%;border-radius:8px;background:#fff;padding:8px;">
            <a href="/api/tracking/${token}/qr" download="QR-${t.numero}.png"
              class="btn btn-primary" style="display:flex;align-items:center;justify-content:center;gap:6px;margin-top:12px;text-decoration:none;">
              ⬇ Descargar QR
            </a>
          </div>
          <div class="card" style="font-size:13px;">
            <h4 style="font-size:13px;font-weight:700;color:var(--text-muted);margin-bottom:12px;text-transform:uppercase;letter-spacing:.05em;">Detalles</h4>
            ${[
              ['Número', t.numero],
              ['Destinatario', t.destinatario],
              ['Sede destino', t.sede_destino || '—'],
              ['Eventos', t.eventos.length],
              ['Creado', formatDate(t.created_at)],
            ].map(([k, v]) => `
              <div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.05);">
                <span style="color:var(--text-muted);">${k}</span>
                <span style="font-weight:500;">${v}</span>
              </div>`).join('')}
          </div>
          ${t.acta_final ? `
            <div class="card">
              <h4 style="font-size:13px;font-weight:700;color:#10b981;margin-bottom:10px;">Acta de recepción</h4>
              <p style="font-size:12px;color:var(--text-muted);margin-bottom:10px;">
                Firmada por: ${t.acta_final.firmado_por}<br>Cargo: ${t.acta_final.cargo}
              </p>
              <a href="/api/tracking/public/${token}/acta-final"
                class="btn btn-secondary btn-small" style="text-decoration:none;display:inline-flex;align-items:center;gap:5px;">
                📄 Descargar acta
              </a>
            </div>` : ''}
          ${t.estado !== 'entregado' && t.estado !== 'devuelto' ? `
            <button id="btn-devuelto"
              style="padding:8px 16px;border:1px solid rgba(239,68,68,.3);border-radius:8px;background:rgba(239,68,68,.08);color:var(--danger);font-size:12px;cursor:pointer;">
              ↩️ Marcar como devuelto
            </button>` : ''}
        </div>
      </div>`;

    container.querySelector('#btn-back-tl')?.addEventListener('click', onBack);

    container.querySelector('#btn-devuelto')?.addEventListener('click', async () => {
      if (!confirm('¿Marcar este paquete como devuelto?')) return;
      const res = await fetch(`/api/tracking/${token}/estado`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: 'devuelto' }),
      });
      if (res.ok) renderDetail(container, token, onBack);
    });

  } catch (e) {
    container.innerHTML = `<div style="padding:30px;color:var(--danger);text-align:center;">Error: ${_esc(e.message)}</div>`;
  }
}

export async function renderTrazabilidad(container) {
  function goList() { renderList(container, goDetail); }
  function goDetail(token) { renderDetail(container, token, goList); }
  goList();
}
