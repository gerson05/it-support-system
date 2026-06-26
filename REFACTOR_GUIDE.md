# Guía de Refactorización - Dividir Componentes Grandes

## Archivos Prioritarios

| Archivo | Líneas | Estado | Plan |
|---------|--------|--------|------|
| despacho-list.js | 600+ | En curso | ✅ Dividir en sub-módulos |
| ticket-detail.js | 250+ | Pending | Dividir en secciones |
| tech-request-detail.js | 260+ | Pending | Dividir form + acta |
| RegistrarEquipo.jsx | 286 | Pending | Convertir a vanilla JS |
| reuniones-admin.js | 240+ | Pending | Dividir admin + public |

---

## Proceso de Refactorización

### Paso 1: Identificar Responsabilidades

Leer archivo y agrupar funciones por dominio:

```javascript
// ticket-detail.js (250 líneas) → Dividir en:
// 1. renderTicketDetail()     → ticket-detail-view.js
// 2. handleNoteAdd()          → ticket-detail-notes.js
// 3. handleMessageAdd()       → ticket-detail-messages.js
// 4. renderAIPanel()          → ticket-ai-panel.js (ya existe)
// 5. openAssignModal()        → ticket-assign-modal.js
```

### Paso 2: Crear Sub-módulos

Para cada responsabilidad, crear archivo módulo:

```
features/tickets/
├── ticket-list.js              (orquestador lista)
├── ticket-detail-view.js       (renderizar detalle)
├── ticket-detail-notes.js      (gestión de notas)
├── ticket-detail-messages.js   (gestión de mensajes)
├── ticket-ai-panel.js          (análisis IA)
├── ticket-assign-modal.js      (asignar usuario)
├── ticket-detail.js            (orquestador - NEW)
└── tickets-service.js          (API calls)
```

### Paso 3: Patrón Sub-módulo

Cada módulo pequeño (<150 líneas):

```javascript
// ticket-detail-notes.js
const TicketDetailNotes = (() => {
  const DOM_ID = '#ticket-notes';
  let ticketId = null;

  const render = (notes) => {
    const html = notes.map(n => `<div class="note">
      <p>${n.content}</p>
      <small>${Format.datetime(n.created_at)}</small>
    </div>`).join('');
    DOM.html(DOM.query(DOM_ID), html);
  };

  const addNote = async (content) => {
    const note = await TicketsService.addNote(ticketId, content);
    render([...notes, note]);
    Toast.success('Nota agregada');
  };

  return {
    init(id, initialNotes) {
      ticketId = id;
      render(initialNotes);
      DOM.on(
        DOM.query('#btn-add-note'),
        'click',
        () => addNote(DOM.query('#note-input').value)
      );
    }
  };
})();
```

### Paso 4: Orquestador Principal

Archivo principal que orquesta todo:

```javascript
// ticket-detail.js (orquestador)
const TicketDetail = (() => {
  let ticket = null;

  const render = () => {
    // Renderizar estructura base
    TicketDetailView.render(ticket);
    TicketDetailNotes.init(ticket.id, ticket.notes);
    TicketDetailMessages.init(ticket.id, ticket.messages);
    TicketAIPanel.init(ticket.id);
    
    // Event listeners
    DOM.on(DOM.query('#btn-assign'), 'click', openAssignModal);
  };

  const loadTicket = async (id) => {
    ticket = await TicketsService.getById(id);
    render();
  };

  return {
    async open(ticketId) {
      await loadTicket(ticketId);
    }
  };
})();
```

---

## Checklist Refactorización

### Pre-Refactor
- [ ] Revisar archivo original
- [ ] Identificar funciones/secciones
- [ ] Listar responsabilidades
- [ ] Hacer commit actual

### Refactoring
- [ ] Crear sub-módulos
- [ ] Mover funciones
- [ ] Actualizar imports
- [ ] Crear orquestador
- [ ] Actualizar HTML que lo usa

### Post-Refactor
- [ ] Probar en navegador
- [ ] Verificar console (sin errores)
- [ ] Commit con descripción clara
- [ ] Actualizar ESTRUCTURA.md

---

## Ejemplos de Refactorización

### Antes (250 líneas en un archivo)
```javascript
// ticket-detail.js
function openTicketDetail(ticketId) {
  // 50 líneas: renderizar estructura
  // 30 líneas: cargar ticket
  // 40 líneas: notas
  // 40 líneas: mensajes
  // 30 líneas: panel IA
  // 20 líneas: event listeners
}
```

### Después (5 archivos <100 líneas cada)
```
ticket-detail.js         (orquestador - 30 líneas)
ticket-detail-view.js    (renderizar - 40 líneas)
ticket-detail-notes.js   (notas - 60 líneas)
ticket-detail-messages.js (mensajes - 70 líneas)
ticket-ai-panel.js       (IA - 50 líneas)
```

---

## Orden de Prioridad

1. **ticket-detail.js** (260L) - Alta prioridad
2. **tech-request-detail.js** (260L) - Alta prioridad
3. **reuniones-admin.js** (240L) - Media prioridad
4. **inventario.js** (260L) - Media prioridad
5. **despacho-detail.js** (componentes) - Media prioridad

---

## Template de Módulo Pequeño

Usar este template para nuevos sub-módulos:

```javascript
// features/[feature]/[feature]-[section].js
const [Feature][Section] = (() => {
  const DOM_ID = '#[section]-container';
  let state = { };

  // Renderizar
  const render = () => {
    DOM.html(DOM.query(DOM_ID), `<!-- HTML -->`);
  };

  // Fetch datos
  const load = async () => {
    state = await [Feature]Service.get[Section]();
    render();
  };

  // Setup events
  const setupEvents = () => {
    DOM.on(DOM.query('#btn-[action]'), 'click', handle[Action]);
  };

  // Public API
  return {
    init() {
      setupEvents();
      load();
    },
    refresh() {
      load();
    }
  };
})();

// En HTML: <script src="js/features/[feature]/[feature]-[section].js"></script>
```

---

## Notas Importantes

✅ Mantener módulos <150 líneas  
✅ Una responsabilidad por archivo  
✅ Service layer para API calls  
✅ No duplicar lógica entre módulos  
✅ Usar event listeners para comunicación  
✅ Orquestador central para coordinar

❌ No crear archivos de "utilidad genérica"  
❌ No mezclar lógica de UI + negocio  
❌ No importar entre módulos (usar service)  
❌ No callbacks profundos (max 2 niveles)
