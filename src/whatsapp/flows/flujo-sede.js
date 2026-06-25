import { setStep, getCtx }              from '../chatbot-session.js';
import { matchCiudad, getPuntosCiudad, displaySede } from '../sedes.js';
import { AREA_MAP_FULL, AREA_MAP_SIMPLE } from '../chatbot-config.js';

const SEDE_STEPS = new Set(['ask_ciudad', 'ask_ciudad_confirm', 'ask_punto', 'select_type']);

export function isSedeCompleta(sede) {
  return (sede || '').toUpperCase().includes('SEDE PRINCIPAL');
}

export function routeAfterSede(flowType, sedeLabel, sedeRaw = '') {
  const confirma = `✅ Punto: *${sedeLabel}*\n\n`;
  const completa = isSedeCompleta(sedeRaw || sedeLabel);

  if (flowType === '1') {
    return completa
      ? {
          step: 'menu_area',
          msg:
            confirma +
            `🔧 *Soporte Técnico*\n\n*¿De qué área nos escribes?*\n\n` +
            `*1️⃣* Cartera\n*2️⃣* Compra\n*3️⃣* Gestión Humana\n` +
            `*4️⃣* PQRS\n*5️⃣* Contabilidad\n*6️⃣* Farmacia\n*7️⃣* Cuentas Médicas\n\n` +
            `_Responde con el número de tu área._`,
        }
      : {
          step: 'menu_area_simple',
          msg:
            confirma +
            `🔧 *Soporte Técnico*\n\n*¿De qué área nos escribes?*\n\n` +
            `*1️⃣* Administrativo\n*2️⃣* Farmacia\n\n` +
            `_Responde con 1 o 2._`,
        };
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

export function handleSede(step, { text, cleanText, session, phone, db }) {
  if (!SEDE_STEPS.has(step)) return null;

  const ctx = getCtx(session);

  if (step === 'select_type') {
    const typeMap = { '1': 'soporte', '2': 'requerimiento', '3': 'incidencia' };
    if (typeMap[cleanText]) {
      setStep(db, phone, 'ask_ciudad', null, JSON.stringify({ flowType: cleanText }));
      return (
        `📍 *¿Desde qué ciudad nos escribes?*\n\n` +
        `Escribe el nombre de tu ciudad.\n` +
        `_Ej: Cali, Manizales, Pereira, Popayán, Dosquebradas_`
      );
    }
    return (
      `⚠️ Opción no válida. Responde con *1*, *2* o *3*:\n\n` +
      `*1️⃣* 🔧 Problema técnico\n` +
      `*2️⃣* 📋 Requerimiento de equipos\n` +
      `*3️⃣* ⚠️ Equipo con falla`
    );
  }

  if (step === 'ask_ciudad') {
    const ciudades = matchCiudad(text, db);
    if (ciudades.length === 0) {
      return (
        `❓ No encontré ninguna ciudad con "*${text}*".\n\n` +
        `Escribe el nombre de tu ciudad.\n` +
        `_Ej: Cali, Manizales, Pereira, Popayán, Pasto, Buenaventura_`
      );
    }
    if (ciudades.length > 1) {
      ctx.ciudad_candidates = ciudades;
      setStep(db, phone, 'ask_ciudad_confirm', null, JSON.stringify(ctx));
      const lista = ciudades.map((c, i) => `*${i + 1}️⃣* ${c}`).join('\n');
      return `⚠️ Encontré varias ciudades. ¿Cuál es la tuya?\n\n${lista}\n\n_Responde con el número._`;
    }
    const ciudad = ciudades[0];
    const puntos = getPuntosCiudad(ciudad, db);
    if (puntos.length === 1) {
      ctx.sede = puntos[0]; ctx.ciudad = ciudad;
      const { step: ns, msg } = routeAfterSede(ctx.flowType, displaySede(ctx.sede), ctx.sede);
      setStep(db, phone, ns, null, JSON.stringify(ctx));
      return `✅ Ciudad: *${ciudad}*\n\n` + msg;
    }
    ctx.ciudad = ciudad; ctx.punto_options = puntos;
    setStep(db, phone, 'ask_punto', null, JSON.stringify(ctx));
    const lista = puntos.map((p, i) => `*${i + 1}️⃣* ${displaySede(p)}`).join('\n');
    return `✅ Ciudad: *${ciudad}*\n\n📍 *¿Cuál es tu punto de atención?*\n\n${lista}\n\n_Responde con el número (ej. 1)_`;
  }

  if (step === 'ask_ciudad_confirm') {
    const idx   = parseInt(cleanText) - 1;
    const cands = ctx.ciudad_candidates || [];
    if (idx < 0 || idx >= cands.length) {
      const lista = cands.map((c, i) => `*${i + 1}️⃣* ${c}`).join('\n');
      return `⚠️ Opción no válida. Responde con un número:\n\n${lista}`;
    }
    const ciudad = cands[idx];
    const puntos = getPuntosCiudad(ciudad, db);
    delete ctx.ciudad_candidates;
    ctx.ciudad = ciudad;
    if (puntos.length === 1) {
      ctx.sede = puntos[0];
      const { step: ns, msg } = routeAfterSede(ctx.flowType, displaySede(ctx.sede), ctx.sede);
      setStep(db, phone, ns, null, JSON.stringify(ctx));
      return `✅ Ciudad: *${ciudad}*\n\n` + msg;
    }
    ctx.punto_options = puntos;
    setStep(db, phone, 'ask_punto', null, JSON.stringify(ctx));
    const lista = puntos.map((p, i) => `*${i + 1}️⃣* ${displaySede(p)}`).join('\n');
    return `✅ Ciudad: *${ciudad}*\n\n📍 *¿Cuál es tu punto de atención?*\n\n${lista}\n\n_Responde con el número (ej. 1)_`;
  }

  // ask_punto
  const idx    = parseInt(cleanText) - 1;
  const puntos = ctx.punto_options || [];
  if (idx < 0 || idx >= puntos.length) {
    const lista = puntos.map((p, i) => `*${i + 1}️⃣* ${displaySede(p)}`).join('\n');
    return `⚠️ Opción no válida. Responde con un número:\n\n${lista}`;
  }
  ctx.sede = puntos[idx];
  delete ctx.punto_options;
  const { step: ns, msg } = routeAfterSede(ctx.flowType, displaySede(ctx.sede), ctx.sede);
  setStep(db, phone, ns, null, JSON.stringify(ctx));
  return `✅ Punto: *${displaySede(ctx.sede)}*\n\n` + msg;
}
