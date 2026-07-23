# Sistema de Tickets IT

[![CI](https://github.com/gerson05/it-support-system/actions/workflows/ci.yml/badge.svg)](https://github.com/gerson05/it-support-system/actions/workflows/ci.yml)
[![Release](https://github.com/gerson05/it-support-system/actions/workflows/release.yml/badge.svg)](https://github.com/gerson05/it-support-system/releases)
[![Node.js](https://img.shields.io/badge/Node.js-24-green)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/Docker-ready-blue)](https://ghcr.io/gerson05/it-support-system)

Sistema de soporte técnico con **chatbot de WhatsApp**, panel web de gestión, inventario de activos, integración con ERP GeneXus y generación de documentos. Diseñado para equipos de IT de empresas con múltiples sedes.

---

## Características

| Módulo | Descripción |
|--------|-------------|
| **Chatbot WhatsApp** | Flujos conversacionales para reportar problemas, solicitar equipos y registrar incidencias |
| **Panel de Tickets** | Dashboard en tiempo real con SSE, filtros por área y agente; perfil de empleado con cédula desde ticket |
| **Inventario** | Equipos, celulares y UPS con códigos QR, autoregistro móvil, numeración automática y búsqueda server-side |
| **Requerimientos** | Solicitudes de equipos con flujo de aprobación y generación de actas DOCX |
| **Base de Conocimiento** | FAQ por área con seguimiento de resoluciones y opción de IA |
| **Despacho** | Trazabilidad de pedidos, tracking de entregas y selector de inventario con búsqueda por servidor |
| **Monitoreo** | Estado de dispositivos, comandos remotos y alertas offline |
| **Reuniones** | Integración con Google Calendar y Google Meet |
| **Empleados** | Provisionamiento en dos fases, autocomplete por nombre/cédula, importación masiva por Excel |
| **Analítica** | Requerimientos técnicos por sede, asignación de técnicos y métricas de resolución |
| **Integración ERP** | Sync automático con GeneXus Medivalle (empleados, sucursales) cada 24h; búsqueda por cédula/nombre; perfil unificado por cédula con historial de tickets, despachos y requerimientos; importación Excel como fallback |
| **Farmacias FOMAG** | Gestión de red de puntos farmacéuticos |
| **Auditoría** | Registro completo de accesos y acciones del sistema |

---

## Stack Tecnológico

- **Runtime:** Node.js 24 (ES Modules)
- **Servidor:** Express 4
- **Base de datos:** SQLite (nativo `node:sqlite`, sin dependencias externas)
- **WhatsApp:** whatsapp-web.js + Baileys
- **Frontend:** Vanilla JavaScript (sin framework, sin build tool)
- **Documentos:** ExcelJS, docx (generación + importación Excel)
- **ERP:** GeneXus scraper (node-fetch + HTML parsing)
- **Google APIs:** Sheets, Calendar, Drive
- **IA opcional:** Claude, OpenAI, Gemini, Ollama
- **Proxy:** Caddy (HTTPS automático)
- **Contenedores:** Docker + Docker Compose

---

## Inicio Rápido

### Requisitos

- Node.js 24+
- npm 10+

### Instalación local

```bash
git clone https://github.com/gerson05/it-support-system.git
cd it-support-system
npm install
cp .env.example .env
# Editar .env con los valores requeridos
node server.js
```

Panel disponible en: `http://localhost:3000`

### Con Docker (recomendado para producción)

```bash
cp .env.example .env
# Editar .env — mínimo: DOMAIN, INIT_ADMIN_PASS
docker compose up -d
```

Ver [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) para guía completa de producción.

---

## Variables de Entorno

Ver referencia completa en [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md).

Variables mínimas para funcionar:

| Variable | Descripción |
|----------|-------------|
| `PORT` | Puerto del servidor (default: `3000`) |
| `INIT_ADMIN_PASS` | Contraseña del admin inicial |
| `IT_WHATSAPP_NUMBER` | Número de WhatsApp IT (ej. `573001234567`) |
| `WHATSAPP_VERIFY_TOKEN` | Token para verificar el webhook |
| `ERP_USER` | Usuario GeneXus para sync automático (opcional) |
| `ERP_PASS` | Contraseña GeneXus |
| `ERP_SYNC_INTERVAL_HOURS` | Intervalo de sync en horas (default: `24`) |
| `ERP_EMPLEADOS_OBJ` | Servlet de empleados GeneXus (ej. `com.version8.wwempleados`); requerido para sync de empleados |

---

## Chatbot de WhatsApp

El chatbot guía al usuario por 3 flujos principales:

```
Hola
 ├── 1. Problema técnico
 │    └── Ciudad → Punto de atención → Área → Nombre → Descripción → Ticket creado
 ├── 2. Requerimiento de equipos
 │    └── Ciudad → Punto → Nombre → Cédula → Cargo → Descripción → Solicitud creada
 └── 3. Equipo con falla
      └── Ciudad → Punto → Nombre → Descripción → Incidencia creada
```

- **Horario:** Solo responde en horario hábil (lun–vie 8am–6pm). Fuera de horario registra nombre y crea caso diferido.
- **Ticket activo:** Si el usuario tiene un ticket abierto, los mensajes se añaden directamente sin re-entrar al flujo.
- **IA automática:** Si `GEMINI_API_KEY` está configurado, el bot sugiere soluciones antes de crear el ticket.
- **Simulador:** `POST /api/simulate` permite probar el chatbot sin WhatsApp real.

Ver [docs/CHATBOT.md](docs/CHATBOT.md) para detalle de flujos y configuración de mensajes.

---

## API

El servidor expone routers REST en `/api/*`:

| Prefijo | Recurso |
|---------|---------|
| `/api/tickets` | Tickets de soporte (CRUD + mensajes) |
| `/api/tech-requests` | Requerimientos e incidencias |
| `/api/faqs` | Base de conocimiento |
| `/api/inventario` | Equipos, celulares, UPS (búsqueda server-side) |
| `/api/despachos` | Despachos y tracking |
| `/api/monitoring` | Estado de dispositivos |
| `/api/reuniones` | Reuniones y calendario |
| `/api/employees` | Empleados, autocomplete por cédula/nombre, importación Excel |
| `/api/metrics` | Métricas del dashboard y analítica por sede/técnico |
| `/api/erp` | ERP GeneXus: autocomplete empleados/sedes, perfil+historial por cédula, sync manual/automático, importación Excel de empleados y puntos |
| `/api/audit` | Logs de auditoría |
| `/api/auth` | Autenticación (sesiones con cookie) |
| `/api/users` | Gestión de usuarios y roles |

Endpoints especiales:
- `GET /api/health` — Health check (usado por Docker)
- `GET /api/events` — Server-Sent Events para actualizaciones en tiempo real
- `GET /api/whatsapp/status` — Estado de la conexión WhatsApp

---

## CI/CD

```
Push a develop/main/stage  (o PR)
      ↓
  CI — 3 jobs en paralelo (Node 24)
  ├── Unit Tests + Coverage
  │    └── 30 suites · umbrales: líneas ≥90%, ramas ≥75%, funciones ≥85%
  │    └── Publica resumen de cobertura como comentario en el PR
  ├── Smoke Tests (test-ci.mjs contra servidor real)
  │    ├── Health check
  │    ├── Login admin
  │    ├── Tickets API
  │    ├── Metrics API
  │    └── Flujo chatbot completo
  └── Security Audit
       ├── npm audit --audit-level=critical
       └── Trivy filesystem (HIGH + CRITICAL, solo vulnerabilidades con fix)
      ↓ (gate "API Tests" — falla si cualquier job falla)
  Release Please
  └── Crea PR con versión bump + CHANGELOG
        ↓ (merge manual)
  GitHub Release v1.x.x
        ↓
  Docker Build → ghcr.io/gerson05/it-support-system:v1.x.x
```

| Workflow | Trigger | Propósito |
|----------|---------|-----------|
| `ci.yml` | Push develop/main/stage, PR, manual | Unit tests + smoke tests + security audit |
| `release.yml` | Push main, manual | Release Please (versionado automático) |
| `docker-build.yml` | PR a stage/main | Valida que la imagen Docker construye |
| `deploy-stage.yml` | CI pasa en stage | Push imagen `:stage` a GHCR |
| `deploy-prod.yml` | CI pasa en main o release publicado | Push imagen `:latest :vX.Y.Z` a GHCR |

---

## Versionado

Usamos [Conventional Commits](https://www.conventionalcommits.org) y [release-please](https://github.com/googleapis/release-please) para versiones automáticas:

| Tipo de commit | Bump |
|----------------|------|
| `fix: ...` | Patch → `1.0.1` |
| `feat: ...` | Minor → `1.1.0` |
| `feat!:` o `BREAKING CHANGE:` | Major → `2.0.0` |
| `ci:`, `docs:`, `chore:` | Sin release |

---

## Estructura del Proyecto

```
it-tickets/
├── server.js              # Entrada principal, registro de routers
├── src/
│   ├── config/
│   │   └── database.js    # Inicialización SQLite + migraciones
│   ├── auth/              # Login, sesiones, RBAC
│   ├── whatsapp/          # Chatbot, flujos, cliente WA
│   │   └── flows/         # flujo-sede, flujo-soporte, etc.
│   ├── knowledge/         # FAQ search + hit tracking
│   ├── tech-requests/     # Requerimientos e incidencias
│   ├── inventario/        # Activos, QR, autoregistro, búsqueda server-side
│   ├── despacho/          # Despachos y tracking
│   ├── monitoring/        # Estado offline, comandos remotos
│   ├── employees/         # Provisionamiento, autocomplete, importación Excel
│   ├── erp/               # Cliente GeneXus, sync de empleados/sucursales/puntos
│   ├── metrics/           # Analítica por sede y técnico
│   ├── reuniones/         # Calendario y Meet
│   └── farmacias/         # Red de puntos FOMAG
├── public/                # Frontend estático (HTML + Vanilla JS)
├── database/              # Archivos SQLite
├── uploads/               # Archivos subidos (imágenes, actas)
├── exports/               # Excel/DOCX generados
├── docs/                  # Documentación
├── Dockerfile
├── docker-compose.yml
├── Caddyfile
└── test-ci.mjs            # Suite de pruebas de integración
```

---

## Desarrollo

```bash
# Modo watch (reinicia en cambios)
node --watch server.js

# Unit tests (Node test runner nativo)
npm test

# Unit tests + cobertura + umbrales (igual que CI)
npm run test:ci

# Smoke tests E2E contra servidor real
node test-ci.mjs

# Ver logs del chatbot
DISABLE_WHATSAPP=false node server.js
```

El frontend no tiene build step — edita los archivos en `/public` y recarga el navegador.

### Suite de Tests

30 archivos en `tests/` agrupados por módulo:

| Módulo | Archivos |
|--------|---------|
| `auth/` | middleware, rutas, servicio, usuarios |
| `tickets/` | modelo, rutas |
| `inventario/` | equipos, celulares, UPS |
| `whatsapp/` | chatbot utils, sedes, flujos (soporte, requerimiento, incidencia, OOS, sede) |
| `knowledge/` | FAQ data, rutas, servicio |
| `despacho/` | rutas |
| `employees/` | rutas |
| `tech-requests/` | rutas |
| `metrics/` | rutas |
| `reuniones/` | rutas |
| `sedes/` | rutas |
| `tracking/` | rutas |
| `utils/` | async-handler, get-base-url |

Umbrales CI: **líneas ≥ 90% · ramas ≥ 75% · funciones ≥ 85%**

---

## Licencia

Uso interno. Todos los derechos reservados.
