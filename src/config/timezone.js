/**
 * Zona horaria de la aplicación: Colombia (UTC-5, sin horario de verano).
 * Se importa antes que todo lo demás en server.js para que fechas locales,
 * SQLite 'localtime' y toLocaleString usen la hora de Colombia aunque el
 * contenedor esté en UTC.
 */
export const APP_TZ = 'America/Bogota';
/** Desfase fijo para la sesión de MariaDB (Colombia no tiene horario de verano). */
export const APP_UTC_OFFSET = '-05:00';

if (!process.env.TZ) process.env.TZ = APP_TZ;
