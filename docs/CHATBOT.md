# Chatbot de WhatsApp

Documentación del flujo conversacional y configuración del chatbot.

---

## Flujos Disponibles

### Menú Principal

```
Usuario: "hola" (o "menu", "inicio", "reiniciar")

Bot: ¿En qué te puedo ayudar hoy?
  1️⃣ Tengo un problema técnico
  2️⃣ Solicitar equipo o material
  3️⃣ Reportar equipo con falla
```

---

### Flujo 1 — Problema Técnico (Soporte)

```
[1] Problema técnico
    ↓
Ciudad (texto libre, ej: "Cali")
    ↓ si múltiples coincidencias
  Selección numérica de ciudad
    ↓
  Punto de atención (selección numérica)
    ↓
  Área:
    SEDE PRINCIPAL → 7 áreas completas
    Otra sede      → Administrativo / Farmacia
    ↓
  Nombre completo
    ↓
  Descripción del problema
    ↓ (con IA configurada)
  Solución sugerida
    ├── "1" Sí se resolvió → Fin
    ├── "2" No, sigue el problema → Ticket creado
    └── "3" Problema diferente → Pide nueva descripción
    ↓ (sin IA)
  Ticket creado directamente
```

**Ticket creado con:** número de ticket, área, sede, nombre del solicitante, prioridad detectada automáticamente.

---

### Flujo 2 — Requerimiento de Equipos

```
[2] Requerimiento
    ↓
Ciudad → Punto de atención
    ↓
Nombre completo
    ↓
Número de cédula
    ↓
Cargo dentro de la empresa
    ↓
Descripción del equipo solicitado (con cantidad)
    ↓
Solicitud registrada (request_number generado)
```

---

### Flujo 3 — Equipo con Falla (Incidencia)

```
[3] Falla de equipo
    ↓
Ciudad → Punto de atención
    ↓
Nombre completo
    ↓
Descripción de la falla
    ↓
Incidencia registrada
```

---

## Comportamientos Especiales

### Ticket Activo

Si el usuario ya tiene un ticket abierto o en progreso, **cualquier mensaje** (sin entrar al flujo) se añade como comentario al ticket activo:

```
Usuario: "el problema sigue igual, ya reinicié el computador"
Bot: ✅ Mensaje agregado al ticket IT-0023. El equipo de IT revisará pronto.
```

### Consulta de Estado

```
Usuario: "estado" / "mis tickets" / "consultar"
Bot: 📋 Tus últimos tickets:
     🎟️ IT-0023 - En progreso - Cartera · 09/07/2026
     🎟️ IT-0021 - Cerrado - Farmacia · 01/07/2026
```

### Horario de Atención

Fuera de horario hábil (lun–vie 8am–6pm), el bot responde de forma diferente según el momento:

- **Cierre inminente (después de las 5:30pm):** Avisa que está cerrando y registra el nombre para primer turno del día siguiente.
- **Fuera de horario:** Registra nombre y crea caso para el siguiente día hábil.

---

## Prioridad Automática

El sistema detecta prioridad basado en palabras clave en la descripción:

| Prioridad | Palabras clave ejemplo |
|-----------|----------------------|
| **Alta** | "no funciona", "caído", "urgente", "bloqueado", "sin acceso" |
| **Media** | Default si no hay palabras clave |
| **Baja** | "lento", "ocasional", "a veces" |

---

## Configuración de Mensajes

Los mensajes del bot son configurables desde el panel:

**Panel → Configuración → Mensajes WhatsApp**

Cada mensaje tiene una clave (ej. `greeting`, `error_fallback`, `ticket_added`) y puede editarse sin reiniciar el servidor.

Mensajes configurables:
- `greeting` — Saludo inicial con menú
- `oos_closed` — Fuera de horario (cerrado)
- `oos_closing` — Próximo a cerrar
- `ticket_added` — Confirmación al agregar mensaje a ticket activo
- `estado_no_tickets` — Sin tickets para mostrar
- `error_fallback` — Error técnico genérico
- `image_out_of_flow` — Imagen enviada fuera del flujo de descripción

---

## Simulador (Testing)

Para probar el chatbot sin WhatsApp real:

```bash
curl -X POST http://localhost:3000/api/simulate \
  -H "Content-Type: application/json" \
  -d '{"phone": "573001234567", "message": "hola"}'
```

Respuesta:
```json
{
  "ok": true,
  "response": "🖥️ *¡Hola! Soy el asistente de IT* 🤖\n\n¿En qué te puedo ayudar hoy?..."
}
```

La sesión del simulador persiste entre llamadas usando el mismo `phone`.

---

## Gestión de Sedes

Las ciudades y puntos de atención se administran desde:

**Panel → Configuración → Sedes**

O via API:
```bash
# Listar sedes activas
GET /api/sedes

# Crear sede
POST /api/sedes
{ "ciudad": "MANIZALES", "nombre_punto": "MI FARMACIA - MANIZALES" }

# Activar / desactivar
PATCH /api/sedes/:id
{ "activo": false }
```

Si una ciudad tiene exactamente **1 punto**, el bot lo selecciona automáticamente sin preguntar. Si tiene **múltiples puntos**, muestra lista numerada.

---

## Integración con IA

Cuando `LLM_PROVIDER` está configurado, el bot busca solución automática antes de crear ticket:

1. Busca en FAQs locales (score ≥ 5 para mostrar)
2. Si no hay FAQ relevante → consulta a LLM con contexto del área
3. Presenta solución y pregunta si se resolvió
4. Solo si el usuario dice que no se resolvió → crea el ticket

Esto reduce tickets de problemas con solución conocida.
