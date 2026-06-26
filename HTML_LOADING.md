# Carga de Scripts - Documentación

## Orden Crítico

Los scripts deben cargarse en este orden exacto:

### 1. Core (Nunca cambiar)
```html
<!-- DEBE cargar primero - bootstrapping del sistema -->
<script src="/js/core/constants.js"></script>
<script src="/js/core/api.js"></script>
<script src="/js/core/state.js"></script>
<script src="/js/core/router.js"></script>
<script src="/js/core/app.js"></script>
```

### 2. UI Components (Segundo)
```html
<!-- Componentes reutilizables - no dependen de features -->
<script src="/js/ui/modal.js"></script>
<script src="/js/ui/forms.js"></script>
<script src="/js/ui/toast.js"></script>
<script src="/js/ui/components.js"></script>
```

### 3. Utils (Tercero)
```html
<!-- Utilidades - funciones puras sin dependencias -->
<script src="/js/utils/format.js"></script>
<script src="/js/utils/validators.js"></script>
<script src="/js/utils/dom.js"></script>
<script src="/js/utils/storage.js"></script>
<script src="/js/utils/logger.js"></script>
<script src="/js/utils/icons.js"></script>
```

### 4. Feature Services (Cuarto)
```html
<!-- APIs específicas de features - ANTES de los modules -->
<script src="/js/features/tickets/tickets-service.js"></script>
<script src="/js/features/despacho/despacho-service.js"></script>
<script src="/js/features/tech-requests/tech-request-service.js"></script>
<script src="/js/features/tracking/tracking-service.js"></script>
<script src="/js/features/inventario/inventario-service.js"></script>
<script src="/js/features/reuniones/reuniones-service.js"></script>
<script src="/js/features/usuarios/usuarios-service.js"></script>
```

### 5. Feature Modules (Quinto)
```html
<!-- Feature logic - dependen de services y utils -->
<script src="/js/features/tickets/tickets-list.js"></script>
<script src="/js/features/tickets/tickets-detail.js"></script>
<script src="/js/features/tickets/ticket-ai-panel.js"></script>

<script src="/js/features/despacho/despacho-list.js"></script>
<script src="/js/features/despacho/despacho-detail.js"></script>
<script src="/js/features/despacho/despacho-form.js"></script>
<script src="/js/features/despacho/despacho-rotulo.js"></script>
<script src="/js/features/despacho/despacho-helpers.js"></script>

<!-- ...otros features -->
```

### 6. Router Setup (Último)
```html
<!-- Inicializar router cuando TODO está cargado -->
<script>
  document.addEventListener('DOMContentLoaded', () => {
    // Todos los módulos ya están disponibles globalmente
    Router.init();
  });
</script>
```

---

## Patrón de Carga Segura

Cada módulo debe seguir este patrón:

```javascript
// features/tickets/tickets-list.js

// 1. Verificar dependencias disponibles
if (typeof TicketsService === 'undefined') {
  throw new Error('TicketsService no está disponible. Revisa el orden de carga.');
}

// 2. Definir módulo con IIFE
const TicketsList = (() => {
  // ... código
  return { init() { } };
})();

// 3. Exponer globalmente
window.TicketsList = TicketsList;
```

---

## Template de HTML (app.html)

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>IT-Tickets</title>
  
  <!-- CSS -->
  <link rel="stylesheet" href="/css/variables.css">
  <link rel="stylesheet" href="/css/base.css">
  <link rel="stylesheet" href="/css/components.css">
  <link rel="stylesheet" href="/css/theme.css">
</head>
<body>
  <div id="app"></div>

  <!-- 1. CORE (Obligatorio) -->
  <script src="/js/core/constants.js"></script>
  <script src="/js/core/api.js"></script>
  <script src="/js/core/state.js"></script>
  <script src="/js/core/router.js"></script>
  <script src="/js/core/app.js"></script>

  <!-- 2. UI COMPONENTS -->
  <script src="/js/ui/modal.js"></script>
  <script src="/js/ui/forms.js"></script>
  <script src="/js/ui/toast.js"></script>
  <script src="/js/ui/components.js"></script>

  <!-- 3. UTILS -->
  <script src="/js/utils/format.js"></script>
  <script src="/js/utils/validators.js"></script>
  <script src="/js/utils/dom.js"></script>
  <script src="/js/utils/storage.js"></script>
  <script src="/js/utils/logger.js"></script>

  <!-- 4. FEATURE SERVICES -->
  <script src="/js/features/tickets/tickets-service.js"></script>
  <script src="/js/features/despacho/despacho-service.js"></script>
  <script src="/js/features/tech-requests/tech-request-service.js"></script>
  <script src="/js/features/tracking/tracking-service.js"></script>
  <script src="/js/features/inventario/inventario-service.js"></script>
  <script src="/js/features/reuniones/reuniones-service.js"></script>
  <script src="/js/features/usuarios/usuarios-service.js"></script>

  <!-- 5. FEATURE MODULES -->
  <script src="/js/features/tickets/tickets-list.js"></script>
  <script src="/js/features/tickets/tickets-detail.js"></script>
  <script src="/js/features/tickets/ticket-ai-panel.js"></script>
  
  <script src="/js/features/despacho/despacho-list.js"></script>
  <script src="/js/features/despacho/despacho-detail.js"></script>
  <script src="/js/features/despacho/despacho-form.js"></script>
  <script src="/js/features/despacho/despacho-rotulo.js"></script>
  
  <script src="/js/features/tech-requests/tech-requests-list.js"></script>
  <script src="/js/features/tech-requests/tech-request-detail.js"></script>
  <script src="/js/features/tech-requests/tech-request-form.js"></script>
  <script src="/js/features/tech-requests/tech-request-acta.js"></script>
  
  <script src="/js/features/tracking/tracking-public.js"></script>
  <script src="/js/features/tracking/trazabilidad.js"></script>
  
  <script src="/js/features/inventario/inventario.js"></script>
  <script src="/js/features/inventario/inventario-forms.js"></script>
  <script src="/js/features/inventario/inventario-import.js"></script>
  <script src="/js/features/inventario/inventario-scanner.js"></script>
  
  <script src="/js/features/reuniones/reuniones-admin.js"></script>
  <script src="/js/features/reuniones/reuniones-public.js"></script>
  
  <script src="/js/features/usuarios/users.js"></script>
  <script src="/js/features/usuarios/roles.js"></script>
  <script src="/js/features/usuarios/employees.js"></script>
  <script src="/js/features/usuarios/employees-form.js"></script>
  
  <script src="/js/features/settings/settings.js"></script>
  <script src="/js/features/settings/punto-setup-modal.js"></script>
  <script src="/js/features/settings/sedes-admin.js"></script>
  <script src="/js/features/settings/bodegas-admin.js"></script>
  
  <script src="/js/features/audit/audit.js"></script>
  <script src="/js/features/dashboard/dashboard.js"></script>
  <script src="/js/features/farmacias/farmacias.js"></script>
  <script src="/js/features/firmar/firmar.js"></script>
  <script src="/js/features/monitoreo/monitoreo.js"></script>
  <script src="/js/features/herramientas/faqs.js"></script>

  <!-- 6. INIT -->
  <script>
    document.addEventListener('DOMContentLoaded', () => {
      // Verificar que todo está disponible
      if (!window.Router || !window.API) {
        throw new Error('Core no está disponible');
      }
      
      // Inicializar router y app
      Router.init();
    });
  </script>
</body>
</html>
```

---

## Debugging - Orden de Carga

### Verificar qué está disponible
```javascript
// En console
typeof TicketsService      // "object"
typeof TicketsList         // "object"
typeof Format              // "object"
typeof API                 // "object"
```

### Error: "X no está definido"
Solución: Revisar orden de scripts

```
Error: TicketsService is not defined
→ Verificar que tickets-service.js se carga ANTES de tickets-list.js
→ Verificar que tickets-service.js está en sección "4. SERVICES"
```

### Error: "Cannot read property of undefined"
Solución: Módulo intenta usar otro que no está cargado

```javascript
// ❌ MALO - TicketsService podría no estar disponible
const TicketsList = (() => {
  const loadTickets = async () => {
    return await TicketsService.list(); // Error potencial
  };
})();

// ✅ BIEN - Verificar primero
const TicketsList = (() => {
  if (typeof TicketsService === 'undefined') {
    throw new Error('TicketsService no cargado');
  }
  const loadTickets = async () => {
    return await TicketsService.list();
  };
})();
```

---

## Standalone Pages

Para páginas standalone (ej: medicalc.html, simulator.html):

```html
<!DOCTYPE html>
<html>
<head>
  <title>MediCalc</title>
  <link rel="stylesheet" href="/css/variables.css">
  <link rel="stylesheet" href="/css/medicalc.css">
</head>
<body>
  <div id="app"></div>
  
  <!-- Solo lo necesario para esta página -->
  <script src="/js/core/api.js"></script>
  <script src="/js/utils/format.js"></script>
  <script src="/js/utils/validators.js"></script>
  <script src="/js/ui/toast.js"></script>
  <script src="/js/features/medicalc/medicalc.js"></script>
  
  <script>
    MediCalc.init();
  </script>
</body>
</html>
```

---

## Checklist para Nueva Página

- [ ] Cargar CORE primero
- [ ] Luego UI components
- [ ] Luego utils
- [ ] Luego feature services
- [ ] Luego feature modules
- [ ] Último: custom init script
- [ ] Verificar console sin errores
- [ ] Probar funcionalidad
