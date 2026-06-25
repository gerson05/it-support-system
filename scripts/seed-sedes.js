/**
 * Sincroniza la tabla sedes desde Bodegas_Propios.xlsx.
 * Uso: node scripts/seed-sedes.js
 */
import { DatabaseSync } from 'node:sqlite';
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, '..');
const DB_PATH   = process.env.DATABASE_PATH || path.join(ROOT, 'database/tickets.db');
const EXCEL     = path.join(ROOT, 'Bodegas_Propios.xlsx');

const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA foreign_keys = ON');

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(EXCEL);
const ws = wb.getWorksheet(1);

const extractCiudad = (nombre) =>
  nombre
    .replace(/^\d+\s+MI\s+FARMA?CIA\s+/i, '')
    .replace(/\s*\(?\s*FOMAG\s*\)?\s*$/i, '')
    .trim()
    .toUpperCase();

db.exec('UPDATE sedes SET activo=0');

const stmtExists = db.prepare('SELECT id FROM sedes WHERE nombre_punto=?');
const stmtIns    = db.prepare('INSERT INTO sedes (ciudad, nombre_punto, activo) VALUES (?, ?, 1)');
const stmtUpd    = db.prepare('UPDATE sedes SET activo=1, ciudad=? WHERE nombre_punto=?');

let count = 0;
ws.eachRow((row, i) => {
  if (i === 1) return;
  const nombre = String(row.getCell(2).value || '').trim();
  const estado = String(row.getCell(4).value || '').trim();
  if (!nombre || estado !== 'A') return;
  const ciudad = extractCiudad(nombre);
  if (stmtExists.get(nombre)) stmtUpd.run(ciudad, nombre);
  else                        stmtIns.run(ciudad, nombre);
  count++;
});

console.log(`Sincronizadas ${count} sedes desde Bodegas_Propios.xlsx.`);
console.log(`Total activas en DB: ${db.prepare("SELECT COUNT(*) as n FROM sedes WHERE activo=1").get().n}`);
