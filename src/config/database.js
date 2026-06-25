import { DatabaseSync } from 'node:sqlite';
import fs   from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { migrations as m001 } from './migrations/001-base.js';
import { migrations as m002 } from './migrations/002-core.js';
import { migrations as m003 } from './migrations/003-auth.js';
import { migrations as m004 } from './migrations/004-inventario.js';
import { migrations as m005 } from './migrations/005-tracking.js';
import { migrations as m006 } from './migrations/006-monitoring.js';
import { migrations as m007 } from './migrations/007-knowledge.js';
import { migrations as m008 } from './migrations/008-despacho-extras.js';
import { migrations as m009 } from './migrations/009-requerimientos.js';
import { migrations as m010 } from './migrations/010-reuniones.js';
import { migrations as m011 } from './migrations/011-bodegas.js';
import { migrations as m012 } from './migrations/012-qr-activos.js';
import { migrations as m013 } from './migrations/013-agent-inventario.js';
import { migrations as m014 } from './migrations/014-celulares-placa.js';
import { migrations as m015 } from './migrations/015-employees-fix.js';
import { migrations as m016 } from './migrations/016-employees-permissions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const dbPath     = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.resolve(__dirname, '../../database/tickets.db');
const schemaPath = path.resolve(__dirname, '../../database/schema.sql');

const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = ON');
db.exec(fs.readFileSync(schemaPath, 'utf8'));

const allMigrations = [
  ...m001, ...m002, ...m003, ...m004, ...m005,
  ...m006, ...m007, ...m008, ...m009, ...m010, ...m011, ...m012, ...m013, ...m014, ...m015, ...m016,
];
for (const sql of allMigrations) {
  try { db.exec(sql); } catch { /* columna/tabla ya existe */ }
}

// Generar qr_token para equipos de inventario que no tienen uno
try {
  const { randomUUID } = await import('crypto');
  for (const tabla of ['inventario_equipos', 'inventario_celulares', 'inventario_ups']) {
    const sin = db.prepare(`SELECT id FROM ${tabla} WHERE qr_token IS NULL`).all();
    const upd = db.prepare(`UPDATE ${tabla} SET qr_token=? WHERE id=?`);
    for (const row of sin) upd.run(randomUUID(), row.id);
    if (sin.length) console.log(`[DB] ${sin.length} tokens QR generados en ${tabla}.`);
  }
} catch {}

// Limpiar sesiones expiradas al arrancar
try {
  db.exec("DELETE FROM sessions WHERE datetime(expires_at) <= datetime('now')");
} catch {}

// Poblar tabla bodegas desde Bodegas_Propios.xlsx si está vacía
const bodegasPath = path.resolve(__dirname, '../../Bodegas_Propios.xlsx');
const bodegasCount = db.prepare('SELECT COUNT(*) as n FROM bodegas').get().n;
if (bodegasCount === 0 && fs.existsSync(bodegasPath)) {
  try {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(bodegasPath);
    const ws = wb.getWorksheet(1);
    const ins = db.prepare('INSERT INTO bodegas (nombre, ciudad, activo) VALUES (?, ?, 1)');
    ws.eachRow((row, i) => {
      if (i === 1) return;
      const nombre = String(row.getCell(2).value || '').trim();
      const estado = String(row.getCell(4).value || '').trim();
      if (!nombre || estado !== 'A') return;
      const ciudad = nombre
        .replace(/^\d+\s+MI\s+FARMA?CIA\s+/i, '')
        .replace(/\s*\(?\s*FOMAG\s*\)?\s*$/i, '')
        .trim()
        .toUpperCase();
      ins.run(nombre, ciudad);
    });
    console.log(`[DB] Bodegas inicializadas desde Excel: ${db.prepare('SELECT COUNT(*) as n FROM bodegas').get().n} bodegas.`);
  } catch (e) {
    console.error('[DB] Error inicializando bodegas:', e.message);
  }
}

// Poblar tabla sedes desde datos estáticos si está vacía
const sedesCount = db.prepare('SELECT COUNT(*) as n FROM sedes').get().n;
if (sedesCount === 0) {
  const { CIUDADES } = await import('../whatsapp/sedes.js');
  const ins = db.prepare('INSERT INTO sedes (ciudad, nombre_punto) VALUES (?, ?)');
  for (const [ciudad, puntos] of Object.entries(CIUDADES)) {
    for (const punto of puntos) ins.run(ciudad, punto);
  }
  console.log(`[DB] Red de puntos inicializada: ${db.prepare('SELECT COUNT(*) as n FROM sedes').get().n} puntos.`);
}

export default db;
