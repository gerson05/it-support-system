// Employee form validation
(function() {
  'use strict';

  document.addEventListener('DOMContentLoaded', function() {
    initializeFormValidation();
  });

  function initializeFormValidation() {
    const cedulaInput = document.getElementById('formEmployeeCedula');
    const nombreInput = document.getElementById('formEmployeeNombre');

    // Cedula: only digits, max 12
    if (cedulaInput) {
      cedulaInput.addEventListener('input', function(e) {
        e.target.value = e.target.value.replace(/\D/g, '').slice(0, 12);
      });
    }

    // Nombre: letters and Spanish chars only
    if (nombreInput) {
      nombreInput.addEventListener('input', function(e) {
        e.target.value = e.target.value.replace(/[^a-zA-ZñÑáéíóúÁÉÍÓÚ\s]/g, '');
      });
    }
  }

  window.employeesFormValidator = {
    initializeFormValidation: initializeFormValidation
  };
})();
