// ============================================================================
// employees.js - Main logic for employee management
// ============================================================================

// Global variables
let currentTab = 'pendientes';
let allEmployees = [];
let editingEmployeeId = null;
const API_BASE = '/api/employees';

// DOM selectors
const tabButtons = document.querySelectorAll('.tab-button');
const tabContent = document.querySelectorAll('[data-tab-content]');
const btnNewEmployee = document.getElementById('btnNewEmployee');
const modalEmployee = document.getElementById('modalEmployee');
const formEmployee = document.getElementById('formEmployee');
const closeModalBtn = document.getElementById('closeModalEmployee');
const btnCancelModal = document.getElementById('btnCancelModalEmployee');
const employeeTableBody = document.getElementById('employeeTableBody');
const completadosTableBody = document.getElementById('completadosTableBody');
const modalTitle = document.getElementById('modalTitleEmployee');

// ============================================================================
// TAB MANAGEMENT
// ============================================================================

function setActiveTab(tab) {
  currentTab = tab;

  // Update active button
  tabButtons.forEach(btn => {
    if (btn.getAttribute('data-tab') === tab) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update active content
  tabContent.forEach(content => {
    if (content.getAttribute('data-tab-content') === tab) {
      content.classList.add('active');
    } else {
      content.classList.remove('active');
    }
  });

  // Also update tab divs by id
  const pendientesTab = document.getElementById('pendientes-tab');
  const completadosTab = document.getElementById('completados-tab');
  if (pendientesTab) pendientesTab.classList.toggle('active', tab === 'pendientes');
  if (completadosTab) completadosTab.classList.toggle('active', tab === 'completados');

  renderEmployees();
}

// ============================================================================
// FILTERING & RENDERING
// ============================================================================

function filterEmployees() {
  if (currentTab === 'pendientes') {
    return allEmployees.filter(emp => emp.estado === 'pendiente');
  } else if (currentTab === 'completado') {
    return allEmployees.filter(emp => emp.estado === 'completado');
  }
  return allEmployees;
}

function renderEmployees() {
  const pendientes = allEmployees.filter(emp => emp.estado === 'pendiente');
  const completados = allEmployees.filter(emp => emp.estado === 'completado');

  // Render pending employees
  if (employeeTableBody) {
    employeeTableBody.innerHTML = pendientes.map(emp => `
      <tr>
        <td>${escapeHtml(emp.cedula || '')}</td>
        <td>${escapeHtml(emp.nombre_completo || '')}</td>
        <td>${escapeHtml(emp.cargo || '')}</td>
        <td>${escapeHtml(emp.area || '')}</td>
        <td><span class="badge badge-pendiente">Pendiente</span></td>
        <td>${escapeHtml(emp.usuario || '')}</td>
        <td>${formatDate(emp.fecha_creacion)}</td>
        <td>
          <div class="actions-cell">
            <button class="btn-sm btn-primary-sm" onclick="openEditModal('${emp.id}')">Editar</button>
            <button class="btn-sm btn-danger-sm" onclick="deleteEmployee('${emp.id}')">Eliminar</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  // Render completed employees
  if (completadosTableBody) {
    completadosTableBody.innerHTML = completados.map(emp => `
      <tr>
        <td>${escapeHtml(emp.cedula || '')}</td>
        <td>${escapeHtml(emp.nombre_completo || '')}</td>
        <td>${escapeHtml(emp.cargo || '')}</td>
        <td>${escapeHtml(emp.area || '')}</td>
        <td><span class="badge badge-completado">Completado</span></td>
        <td>${escapeHtml(emp.usuario || '')}</td>
        <td>${formatDate(emp.fecha_creacion)}</td>
        <td>
          <div class="actions-cell">
            <button class="btn-sm btn-primary-sm" onclick="openEditModal('${emp.id}')">Editar</button>
            <button class="btn-sm btn-danger-sm" onclick="deleteEmployee('${emp.id}')">Eliminar</button>
          </div>
        </td>
      </tr>
    `).join('');
  }
}

// ============================================================================
// API & DATA LOADING
// ============================================================================

async function loadEmployees() {
  try {
    const response = await fetch(API_BASE);
    if (!response.ok) {
      if (response.status === 401) {
        showNotification('Necesitas iniciar sesión', 'error');
        return;
      }
      throw new Error(`Error: ${response.status}`);
    }
    allEmployees = await response.json();
    renderEmployees();
  } catch (error) {
    console.error('Error loading employees:', error);
    showNotification('Error cargando empleados', 'error');
  }
}


// ============================================================================
// MODAL OPERATIONS
// ============================================================================

function openNewEmployeeModal() {
  editingEmployeeId = null;
  if (modalTitle) {
    modalTitle.textContent = 'Nuevo Empleado';
  }

  formEmployee.reset();

  const cedulaInput = document.getElementById('formEmployeeCedula');
  if (cedulaInput) {
    cedulaInput.removeAttribute('readonly');
  }

  if (modalEmployee) {
    modalEmployee.classList.add('active');
  }
}

async function openEditModal(employeeId) {
  editingEmployeeId = employeeId;

  try {
    const response = await fetch(`${API_BASE}/${employeeId}`);
    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }
    const employee = await response.json();

    if (modalTitle) {
      modalTitle.textContent = 'Editar Empleado';
    }

    // Populate form
    const cedulaInput = document.getElementById('formEmployeeCedula');
    const nombreInput = document.getElementById('formEmployeeNombre');
    const cargoInput = document.getElementById('formEmployeeCargo');
    const areaInput = document.getElementById('formEmployeeArea');
    const usuarioInput = document.getElementById('formEmployeeUsuario');
    const contraInput = document.getElementById('formEmployeeContraseña');
    const estadoSelect = document.getElementById('formEmployeeEstado');

    if (cedulaInput) {
      cedulaInput.value = employee.cedula || '';
      cedulaInput.setAttribute('readonly', 'readonly');
    }
    if (nombreInput) nombreInput.value = employee.nombre_completo || '';
    if (cargoInput) cargoInput.value = employee.cargo || '';
    if (areaInput) areaInput.value = employee.area || '';
    if (usuarioInput) usuarioInput.value = employee.usuario || '';
    if (contraInput) contraInput.value = '••••';
    if (estadoSelect) estadoSelect.value = employee.estado || 'pendiente';

    if (modalEmployee) {
      modalEmployee.classList.add('active');
    }
  } catch (error) {
    console.error('Error loading employee:', error);
    showNotification('Error cargando empleado', 'error');
  }
}

function closeModal() {
  editingEmployeeId = null;
  formEmployee.reset();

  if (modalEmployee) {
    modalEmployee.classList.remove('active');
  }
}

// ============================================================================
// FORM SUBMISSION & VALIDATION
// ============================================================================

function validateEmployeeForm(data) {
  const cedulaRegex = /^\d{8,12}$/;
  if (!cedulaRegex.test(data.cedula)) {
    showNotification('Cédula debe contener 8-12 dígitos', 'error');
    return false;
  }

  if (!data.nombre || data.nombre.trim().length < 3) {
    showNotification('Nombre debe tener al menos 3 caracteres', 'error');
    return false;
  }

  if (!data.cargo || data.cargo.trim() === '') {
    showNotification('Cargo es requerido', 'error');
    return false;
  }

  if (!data.area || data.area.trim() === '') {
    showNotification('Área es requerida', 'error');
    return false;
  }

  return true;
}

async function handleFormSubmit(e) {
  e.preventDefault();

  const formData = new FormData(formEmployee);
  const data = {
    cedula: formData.get('cedula') || '',
    nombre_completo: formData.get('nombre') || '',
    cargo: formData.get('cargo') || '',
    area: formData.get('area') || '',
    estado: formData.get('estado') || 'pendiente'
  };

  if (!validateEmployeeForm(data)) {
    return;
  }

  try {
    const url = editingEmployeeId
      ? `${API_BASE}/${editingEmployeeId}`
      : API_BASE;

    const method = editingEmployeeId ? 'PUT' : 'POST';

    const response = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    showNotification(
      editingEmployeeId
        ? 'Empleado actualizado exitosamente'
        : 'Empleado creado exitosamente',
      'success'
    );

    closeModal();
    loadEmployees();
  } catch (error) {
    console.error('Error submitting form:', error);
    showNotification('Error guardando empleado', 'error');
  }
}

// ============================================================================
// DELETE OPERATION
// ============================================================================

async function deleteEmployee(employeeId) {
  if (!confirm('¿Estás seguro de que deseas eliminar este empleado?')) {
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/${employeeId}`, {
      method: 'DELETE'
    });

    if (!response.ok) {
      throw new Error(`Error: ${response.status}`);
    }

    showNotification('Empleado eliminado exitosamente', 'success');
    loadEmployees();
  } catch (error) {
    console.error('Error deleting employee:', error);
    showNotification('Error eliminando empleado', 'error');
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

function formatDate(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  } catch (e) {
    return dateString;
  }
}

function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 20px;
    background: ${type === 'success' ? '#28a745' : type === 'error' ? '#dc3545' : '#17a2b8'};
    color: white;
    border-radius: 4px;
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
  // Tab buttons
  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');
      setActiveTab(tab);
    });
  });

  // New employee button
  if (btnNewEmployee) {
    btnNewEmployee.addEventListener('click', openNewEmployeeModal);
  }

  // Modal close buttons
  if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeModal);
  }
  if (btnCancelModal) {
    btnCancelModal.addEventListener('click', closeModal);
  }

  // Form submit
  if (formEmployee) {
    formEmployee.addEventListener('submit', handleFormSubmit);
  }

  // Close modal on backdrop click
  if (modalEmployee) {
    modalEmployee.addEventListener('click', (e) => {
      if (e.target === modalEmployee) {
        closeModal();
      }
    });
  }

  // Load employees on page load
  loadEmployees();
});
