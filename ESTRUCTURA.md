# Estructura del Proyecto IT-Tickets

## Arquitectura General

```
Backend (Node.js)        Frontend (Vanilla JS)
src/                     public/
  ├─ core/                 ├─ js/
  ├─ modules/              │   ├─ core/       (bootstrapping)
  ├─ shared/               │   ├─ features/   (módulos por funcionalidad)
  └─ config/               │   ├─ ui/        (componentes reutilizables)
                           │   └─ utils/     (helpers)
                           ├─ css/          (estilos)
                           ├─ index.html    (entry point)
                           └─ app.html      (shell)
```

---

## Backend (`src/`)

### Capas por Módulo

Cada módulo tiene estructura clara de 4 capas:

```
src/modules/tickets/
├── ticket-model.js       (1. DATA - queries BD)
├── ticket-service.js     (2. LOGIC - reglas negocio)
├── ticket-routes.js      (3. API - endpoints HTTP)
└── validators.js         (4. VALIDATION - input)
```

**Responsabilidades:**
- **Model**: Interacción con BD, queries SQL
- **Service**: Lógica de negocio, transformaciones
- **Routes**: Endpoints HTTP, status codes
- **Validators**: Validación de entrada

### Core (`src/core/`)

Base compartida del sistema:
- `auth/` - Autenticación, sesiones
- `permissions/` - Control de acceso (RBAC)
- `users/` - Gestión de usuarios
- `events/` - Event bus

### Shared (`src/shared/`)

Utilidades globales:
- `utils/` - Funciones helper
- `middleware/` - Middleware global

---

## Frontend (`public/`)

### Core (`public/js/core/`)

Bootstrapping y configuración:
- `app.js` - Main entry point
- `api.js` - HTTP client
- `router.js` - Page routing
- `state.js` - State management
- `constants.js` - Configuración global

**Uso:**
```javascript
// Conectarse a API
const data = await API.get('/tickets');

// Navegar
Router.navigate('/tickets/123');

// Global state
State.set('user', userData);
```

### Features (`public/js/features/`)

Módulos independientes por funcionalidad:

```
features/tickets/
├── ticket-list.js      (Listar tickets)
├── ticket-detail.js    (Detalle de ticket)
├── ticket-ai-panel.js  (Panel IA)
└── tickets-service.js  (API calls específicas)
```

**Patrón Módulo:**
```javascript
const TicketList = (() => {
  const state = { tickets: [] };

  const render = () => { /* renderizar DOM */ };
  const fetch = async () => { /* traer datos */ };

  return {
    init() { /* inicializar */ },
    refresh() { /* refrescar */ }
  };
})();

// En HTML: <script src="features/tickets/ticket-list.js"></script>
```

### UI (`public/js/ui/`)

Componentes reutilizables:
- `modal.js` - Diálogos
- `forms.js` - Helpers de formularios
- `toast.js` - Notificaciones
- `components.js` - UI genérico

**Uso:**
```javascript
// Modal
Modal.create('id', 'Título', 'contenido');
Modal.open('id');

// Toast
Toast.success('Guardado!');
Toast.error('Error al guardar');

// Forms
const data = Forms.getValues(formElement);
Forms.setValues(formElement, { name: 'Juan' });
```

### Utils (`public/js/utils/`)

Funciones helper:
- `format.js` - Formateo (fechas, moneda, texto)
- `validators.js` - Validación de input
- `dom.js` - Manipulación DOM
- `storage.js` - LocalStorage
- `logger.js` - Logging

**Uso:**
```javascript
// Formato
Format.date(isoDate);      // "26/06/2026"
Format.currency(1000);     // "$1.000"

// Validación
Validators.email(value);
Validators.required(value);

// DOM
DOM.query('#id');
DOM.addClass(el, 'active');
DOM.on(el, 'click', handler);

// Storage
Storage.set('user', userData);
Storage.get('user');

// Logger
Logger.info('Mensaje');
Logger.error('Error');
```

### CSS (`public/css/`)

Estilos organizados:
- `variables.css` - Colores, espaciado
- `base.css` - Reset y base
- `components.css` - Componentes
- `theme.css` - Tema (dark/light)

---

## Flujo de Desarrollo

### 1. Nueva Feature

Crear carpeta:
```
public/js/features/nueva-feature/
├── nueva-feature-list.js
├── nueva-feature-detail.js
└── nueva-feature-service.js
```

Patrón modular:
```javascript
const NewFeatureList = (() => {
  const state = { items: [] };
  
  return {
    init() { /* setup */ },
    async load() { /* fetch */ }
  };
})();
```

### 2. Reutilizar Componentes

```javascript
// Modal
Modal.create('modal-id', 'Título', '<form>...</form>');

// Toast
Toast.success('Hecho!');

// Forms
const values = Forms.getValues(document.querySelector('form'));

// DOM
DOM.on(button, 'click', handler);
```

### 3. Llamar API

```javascript
const tickets = await API.get('/api/tickets');
await API.post('/api/tickets', { title: 'Nuevo' });
await API.put(`/api/tickets/${id}`, data);
```

---

## Ventajas de esta Estructura

✅ **Modular**: Features independientes, sin acoplamiento  
✅ **Escalable**: Agregar features sin tocar código existente  
✅ **Mantenible**: Responsabilidades claras por archivo  
✅ **Testeable**: Módulos aislados, fácil mock  
✅ **Legible**: Estructura predecible y consistente  
✅ **Desacoplado**: Frontend/backend separados completamente

---

## Convenciones

### Nombres de Archivos
- Módulos: `kebab-case.js` (ticket-list.js)
- Funciones utilitarias: `noun.js` (format.js)
- Servicios: `nombre-service.js` (tickets-service.js)

### Estructura de Módulos
```javascript
const ModuleName = (() => {
  // Estado privado
  const state = {};

  // Funciones privadas
  const render = () => {};
  const fetch = async () => {};

  // API pública
  return {
    init() { },
    method() { }
  };
})();
```

### Eventos
- Usar `CustomEvent` para comunicación entre módulos
- Emitir desde feature, escuchar en otro

```javascript
// Emitir
document.dispatchEvent(new CustomEvent('ticketCreated', { detail: data }));

// Escuchar
document.addEventListener('ticketCreated', (e) => console.log(e.detail));
```

---

## Migración desde React

**Eliminado:**
- ❌ client/src/ (React components)
- ❌ node_modules de React
- ❌ JSX/Babel

**Mantenido:**
- ✅ Backend (src/)
- ✅ Public assets (css, html)
- ✅ Database (database/)

**Nuevas utilidades:**
- ✅ UI helpers (modal, forms, toast)
- ✅ Utility libraries (format, validators, dom, storage)
- ✅ Service layer utilities
