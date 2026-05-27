import dotenv from 'dotenv';
dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY;

/**
 * Modelos en orden de preferencia.
 * Si el primero devuelve 429 (cuota agotada), se intenta el siguiente.
 */
const MODELS = [
  'gemini-2.5-flash-lite',  // más ligero y rápido
  'gemini-2.5-flash',       // más capaz — fallback
];

/** Cooldown por modelo: timestamp hasta el que ese modelo está suspendido */
const _cooldownUntil = {};

/** Contexto operativo de cada área para enriquecer el prompt */
const AREA_NAMES = {
  cartera:        'Cartera',
  compra:         'Compras',
  gestion_humana: 'Gestión Humana',
  pqrs:           'PQRS',
  contabilidad:   'Contabilidad',
  farmacia:       'Farmacia',
  cuentas_medicas:'Cuentas Médicas',
  general:        'Soporte General IT',
};

const AREA_CONTEXT = {
  cartera:
    'Software de gestión de cobros y cartera, reportes de recaudo en PDF/Excel, ' +
    'conciliación de pagos, base de datos de clientes deudores.',
  compra:
    'Sistema de órdenes de compra, portal web de proveedores externos, ' +
    'flujos digitales de aprobación con firma de jefes, adjuntos en PDF.',
  gestion_humana:
    'Software de nómina (liquidación mensual), reloj biométrico de asistencia ' +
    'con lector de huella, portal de autogestión de empleados.',
  pqrs:
    'Sistema PQRS (Peticiones, Quejas, Reclamos y Sugerencias), registro de casos, ' +
    'asignación automática por área y seguimiento de respuestas.',
  contabilidad:
    'Software contable Siigo (u otro ERP), facturación electrónica DIAN, ' +
    'firma digital con token USB o en la nube, cierres contables y módulos fiscales.',
  farmacia:
    'Sistema de dispensación y facturación de medicamentos, lectores de códigos ' +
    'de barras USB, impresoras de etiquetas térmicas Zebra, impresoras Epson ' +
    'EcoTank (L1536, L11002, L1006, L400, L364, L3220, L2110) que usan tinta ' +
    'líquida en tanques (no cartuchos), inventario de medicamentos por lote.',
  cuentas_medicas:
    'Software de facturación médica, archivos RIPS (.AM .AP .US), ' +
    'plataformas web de EPS (muchas requieren Java / modo IE en Edge), ' +
    'firma digital y glosa electrónica.',
  general:
    'Equipos de cómputo Windows, impresoras de red HP/Kyocera (tóner) y ' +
    'Epson EcoTank (tinta líquida en tanques), Office 365, red corporativa y VPN.',
};

/**
 * Llama a Gemini con rotación de modelos.
 * Intenta MODELS[0] primero; si tiene 429, prueba MODELS[1], etc.
 * Retorna null si todos los modelos fallan.
 */
export async function getAISolution(area, description) {
  if (!API_KEY) {
    console.warn('[Gemini] GEMINI_API_KEY no configurado — revisa el .env.');
    return null;
  }

  const areaName    = AREA_NAMES[area]   || 'Soporte IT';
  const areaContext = AREA_CONTEXT[area] || AREA_CONTEXT.general;
  const now         = Date.now();

  const prompt =
`Eres el experto en soporte técnico IT de "Mi Farmacia", empresa colombiana del sector salud con múltiples sedes. El empleado trabaja en el área de *${areaName}*.

Contexto del área:
${areaContext}

El empleado reporta por WhatsApp:
"${description}"

TAREA: Escribe los pasos CONCRETOS que el empleado debe seguir AHORA MISMO en su puesto de trabajo para intentar resolver el problema antes de escalar a IT.

FORMATO OBLIGATORIO:
- Máximo 5 pasos numerados
- Cada paso: una ACCIÓN específica + qué debe VER o ESCUCHAR si funciona
- Para problemas de hardware (impresora, escáner, lector, tóner, tinta): describe físicamente DÓNDE y CÓMO
- Lenguaje simple, sin siglas técnicas
- Si necesita más contexto, haz solo UNA pregunta concreta al final
- NO empieces diciendo "Comunícate con IT" — eso es el último recurso

RESTRICCIONES:
- Máximo 160 palabras
- No repitas la descripción del problema
- Solo en español`;

  for (const model of MODELS) {
    // Si el modelo tiene cooldown activo, saltar al siguiente
    if (_cooldownUntil[model] && now < _cooldownUntil[model]) {
      const remaining = Math.ceil((_cooldownUntil[model] - now) / 1000);
      console.warn(`[Gemini] ${model} en cooldown (${remaining}s restantes), probando siguiente modelo…`);
      continue;
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          contents:         [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 420, temperature: 0.25 },
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        if (res.status === 429) {
          // Cooldown de 5 minutos para este modelo y probar el siguiente
          _cooldownUntil[model] = now + 5 * 60_000;
          console.warn(`[Gemini] Cuota agotada en ${model} (429). Cooldown 5 min. Probando siguiente modelo…`);
          continue;
        }
        console.error(`[Gemini] Error HTTP ${res.status} en ${model}:`, errBody.slice(0, 200));
        return null;
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) {
        console.warn(`[Gemini] Respuesta vacía de ${model}.`);
        continue;
      }

      console.log(`[Gemini] ✓ Solución generada con ${model} para área "${area}".`);
      return text;

    } catch (err) {
      console.error(`[Gemini] Error de red con ${model}:`, err.message);
    }
  }

  console.warn('[Gemini] Todos los modelos fallaron — usando fallback local.');
  return null;
}

/**
 * Analiza una imagen con Gemini Vision y devuelve pasos de solución.
 * Recibe imageBase64 (string base64 puro, sin prefijo data:…) y mimetype.
 */
export async function getAISolutionFromImage(area, imageBase64, mimetype = 'image/jpeg') {
  if (!API_KEY) return null;

  const areaName    = AREA_NAMES[area]   || 'Soporte IT';
  const areaContext = AREA_CONTEXT[area] || AREA_CONTEXT.general;

  const textPrompt =
`Eres el experto en soporte técnico IT de "Mi Farmacia", empresa colombiana del sector salud. El empleado trabaja en el área de *${areaName}*.

Contexto del área:
${areaContext}

El empleado ha enviado una captura de pantalla de su problema.

TAREA: Analiza la imagen y escribe los pasos CONCRETOS para resolver el error o problema visible.

FORMATO OBLIGATORIO:
- Máximo 5 pasos numerados
- Cada paso: acción específica + qué ver si funciona
- Lenguaje simple, sin siglas técnicas
- NO empieces con "Comunícate con IT"
- Máximo 160 palabras — solo en español`;

  // Modelos con soporte de visión (multimodal)
  const VISION_MODELS = ['gemini-2.5-flash', 'gemini-2.5-flash-lite'];
  const now = Date.now();

  for (const model of VISION_MODELS) {
    if (_cooldownUntil[model] && now < _cooldownUntil[model]) continue;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${API_KEY}`;

    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inlineData: { mimeType: mimetype, data: imageBase64 } },
              { text: textPrompt },
            ],
          }],
          generationConfig: { maxOutputTokens: 420, temperature: 0.25 },
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        if (res.status === 429) {
          _cooldownUntil[model] = now + 5 * 60_000;
          console.warn(`[Gemini Vision] Cuota agotada en ${model}. Cooldown 5 min.`);
          continue;
        }
        console.error(`[Gemini Vision] Error HTTP ${res.status} en ${model}:`, errBody.slice(0, 200));
        return null;
      }

      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (!text) { console.warn(`[Gemini Vision] Respuesta vacía de ${model}.`); continue; }

      console.log(`[Gemini Vision] ✓ Imagen analizada con ${model} para área "${area}".`);
      return text;

    } catch (err) {
      console.error(`[Gemini Vision] Error de red con ${model}:`, err.message);
    }
  }

  console.warn('[Gemini Vision] Todos los modelos fallaron.');
  return null;
}
