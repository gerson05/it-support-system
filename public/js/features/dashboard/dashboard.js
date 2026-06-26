import { createTicketRow, createEmptyState, createLoadingSpinner } from './components.js';
import DataService from './data-service.js';

let refreshInterval = null;
let trendChart      = null;

/* ── SVG icons ──────────────────────────────────────────────────────────── */
const IC = {
  inbox:   `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,
  zap:     `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
  check:   `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  cpu:     `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/></svg>`,
  alert:   `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  clock:   `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,
  ok:      `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`,
  bar:     `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,
  tri:     `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  trend:   `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>`,
  ticket:  `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>`,
};

/* ── Stat card mejorada ─────────────────────────────────────────────────── */
function statCard({ value, label, icon, color, bg, subtitle = '' }) {
  return `
    <div class="card" style="padding:20px;cursor:default;border-color:${color}22;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:14px;">
        <div style="width:38px;height:38px;border-radius:10px;background:${bg};display:flex;align-items:center;justify-content:center;color:${color};">
          ${icon}
        </div>
      </div>
      <div style="font-size:28px;font-weight:700;letter-spacing:-1px;color:var(--text);line-height:1;">${value}</div>
      <div style="font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--text-3);margin-top:6px;">${label}</div>
      ${subtitle ? `<div style="font-size:11px;color:var(--text-3);margin-top:4px;">${subtitle}</div>` : ''}
    </div>`;
}

/* ── SLA card ───────────────────────────────────────────────────────────── */
function slaCard({ count, label, sublabel, ok, color, icon }) {
  const isOk = ok || count === 0;
  const c = isOk ? '#10b981' : color;
  const bg = isOk ? 'rgba(16,185,129,.1)' : `${color}18`;
  return `
    <div class="card" style="padding:18px 22px;border-left:3px solid ${c};">
      <div style="display:flex;align-items:center;gap:16px;">
        <div style="width:42px;height:42px;flex-shrink:0;border-radius:10px;background:${bg};display:flex;align-items:center;justify-content:center;color:${c};">
          ${isOk ? IC.ok : icon}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:26px;font-weight:700;color:${c};line-height:1;margin-bottom:4px;">${count}</div>
          <div style="font-size:13px;font-weight:600;color:var(--text-2);">${label}</div>
          <div style="font-size:11px;color:var(--text-3);margin-top:2px;">${sublabel}</div>
        </div>
        <div style="width:6px;height:36px;border-radius:3px;background:${c};opacity:.4;flex-shrink:0;"></div>
      </div>
    </div>`;
}

export async function renderDashboard(container) {
  if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; }
  if (trendChart)      { trendChart.destroy(); trendChart = null; }

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:24px;flex-wrap:wrap;gap:12px;">
      <div>
        <h2 style="font-size:20px;font-weight:700;letter-spacing:-.4px;margin-bottom:4px;">Dashboard de Soporte IT</h2>
        <p style="color:var(--text-3);font-size:13px;">Métricas en tiempo real · actualiza cada 30 segundos</p>
      </div>
      <div id="last-updated" style="font-size:11px;color:var(--text-3);"></div>
    </div>

    <div id="dashboard-loading">${createLoadingSpinner()}</div>

    <div id="dashboard-content" style="display:none;">

      <!-- KPI cards -->
      <div class="grid-4" id="stats-grid" style="margin-bottom:16px;"></div>

      <!-- SLA -->
      <div class="grid-2" id="sla-grid" style="margin-bottom:20px;"></div>

      <!-- Área + Prioridades -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px;">
        <div class="card">
          <div style="display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text-3);margin-bottom:18px;">
            ${IC.bar} Tickets por Área
          </div>
          <div id="area-chart-container"></div>
        </div>
        <div class="card">
          <div style="display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text-3);margin-bottom:18px;">
            ${IC.tri} Distribución por Prioridad
          </div>
          <div id="priority-container" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;"></div>
        </div>
      </div>

      <!-- Tendencia -->
      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text-3);margin-bottom:18px;">
          ${IC.trend} Tickets creados — últimos 7 días
        </div>
        <div style="position:relative;height:190px;">
          <canvas id="trend-chart"></canvas>
        </div>
      </div>

      <!-- Tickets recientes -->
      <div class="card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <div style="display:flex;align-items:center;gap:7px;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.6px;color:var(--text-3);">
            ${IC.ticket} Últimos tickets recibidos
          </div>
          <button class="btn btn-secondary btn-small" onclick="window.location.hash='#tickets'">Ver todos →</button>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Área</th>
                <th>Asunto / Solicitante</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>Asignado</th>
                <th>Actualizado</th>
              </tr>
            </thead>
            <tbody id="recent-tickets-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  async function fetchAndRenderData() {
    try {
      const [data, trendData] = await Promise.all([
        DataService.getMetrics(),
        fetch('/api/metrics/trend').then(r => r.json()).catch(() => ({ trend: [], sla: { breached: 0, warning: 0 } })),
      ]);

      document.getElementById('dashboard-loading').style.display = 'none';
      document.getElementById('dashboard-content').style.display = 'block';

      const now = new Date().toLocaleTimeString('es-CO', { hour:'2-digit', minute:'2-digit' });
      const lastUpd = document.getElementById('last-updated');
      if (lastUpd) lastUpd.textContent = `Actualizado a las ${now}`;

      /* ── 1. KPI cards ── */
      const sum = data.summary;
      document.getElementById('stats-grid').innerHTML = `
        ${statCard({ value: sum.open_tickets,        label: 'Abiertos',          icon: IC.inbox, color: '#6366f1', bg: 'rgba(99,102,241,.15)' })}
        ${statCard({ value: sum.in_progress_tickets,  label: 'En Progreso',       icon: IC.zap,   color: '#f97316', bg: 'rgba(249,115,22,.15)' })}
        ${statCard({ value: sum.resolved_today,        label: 'Resueltos Hoy',     icon: IC.check, color: '#10b981', bg: 'rgba(16,185,129,.15)' })}
        ${statCard({ value: `${sum.autoservice_rate}%`,label: 'Tasa Autoservicio', icon: IC.cpu,   color: '#8b5cf6', bg: 'rgba(139,92,246,.15)', subtitle: 'Resueltos por el bot' })}
      `;

      /* ── 2. SLA cards ── */
      const { breached = 0, warning = 0 } = trendData.sla || {};
      document.getElementById('sla-grid').innerHTML = `
        ${slaCard({ count: breached, label: 'SLA Vencidos',   sublabel: 'Tiempo límite superado',           ok: breached === 0, color: '#ef4444', icon: IC.alert })}
        ${slaCard({ count: warning,  label: 'SLA En Riesgo',  sublabel: 'Menos del 25% del tiempo restante', ok: warning === 0,  color: '#f59e0b', icon: IC.clock })}
      `;

      /* ── 3. Barras de área ── */
      const areaEl = document.getElementById('area-chart-container');
      if (data.by_area.length === 0) {
        areaEl.innerHTML = `<p style="color:var(--text-3);font-size:13px;text-align:center;padding:20px 0;">Sin datos de área.</p>`;
      } else {
        const max = Math.max(...data.by_area.map(a => a.count), 1);
        areaEl.innerHTML = data.by_area.map(item => {
          const pct = Math.round((item.count / max) * 100);
          return `
            <div style="margin-bottom:13px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">
                <span style="font-size:12px;color:var(--text-2);font-weight:500;">${item.area_label}</span>
                <span style="font-size:12px;font-weight:700;color:var(--text);">${item.count}</span>
              </div>
              <div style="height:5px;background:var(--surface-3);border-radius:99px;overflow:hidden;">
                <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,#6366f1,#8b5cf6);border-radius:99px;transition:width .4s ease;"></div>
              </div>
            </div>`;
        }).join('');
      }

      /* ── 4. Prioridades ── */
      const PRIO = [
        { key:'critica', label:'Crítica',  color:'#ef4444', bg:'rgba(239,68,68,.1)' },
        { key:'alta',    label:'Alta',     color:'#f97316', bg:'rgba(249,115,22,.1)' },
        { key:'media',   label:'Media',    color:'#f59e0b', bg:'rgba(245,158,11,.1)' },
        { key:'baja',    label:'Baja',     color:'#10b981', bg:'rgba(16,185,129,.1)' },
      ];
      const getCount = k => data.by_priority.find(x => x.priority.toLowerCase() === k)?.count || 0;
      document.getElementById('priority-container').innerHTML = PRIO.map(p => `
        <div style="background:${p.bg};border:1px solid ${p.color}22;border-radius:10px;padding:14px 16px;">
          <div style="font-size:24px;font-weight:700;color:${p.color};line-height:1;margin-bottom:5px;">${getCount(p.key)}</div>
          <div style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:${p.color};opacity:.8;">${p.label}</div>
        </div>`).join('');

      /* ── 5. Chart tendencia ── */
      const canvas = document.getElementById('trend-chart');
      if (canvas && trendData.trend?.length > 0) {
        if (trendChart) { trendChart.destroy(); trendChart = null; }
        trendChart = new Chart(canvas, {
          type: 'line',
          data: {
            labels: trendData.trend.map(d => d.day),
            datasets: [{
              data: trendData.trend.map(d => d.count),
              fill: true,
              backgroundColor: (ctx) => {
                const g = ctx.chart.ctx.createLinearGradient(0, 0, 0, 190);
                g.addColorStop(0, 'rgba(99,102,241,.25)');
                g.addColorStop(1, 'rgba(99,102,241,0)');
                return g;
              },
              borderColor: '#6366f1',
              borderWidth: 2,
              pointBackgroundColor: '#6366f1',
              pointBorderColor: '#1a1a30',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 6,
              tension: 0.4,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            scales: {
              y: {
                beginAtZero: true,
                ticks: { color: '#64748b', stepSize: 1, precision: 0, font: { size: 11 } },
                grid:  { color: 'rgba(255,255,255,.04)', drawBorder: false },
                border: { display: false },
              },
              x: {
                ticks: { color: '#64748b', font: { size: 11 } },
                grid:  { display: false },
                border: { display: false },
              },
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                backgroundColor: '#1a1a30',
                borderColor: 'rgba(255,255,255,.1)',
                borderWidth: 1,
                titleColor: '#94a3b8',
                bodyColor: '#e2e8f0',
                padding: 10,
                callbacks: {
                  label: ctx => ` ${ctx.parsed.y} ticket${ctx.parsed.y !== 1 ? 's' : ''}`,
                },
              },
            },
          },
        });
      }

      /* ── 6. Tickets recientes ── */
      const tbody = document.getElementById('recent-tickets-tbody');
      if (data.recent_tickets.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:40px 0;">${createEmptyState('Sin tickets recientes.')}</td></tr>`;
      } else {
        tbody.innerHTML = data.recent_tickets.map(t => createTicketRow(t)).join('');
      }

    } catch (err) {
      console.error(err);
      document.getElementById('dashboard-loading').innerHTML =
        createEmptyState('Error al cargar métricas. Verifica la conexión con el servidor.');
    }
  }

  await fetchAndRenderData();
  refreshInterval = setInterval(fetchAndRenderData, 30_000);
}
