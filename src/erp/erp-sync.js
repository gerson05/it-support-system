/**
 * ERP sync — scrapes employee and sede data from GeneXus and upserts
 * into the local SQLite employees / puntos tables.
 *
 * Employee servlet URL: ERP_EMPLEADOS_OBJ env var (required for employee sync).
 * Field name mapping: ERP_FIELD_CEDULA, ERP_FIELD_NOMBRE, ERP_FIELD_CARGO, ERP_FIELD_AREA
 *
 * Sucursales (puntos) use the existing wwsucursales flow.
 */

import db from '../config/database.js';

// Field name defaults — override via env if GeneXus instance uses different names
const FIELD_CEDULA = process.env.ERP_FIELD_CEDULA || 'EMPCEDULA';
const FIELD_NOMBRE = process.env.ERP_FIELD_NOMBRE || 'EMPNOMBRE';
const FIELD_CARGO  = process.env.ERP_FIELD_CARGO  || 'EMPCARGO';
const FIELD_AREA   = process.env.ERP_FIELD_AREA   || 'EMPAREA';

const FIELD_SUC_COD  = process.env.ERP_FIELD_SUC_COD  || 'SUCCOD';
const FIELD_SUC_NOM  = process.env.ERP_FIELD_SUC_NOM  || 'SUCNOM';
const FIELD_SUC_CIU  = process.env.ERP_FIELD_SUC_CIU  || 'SUCCIU';

export const syncStatus = {
  running:   false,
  lastRun:   null,
  lastResult: null,  // { empleados: N, puntos: N, errors: [] }
};

/**
 * Sync employees from ERP into local employees table.
 * Returns { upserted, errors }.
 */
export async function syncEmpleados(client) {
  const servletObj = process.env.ERP_EMPLEADOS_OBJ;
  if (!servletObj) {
    return { upserted: 0, errors: ['ERP_EMPLEADOS_OBJ not configured — set env var to the employee panel servlet name'] };
  }

  const errors = [];
  let upserted = 0;

  try {
    const { html } = await client._loadPanel(servletObj, {});
    const rows = client._parseGridRows(html, [FIELD_CEDULA, FIELD_NOMBRE, FIELD_CARGO, FIELD_AREA]);

    const upsert = db.prepare(`
      INSERT INTO employees (cedula, nombre_completo, cargo, area)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(cedula) DO UPDATE SET
        nombre_completo = excluded.nombre_completo,
        cargo           = excluded.cargo,
        area            = excluded.area,
        updated_at      = datetime('now','localtime')
    `);

    for (const row of rows) {
      const cedula = row[FIELD_CEDULA]?.trim();
      const nombre = row[FIELD_NOMBRE]?.trim();
      if (!cedula || !nombre) continue;
      try {
        upsert.run(cedula, nombre, row[FIELD_CARGO]?.trim() || '', row[FIELD_AREA]?.trim() || '');
        upserted++;
      } catch (e) {
        errors.push(`Row cedula=${cedula}: ${e.message}`);
      }
    }
  } catch (e) {
    errors.push(`Employee panel error: ${e.message}`);
  }

  return { upserted, errors };
}

/**
 * Sync sucursales (puntos) from ERP into local puntos table.
 * Returns { upserted, errors }.
 */
export async function syncPuntos(client) {
  const errors = [];
  let upserted = 0;

  try {
    const { html } = await client._loadPanel('com.version8.wwsucursales', { SUCEST: 'A' });
    const rows = client._parseGridRows(html, [FIELD_SUC_COD, FIELD_SUC_NOM, FIELD_SUC_CIU]);

    const upsert = db.prepare(`
      INSERT INTO puntos (codigo, nombre, ciudad, activo)
      VALUES (?, ?, ?, 1)
      ON CONFLICT(codigo) DO UPDATE SET
        nombre  = excluded.nombre,
        ciudad  = excluded.ciudad,
        activo  = 1
    `);

    for (const row of rows) {
      const codigo = row[FIELD_SUC_COD]?.trim();
      const nombre = row[FIELD_SUC_NOM]?.trim();
      if (!codigo || !nombre) continue;
      try {
        upsert.run(codigo, nombre, row[FIELD_SUC_CIU]?.trim() || '');
        upserted++;
      } catch (e) {
        errors.push(`Punto codigo=${codigo}: ${e.message}`);
      }
    }
  } catch (e) {
    errors.push(`Sucursales panel error: ${e.message}`);
  }

  return { upserted, errors };
}

/**
 * Run full sync: authenticate → sync employees → sync puntos.
 * Updates syncStatus in place.
 */
export async function runFullSync(client) {
  if (syncStatus.running) return { skipped: true, reason: 'Sync already in progress' };
  if (!process.env.ERP_USER || !process.env.ERP_PASS) {
    return { skipped: true, reason: 'ERP_USER / ERP_PASS not configured' };
  }

  syncStatus.running = true;
  const started = new Date();
  const errors  = [];

  try {
    await client.authenticate();

    const [empResult, puntosResult] = await Promise.allSettled([
      syncEmpleados(client),
      syncPuntos(client),
    ]);

    const emp    = empResult.status    === 'fulfilled' ? empResult.value    : { upserted: 0, errors: [empResult.reason?.message] };
    const puntos = puntosResult.status === 'fulfilled' ? puntosResult.value : { upserted: 0, errors: [puntosResult.reason?.message] };

    errors.push(...(emp.errors || []), ...(puntos.errors || []));

    syncStatus.lastResult = {
      empleados: emp.upserted,
      puntos:    puntos.upserted,
      errors,
      duration:  Date.now() - started,
    };
    syncStatus.lastRun = started.toISOString();

    console.log(`[ERP Sync] empleados=${emp.upserted} puntos=${puntos.upserted} errors=${errors.length} (${Date.now() - started}ms)`);

    return syncStatus.lastResult;
  } catch (e) {
    const result = { empleados: 0, puntos: 0, errors: [e.message], duration: Date.now() - started };
    syncStatus.lastResult = result;
    syncStatus.lastRun    = started.toISOString();
    console.error('[ERP Sync] Failed:', e.message);
    return result;
  } finally {
    syncStatus.running = false;
  }
}

/**
 * Schedule automatic sync every N hours (default: 24h).
 * Call once at server startup.
 */
export function scheduleSync(client, intervalHours = 24) {
  if (!process.env.ERP_USER || !process.env.ERP_PASS) {
    console.log('[ERP Sync] Skipping schedule — ERP_USER/ERP_PASS not set');
    return;
  }
  const ms = intervalHours * 60 * 60 * 1000;
  console.log(`[ERP Sync] Scheduled every ${intervalHours}h`);
  setTimeout(async () => {
    await runFullSync(client);
    setInterval(() => runFullSync(client), ms);
  }, ms);
}
