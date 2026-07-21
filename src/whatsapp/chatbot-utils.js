/** Hora actual en Colombia (UTC-5) */
function coNow() {
  const now   = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  return new Date(utcMs - 5 * 3_600_000);
}

/**
 * 'open'    — dentro del horario normal (L-V 7:00–16:20)
 * 'closing' — pre-cierre 16:20–16:40
 * 'closed'  — fuera de horario / fin de semana
 */
export function getBusinessStatus() {
  const co  = coNow();
  const day = co.getDay();
  if (day === 0 || day === 6) return 'closed';
  const min = co.getHours() * 60 + co.getMinutes();
  if (min < 7 * 60)        return 'closed';
  if (min >= 16 * 60 + 40) return 'closed';
  if (min >= 16 * 60 + 20) return 'closing';
  return 'open';
}

/** Próximo día hábil en español */
export function nextBusinessDay() {
  const co   = coNow();
  const next = new Date(co);
  do { next.setDate(next.getDate() + 1); }
  while (next.getDay() === 0 || next.getDay() === 6);
  const DAYS   = ['domingo','lunes','martes','miércoles','jueves','viernes','sábado'];
  const MONTHS = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  return `${DAYS[next.getDay()]} ${next.getDate()} de ${MONTHS[next.getMonth()]}`;
}

/* Rate limiting: máx 20 msg/min por número */
const _rateMap = new Map();
export function checkRateLimit(phone) {
  const now = Date.now();
  let entry = _rateMap.get(phone);
  if (!entry || now > entry.resetAt) entry = { count: 0, resetAt: now + 60_000 };
  entry.count++;
  _rateMap.set(phone, entry);
  return entry.count <= 20;
}

/** Detección automática de prioridad por palabras clave */
export function detectPriority(text) {
  const normalized = (text || '').toLowerCase();
  if (/toda.{0,15}(sede|oficina)|sin internet.{0,10}todos|sistema.{0,10}cai[dó]|produccion.{0,10}parad|no podemos trabajar|perdida.{0,10}datos|todos los equipos|todos.{0,10}afectad/.test(normalized)) return 'critica';
  if (/urgente|bloqueado completamente|no funciona nada|desde ayer|toda la mañana|no puedo entrar|borro|eliminó/.test(normalized)) return 'alta';
  return 'media';
}
