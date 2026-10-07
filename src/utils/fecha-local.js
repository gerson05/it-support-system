// Fechas en hora local (Colombia, ver src/config/timezone.js).
// No usar toISOString() para fechas que ve el usuario: devuelve UTC (5 h adelante).

const pad = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' en hora local. */
export function fechaLocal(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** 'YYYYMMDD' en hora local (para números de ticket, despacho, etc.). */
export function fechaCompacta(d = new Date()) {
  return fechaLocal(d).replace(/-/g, '');
}

/** 'YYYY-MM-DD HH:MM:SS' en hora local (mismo formato que datetime('now','localtime')). */
export function fechaHoraLocal(d = new Date()) {
  return `${fechaLocal(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
