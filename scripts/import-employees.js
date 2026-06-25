/**
 * Importa empleados desde Excel a la BD.
 * Hoja "Base": col B=cedula, C=nombre, D=cargo, E=area, F=usuario, G=contraseña, H=fecha
 * Hoja "Datos": col A=cargo, B=farmacia (para dropdowns)
 */

import ExcelJS from 'exceljs';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const dbPath   = path.join(ROOT, 'database', 'tickets.db');
const xlsxPath = path.join(ROOT, 'CREACION DE USUARIOS PERSONAL NUEVO (1).xlsx');

const db = new DatabaseSync(dbPath);
db.exec('PRAGMA foreign_keys = OFF'); // importar sin validar FKs

const wb = new ExcelJS.Workbook();
await wb.xlsx.readFile(xlsxPath);

// ── Cargos y Áreas desde hoja "Datos" ────────────────────────────────────────
const datosSheet = wb.getWorksheet('Datos');
let cargos = 0, areas = 0;

if (datosSheet) {
  const stmtC = db.prepare('INSERT OR IGNORE INTO employee_cargos (nombre) VALUES (?)');
  const stmtA = db.prepare('INSERT OR IGNORE INTO employee_areas (nombre) VALUES (?)');

  datosSheet.eachRow((row, n) => {
    if (n === 1) return;
    const cargo = String(row.getCell(1).value || '').trim();
    const area  = String(row.getCell(2).value || '').trim();
    if (cargo) { stmtC.run(cargo); cargos++; }
    if (area)  { stmtA.run(area);  areas++;  }
  });
}
console.log(`Cargos: ${cargos} procesados | Áreas: ${areas} procesadas`);

// ── Empleados desde hoja "Base" ───────────────────────────────────────────────
// Col: A=nro, B=cedula, C=nombre, D=cargo, E=area, F=usuario, G=contraseña, H=fecha
const baseSheet = wb.getWorksheet('Base');
let insertados = 0, omitidos = 0;

if (baseSheet) {
  const stmtCheck  = db.prepare('SELECT id FROM employees WHERE cedula = ?');
  const stmtInsert = db.prepare(`
    INSERT INTO employees (cedula, nombre_completo, cargo, area, usuario, contraseña, fecha_respuesta_soporte, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL)
  `);

  baseSheet.eachRow((row, n) => {
    if (n === 1) return; // header

    // Mapeo correcto: col B=2 cedula, C=3 nombre, D=4 cargo, E=5 area, F=6 usuario, G=7 contraseña, H=8 fecha
    const cedula  = String(row.getCell(2).value ?? '').trim();
    const nombre  = String(row.getCell(3).value ?? '').trim();
    const cargo   = String(row.getCell(4).value ?? '').trim();
    const area    = String(row.getCell(5).value ?? '').trim();
    const usuario = String(row.getCell(6).value ?? '').trim() || null;
    let   contra  = String(row.getCell(7).value ?? '').trim() || null;
    let   fecha   = row.getCell(8).value;

    // Validar cédula — solo dígitos, 8-12 chars
    if (!/^\d{8,12}$/.test(cedula)) { omitidos++; return; }
    if (!nombre || !cargo || !area)  { omitidos++; return; }

    // Convertir fecha serial Excel → string ISO si es Date
    if (fecha instanceof Date) {
      fecha = fecha.toISOString().slice(0, 10);
    } else if (fecha) {
      fecha = String(fecha).trim() || null;
    } else {
      fecha = null;
    }

    // Contraseña serial Excel (número > 40000 = fecha serial) → últimos 4 de cédula
    if (contra && /^\d+$/.test(contra) && Number(contra) > 40000) {
      contra = cedula.slice(-4);
    }

    // Saltar duplicados
    if (stmtCheck.get(cedula)) { omitidos++; return; }

    try {
      stmtInsert.run(cedula, nombre, cargo, area, usuario, contra, fecha);
      insertados++;
    } catch (e) {
      console.warn(`  ⚠ fila ${n} cédula ${cedula}: ${e.message}`);
      omitidos++;
    }
  });
}

console.log(`Empleados insertados: ${insertados} | Omitidos: ${omitidos}`);
console.log('✨ Done!');
process.exit(0);
