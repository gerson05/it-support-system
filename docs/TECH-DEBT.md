# Deuda Técnica y Mejoras Pendientes

Auditoría realizada 2026-07-17 con análisis estático del grafo de código.

---

## 🔴 Crítico

### 1. God Functions en el frontend

Funciones que mezclan fetch, DOM, eventos y lógica en una sola unidad. Imposibles de testear o mantener.

| Función | Archivo | Líneas |
|--------|---------|--------|
| `renderTicketDetail` | `public/js/features/tickets/ticket-detail.js:18` | 573 |
| `loadTicketData` | `public/js/features/tickets/ticket-detail.js:21` | 566 |
| `openCreateModal` | `public/js/features/despacho/despacho-form.js:112` | 561 |
| `renderTechRequests` | `public/js/features/tech-requests/tech-requests-list.js:63` | 426 |

**Fix:** Separar en capas — fetching, rendering, event binding. Cada función ≤ 100 líneas con responsabilidad única.

---

### 2. Cero tests unitarios

Solo existe `test-ci.mjs` (integración end-to-end). Los hotspots más críticos del sistema no tienen cobertura:

| Función | Usos | Riesgo |
|--------|------|--------|
| `showToast` (`public/js/ui/components.js`) | 190 | UI rompe silenciosamente |
| `wrap` (`src/utils/async-handler.js`) | 160 | Errors swallowed without notice |
| `loadTicketData` (`ticket-detail.js`) | 144 | Ticket view blind to regressions |
| `openCreateModal` (`despacho-form.js`) | 136 | Despacho flow untestable |
| `requireAuth` (`src/auth/auth-middleware.js`) | 95 | Auth bypass goes undetected |
| `requirePermission` (`src/auth/auth-middleware.js`) | 82 | RBAC bypass goes undetected |

**Fix:** Agregar Vitest o Node test runner. Prioridad: `requireAuth`, `wrap`, lógica de negocio de modelos.

---

## 🟡 Medio

### 3. Backend con cohesión casi cero

Módulos del servidor donde cada "módulo" es en la práctica un solo archivo sin interacción interna real entre componentes.

| Módulo | Cohesión | Síntoma |
|--------|----------|---------|
| `src/tickets/` | 0.00 | ticket-model.js hace todo |
| `src/metrics/` | 0.00 | un solo archivo de rutas |
| `src/despacho/` | 0.00 | modelo y rutas sin separación real |
| `src/events/` | 0.00 | SSE en un solo archivo |
| `src/auth/` | 0.02 | middleware y rutas acoplados |
| `src/inventario/` | 0.03 | 3 archivos de rutas paralelos sin base común |

**Fix:** Extraer lógica de negocio a service layers separados de routes y models. Patrón: `*-model.js` (DB) → `*-service.js` (lógica) → `*-routes.js` (HTTP).

---

### 4. `server.js` demasiado grande (401 líneas)

El punto de entrada registra routers, configura middleware, maneja SSE, gestiona errores y arranca el servidor.

**Fix:** Separar en:
- `src/app.js` — configuración Express + middleware
- `src/routes/index.js` — registro de routers
- `src/sse/sse-server.js` — lógica SSE
- `server.js` — solo `app.listen()` + startup

---

### 5. Variables de una letra en código fuente de producción

`i`, `w`, `v`, `a`, `c`, `k`, `n` aparecen como símbolos de nivel de módulo en ~15 archivos. No es minificación.

Archivos afectados: `sheets-logger.js`, `faq-data.js`, `ticket-model.js`, `tech-request-model.js`, `despacho-model.js`, `calendar-service.js`, varios en `public/js/features/`.

**Fix:** Renombrar a nombres descriptivos al tocar cada archivo.

---

## 🟢 Menor

### 6. Thin communities (módulos muy pequeños)

Módulos con 3–4 nodos que podrían fusionarse o expandirse para justificar su existencia como módulo independiente:

- `src/events/` (3 nodos) — SSE podría vivir en `src/tickets/` o `src/app/`
- `src/metrics/` (3 nodos) — podría expandirse con más analítica o fusionarse con `src/tickets/`

---

## Prioridad de ataque recomendada

```
1. Tests unitarios para requireAuth + requirePermission  (seguridad)
2. Romper god functions: ticket-detail.js primero        (mayor dolor diario)
3. Separar server.js en capas                            (mantenibilidad)
4. Service layer en src/tickets/ como piloto             (patrón replicable)
5. Renombrar variables de una letra al tocar archivos    (oportunista)
```
