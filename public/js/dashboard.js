import {
  createStatCard,
  createTicketRow,
  createEmptyState,
  createLoadingSpinner
} from './components.js';
import DataService from './data-service.js';

let refreshInterval = null;
let trendChart = null;   // referencia a la instancia de Chart.js

export async function renderDashboard(container) {
  if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; }
  if (trendChart)      { trendChart.destroy(); trendChart = null; }

  container.innerHTML = `
    <div class="page-header">
      <h2>Dashboard de Soporte IT</h2>
      <p>Métricas clave de atención y automatización por WhatsApp en tiempo real.</p>
    </div>

    <div id="dashboard-loading">${createLoadingSpinner()}</div>

    <div id="dashboard-content" style="display: none;">

      <!-- Grid de 4 tarjetas principales -->
      <div class="grid-4" id="stats-grid"></div>

      <!-- SLA: 2 tarjetas de alerta -->
      <div class="grid-2" id="sla-grid" style="margin-top:0;"></div>

      <!-- Secciones intermedias: Áreas + Prioridades -->
      <div class="grid-2">
        <div class="card">
          <div class="section-title">📊 Tickets por Área de la Empresa</div>
          <div class="chart-bar-list" id="area-chart-container" style="margin-top: 20px;"></div>
        </div>

        <div class="card">
          <div class="section-title">⚠️ Distribución por Prioridad</div>
          <div class="grid-priorities" style="margin-top: 25px;" id="priority-container"></div>
        </div>
      </div>

      <!-- Gráfica de tendencia (últimos 7 días) -->
      <div class="card" style="margin-top:0;">
        <div class="section-title">📈 Tickets Creados — Últimos 7 Días</div>
        <div style="position:relative;height:200px;margin-top:20px;">
          <canvas id="trend-chart"></canvas>
        </div>
      </div>

      <!-- Tabla de Tickets Recientes -->
      <div class="card" style="margin-top: 10px;">
        <div class="table-header-row">
          <div class="section-title">🎟️ Últimos Tickets Recibidos</div>
          <button class="btn btn-secondary" onclick="window.location.hash = '#tickets'">Ver todos los tickets ➔</button>
        </div>
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Área</th>
                <th>Solicitante</th>
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

      const loadingEl = document.getElementById('dashboard-loading');
      const contentEl = document.getElementById('dashboard-content');
      if (loadingEl) loadingEl.style.display = 'none';
      if (contentEl) contentEl.style.display = 'block';

      // 1. Tarjetas principales
      const statsGrid = document.getElementById('stats-grid');
      if (statsGrid) {
        const sum = data.summary;
        statsGrid.innerHTML = `
          ${createStatCard('Abiertos',          sum.open_tickets,         '📂', 'open')}
          ${createStatCard('En Progreso',        sum.in_progress_tickets,  '⚙️', 'in-progress')}
          ${createStatCard('Resueltos Hoy',      sum.resolved_today,       '✅', 'resolved')}
          ${createStatCard('Tasa Autoservicio',  `${sum.autoservice_rate}%`,'🤖', 'autoservice')}
        `;
      }

      // 2. SLA cards
      const slaGrid = document.getElementById('sla-grid');
      if (slaGrid && trendData.sla) {
        const { breached, warning } = trendData.sla;
        slaGrid.innerHTML = `
          <div class="card" style="border-left:3px solid ${breached > 0 ? '#ef4444' : '#22c55e'};padding:18px 24px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:28px;">${breached > 0 ? '🔴' : '🟢'}</span>
              <div>
                <div style="font-size:26px;font-weight:700;color:${breached > 0 ? '#ef4444' : '#22c55e'};">${breached}</div>
                <div style="font-size:12px;color:var(--text-muted);">SLA Vencidos <span style="font-size:10px;">(tiempo límite superado)</span></div>
              </div>
            </div>
          </div>
          <div class="card" style="border-left:3px solid ${warning > 0 ? '#f59e0b' : '#22c55e'};padding:18px 24px;">
            <div style="display:flex;align-items:center;gap:12px;">
              <span style="font-size:28px;">${warning > 0 ? '🟡' : '🟢'}</span>
              <div>
                <div style="font-size:26px;font-weight:700;color:${warning > 0 ? '#f59e0b' : '#22c55e'};">${warning}</div>
                <div style="font-size:12px;color:var(--text-muted);">SLA En Riesgo <span style="font-size:10px;">(menos del 25% del tiempo restante)</span></div>
              </div>
            </div>
          </div>
        `;
      }

      // 3. Barras de área
      const areaChartContainer = document.getElementById('area-chart-container');
      if (areaChartContainer) {
        if (data.by_area.length === 0) {
          areaChartContainer.innerHTML = createEmptyState('No hay tickets registrados por área.', '📊');
        } else {
          const maxCount = Math.max(...data.by_area.map(a => a.count), 1);
          areaChartContainer.innerHTML = data.by_area.map(item => {
            const pct = (item.count / maxCount) * 100;
            return `
              <div class="chart-bar-item">
                <div class="chart-bar-info">
                  <span class="chart-bar-label">${item.area_label}</span>
                  <span class="chart-bar-value"><strong>${item.count}</strong> tickets</span>
                </div>
                <div class="chart-bar-wrapper">
                  <div class="chart-bar-fill" style="width: ${pct}%;"></div>
                </div>
              </div>
            `;
          }).join('');
        }
      }

      // 4. Distribución de prioridades
      const priorityContainer = document.getElementById('priority-container');
      if (priorityContainer) {
        const getPriorityCount = (p) => {
          const found = data.by_priority.find(x => x.priority.toLowerCase() === p);
          return found ? found.count : 0;
        };
        priorityContainer.innerHTML = `
          <div class="priority-count-box critica">
            <span class="priority-number" style="color: var(--color-critica);">${getPriorityCount('critica')}</span>
            <span class="priority-label">Crítica</span>
          </div>
          <div class="priority-count-box alta">
            <span class="priority-number" style="color: var(--color-alta);">${getPriorityCount('alta')}</span>
            <span class="priority-label">Alta</span>
          </div>
          <div class="priority-count-box media">
            <span class="priority-number" style="color: var(--color-media);">${getPriorityCount('media')}</span>
            <span class="priority-label">Media</span>
          </div>
          <div class="priority-count-box baja">
            <span class="priority-number" style="color: var(--color-baja);">${getPriorityCount('baja')}</span>
            <span class="priority-label">Baja</span>
          </div>
        `;
      }

      // 5. Gráfica de tendencia con Chart.js
      const canvas = document.getElementById('trend-chart');
      if (canvas && trendData.trend?.length > 0) {
        if (trendChart) { trendChart.destroy(); trendChart = null; }
        trendChart = new Chart(canvas, {
          type: 'line',
          data: {
            labels: trendData.trend.map(d => d.day),
            datasets: [{
              label: 'Tickets',
              data: trendData.trend.map(d => d.count),
              fill: true,
              backgroundColor: 'rgba(102,126,234,0.15)',
              borderColor: '#667eea',
              borderWidth: 2,
              pointBackgroundColor: '#667eea',
              pointRadius: 4,
              tension: 0.3,
            }],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
              y: {
                beginAtZero: true,
                ticks: { color: '#94a3b8', stepSize: 1, precision: 0 },
                grid:  { color: 'rgba(255,255,255,0.05)' },
              },
              x: {
                ticks: { color: '#94a3b8' },
                grid:  { display: false },
              },
            },
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: ctx => ` ${ctx.parsed.y} ticket${ctx.parsed.y !== 1 ? 's' : ''}`,
                },
              },
            },
          },
        });
      }

      // 6. Tabla de tickets recientes
      const tbody = document.getElementById('recent-tickets-tbody');
      if (tbody) {
        if (data.recent_tickets.length === 0) {
          tbody.innerHTML = `
            <tr>
              <td colspan="7" style="text-align: center; padding: 40px 0;">
                ${createEmptyState('No hay tickets registrados recientemente.', '🎟️')}
              </td>
            </tr>
          `;
        } else {
          tbody.innerHTML = data.recent_tickets.map(ticket => createTicketRow(ticket)).join('');
        }
      }

    } catch (err) {
      console.error(err);
      const loadingEl = document.getElementById('dashboard-loading');
      if (loadingEl) {
        loadingEl.innerHTML = createEmptyState('Error al cargar las métricas. Comprueba la conexión con el servidor.', '❌');
      }
    }
  }

  await fetchAndRenderData();
  refreshInterval = setInterval(fetchAndRenderData, 30_000);
}
