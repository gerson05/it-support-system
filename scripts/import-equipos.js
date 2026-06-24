#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import ExcelJS from 'exceljs';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../database/tickets.db');
const equiposDir = path.resolve(__dirname, '../equipos');

const db = new DatabaseSync(dbPath);

// ═════════════════════════════════════════════════════════════════
// PARSERS
// ═════════════════════════════════════════════════════════════════

function parseTxtFile(filePath) {
  const txt = fs.readFileSync(filePath, 'utf8');
  const data = {};

  // Extraer nombre de host
  const hostMatch = txt.match(/Nombre de host:\s*(.+)/);
  if (hostMatch) data.hostname = hostMatch[1].trim();

  // Extraer fabricante
  const fabricanteMatch = txt.match(/Fabricante del sistema:\s*(.+)/);
  if (fabricanteMatch) data.fabricante = fabricanteMatch[1].trim();

  // Extraer modelo
  const modelMatch = txt.match(/Modelo el sistema:\s*(.+)/);
  if (modelMatch) data.modelo = modelMatch[1].trim();

  // Extraer CPU
  const cpuMatch = txt.match(/\[01\]:\s*(.+?)(?:\n|$)/);
  if (cpuMatch) data.procesador = cpuMatch[1].trim();

  // Extraer RAM
  const ramMatch = txt.match(/Cantidad total de memoria física:\s*(.+)/);
  if (ramMatch) data.ram = ramMatch[1].trim();

  // Extraer disco
  const discoMatch = txt.match(/Model\s+:\s*(.+?)(?:\n|Serial)/s);
  if (discoMatch) {
    const lines = discoMatch[1].split('\n');
    if (lines[0]) data.disco = lines[0].trim();
  }

  const serialMatch = txt.match(/SerialNumber\s+:\s*(.+)/);
  if (serialMatch) data.serial = serialMatch[1].trim();

  return data;
}

async function parseXlsxFile(filePath, sede) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];

  const data = { sede };

  // Procesar todas las celdas buscando labels y sus valores (columna contigua o misma fila)
  ws.eachRow((row, i) => {
    row.eachCell((cell, col) => {
      const cellVal = String(cell.value || '').toLowerCase().trim();

      // Buscar labels conocidos y extraer valores de columna contigua
      if (cellVal.includes('marca:') && !data.marca) {
        const nextVal = row.getCell(col + 1)?.value || row.getCell(col + 2)?.value;
        if (nextVal) data.marca = String(nextVal).trim();
      }
      if (cellVal.includes('modelo:') && !data.modelo) {
        const nextVal = row.getCell(col + 1)?.value || row.getCell(col + 2)?.value;
        if (nextVal) data.modelo = String(nextVal).trim();
      }
      if (cellVal.includes('procesador') && !data.procesador) {
        const nextVal = row.getCell(col + 1)?.value || row.getCell(col + 2)?.value;
        if (nextVal) data.procesador = String(nextVal).trim();
      }
      if (cellVal.includes('ram') && !data.ram) {
        const nextVal = row.getCell(col + 1)?.value || row.getCell(col + 2)?.value;
        if (nextVal) data.ram = String(nextVal).trim();
      }
      if (cellVal.includes('disco') && !data.disco) {
        const nextVal = row.getCell(col + 1)?.value || row.getCell(col + 2)?.value;
        if (nextVal) data.disco = String(nextVal).trim();
      }
      if (cellVal.includes('serie:') && !data.serie) {
        const nextVal = row.getCell(col + 1)?.value || row.getCell(col + 2)?.value;
        if (nextVal && String(nextVal).toUpperCase() !== 'GENERICA') {
          data.serie = String(nextVal).trim();
        }
      }
      if (cellVal.includes('equipo:') && !data.equipo && col <= 5) {
        const nextVal = row.getCell(col + 1)?.value || row.getCell(col + 2)?.value;
        if (nextVal) data.equipo = String(nextVal).trim();
      }
    });
  });

  return data;
}

// ═════════════════════════════════════════════════════════════════
// MAIN IMPORT
// ═════════════════════════════════════════════════════════════════

async function importEquipos() {
  console.log('🔄 Iniciando importación de equipos...\n');

  const sedes = fs.readdirSync(equiposDir)
    .filter(f => fs.statSync(path.join(equiposDir, f)).isDirectory())
    .sort();

  let totalImported = 0;

  for (const sede of sedes) {
    const sedePath = path.join(equiposDir, sede);
    console.log(`📍 Sede: ${sede}`);

    // Procesar archivos .txt
    const txtDir = path.join(sedePath, 'txt');
    if (fs.existsSync(txtDir)) {
      const txtFiles = fs.readdirSync(txtDir).filter(f => f.endsWith('.txt'));
      for (const txtFile of txtFiles) {
        try {
          const data = parseTxtFile(path.join(txtDir, txtFile));
          if (!data.serial || data.serial === 'System Serial Number') {
            console.log(`  ⚠️  ${txtFile}: serial vacío, saltando`);
            continue;
          }

          const placa = `AF-${sede.substring(0, 3).toUpperCase()}-${totalImported + 1}`.replace(/\s+/g, '');
          const qrToken = randomUUID();

          db.prepare(`
            INSERT OR IGNORE INTO inventario_equipos
            (placa, marca, nombre_equipo, serial, procesador, ram, cap_disco, tipo_disco, area, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
          `).run(
            placa,
            data.fabricante || 'N/A',
            data.hostname || data.modelo || 'Desktop',
            data.serial,
            data.procesador || '',
            data.ram || '',
            data.disco || '',
            'HDD/SSD',
            sede
          );

          console.log(`  ✅ ${txtFile}: importado como ${placa}`);
          totalImported++;
        } catch (e) {
          console.log(`  ❌ ${txtFile}: ${e.message}`);
        }
      }
    }

    // Procesar archivos .xlsx
    const xlsxFiles = fs.readdirSync(sedePath)
      .filter(f => f.endsWith('.xlsx') && !f.startsWith('~'))
      .slice(0, 5); // Limitar a 5 por sede para prueba rápida

    for (const xlsxFile of xlsxFiles) {
      try {
        const data = await parseXlsxFile(path.join(sedePath, xlsxFile), sede);
        // Validar que tengamos al menos modelo O equipo + serie
        if (!data.modelo && !data.equipo) {
          console.log(`  ⚠️  ${xlsxFile}: sin modelo/equipo`);
          continue;
        }

        const placa = `AF-${sede.substring(0, 3).toUpperCase()}-${totalImported + 1}`.replace(/\s+/g, '');
        const nombreEquipo = data.modelo || data.equipo || 'Desktop';
        const serial = data.serie && String(data.serie).toUpperCase() !== 'GENERICA'
          ? data.serie
          : `SN-${placa}`;

        db.prepare(`
          INSERT OR IGNORE INTO inventario_equipos
          (placa, marca, nombre_equipo, serial, procesador, ram, cap_disco, tipo_disco, area, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', 'localtime'))
        `).run(
          placa,
          data.marca || 'N/A',
          nombreEquipo,
          serial,
          data.procesador || '',
          data.ram || '',
          data.disco || '',
          'HDD/SSD',
          sede
        );

        console.log(`  ✅ ${xlsxFile}: importado como ${placa}`);
        totalImported++;
      } catch (e) {
        console.log(`  ❌ ${xlsxFile}: ${e.message}`);
      }
    }

    console.log('');
  }

  console.log(`\n✅ Importación completada: ${totalImported} equipos`);
  db.close();
}

importEquipos().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
