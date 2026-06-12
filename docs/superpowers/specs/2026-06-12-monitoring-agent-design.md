# Módulo de Monitoreo de Equipos — Diseño

**Fecha:** 2026-06-12  
**Estado:** Aprobado

## Resumen

Módulo de monitoreo de PCs Windows compuesto por un agente instalable (`.exe`) que reporta inventario de hardware y métricas de recursos en tiempo real al servidor central, y un panel web para que el administrador de IT visualice todos los equipos conectados.

---

## Alcance

- **Plataforma agente:** Windows únicamente
- **Sin alertas** — solo visualización
- **Red inicial:** LAN de oficina principal
- **Expansión futura:** sedes remotas vía cambio de `server_url` en config del agente

---

## Arquitectura

```
[PC Windows] → agente-it.exe → POST /api/monitoring/heartbeat (cada 10s)
                                     ↓
                              [Express + SQLite]
                              agentes + metricas_agentes
                                     ↓
                           SSE GET /api/monitoring/stream
                                     ↓
                        Panel Monitoreo (browser admin)
```

### Flujo del agente

1. Primera ejecución: `POST /api/monitoring/register` con hardware completo → recibe `agent_id` + `api_key`, los guarda en `agent-config.json`
2. Ejecuciones siguientes: usa `agent_id` guardado, envía heartbeat directamente
3. Heartbeat cada 10s: CPU%, RAM usada, disco usado, uptime
4. Si servidor no responde: reintenta cada 30s, no crashea

### Flujo del panel

1. Browser conecta SSE → recibe actualizaciones en tiempo real
2. Tabla actualiza barras CPU/RAM/disco sin recargar
3. Click en fila → acordeón con hardware completo y métricas actuales

---

## Agente (`agent/`)

### Estructura de archivos

```
agent/
├── agent.js            ← lógica principal
├── package.json        ← deps: systeminformation, node-fetch
└── agent-config.json   ← configuración (server_url, interval_ms, agent_id, api_key)
```

### `agent-config.json` (distribuir junto al .exe)

```json
{
  "server_url": "http://192.168.1.100:3000",
  "interval_ms": 10000
}
```

`agent_id` y `api_key` se añaden automáticamente tras el primer registro.

### Datos recolectados

**Al registro (una sola vez):**
- CPU: modelo, núcleos, frecuencia GHz
- RAM: total en GB
- Disco: modelo, tamaño total
- GPU: modelo
- OS: nombre, versión, build, arquitectura
- Red: MAC address, adaptador

**Cada heartbeat (cada 10s):**
- CPU: % uso actual
- RAM: GB usados
- Disco: GB usados / libres (disco principal C:)
- Uptime en segundos

### Build

```bash
cd agent
npm install
npx pkg agent.js --targets node18-win-x64 --output dist/agente-it.exe
```

Genera `agente-it.exe` standalone (~60MB). Distribuir junto a `agent-config.json`.

### Instalación como servicio Windows (opcional)

Script `install-service.js` incluido usando `node-windows`. El usuario ejecuta:
```
node install-service.js
```
Instala el agente como servicio de Windows que arranca automáticamente con el PC. Requiere tener Node.js instalado solo para este paso de instalación; el `.exe` en sí no lo requiere.

---

## Backend (`src/monitoring/`)

### Tablas SQLite

```sql
CREATE TABLE IF NOT EXISTS agentes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  hostname     TEXT NOT NULL,
  mac_address  TEXT UNIQUE,
  ip           TEXT,
  os_name      TEXT,
  os_version   TEXT,
  cpu_model    TEXT,
  cpu_cores    INTEGER,
  cpu_ghz      REAL,
  ram_total    INTEGER,
  disk_model   TEXT,
  disk_total   INTEGER,
  gpu          TEXT,
  sede         TEXT,
  apodo        TEXT,
  api_key      TEXT UNIQUE NOT NULL,
  estado       TEXT DEFAULT 'offline',
  last_seen    TEXT,
  created_at   TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS metricas_agentes (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  agente_id    INTEGER NOT NULL REFERENCES agentes(id),
  timestamp    TEXT DEFAULT (datetime('now')),
  cpu_percent  REAL,
  ram_used     INTEGER,
  disk_used    INTEGER,
  uptime       INTEGER
);
```

Métricas se purgan automáticamente después de 24h mediante un job interno.

### Endpoints (`src/monitoring/monitoring-routes.js`)

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| POST | `/api/monitoring/register` | Ninguna | Agente se registra, recibe api_key |
| POST | `/api/monitoring/heartbeat` | api_key header | Agente envía métricas en vivo |
| GET | `/api/monitoring/agents` | Session (admin) | Lista todos + última métrica |
| GET | `/api/monitoring/agents/:id` | Session (admin) | Detalle + historial 24h |
| GET | `/api/monitoring/stream` | Session (admin) | SSE en tiempo real |

### Job de offline checker

Cada 20s: marca como `offline` los agentes sin heartbeat en los últimos 30s. Hace broadcast SSE del cambio.

---

## Frontend (`public/js/monitoreo.js`)

### Layout — Resumen + Tabla (opción C)

**Fila de KPIs** (5 tarjetas):
- Online | Offline | CPU promedio | RAM promedio | Disco promedio

**Barra de búsqueda/filtro** por hostname, sede, estado

**Tabla con columnas:**
`▶/▼` | Equipo (hostname + IP) | Sede | Estado | CPU (% + barra) | RAM (GB + barra) | Disco (% + barra) | Último visto

**Acordeón al hacer click en fila:**
- CPU modelo/núcleos/GHz
- RAM total/tipo/frecuencia
- Disco modelo/tamaño/espacio libre
- OS nombre/versión/build
- Red IP/MAC/adaptador
- Uptime / último reinicio

### Colores de barras

| Rango | Color |
|-------|-------|
| 0–60% | Azul / Verde |
| 60–80% | Amarillo |
| 80–100% | Rojo |

### SSE

- Conecta a `/api/monitoring/stream` al cargar el panel
- Recibe eventos `metrics` (actualiza fila) y `status` (cambia badge online/offline)
- Reconecta automáticamente si se pierde la conexión

---

## Navegación

- Nuevo ítem en sidebar: **Monitoreo** (`#monitoreo`, ícono `monitor`)
- Visible solo para roles con permiso `monitoring:read` (admin / full)
- Nuevo hash `#monitoreo` en `app.js`

---

## Archivos a crear/modificar

**Crear:**
- `agent/agent.js`
- `agent/package.json`
- `agent/agent-config.json`
- `src/monitoring/monitoring-routes.js`
- `public/js/monitoreo.js`

**Modificar:**
- `server.js` — importar router, crear tablas, iniciar offline checker
- `src/config/database.js` — migraciones nuevas tablas
- `public/index.html` — nav item Monitoreo
- `public/js/app.js` — hash `#monitoreo`, permisos, importar módulo

---

## Fuera de alcance (v1)

- Alertas / notificaciones
- Historial gráfico (gráficas de línea)
- Soporte Linux/Mac
- Auto-actualización del agente
- Dashboard por sede
