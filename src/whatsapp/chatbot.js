import { getAISolution, getAISolutionFromImage, generateTicketTitle } from './gemini-service.js';
import { appEvents }         from '../events/broadcaster.js';
import { createTechRequest } from '../tech-requests/tech-request-model.js';
import { matchCiudad, getPuntosCiudad, displaySede } from './sedes.js';
import { searchFaqsAll }     from '../knowledge/faq-service.js';
import { logAudit }          from '../audit/audit-logger.js';

/* ─────────────────────────────────────────────────────────────
   HORARIO DE ATENCIÓN (Colombia, UTC-5, sin DST)
   Lunes–Viernes  7:00 – 16:40
   Pre-cierre     16:20 – 16:40  (aviso de agendamiento)
   ───────────────────────────────────────────────────────────── */

/** Hora actual en Colombia (UTC-5) */
function _coNow() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utcMs - 5 * 3_600_000);
}

/**
 * Devuelve el estado del horario:
 *   'open'    — dentro del horario normal
 *   'closing' — últimos 20 min antes del cierre (16:20–16:40)
 *   'closed'  — fuera del horario (antes de las 7, después de las 16:40, fines de semana)
 */
function getBusinessStatus() {
  const co  = _coNow();
  const day = co.getDay(); // 0=Dom, 6=Sáb
  if (day === 0 || day === 6) return 'closed';

  const min = co.getHours() * 60 + co.getMinutes();
  if (min < 7 * 60)          return 'closed';   // antes de 7:00
  if (min >= 16 * 60 + 40)   return 'closed';   // después de 16:40
  if (min >= 16 * 60 + 20)   return 'closing';  // 16:20–16:40
  return 'open';
}

/** Próximo día hábil en español */
function _nextBusinessDay() {
  const co   = _coNow();
  const next = new Date(co);
  do { next.setDate(next.getDate() + 1); }
  while (next.getDay() === 0 || next.getDay() === 6);
  const DAYS   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${DAYS[next.getDay()]} ${next.getDate()} de ${MONTHS[next.getMonth()]}`;
}

/* ─────────────────────────────────────────────────────────────
   Rate limiting: máximo 20 mensajes por minuto por número
   ───────────────────────────────────────────────────────────── */
const _rateMap = new Map();
function _checkRateLimit(phone) {
  const now = Date.now();
  let e = _rateMap.get(phone);
  if (!e || now > e.resetAt) e = { count: 0, resetAt: now + 60_000 };
  e.count++;
  _rateMap.set(phone, e);
  return e.count <= 20;
}

/* ─────────────────────────────────────────────────────────────
   Detección automática de prioridad por palabras clave
   ───────────────────────────────────────────────────────────── */
function _detectPriority(text) {
  const t = (text || '').toLowerCase();
  if (/toda.{0,15}(sede|oficina)|sin internet.{0,10}todos|sistema.{0,10}cai[dó]|produccion.{0,10}parad|no podemos trabajar|perdida.{0,10}datos|todos los equipos|todos.{0,10}afectad/.test(t)) return 'critica';
  if (/urgente|bloqueado completamente|no funciona nada|desde ayer|toda la mañana|no puedo entrar|borro|eliminó/.test(t)) return 'alta';
  return 'media';
}

/* ══════════════════════════════════════════════════════════════
   MAPEOS DE ÁREA
   ══════════════════════════════════════════════════════════════ */
// Menú COMPLETO — solo Sede Principal de Cali
const AREA_MAP_FULL = {
  '1': 'cartera',
  '2': 'compra',
  '3': 'gestion_humana',
  '4': 'pqrs',
  '5': 'contabilidad',
  '6': 'farmacia',
  '7': 'cuentas_medicas',
};

// Menú SIMPLIFICADO — todos los demás puntos
const AREA_MAP_SIMPLE = {
  '1': 'administrativo',
  '2': 'farmacia',
};

// Mantener compatibilidad con código existente
const AREA_MAP = AREA_MAP_FULL;

const AREA_NAMES = {
  cartera:         'Cartera',
  compra:          'Compra',
  gestion_humana:  'Gestión Humana',
  pqrs:            'PQRS',
  contabilidad:    'Contabilidad',
  farmacia:        'Farmacia',
  cuentas_medicas: 'Cuentas Médicas',
  administrativo:  'Administrativo',
};

/** Determina si una sede tiene el menú de áreas completo */
function isSedeCompleta(sede) {
  return (sede || '').toUpperCase().includes('SEDE PRINCIPAL');
}

const STATUS_LABELS_WA = {
  abierto:     '🔵 Abierto',
  en_progreso: '🟡 En progreso',
  en_espera:   '🟠 En espera',
  resuelto:    '✅ Resuelto',
  cerrado:     '⬜ Cerrado',
};

const AREA_EXAMPLES = {
  cartera:
    '• _"El software no abre o da error"_\n' +
    '• _"No puedo generar reportes de cobros"_\n' +
    '• _"Olvidé mi contraseña del sistema"_',
  compra:
    '• _"Error 500 al guardar una orden de compra"_\n' +
    '• _"No puedo entrar al portal de proveedores"_\n' +
    '• _"El flujo de aprobación está bloqueado"_',
  gestion_humana:
    '• _"Error al liquidar o procesar la nómina"_\n' +
    '• _"El biométrico no registra mi huella"_\n' +
    '• _"No puedo subir archivos al portal de empleados"_',
  pqrs:
    '• _"El sistema no guarda los nuevos registros"_\n' +
    '• _"La asignación automática de casos falla"_',
  contabilidad:
    '• _"Siigo está muy lento o se congela"_\n' +
    '• _"Error al firmar la factura electrónica"_\n' +
    '• _"Los balances no cuadran en el módulo fiscal"_',
  farmacia:
    '• _"El lector de barras no funciona o escribe caracteres raros"_\n' +
    '• _"Las etiquetas Zebra no imprimen"_\n' +
    '• _"Error de stock al despachar un medicamento"_\n' +
    '• _"La impresora Epson L1536 / L400 / L364 se quedó sin tinta"_\n' +
    '• _"Necesito rellenar la tinta de la impresora Epson"_',
  cuentas_medicas:
    '• _"Error al generar los archivos RIPS"_\n' +
    '• _"La plataforma de la EPS no reconoce la firma digital"_\n' +
    '• _"Error de conexión en el software de facturación"_',
  administrativo:
    '• _"No puedo entrar a algún sistema o aplicativo"_\n' +
    '• _"Problemas con el equipo, impresora o red"_\n' +
    '• _"Error en un programa o software de oficina"_',
};

/* ══════════════════════════════════════════════════════════════
   CHATBOT PRINCIPAL
   ══════════════════════════════════════════════════════════════ */
export class Chatbot {

  /**
   * @param {string} phone   - número de teléfono (para display y DB)
   * @param {string} text    - texto del mensaje (o '__IMAGE__' si es imagen)
   * @param {object} db      - instancia de DatabaseSync
   * @param {object|null} media  - { imageBase64, mimetype } para imágenes
   * @param {string|null} chatId - JID original de WhatsApp (msg.from) para envíos directos
   */
  async processMessage(phone, text, db, media = null, chatId = null) {

    // ── Rate limiting ──
    if (!_checkRateLimit(phone)) {
      console.warn(`[Bot] Rate limit alcanzado para ${phone}`);
      return null; // silencio — evita bucle de mensajes de error
    }

    // ── Si es imagen pero el bot no está en awaiting_description, orientar ──
    if (text === '__IMAGE__') {
      const sess = db.prepare('SELECT current_step FROM conversations WHERE phone=?').get(phone);
      if (!sess || sess.current_step !== 'awaiting_description') {
        return `📸 _Imagen recibida._ Para que analicemos el error de tu captura, escribe *Hola*, selecciona *Soporte técnico* y cuando llegues a describir el problema envía la imagen. 📲`;
      }
    }

    const cleanText = text.trim();
    const lower     = cleanText.toLowerCase();
    const isCommand = ['hola', 'menu', 'inicio', 'reiniciar'].includes(lower);

    /* ── Obtener / crear sesión ── */
    let session = db.prepare('SELECT * FROM conversations WHERE phone = ?').get(phone);
    if (!session) {
      db.prepare('INSERT INTO conversations (phone, current_step) VALUES (?,?)').run(phone, 'idle');
      session = { phone, current_step: 'idle', area: null, context: '{}' };
    }
    // Persistir chatId (JID real de WhatsApp) en el contexto para usarlo al crear tickets
    if (chatId && chatId !== phone) {
      try {
        const ctxObj = JSON.parse(session.context || '{}');
        if (!ctxObj._chatId) {
          ctxObj._chatId = chatId;
          db.prepare('UPDATE conversations SET context=? WHERE phone=?').run(JSON.stringify(ctxObj), phone);
          session = { ...session, context: JSON.stringify(ctxObj) };
        }
      } catch {}
    }

    let step     = session.current_step;
    let response = '';
    const inBotFlow = step !== 'idle';

    /* ── Comando rápido: consultar estado de tickets ── */
    if (!isCommand && !inBotFlow && /^(estado|mis tickets?|consultar|ver ticket|mi caso)/i.test(lower)) {
      const tickets = db.prepare(`
        SELECT ticket_number, status, area, created_at
        FROM tickets WHERE phone=? ORDER BY id DESC LIMIT 3
      `).all(phone);

      if (tickets.length === 0) {
        return `📭 No tienes tickets registrados aún.\n\nEscribe *Hola* para iniciar una nueva consulta de soporte.`;
      }

      const lines = tickets.map(t =>
        `🎟️ *${t.ticket_number}*\n` +
        `   ${STATUS_LABELS_WA[t.status] || t.status}\n` +
        `   ${AREA_NAMES[t.area] || t.area} · ${new Date(t.created_at).toLocaleDateString('es-CO')}`
      ).join('\n\n');

      return `📋 *Tus últimos tickets:*\n\n${lines}\n\n_Para agregar información escríbenos directamente. Escribe *Hola* para una nueva consulta._`;
    }

    /* ── Ticket activo: agregar mensaje sin entrar al flujo ── */
    if (!isCommand && !inBotFlow) {
      const activeTicket = db.prepare(`
        SELECT * FROM tickets
        WHERE phone = ? AND status IN ('abierto','en_progreso','en_espera')
        ORDER BY id DESC LIMIT 1
      `).get(phone);

      if (activeTicket) {
        if (text === '__IMAGE__' && media?.imageBase64) {
          const attachment = JSON.stringify({ type: 'image', mimetype: media.mimetype || 'image/jpeg', base64: media.imageBase64 });
          db.prepare(`INSERT INTO messages (ticket_id, sender_type, content, attachment) VALUES (?, 'user', '__IMAGE__', ?)`)
            .run(activeTicket.id, attachment);
        } else {
          db.prepare(`INSERT INTO messages (ticket_id, sender_type, content) VALUES (?, 'user', ?)`)
            .run(activeTicket.id, text);
        }
        db.prepare(`UPDATE tickets SET updated_at = datetime('now','localtime') WHERE id = ?`)
          .run(activeTicket.id);
        appEvents.emit('ticket:message', { ticketId: activeTicket.id });
        return `📥 *Mensaje agregado al Ticket ${activeTicket.ticket_number}*\n\nTu mensaje fue registrado. El equipo de IT te responderá pronto.\n\n_Para nueva consulta escribe *menu*._`;
      }
    }

    try {

      /* ══════════════════════════════════════════════════════
         MENÚ INICIAL — con verificación de horario
         ══════════════════════════════════════════════════════ */
      if (step === 'idle' || isCommand) {
        const bizStatus = getBusinessStatus();

        if (bizStatus !== 'open') {
          // Fuera de horario o pre-cierre → redirigir a flujo OOS
          const isClosing = bizStatus === 'closing';
          this._setStep(db, phone, 'oos_name', null, '{}');
          response = isClosing
            ? `⚠️ *Estamos a punto de cerrar*\n\n` +
              `Nuestro horario de atención termina a las *4:40 PM*.\n` +
              `Tu caso quedará agendado para el *${_nextBusinessDay()}* a las 7:00 AM.\n\n` +
              `¿Cuál es tu nombre completo?`
            : `⏰ *Fuera de horario de atención*\n\n` +
              `Nuestro equipo de IT atiende de *lunes a viernes de 7:00 AM a 4:40 PM*.\n\n` +
              `Tu caso quedará registrado y será atendido el *${_nextBusinessDay()}* a primera hora.\n\n` +
              `¿Cuál es tu nombre completo?`;
        } else {
          // Horario normal
          this._setStep(db, phone, 'select_type', null, '{}');
        response =
          `🖥️ *¡Hola! Soy el asistente de IT* 🤖\n\n` +
          `¿En qué te puedo ayudar hoy?\n\n` +
          `*1️⃣* 🔧 Tengo un *problema técnico*\n` +
          `*2️⃣* 📋 Necesito *equipos o materiales* (requerimiento)\n` +
          `*3️⃣* ⚠️ Voy a *enviar un equipo con falla* (incidencia)\n\n` +
          `_Responde con el número de tu opción._\n\n` +
          `💡 Escribe *estado* en cualquier momento para consultar tus tickets.`;
        } // fin else horario normal

      /* ══════════════════════════════════════════════════════
         FLUJO FUERA DE HORARIO — nombre del solicitante
         ══════════════════════════════════════════════════════ */
      } else if (step === 'oos_name') {
        const ctx = this._ctx(session);
        ctx.name = text.trim();
        this._setStep(db, phone, 'oos_desc', null, JSON.stringify(ctx));
        response =
          `✅ Gracias, *${ctx.name}*.\n\n` +
          `📝 Descríbeme brevemente el problema o lo que necesitas.\n` +
          `_(Lo atenderemos el *${_nextBusinessDay()}* a partir de las 7:00 AM)_`;

      /* ══════════════════════════════════════════════════════
         FLUJO FUERA DE HORARIO — descripción y cierre de ticket
         ══════════════════════════════════════════════════════ */
      } else if (step === 'oos_desc') {
        const ctx      = this._ctx(session);
        const title    = await generateTicketTitle('general', text);
        const dateStr  = new Date().toISOString().slice(0,10).replace(/-/g,'');
        const last     = db.prepare(`SELECT ticket_number FROM tickets WHERE ticket_number LIKE ? ORDER BY id DESC LIMIT 1`).get(`TK-${dateStr}-%`);
        const nextNum  = last ? parseInt(last.ticket_number.split('-')[2]) + 1 : 1;
        const ticketNumber = `TK-${dateStr}-${String(nextNum).padStart(3,'0')}`;

        db.prepare(`
          INSERT INTO tickets (ticket_number, phone, requester_name, area, description, title, status, priority)
          VALUES (?, ?, ?, 'general', ?, ?, 'siguiente_dia', 'media')
        `).run(ticketNumber, phone, ctx.name || 'Sin nombre', text, title);

        const { id: ticketId } = db.prepare(`SELECT last_insert_rowid() as id`).get();
        db.prepare(`INSERT INTO messages (ticket_id, sender_type, content) VALUES (?, 'user', ?)`).run(ticketId, text);
        appEvents.emit('ticket:created', { id: ticketId, ticket_number: ticketNumber, area: 'general', phone });

        this._setStep(db, phone, 'idle', null, '{}');
        response =
          `✅ *Caso agendado para el ${_nextBusinessDay()}*\n\n` +
          `🎟️ Número de caso: *${ticketNumber}*\n` +
          `👤 Nombre: ${ctx.name}\n\n` +
          `Nuestro equipo lo atenderá a primera hora. ¡Gracias por tu paciencia! 🙏`;

      /* ══════════════════════════════════════════════════════
         SELECCIÓN DE TIPO
         ══════════════════════════════════════════════════════ */
      } else if (step === 'select_type') {
        const typeMap = { '1': 'soporte', '2': 'requerimiento', '3': 'incidencia' };
        if (typeMap[cleanText]) {
          this._setStep(db, phone, 'ask_ciudad', null, JSON.stringify({ flowType: cleanText }));
          response =
            `📍 *¿Desde qué ciudad nos escribes?*\n\n` +
            `Escribe el nombre de tu ciudad.\n` +
            `_Ej: Cali, Manizales, Pereira, Popayán, Dosquebradas_`;
        } else {
          response =
            `⚠️ Opción no válida. Responde con *1*, *2* o *3*:\n\n` +
            `*1️⃣* 🔧 Problema técnico\n` +
            `*2️⃣* 📋 Requerimiento de equipos\n` +
            `*3️⃣* ⚠️ Equipo con falla`;
        }

      /* ══════════════════════════════════════════════════════
         PASO 1: PREGUNTA DE CIUDAD
         ══════════════════════════════════════════════════════ */
      } else if (step === 'ask_ciudad') {
        const ctx      = this._ctx(session);
        const ciudades = matchCiudad(text, db);

        if (ciudades.length === 0) {
          response =
            `❓ No encontré ninguna ciudad con "*${text}*".\n\n` +
            `Escribe el nombre de tu ciudad.\n` +
            `_Ej: Cali, Manizales, Pereira, Popayán, Pasto, Buenaventura_`;

        } else if (ciudades.length > 1) {
          // Varias ciudades coinciden → pedir que aclare
          ctx.ciudad_candidates = ciudades;
          this._setStep(db, phone, 'ask_ciudad_confirm', null, JSON.stringify(ctx));
          const lista = ciudades.map((c, i) => `*${i + 1}️⃣* ${c}`).join('\n');
          response = `⚠️ Encontré varias ciudades. ¿Cuál es la tuya?\n\n${lista}\n\n_Responde con el número._`;

        } else {
          // Ciudad única encontrada
          const ciudad = ciudades[0];
          const puntos = getPuntosCiudad(ciudad, db);

          if (puntos.length === 1) {
            // Un solo punto → seleccionar automáticamente
            ctx.sede   = puntos[0];
            ctx.ciudad = ciudad;
            const { step: ns, msg } = this._routeAfterSede(ctx.flowType, displaySede(ctx.sede), ctx.sede);
            this._setStep(db, phone, ns, null, JSON.stringify(ctx));
            response = `✅ Ciudad: *${ciudad}*\n\n` + msg;
          } else {
            // Varios puntos → mostrar lista numerada
            ctx.ciudad         = ciudad;
            ctx.punto_options  = puntos;
            this._setStep(db, phone, 'ask_punto', null, JSON.stringify(ctx));
            const lista = puntos.map((p, i) => `*${i + 1}️⃣* ${displaySede(p)}`).join('\n');
            response =
              `✅ Ciudad: *${ciudad}*\n\n` +
              `📍 *¿Cuál es tu punto de atención?*\n\n${lista}\n\n` +
              `_Responde con el número de tu punto (ej. 1)_`;
          }
        }

      } else if (step === 'ask_ciudad_confirm') {
        const ctx   = this._ctx(session);
        const idx   = parseInt(cleanText) - 1;
        const cands = ctx.ciudad_candidates || [];

        if (idx >= 0 && idx < cands.length) {
          const ciudad = cands[idx];
          const puntos = getPuntosCiudad(ciudad, db);
          delete ctx.ciudad_candidates;
          ctx.ciudad = ciudad;

          if (puntos.length === 1) {
            ctx.sede = puntos[0];
            const { step: ns, msg } = this._routeAfterSede(ctx.flowType, displaySede(ctx.sede), ctx.sede);
            this._setStep(db, phone, ns, null, JSON.stringify(ctx));
            response = `✅ Ciudad: *${ciudad}*\n\n` + msg;
          } else {
            ctx.punto_options = puntos;
            this._setStep(db, phone, 'ask_punto', null, JSON.stringify(ctx));
            const lista = puntos.map((p, i) => `*${i + 1}️⃣* ${displaySede(p)}`).join('\n');
            response =
              `✅ Ciudad: *${ciudad}*\n\n` +
              `📍 *¿Cuál es tu punto de atención?*\n\n${lista}\n\n` +
              `_Responde con el número de tu punto (ej. 1)_`;
          }
        } else {
          const lista = cands.map((c, i) => `*${i + 1}️⃣* ${c}`).join('\n');
          response = `⚠️ Opción no válida. Responde con un número:\n\n${lista}`;
        }

      /* ══════════════════════════════════════════════════════
         PASO 2: SELECCIÓN DE PUNTO (ciudades con varios puntos)
         ══════════════════════════════════════════════════════ */
      } else if (step === 'ask_punto') {
        const ctx    = this._ctx(session);
        const idx    = parseInt(cleanText) - 1;
        const puntos = ctx.punto_options || [];

        if (idx >= 0 && idx < puntos.length) {
          ctx.sede = puntos[idx];
          delete ctx.punto_options;
          const { step: ns, msg } = this._routeAfterSede(ctx.flowType, displaySede(ctx.sede), ctx.sede);
          this._setStep(db, phone, ns, null, JSON.stringify(ctx));
          response = `✅ Punto: *${displaySede(ctx.sede)}*\n\n` + msg;
        } else {
          const lista = puntos.map((p, i) => `*${i + 1}️⃣* ${displaySede(p)}`).join('\n');
          response = `⚠️ Opción no válida. Responde con un número:\n\n${lista}`;
        }

      /* ══════════════════════════════════════════════════════
         FLUJO PROBLEMA TÉCNICO — A1b: Menú simplificado (2 opciones)
         ══════════════════════════════════════════════════════ */
      } else if (step === 'menu_area_simple') {
        const area = AREA_MAP_SIMPLE[cleanText];
        if (!area) {
          response =
            `⚠️ Opción no válida. Responde con:\n\n` +
            `*1* — Administrativo\n*2* — Farmacia`;
        } else {
          this._setStep(db, phone, 'ask_ticket_name', area, '{}');
          const ejemplos = AREA_EXAMPLES[area] || '';
          response =
            `👍 Área: *${AREA_NAMES[area]}*\n\n` +
            `*¿Cuál es tu nombre completo?*`;
        }

      /* ══════════════════════════════════════════════════════
         FLUJO PROBLEMA TÉCNICO — A: Selección de área (completa)
         ══════════════════════════════════════════════════════ */
      } else if (step === 'menu_area') {
        const area = AREA_MAP_FULL[cleanText];
        if (!area) {
          response =
            `⚠️ Opción no válida. Selecciona tu área (1–7):\n\n` +
            `*1* Cartera\n*2* Compra\n*3* Gestión Humana\n` +
            `*4* PQRS\n*5* Contabilidad\n*6* Farmacia\n*7* Cuentas Médicas`;
        } else {
          this._setStep(db, phone, 'ask_ticket_name', area, '{}');
          response =
            `👍 Área: *${AREA_NAMES[area]}*\n\n` +
            `👤 *¿Cuál es tu nombre completo?*`;
        }

      /* ══════════════════════════════════════════════════════
         FLUJO PROBLEMA TÉCNICO — A2: Nombre del solicitante
         ══════════════════════════════════════════════════════ */
      } else if (step === 'ask_ticket_name') {
        const area = session.area || 'general';
        const ctx  = this._ctx(session);
        ctx.requester_name = text.trim();
        this._setStep(db, phone, 'awaiting_description', area, JSON.stringify(ctx));
        const ejemplos = AREA_EXAMPLES[area] || '';
        response =
          `✅ Gracias, *${ctx.requester_name}*.\n\n` +
          `📝 *¿Qué problema tienes hoy?*\n\n` +
          (ejemplos ? `Casos frecuentes en tu área:\n${ejemplos}\n\n` : '') +
          `Descríbeme el problema con el mayor detalle posible _(programa, mensaje de error, qué hacías)_.\n\n` +
          `📸 También puedes enviar una *captura de pantalla* del error.`;

      /* ══════════════════════════════════════════════════════
         FLUJO PROBLEMA TÉCNICO — B: Descripción / imagen
         ══════════════════════════════════════════════════════ */
      } else if (step === 'awaiting_description') {
        const area = session.area || 'general';
        const ctx  = this._ctx(session);
        let aiSolution = null;
        let msgHeader  = '';
        let faqId      = null;
        let description = text;

        if (text === '__IMAGE__' && media?.imageBase64) {
          // ── Gemini Vision ──
          console.log(`[Bot] Imagen de ${phone} → Gemini Vision (área: ${area})`);
          aiSolution  = await getAISolutionFromImage(area, media.imageBase64, media.mimetype, media.caption || '');
          msgHeader   = aiSolution ? `🔍 *Análisis de tu captura (${AREA_NAMES[area] || area}):*\n\n` : '';
          description = media.caption ? `(captura de pantalla: ${media.caption})` : '(captura de pantalla)';
          // Guardar base64 en contexto para adjuntarlo al ticket cuando se cree
          ctx._imageBase64  = media.imageBase64;
          ctx._imageMimetype = media.mimetype || 'image/jpeg';
        } else {
          // ── 1. FAQ-first ──
          if (!ctx.faq_tried) {
            const results = searchFaqsAll(db, area, text);
            const topFaq  = results[0];

            if (topFaq && topFaq.score >= 5) {
              aiSolution = topFaq.solution;
              msgHeader  = `📋 *${topFaq.title}*\n\n`;
              faqId      = topFaq.id;
              try {
                db.prepare(`INSERT INTO faq_hits (faq_id, area, resolved, phone) VALUES (?,?,0,?)`)
                  .run(String(faqId), area, phone);
              } catch {}
              console.log(`[Bot] FAQ match: ${faqId} (score ${topFaq.score})`);
            }
          }
          // ── 2. Gemini fallback ──
          if (!aiSolution) {
            aiSolution = await getAISolution(area, text);
            msgHeader  = aiSolution ? `💡 *Pasos sugeridos para ${AREA_NAMES[area] || area}:*\n\n` : '';
          }
        }

        if (aiSolution) {
          const nextCtx = { description, area, faq_shown_id: faqId };
          if (ctx._imageBase64) { nextCtx._imageBase64 = ctx._imageBase64; nextCtx._imageMimetype = ctx._imageMimetype; }
          this._setStep(db, phone, 'ask_resolved', area, JSON.stringify(nextCtx));
          response =
            msgHeader + aiSolution + `\n\n` +
            `━━━━━━━━━━━━━━━\n` +
            `*¿Pudiste resolver el problema?*\n\n` +
            `*1️⃣* ✅ Sí, se solucionó\n` +
            `*2️⃣* ❌ No, el problema continúa\n` +
            `*3️⃣* 🔄 Mi problema es diferente`;
        } else {
          const nextCtx = { description, area };
          if (ctx._imageBase64) { nextCtx._imageBase64 = ctx._imageBase64; nextCtx._imageMimetype = ctx._imageMimetype; }
          this._setStep(db, phone, 'create_ticket', area, JSON.stringify(nextCtx));
          response =
            `No encontré solución automática para este caso. 🤔\n\n` +
            `Voy a crear un *ticket de soporte* directamente.\n` +
            `¿Tienes algún detalle adicional que agregar?\n\n` +
            `_(O responde *no* para crear el ticket ahora)_`;
        }

      /* ══════════════════════════════════════════════════════
         FLUJO PROBLEMA TÉCNICO — C: ¿Se resolvió?
         ══════════════════════════════════════════════════════ */
      } else if (step === 'ask_resolved') {
        const ctx  = this._ctx(session);
        const area = ctx.area || session.area || 'general';

        if (cleanText === '1' || /^s[íi]\b/i.test(cleanText)) {
          // Marcar FAQ como resuelto si fue mostrada
          if (ctx.faq_shown_id) {
            try {
              db.prepare(`
                UPDATE faq_hits SET resolved=1
                WHERE id = (
                  SELECT id FROM faq_hits
                  WHERE phone=? AND faq_id=? AND resolved=0
                  ORDER BY id DESC LIMIT 1
                )
              `).run(phone, String(ctx.faq_shown_id));
            } catch {}
          }
          this._setStep(db, phone, 'idle', null, '{}');
          response =
            `🎉 *¡Genial, problema resuelto!*\n\n` +
            `Me alegra haber podido ayudarte. Si tienes otra consulta, solo escribe *Hola*. ¡Buen día! 😊`;

        } else if (cleanText === '2' || /^no\b/i.test(cleanText)) {
          // ── Verificar ticket duplicado ──
          const existing = db.prepare(`
            SELECT ticket_number FROM tickets
            WHERE phone=? AND status IN ('abierto','en_progreso','en_espera')
            ORDER BY id DESC LIMIT 1
          `).get(phone);

          if (existing) {
            this._setStep(db, phone, 'confirm_dup_ticket', area, JSON.stringify(ctx));
            response =
              `⚠️ Ya tienes el ticket *${existing.ticket_number}* activo en el sistema.\n\n` +
              `¿Tu problema actual es *diferente* al de ese ticket?\n\n` +
              `*1️⃣* Sí, es un problema diferente — crear nuevo ticket\n` +
              `*2️⃣* No, es el mismo — agregar este mensaje al ticket existente`;
          } else {
            const priority = _detectPriority(ctx.description);
            const imageCtx = ctx._imageBase64 ? { base64: ctx._imageBase64, mimetype: ctx._imageMimetype } : null;
            const ticketId = await this._crearTicket(phone, area, ctx.description || '(sin descripción)', db, priority, ctx.requester_name, imageCtx, ctx._chatId || chatId);
            this._setStep(db, phone, 'idle', null, '{}');
            const { ticket_number } = db.prepare('SELECT ticket_number FROM tickets WHERE id=?').get(ticketId);
            response =
              `😔 Entendido. El equipo de IT tomará el caso directamente.\n\n` +
              `🎟️ *Ticket creado: ${ticket_number}*\n` +
              `📍 Área: ${AREA_NAMES[area] || area}\n` +
              (priority !== 'media' ? `⚡ Prioridad detectada: *${priority.toUpperCase()}*\n` : '') +
              `\nUn técnico se comunicará contigo a la brevedad. ¡Gracias por tu paciencia!`;
          }

        } else if (cleanText === '3' || /diferente|otro|distint/i.test(cleanText)) {
          this._setStep(db, phone, 'awaiting_description', area, JSON.stringify({ faq_tried: true }));
          response =
            `Entendido. 🔄\n\n` +
            `📝 *Descríbeme tu problema con más detalle:*\n\n` +
            `Incluye el programa o equipo, el mensaje de error exacto y qué acción realizabas.\n\n` +
            `📸 También puedes enviar una *captura de pantalla* del error.`;
        } else {
          response =
            `⚠️ Por favor responde con un número:\n\n` +
            `*1* — Sí, se solucionó ✅\n` +
            `*2* — No, el problema continúa ❌\n` +
            `*3* — Mi problema es diferente 🔄`;
        }

      /* ══════════════════════════════════════════════════════
         Confirmación de ticket duplicado
         ══════════════════════════════════════════════════════ */
      } else if (step === 'confirm_dup_ticket') {
        const ctx  = this._ctx(session);
        const area = ctx.area || session.area || 'general';

        if (cleanText === '1') {
          const priority = _detectPriority(ctx.description);
          const imageCtx = ctx._imageBase64 ? { base64: ctx._imageBase64, mimetype: ctx._imageMimetype } : null;
          const ticketId = await this._crearTicket(phone, area, ctx.description || '(sin descripción)', db, priority, ctx.requester_name, imageCtx, ctx._chatId || chatId);
          this._setStep(db, phone, 'idle', null, '{}');
          const { ticket_number } = db.prepare('SELECT ticket_number FROM tickets WHERE id=?').get(ticketId);
          response =
            `✅ Nuevo ticket creado: *${ticket_number}*\n` +
            `📍 Área: ${AREA_NAMES[area] || area}\n\n` +
            `Un técnico se comunicará contigo a la brevedad.`;

        } else if (cleanText === '2') {
          const existing = db.prepare(`
            SELECT * FROM tickets
            WHERE phone=? AND status IN ('abierto','en_progreso','en_espera')
            ORDER BY id DESC LIMIT 1
          `).get(phone);
          if (existing) {
            db.prepare(`INSERT INTO messages (ticket_id, sender_type, content) VALUES (?, 'user', ?)`)
              .run(existing.id, ctx.description || '(sin descripción)');
            db.prepare(`UPDATE tickets SET updated_at=datetime('now','localtime') WHERE id=?`)
              .run(existing.id);
            appEvents.emit('ticket:message', { ticketId: existing.id });
          }
          this._setStep(db, phone, 'idle', null, '{}');
          response =
            `📥 Mensaje agregado al ticket *${existing?.ticket_number || 'existente'}*.\n\n` +
            `El equipo de IT revisará la información adicional. ¡Gracias!`;
        } else {
          response =
            `⚠️ Responde *1* para crear un nuevo ticket o *2* para agregar al ticket existente.`;
        }

      /* ══════════════════════════════════════════════════════
         Crear ticket directo (fallback sin IA)
         ══════════════════════════════════════════════════════ */
      } else if (step === 'create_ticket') {
        const area   = session.area || 'general';
        const ctx    = this._ctx(session);
        const detail = /^no$/i.test(cleanText) ? (ctx.description || text) : text;

        const priority = _detectPriority(detail);
        const imageCtx = ctx._imageBase64 ? { base64: ctx._imageBase64, mimetype: ctx._imageMimetype } : null;
        const ticketId = await this._crearTicket(phone, area, detail, db, priority, ctx.requester_name, imageCtx, ctx._chatId || chatId);
        this._setStep(db, phone, 'idle', null, '{}');
        const { ticket_number } = db.prepare('SELECT ticket_number FROM tickets WHERE id=?').get(ticketId);
        response =
          `🎟️ *¡Ticket creado exitosamente!*\nNúmero de caso: *${ticket_number}*\n\n` +
          `El equipo de IT fue notificado. ¡Gracias por tu paciencia!`;

      /* ══════════════════════════════════════════════════════
         FLUJO REQUERIMIENTO TECNOLÓGICO
         ══════════════════════════════════════════════════════ */
      } else if (step === 'req_name') {
        const ctx = this._ctx(session);
        ctx.name = text;
        this._setStep(db, phone, 'req_cedula', null, JSON.stringify(ctx));
        response = `✅ Nombre: *${text}*\n\n*¿Cuál es tu número de cédula?*`;

      } else if (step === 'req_cedula') {
        const ctx = this._ctx(session);
        ctx.cedula = text;
        this._setStep(db, phone, 'req_cargo', null, JSON.stringify(ctx));
        response = `✅ Cédula: *${text}*\n\n*¿Cuál es tu cargo dentro de la empresa?*`;

      } else if (step === 'req_cargo') {
        const ctx = this._ctx(session);
        ctx.cargo = text;
        this._setStep(db, phone, 'req_desc', null, JSON.stringify(ctx));
        response =
          `✅ Cargo: *${text}*\n\n` +
          `📝 *¿Qué equipos o materiales necesitas?*\n\n` +
          `Incluye la cantidad y una descripción clara\n` +
          `(ej: _"2 mouses inalámbricos"_ o _"1 monitor 24 pulgadas"_).`;

      } else if (step === 'req_desc') {
        const ctx = this._ctx(session);
        ctx.description = text;
        const qtyMatch = text.match(/^\s*(\d+)\s+/);
        ctx.quantity = qtyMatch ? parseInt(qtyMatch[1]) : 1;

        const result = createTechRequest(db, {
          type:           'requerimiento',
          requester_name: ctx.name,
          cedula:         ctx.cedula,
          cargo:          ctx.cargo,
          sede:           ctx.sede,
          description:    text,
          quantity:       ctx.quantity,
          priority:       _detectPriority(text),
        });

        appEvents.emit('tech-request:created', {
          id: result.id, request_number: result.request_number, type: 'requerimiento',
        });

        this._setStep(db, phone, 'idle', null, '{}');
        response =
          `✅ *¡Requerimiento registrado exitosamente!*\n\n` +
          `📋 *N.º de solicitud:* ${result.request_number}\n\n` +
          `• 👤 *Nombre:* ${ctx.name}\n` +
          `• 🪪 *Cédula:* ${ctx.cedula}\n` +
          `• 💼 *Cargo:* ${ctx.cargo}\n` +
          `• 📍 *Sede:* ${ctx.sede}\n` +
          `• 📦 *Descripción:* ${text}\n\n` +
          `El equipo de IT revisará tu solicitud y te informará. ¡Gracias!`;

      /* ══════════════════════════════════════════════════════
         FLUJO INCIDENCIA (equipo con falla)
         ══════════════════════════════════════════════════════ */
      } else if (step === 'inc_name') {
        const ctx = this._ctx(session);
        ctx.name = text;
        this._setStep(db, phone, 'inc_cedula', null, JSON.stringify(ctx));
        response = `✅ Nombre: *${text}*\n\n*¿Cuál es tu número de cédula?*`;

      } else if (step === 'inc_cedula') {
        const ctx = this._ctx(session);
        ctx.cedula = text;
        this._setStep(db, phone, 'inc_cargo', null, JSON.stringify(ctx));
        response = `✅ Cédula: *${text}*\n\n*¿Cuál es tu cargo dentro de la empresa?*`;

      } else if (step === 'inc_cargo') {
        const ctx = this._ctx(session);
        ctx.cargo = text;
        this._setStep(db, phone, 'inc_equipo', null, JSON.stringify(ctx));
        response =
          `✅ Cargo: *${text}*\n\n` +
          `🖥️ *¿Cuál es el nombre o tipo del equipo con falla?*\n\n` +
          `Si conoces el serial o número de inventario, inclúyelo separado con un guión\n` +
          `(ej: _"PC HP EliteDesk - serial HP2024001"_).`;

      } else if (step === 'inc_equipo') {
        const ctx = this._ctx(session);
        const serialMatch = text.match(/[—\-–]\s*(?:serial|inv\.?|inventario)?\s*([A-Z0-9\-]+)\s*$/i);
        if (serialMatch) {
          ctx.equipment_name   = text.slice(0, text.lastIndexOf(serialMatch[0])).trim();
          ctx.equipment_serial = serialMatch[1].trim();
        } else {
          ctx.equipment_name   = text;
          ctx.equipment_serial = null;
        }
        this._setStep(db, phone, 'inc_desc', null, JSON.stringify(ctx));
        response =
          `✅ Equipo: *${ctx.equipment_name}*` +
          (ctx.equipment_serial ? `\n✅ Serial: *${ctx.equipment_serial}*` : '') +
          `\n\n⚠️ *Describe la falla del equipo.*\n\n` +
          `Indica qué sucede, desde cuándo ocurre y si muestra algún error.`;

      } else if (step === 'inc_desc') {
        const ctx = this._ctx(session);
        ctx.description = text;

        const result = createTechRequest(db, {
          type:             'incidencia',
          requester_name:   ctx.name,
          cedula:           ctx.cedula,
          cargo:            ctx.cargo,
          sede:             ctx.sede,
          description:      text,
          equipment_name:   ctx.equipment_name   || null,
          equipment_serial: ctx.equipment_serial || null,
          quantity:         1,
          priority:         _detectPriority(text),
        });

        appEvents.emit('tech-request:created', {
          id: result.id, request_number: result.request_number, type: 'incidencia',
        });

        this._setStep(db, phone, 'idle', null, '{}');
        response =
          `✅ *¡Incidencia registrada exitosamente!*\n\n` +
          `🔧 *N.º de solicitud:* ${result.request_number}\n\n` +
          `• 👤 *Nombre:* ${ctx.name}\n` +
          `• 🪪 *Cédula:* ${ctx.cedula}\n` +
          `• 💼 *Cargo:* ${ctx.cargo}\n` +
          `• 📍 *Sede:* ${ctx.sede}\n` +
          `• 🖥️ *Equipo:* ${ctx.equipment_name || 'N/A'}` +
          (ctx.equipment_serial ? ` (serial: ${ctx.equipment_serial})` : '') + `\n` +
          `• ⚠️ *Falla:* ${text}\n\n` +
          `El equipo de IT revisará el equipo y te informará. ¡Gracias!`;

      /* ══════════════════════════════════════════════════════
         PASO DESCONOCIDO — reiniciar
         ══════════════════════════════════════════════════════ */
      } else {
        this._setStep(db, phone, 'idle', null, '{}');
        response = `❓ No entendí eso. Escribe *Hola* para volver al menú principal.`;
      }

      // Actualizar actividad y limpiar aviso de inactividad si existía
      db.prepare(`
        UPDATE conversations
        SET last_activity = datetime('now','localtime'), warned_inactive = 0
        WHERE phone = ?
      `).run(phone);

    } catch (err) {
      console.error('[Chatbot] Error:', err);
      this._setStep(db, phone, 'idle', null, '{}');
      response = `❌ Ocurrió un error técnico. Por favor escribe *Hola* para reiniciar.`;
    }

    return response;
  }

  /* ─ Helpers privados ─────────────────────────────────────── */

  _routeAfterSede(flowType, sedeLabel, sedeRaw = '') {
    const confirma = `✅ Punto: *${sedeLabel}*\n\n`;
    const completa = isSedeCompleta(sedeRaw || sedeLabel);

    if (flowType === '1') {
      if (completa) {
        return {
          step: 'menu_area',
          msg:
            confirma +
            `🔧 *Soporte Técnico*\n\n*¿De qué área nos escribes?*\n\n` +
            `*1️⃣* Cartera\n*2️⃣* Compra\n*3️⃣* Gestión Humana\n` +
            `*4️⃣* PQRS\n*5️⃣* Contabilidad\n*6️⃣* Farmacia\n*7️⃣* Cuentas Médicas\n\n` +
            `_Responde con el número de tu área._`,
        };
      } else {
        return {
          step: 'menu_area_simple',
          msg:
            confirma +
            `🔧 *Soporte Técnico*\n\n*¿De qué área nos escribes?*\n\n` +
            `*1️⃣* Administrativo\n*2️⃣* Farmacia\n\n` +
            `_Responde con 1 o 2._`,
        };
      }
    }
    if (flowType === '2') {
      return {
        step: 'req_name',
        msg:
          confirma +
          `📋 *Solicitud de Requerimiento Tecnológico*\n\n` +
          `Voy a registrar tu solicitud. Te haré unas preguntas breves.\n\n` +
          `*¿Cuál es tu nombre completo?*`,
      };
    }
    return {
      step: 'inc_name',
      msg:
        confirma +
        `⚠️ *Reporte de Equipo con Falla*\n\n` +
        `Voy a registrar el equipo para revisión. Te haré unas preguntas breves.\n\n` +
        `*¿Cuál es tu nombre completo?*`,
    };
  }

  _setStep(db, phone, step, area = null, context = '{}') {
    db.prepare(`UPDATE conversations SET current_step=?, area=?, context=? WHERE phone=?`)
      .run(step, area, context, phone);
  }

  _ctx(session) {
    try { return JSON.parse(session.context || '{}'); } catch { return {}; }
  }

  async _crearTicket(phone, area, description, db, priority = 'media', requesterName = 'Empleado WhatsApp', imageCtx = null, chatId = null) {
    const dateStr      = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const like         = `TK-${dateStr}-%`;
    const last         = db.prepare('SELECT ticket_number FROM tickets WHERE ticket_number LIKE ? ORDER BY id DESC LIMIT 1').get(like);
    const nextNum      = last ? parseInt(last.ticket_number.split('-')[2]) + 1 : 1;
    const ticketNumber = `TK-${dateStr}-${String(nextNum).padStart(3, '0')}`;

    // Generar título con IA (no bloquea — usa fallback si falla)
    const title = await generateTicketTitle(area, description);

    db.prepare(`
      INSERT INTO tickets (ticket_number, phone, chat_id, requester_name, area, description, title, status, priority)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'abierto', ?)
    `).run(ticketNumber, phone, chatId || phone, requesterName, area, description, title, priority);

    const { id: ticketId } = db.prepare('SELECT last_insert_rowid() as id').get();

    if (imageCtx?.base64) {
      const attachment = JSON.stringify({ type: 'image', mimetype: imageCtx.mimetype || 'image/jpeg', base64: imageCtx.base64 });
      db.prepare(`INSERT INTO messages (ticket_id, sender_type, content, attachment) VALUES (?, 'user', '__IMAGE__', ?)`)
        .run(ticketId, attachment);
    } else {
      db.prepare(`INSERT INTO messages (ticket_id, sender_type, content) VALUES (?, 'user', ?)`)
        .run(ticketId, description);
    }

    logAudit('Bot WhatsApp', 'Ticket creado', 'ticket', ticketId, ticketNumber, { area, phone });
    appEvents.emit('ticket:created', { id: ticketId, ticket_number: ticketNumber, area, phone });
    return ticketId;
  }
}

export default Chatbot;
