# Variables de Entorno

Referencia completa de todas las variables de entorno del sistema.

Copia `.env.example` a `.env` y configura los valores antes de iniciar.

---

## Servidor

| Variable | Default | Descripción |
|----------|---------|-------------|
| `PORT` | `3000` | Puerto HTTP del servidor |
| `NODE_ENV` | `development` | `production` \| `development` \| `test` |
| `DATABASE_PATH` | `database/tickets.db` | Ruta al archivo SQLite |

## Autenticación

| Variable | Requerido | Descripción |
|----------|-----------|-------------|
| `INIT_ADMIN_PASS` | Sí | Contraseña del usuario `admin` creado al iniciar. Si ya existe el usuario, se ignora. |

## WhatsApp

| Variable | Requerido | Descripción |
|----------|-----------|-------------|
| `IT_WHATSAPP_NUMBER` | Sí | Número WhatsApp del área IT en formato internacional sin `+` (ej. `573001234567`) |
| `IT_PHONE` | No | Alias de `IT_WHATSAPP_NUMBER` (deprecado) |
| `WHATSAPP_VERIFY_TOKEN` | Sí | Token para verificar el webhook entrante de WhatsApp |
| `DISABLE_WHATSAPP` | `false` | `true` desactiva la conexión automática al arrancar |
| `DISABLE_INACTIVITY_MONITOR` | `false` | `true` desactiva el cierre de sesiones inactivas |

## IA / LLM (opcional)

El bot puede sugerir soluciones automáticamente antes de crear un ticket.

| Variable | Default | Descripción |
|----------|---------|-------------|
| `LLM_PROVIDER` | `none` | `claude` \| `openai` \| `gemini` \| `ollama` \| `none` |
| `LLM_API_KEY` | — | API key del proveedor (no se usa con `ollama`) |
| `LLM_MODEL` | — | Modelo específico (ej. `gpt-4o`, `claude-sonnet-4-6`) |
| `LLM_BASE_URL` | `http://localhost:11434` | Endpoint base para Ollama |
| `GEMINI_API_KEY` | — | API key de Google Gemini (alternativa a `LLM_PROVIDER=gemini`) |

## Google APIs (opcional)

| Variable | Módulo | Descripción |
|----------|--------|-------------|
| `GOOGLE_SHEETS_CSV_URL` | Farmacias | URL CSV público de la hoja de Farmacias FOMAG |
| `GOOGLE_APPS_SCRIPT_URL` | Farmacias | Endpoint Apps Script para escritura |
| `REGISTROS_SCRIPT_URL` | Registros IT | Apps Script de registros IT |
| `REGISTROS_SHEET_URL` | Registros IT | URL de hoja de registros IT |
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | Reuniones | Ruta al JSON de cuenta de servicio para Calendar |
| `GOOGLE_SERVICE_ACCOUNT_KEY_JSON` | Reuniones | Alternativa: contenido JSON inline (base64 o raw) |

## Módulo Requerimientos

| Variable | Descripción |
|----------|-------------|
| `REQ_GMAIL_USER` | Correo remitente para notificaciones de requerimientos |
| `REQ_GMAIL_APP_PASSWORD` | Contraseña de aplicación Gmail (no la contraseña normal) |
| `REQ_ADMIN_SECRET` | Secreto aleatorio para firma de tokens (mínimo 32 caracteres) |
| `REQ_ADMIN_USER` | Usuario administrador del módulo de requerimientos |
| `REQ_ADMIN_PASS` | Contraseña del administrador de requerimientos |

## HTTPS y Red

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DOMAIN` | — | Dominio público (ej. `soporte.empresa.com`). Usado por Caddy para obtener certificado TLS. |
| `ENABLE_HTTPS` | `false` | Activa HTTPS con certificado autofirmado (solo útil en Windows local) |
| `HTTPS_PORT` | `3443` | Puerto HTTPS en modo autofirmado |

## Workers en Background

| Variable | Default | Descripción |
|----------|---------|-------------|
| `DISABLE_OFFLINE_CHECKER` | `false` | Desactiva el monitoreo periódico de dispositivos offline |
| `DISABLE_TUNNEL` | `true` | Desactiva el túnel Cloudflare. Activar (`false`) si se necesita acceso móvil a cámara vía HTTPS en red local |

---

## CI / Testing

Estas variables son solo para el entorno de CI y no deben usarse en producción:

| Variable | Valor CI | Descripción |
|----------|----------|-------------|
| `INIT_ADMIN_PASS` | `ci-admin-password-for-tests` | Contraseña determinista para tests |
| `LLM_PROVIDER` | `none` | Desactiva IA en tests |
| `DISABLE_WHATSAPP` | `true` | Sin conexión real de WhatsApp |
| `DISABLE_INACTIVITY_MONITOR` | `true` | Sin timers de sesión |
| `DISABLE_OFFLINE_CHECKER` | `true` | Sin monitoreo de red |
| `DISABLE_TUNNEL` | `true` | Sin túnel Cloudflare |

---

## Ejemplo `.env` mínimo (desarrollo local)

```env
PORT=3001
NODE_ENV=development
DATABASE_PATH=database/tickets.db
INIT_ADMIN_PASS=cambia-esta-clave

IT_WHATSAPP_NUMBER=573001234567
WHATSAPP_VERIFY_TOKEN=mi-token-secreto

LLM_PROVIDER=none
DISABLE_WHATSAPP=true
DISABLE_TUNNEL=true
```
