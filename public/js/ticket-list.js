import {
  createTicketRow,
  createEmptyState,
  createLoadingSpinner
} from './components.js';
import { iconRefresh } from './icons.js';
import { state } from './app.js';
import DataService from './data-service.js';

export async function renderTicketList(container) {
  let currentPage = 1;
  const limit = 10;
  let mode = 'activos'; // 'activos' | 'archivo'

  // Estructura principal
  container.innerHTML = `
    <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
      <div>
        <h2 style="font-size:20px;font-weight:700;letter-spacing:-.4px;margin-bottom:4px;">Tickets</h2>
        <p style="color:var(--text-3);font-size:13px;">Administra y responde los casos técnicos escalados por WhatsApp.</p>
      </div>
      <button class="btn btn-primary" id="btn-refresh-tickets" style="display:flex;align-items:center;gap:7px;">${iconRefresh(14)} Refrescar</button>
    </div>

    <!-- Tabs Activos / Archivo -->
    <div style="display:flex;gap:0;margin-bottom:20px;border-bottom:2px solid var(--border);">
      <button id="tab-activos" style="padding:10px 22px;font-size:14px;font-weight:600;border:none;background:none;cursor:pointer;color:var(--primary);border-bottom:2px solid var(--primary);margin-bottom:-2px;transition:color .15s;">Activos</button>
      <button id="tab-archivo" style="padding:10px 22px;font-size:14px;font-weight:600;border:none;background:none;cursor:pointer;color:var(--text-3);border-bottom:2px solid transparent;margin-bottom:-2px;transition:color .15s;">Archivo</button>
    </div>

    <!-- Barra de Filtros -->
    <div class="card" style="margin-bottom: 25px; padding: 20px;" id="filters-card">
      <div class="filter-bar">
        <div class="form-group">
          <label for="filter-search">Buscar</label>
          <input type="text" id="filter-search" placeholder="ID, teléfono, descripción..." autocomplete="off">
        </div>

        <div class="form-group" id="status-filter-group">
          <label for="filter-status">Estado</label>
          <select id="filter-status">
            <option value="">Todos los activos</option>
            <option value="siguiente_dia">Siguiente día</option>
            <option value="abierto">Abiertos</option>
            <option value="en_progreso">En Progreso</option>
            <option value="en_espera">En Espera</option>
          </select>
        </div>

        <div class="form-group">
          <label for="filter-priority">Prioridad</label>
          <select id="filter-priority">
            <option value="">Todas</option>
            <option value="baja">Baja</option>
            <option value="media">Media</option>
            <option value="alta">Alta</option>
            <option value="critica">Crítica</option>
          </select>
        </div>

        <div class="form-group">
          <label for="filter-area">Área</label>
          <select id="filter-area">
            <option value="">Todas</option>
            <option value="cartera">💰 Cartera</option>
            <option value="compra">🛒 Compra</option>
            <option value="gestion_humana">👥 Gestión Humana</option>
            <option value="pqrs">📋 PQRS</option>
            <option value="contabilidad">📊 Contabilidad</option>
            <option value="farmacia">💊 Farmacia</option>
            <option value="cuentas_medicas">🏥 Cuentas Médicas</option>
            <option value="general">🖥️ General / IT</option>
          </select>
        </div>

        <div class="form-group">
          <label for="filter-assigned">Asignado A</label>
          <select id="filter-assigned">
            <option value="">Todos</option>
            <option value="null">Sin Asignar</option>
            <option value="${state.currentAgent.id}">Asignados a Mí</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Contenedor de la Tabla -->
    <div class="card" style="padding: 10px;">
      <div id="tickets-table-container">
        <!-- Renderizado dinámico -->
      </div>
    </div>
  `;

  function setTabUI() {
    const tabActivos = document.getElementById('tab-activos');
    const tabArchivo = document.getElementById('tab-archivo');
    const statusGroup = document.getElementById('status-filter-group');
    const statusSelect = document.getElementById('filter-status');

    if (mode === 'activos') {
      tabActivos.style.color = 'var(--primary)';
      tabActivos.style.borderBottomColor = 'var(--primary)';
      tabArchivo.style.color = 'var(--text-3)';
      tabArchivo.style.borderBottomColor = 'transparent';
      // Show status filter with active statuses
      statusGroup.style.display = '';
      statusSelect.innerHTML = `
        <option value="">Todos los activos</option>
        <option value="siguiente_dia">Siguiente día</option>
        <option value="abierto">Abiertos</option>
        <option value="en_progreso">En Progreso</option>
        <option value="en_espera">En Espera</option>
      `;
    } else {
      tabArchivo.style.color = 'var(--primary)';
      tabArchivo.style.borderBottomColor = 'var(--primary)';
      tabActivos.style.color = 'var(--text-3)';
      tabActivos.style.borderBottomColor = 'transparent';
      // Hide status filter — archive always shows resuelto+cerrado
      statusGroup.style.display = 'none';
    }
  }

  // Función para obtener y renderizar los datos filtrados
  async function fetchTickets() {
    const tableContainer = document.getElementById('tickets-table-container');
    if (!tableContainer) return;

    tableContainer.innerHTML = createLoadingSpinner();

    // Recoger filtros de la UI
    const search = document.getElementById('filter-search').value;
    const priority = document.getElementById('filter-priority').value;
    const area = document.getElementById('filter-area').value;
    const assigned_to = document.getElementById('filter-assigned').value;

    // In activos mode, allow per-status filtering; in archivo mode use status_group
    let statusParam = '';
    let statusGroupParam = '';

    if (mode === 'archivo') {
      statusGroupParam = 'archivo';
    } else {
      const rawStatus = document.getElementById('filter-status')?.value || '';
      if (rawStatus) {
        statusParam = rawStatus;
      } else {
        statusGroupParam = 'activos';
      }
    }

    try {
      const data = await DataService.getTickets({
        search,
        status: statusParam,
        status_group: statusGroupParam,
        priority,
        area,
        assigned_to,
        page: currentPage,
        limit
      });

      if (data.tickets.length === 0) {
        tableContainer.innerHTML = createEmptyState('No se encontraron tickets con los filtros actuales.', '📋');
        return;
      }

      tableContainer.innerHTML = `
        <div class="table-container">
          <table>
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Área</th>
                <th>Asunto / Solicitante</th>
                <th>Prioridad</th>
                <th>Estado</th>
                <th>Asignado</th>
                <th>Actualizado</th>
              </tr>
            </thead>
            <tbody>
              ${data.tickets.map(ticket => createTicketRow(ticket)).join('')}
            </tbody>
          </table>
        </div>

        <!-- Controles de Paginación -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 20px 10px 10px 10px;">
          <div style="font-size: 13.5px; color: var(--text-muted);">
            Mostrando página <strong>${data.page}</strong> de <strong>${data.total_pages || 1}</strong> (${data.total} tickets totales)
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary" id="btn-prev-page" ${data.page <= 1 ? 'disabled' : ''}>◀ Anterior</button>
            <button class="btn btn-secondary" id="btn-next-page" ${data.page >= data.total_pages ? 'disabled' : ''}>Siguiente ▶</button>
          </div>
        </div>
      `;

      // Vincular eventos de paginación
      const btnPrev = document.getElementById('btn-prev-page');
      const btnNext = document.getElementById('btn-next-page');

      if (btnPrev) {
        btnPrev.addEventListener('click', () => {
          if (currentPage > 1) {
            currentPage--;
            fetchTickets();
          }
        });
      }

      if (btnNext) {
        btnNext.addEventListener('click', () => {
          if (currentPage < data.total_pages) {
            currentPage++;
            fetchTickets();
          }
        });
      }

    } catch (err) {
      console.error(err);
      tableContainer.innerHTML = createEmptyState('Error al cargar la base de datos de tickets.', '❌');
    }
  }

  // Tab click handlers
  document.getElementById('tab-activos').addEventListener('click', () => {
    if (mode === 'activos') return;
    mode = 'activos';
    currentPage = 1;
    setTabUI();
    fetchTickets();
  });

  document.getElementById('tab-archivo').addEventListener('click', () => {
    if (mode === 'archivo') return;
    mode = 'archivo';
    currentPage = 1;
    setTabUI();
    fetchTickets();
  });

  // Vincular eventos a los filtros para recargar automáticamente al cambiar
  const filters = ['filter-status', 'filter-priority', 'filter-area', 'filter-assigned'];
  filters.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => {
        currentPage = 1; // Volver a la página 1 al cambiar un filtro
        fetchTickets();
      });
    }
  });

  // Buscador de texto con de-bounce básico de 300ms para no saturar al tipear
  let debounceTimeout = null;
  const searchInput = document.getElementById('filter-search');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        currentPage = 1;
        fetchTickets();
      }, 300);
    });
  }

  // Botón de refresco manual
  const btnRefresh = document.getElementById('btn-refresh-tickets');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', () => {
      fetchTickets();
    });
  }

  // Exponer modo actual para uso externo (SSE refresh)
  container._ticketListMode = () => mode;

  // Carga inicial
  setTabUI();
  await fetchTickets();
}
