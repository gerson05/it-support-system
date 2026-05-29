import { 
  createTicketRow, 
  createEmptyState, 
  createLoadingSpinner 
} from './components.js';
import { state } from './app.js';
import DataService from './data-service.js';

export async function renderTicketList(container) {
  let currentPage = 1;
  const limit = 10;
  
  // Estructura principal
  container.innerHTML = `
    <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
      <div>
        <h2 style="font-size:20px;font-weight:700;letter-spacing:-.4px;margin-bottom:4px;">Tickets</h2>
        <p style="color:var(--text-3);font-size:13px;">Administra y responde los casos técnicos escalados por WhatsApp.</p>
      </div>
      <button class="btn btn-primary" id="btn-refresh-tickets">🔄 Refrescar</button>
    </div>

    <!-- Barra de Filtros -->
    <div class="card" style="margin-bottom: 25px; padding: 20px;">
      <div class="filter-bar">
        <div class="form-group">
          <label for="filter-search">Buscar</label>
          <input type="text" id="filter-search" placeholder="ID, teléfono, descripción..." autocomplete="off">
        </div>
        
        <div class="form-group">
          <label for="filter-status">Estado</label>
          <select id="filter-status">
            <option value="">Todos</option>
            <option value="siguiente_dia">Siguiente día</option>
            <option value="abierto">Abiertos</option>
            <option value="en_progreso">En Progreso</option>
            <option value="en_espera">En Espera</option>
            <option value="resuelto">Resueltos</option>
            <option value="cerrado">Cerrados</option>
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

  // Función para obtener y renderizar los datos filtrados
  async function fetchTickets() {
    const tableContainer = document.getElementById('tickets-table-container');
    if (!tableContainer) return;
    
    tableContainer.innerHTML = createLoadingSpinner();

    // Recoger filtros de la UI
    const search = document.getElementById('filter-search').value;
    const status = document.getElementById('filter-status').value;
    const priority = document.getElementById('filter-priority').value;
    const area = document.getElementById('filter-area').value;
    const assigned_to = document.getElementById('filter-assigned').value;

    try {
      const data = await DataService.getTickets({
        search,
        status,
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

  // Carga inicial
  await fetchTickets();
}
