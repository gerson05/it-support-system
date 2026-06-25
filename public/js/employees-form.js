// Employee form validation module
(function() {
  'use strict';

  // Initialize form validation when DOM is ready
  document.addEventListener('DOMContentLoaded', function() {
    initializeFormValidation();
  });

  function initializeFormValidation() {
    // Get DOM references
    const cedulaInput = document.getElementById('cedula');
    const nombreInput = document.getElementById('nombreCompleto');
    const cargoInput = document.getElementById('cargo');
    const areaInput = document.getElementById('area');
    const fechaInput = document.getElementById('fechaRespuesta');

    // Cedula validation: only digits, max 12 chars
    if (cedulaInput) {
      cedulaInput.addEventListener('input', function(e) {
        let value = e.target.value.replace(/\D/g, '');
        if (value.length > 12) {
          value = value.slice(0, 12);
        }
        e.target.value = value;
      });
    }

    // Nombre validation: only letters and spaces, allow Spanish characters
    if (nombreInput) {
      nombreInput.addEventListener('input', function(e) {
        let value = e.target.value;
        // Keep letters (a-z, A-Z), spaces, and Spanish characters (ñ, á, é, í, ó, ú)
        value = value.replace(/[^a-zA-ZñÑáéíóúÁÉÍÓÚ\s]/g, '');
        e.target.value = value;
      });
    }

    // Fecha validation: not future date
    if (fechaInput) {
      fechaInput.addEventListener('change', function(e) {
        const selectedDate = new Date(e.target.value);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (selectedDate > today) {
          alert('La fecha no puede ser en el futuro');
          e.target.value = '';
        }
      });
    }
  }

  // Export for testing if needed
  window.employeesFormValidator = {
    initializeFormValidation: initializeFormValidation
  };
})();
