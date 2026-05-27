# 🖥️ Sistema de Tickets IT con WhatsApp y Panel de Control

Este sistema ha sido diseñado con una arquitectura **híbrida e inteligente**. Puede funcionar de forma 100% autónoma en cualquier navegador web (Modo Demo Local) y está completamente preparado para conectarse a un servidor centralizado e integrarse con la **API de WhatsApp Business de Meta** (Modo Servidor Real).

---

## 🚀 Opción 1: Probar Instantáneamente (Modo Demo Local)

Si no tienes Node.js instalado o deseas probar la aplicación de inmediato sin configuraciones:

1. Navega a la carpeta del proyecto:
   `C:\Users\equipo sitemas 1\.gemini\antigravity\scratch\it-tickets\public\`
2. Haz **doble clic** en el archivo **`index.html`** para abrirlo en cualquier navegador (Chrome, Edge, Firefox, etc.).
3. ¡Listo! Verás el panel con un indicador LED naranja de `(Demo Local)` en la esquina inferior izquierda.

### 🧪 ¿Cómo probar el flujo completo?
1. Ve a la pestaña **📱 Simulador WhatsApp** en el menú de la izquierda.
2. Sigue las instrucciones del panel derecho: escribe `hola` en el chat del teléfono para iniciar el bot.
3. Interactúa con el bot seleccionando tu área y un problema común.
4. Indica que la solución sugerida **no resolvió tu problema** (Opción `2`) o selecciona **crear ticket** (Opción `0`). Escribe la descripción de tu caso.
5. El bot creará un Ticket y te dará un número de caso (ej: `TK-20260525-001`).
6. Ahora navega a las pestañas **📊 Dashboard** o **📋 Tickets** en el panel lateral de IT. ¡Verás que el ticket que acabas de crear en WhatsApp aparece mágicamente en tiempo real con estadísticas y métricas actualizadas!
7. Haz clic sobre el ticket en el listado para abrir su detalle.
8. En la sección de respuestas, escribe un mensaje de soporte y haz clic en **Enviar respuesta**.
9. Regresa a la pestaña **📱 Simulador WhatsApp**. ¡La respuesta que escribió el agente de IT en su consola ha llegado de inmediato al chat de WhatsApp del empleado!

---

## 🌐 Opción 2: Modo de Producción (Servidor Real + WhatsApp de Meta)

Cuando decidan crear su cuenta de **Meta Business** y conectar su número de WhatsApp corporativo de forma real, sigan estos pasos:

### 1. Requisitos Previos
- Instalar **Node.js** (versión 18 o superior) descargándolo desde [nodejs.org](https://nodejs.org/).
- Una cuenta en [Meta for Developers](https://developers.facebook.com/) y una **WhatsApp Business App** configurada con su número.

### 2. Configuración de Entorno
Copia el archivo `.env.example` como `.env` y rellena tus tokens oficiales de Meta:
```env
PORT=3000
WHATSAPP_TOKEN=tu_token_de_acceso_temporal_o_permanente_de_meta
WHATSAPP_PHONE_ID=tu_identificador_de_numero_de_telefono_de_meta
WHATSAPP_VERIFY_TOKEN=mi_token_secreto_123
```

### 3. Levantar el Servidor
Abre una consola o terminal en la ruta del proyecto y ejecuta:
```bash
# Instalar las dependencias de producción
npm install

# Iniciar el servidor web y webhook
npm start
```
El servidor levantará en `http://localhost:3000`.

### 4. Configurar el Webhook en Meta
1. En el panel de Meta developers, ve a la configuración de WhatsApp Webhooks.
2. En la URL de callback ingresa la URL de tu servidor público (puedes usar Ngrok para desarrollo local, ej: `https://xxxx.ngrok-free.app/webhook`).
3. En el Token de verificación ingresa el valor de tu `.env` (ej: `mi_token_secreto_123`).
4. Suscríbete al campo `messages` en la lista de eventos.

¡A partir de ese momento, cada mensaje enviado por los empleados al WhatsApp real de la empresa será atendido automáticamente por el chatbot y los tickets se guardarán en la base de datos centralizada SQLite!

---

## 🛠️ Arquitectura del Sistema Construido

El proyecto está organizado de manera modular bajo las mejores prácticas de ingeniería:

```
it-tickets/
├── database/
│   └── schema.sql            # Estructura de base de datos relacional SQLite
├── src/
│   ├── config/
│   │   └── database.js       # Conector y cargador del esquema SQLite
│   ├── knowledge/
│   │   └── faq-data.js       # Base de conocimiento (FAQs por área en español)
│   ├── tickets/
│   │   ├── ticket-model.js   # Operaciones CRUD síncronas de base de datos
│   │   └── ticket-routes.js  # API RESTful de gestión de tickets e IT agents
│   ├── metrics/
│   │   └── metrics-routes.js # API para métricas en tiempo real del dashboard
│   └── whatsapp/
│       ├── chatbot.js        # Motor conversacional y máquina de estados
│       ├── messenger.js      # Integrador de Meta Cloud API con simulación activa
│       └── webhook.js        # Webhook HTTP para validación e incoming events de Meta
├── public/                   # Frontend SPA Premium (HTML, CSS y JS Vanilla)
│   ├── index.html            # Contenedor gráfico principal
│   ├── css/
│   │   └── styles.css        # Hoja de estilos con Glassmorphism y temas oscuros
│   └── js/
│       ├── app.js            # Router por hash e inicializador SPA
│       ├── data-service.js   # HÍBRIDO: Selector dinámico Online API vs LocalStorage Demo
│       ├── faq-data.js       # FAQ del lado del cliente para modo autónomo
│       ├── components.js     # Componentes visuales y sistema de notificaciones Toasts
│       ├── dashboard.js      # Vista Dashboard con métricas dinámicas
│       ├── ticket-list.js    # Vista Listado de tickets con filtros y paginado
│       ├── ticket-detail.js  # Vista Detalle, timeline del chat y notas internas de IT
│       └── simulator.js      # Interfaz interactiva de simulación móvil de WhatsApp
├── server.js                 # Servidor de producción Express principal
└── package.json              # Dependencias declaradas (express, better-sqlite3, dotenv)
```
