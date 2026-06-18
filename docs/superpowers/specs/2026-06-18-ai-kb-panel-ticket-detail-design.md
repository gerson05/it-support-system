# AI KB Panel en Ticket Detail

**Fecha:** 2026-06-18  
**Estado:** Aprobado

## Objetivo

Agregar un tab "Asistente AI" en la columna izquierda del `ticket-detail.js` (vanilla JS) que permita al técnico IT buscar soluciones en el knowledge base, ver análisis de IA, y ejecutar comandos de solución directamente en el equipo remoto del solicitante.

---

## Contexto existente

### Backend (ya implementado)
- `src/ai/ai-routes.js` — REST API completa:
  - `POST /api/ai/analyze` — busca KB + LLM opcional; devuelve `{ kb: [...], ai: string|null }`
  - `GET /api/ai/kb/search?q=&limit=` — búsqueda solo KB
  - CRUD `/api/ai/kb` para gestión de items
- `src/ai/llm-provider.js` — abstracción multi-proveedor (Claude, OpenAI, Gemini, Ollama); `isEnabled()` indica si hay LLM activo
- `src/monitoring/` — agentes con heartbeat; endpoint de comandos remotos existente (dispatch vía heartbeat)
- Tabla `ai_ticket_analysis` — historial de análisis por ticket

### Frontend (ya implementado)
- `public/js/ticket-detail.js` — 2 columnas:
  - **Izquierda**: card de conversación WhatsApp (`.timeline-card`)
  - **Derecha**: Detalles, Gestión, Notas Internas
- `public/js/monitoreo.js` — UI de agentes/monitoreo; reutilizable para obtener agentes online

---

## Arquitectura del feature

### 1. Tabs en columna izquierda

La `.timeline-card` actual se convierte en un contenedor con 2 tabs:

```
[ 💬 Conversación ] [ 🤖 Asistente AI ]
```

- Tab activo marcado con `border-bottom: 2px solid var(--primary)` + fondo sutil
- Al hacer clic en "Asistente AI", llama `initAiTab(ticket)` si no fue inicializado

### 2. Ciclo de vida del tab AI

```
Clic en tab → spinner "Analizando..." 
  → POST /api/ai/analyze { problema: ticket.description, ticket_id }
  → Render resultados:
      [si ai != null] → bloque análisis LLM (verde)
      [kb.length > 0] → tarjetas KB rankeadas por _score
      [kb.length = 0] → mensaje "Sin coincidencias en KB"
  → Botón "🔄 Re-analizar" (con campo de texto editable)
```

Solo carga una vez por sesión de tab. Re-analizar permite editar el texto del problema.

### 3. Tarjetas KB

Cada item devuelto por `/api/ai/analyze` renderiza:
- Título + badge "MEJOR MATCH" en el item de mayor `_score`
- Categoría + número de comandos (de `JSON.parse(item.comandos).length`)
- Descripción de la solución (`item.solucion`, truncada a 120 chars con expand)
- Botones: **▶ Ejecutar en equipo** | **Ver solución** (expande texto completo)

### 4. Flujo de ejecución remota

**Al hacer clic "▶ Ejecutar en equipo":**

1. `GET /api/monitoring/agents` → filtrar agentes con `status = 'online'`
2. Buscar agente vinculado al ticket (por `ticket.phone` o campo `equipo_id` si existe)
   - Si vinculado y online → mostrar modal de confirmación con ese agente pre-seleccionado
   - Si no vinculado o offline → mostrar selector con agentes online disponibles (offline deshabilitados)
3. Modal muestra:
   - Nombre del agente + estado
   - Comandos del KB item (bloque monospace)
   - Botón "✓ Confirmar y ejecutar" / "Cancelar"
4. Confirmar → `POST /api/monitoring/agents/:id/command` con `{ tipo: 'shell', parametro: commands.join('\r\n') }`; responde `{ cmd_id }`
5. Output: polling `GET /api/monitoring/agents/:id/commands` cada 2s; buscar por `cmd_id`; leer campo `output` y `estado` (`ejecutando` | `completado` | `error`). Detener cuando `estado !== 'ejecutando'`.
6. Al completar → botones: **"✓ Marcar ticket como resuelto"** | **"Guardar en notas internas"**

### 5. Vinculación ticket ↔ agente

El ticket tiene `phone` del solicitante. Los agentes en DB tienen campo `hostname`/`name`. 

Estrategia: buscar en `agents` donde `name` coincide con campo `equipo` del ticket (si existe), o exponer como "sin equipo vinculado" y usar selector. No bloquear si no hay vínculo — siempre se puede seleccionar manualmente.

---

## Archivos a modificar / crear

| Archivo | Cambio |
|---------|--------|
| `public/js/ticket-detail.js` | Convertir `.timeline-card` en contenedor con tabs; agregar función `renderAiTab(ticket)` |
| `public/js/data-service.js` | Agregar `analyzeTicket(problema, ticketId)`, `getOnlineAgents()`, `executeRemoteCommand(agentId, commands)` |
| `public/js/components.js` | Agregar `createAiKbCard(item, isBestMatch)`, `createExecutionModal(agent, commands, onConfirm)` |

No se crean archivos nuevos. Los cambios están aislados en estos 3 archivos.

---

## Comportamiento edge cases

| Caso | Comportamiento |
|------|---------------|
| LLM no configurado (`isEnabled()=false`) | Solo muestra resultados KB, sin bloque AI. Sin error. |
| KB vacío (0 resultados) | Mensaje "No se encontraron soluciones relacionadas en la base de conocimiento." + botón Re-analizar |
| Ningún agente online | Botón "Ejecutar" deshabilitado con tooltip "Sin equipos online disponibles" |
| Comando falla en agente | Output muestra error en rojo; no cambia estado del ticket |
| Ticket sin descripción | Campo problema pre-llenado vacío; botón "Analizar" activo para que el técnico escriba manualmente |

---

## Lo que NO entra en scope

- Gestión CRUD del knowledge base (ya existe en otra sección)
- Historial de análisis previos del ticket (tabla `ai_ticket_analysis` existe pero no se muestra en este panel)
- Ejecución de comandos con parámetros variables (los comandos son strings fijos del KB item)
- Streaming de output en tiempo real (polling cada 2s es suficiente)
