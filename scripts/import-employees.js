#!/usr/bin/env node

/**
 * Script para importar datos de empleados desde Excel
 * Uso: node scripts/import-employees.js
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseSync } from 'node:sqlite';
import fs from 'fs';
import { importEmployeeDataFromExcel } from '../src/employees/employees-import.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta del archivo Excel a importar
const EXCEL_FILE = path.resolve(__dirname, '../CREACION DE USUARIOS PERSONAL NUEVO (1).xlsx');

// Ruta de la base de datos
const DATABASE_PATH = path.resolve(__dirname, '../database/tickets.db');

async function main() {
  try {
    // Verificar que el archivo Excel existe
    if (!fs.existsSync(EXCEL_FILE)) {
      console.error(`❌ Archivo Excel no encontrado: ${EXCEL_FILE}`);
      process.exit(1);
    }

    // Abrir la base de datos
    const db = new DatabaseSync(DATABASE_PATH);
    db.exec('PRAGMA foreign_keys = ON');

    console.log('🚀 Iniciando importación de empleados...');
    console.log(`📁 Archivo: ${EXCEL_FILE}`);
    console.log(`📊 Base de datos: ${DATABASE_PATH}`);
    console.log('');

    // Ejecutar la importación
    const result = await importEmployeeDataFromExcel(EXCEL_FILE, db);

    console.log('');
    console.log('📊 Resumen de importación:');
    console.log(`  - Cargos nuevos: ${result.cargosNuevos}`);
    console.log(`  - Áreas nuevas: ${result.areasNuevas}`);
    console.log(`  - Empleados insertados: ${result.empleadosInsertados}`);
    console.log(`  - Empleados omitidos: ${result.empleadosSkipped}`);

    // Verificar resultados en BD
    const countEmpleados = db.prepare('SELECT COUNT(*) as cnt FROM employees').get();
    const countCargos = db.prepare('SELECT COUNT(*) as cnt FROM employee_cargos').get();
    const countAreas = db.prepare('SELECT COUNT(*) as cnt FROM employee_areas').get();

    console.log('');
    console.log('📈 Estado de la base de datos:');
    console.log(`  - Total empleados: ${countEmpleados.cnt}`);
    console.log(`  - Total cargos: ${countCargos.cnt}`);
    console.log(`  - Total áreas: ${countAreas.cnt}`);

    db.close();

    console.log('');
    console.log('✨ Done!');
    process.exit(0);
  } catch (err) {
    console.error('❌ Error durante la importación:', err.message);
    if (err.stack) console.error(err.stack);
    process.exit(1);
  }
}

main();
