/**
 * Importar datos de empleados desde Excel
 * Lee hojas "Datos" y "Base" del archivo Excel
 * - Datos: extrae CARGO y FARMACIAS, desduplicar e insertar en employee_cargos/employee_areas
 * - Base: extrae 10 campos, valida, verifica cédula no existe, inserta empleados
 */

import ExcelJS from 'exceljs';
import fs from 'fs';

export async function importEmployeeDataFromExcel(filePath, db) {
  try {
    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
      throw new Error(`Archivo no encontrado: ${filePath}`);
    }

    // Leer el archivo Excel
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    // ============================================================================
    // PASO 1: Procesar hoja "Datos" (CARGO y FARMACIAS)
    // ============================================================================
    let cargosNuevos = 0;
    let areasNuevas = 0;

    const datosWorksheet = workbook.getWorksheet('Datos');
    if (datosWorksheet) {
      // Extraer CARGO (columna única)
      const cargos = new Set();
      datosWorksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Saltar encabezado
        const cargo = String(row.getCell('A').value || '').trim();
        if (cargo && cargo !== '' && cargo !== 'CARGO') {
          cargos.add(cargo);
        }
      });

      // Insertar cargos nuevos
      const stmtCargo = db.prepare(`
        INSERT OR IGNORE INTO employee_cargos (nombre) VALUES (?)
      `);
      cargos.forEach(cargo => {
        try {
          const result = stmtCargo.run(cargo);
          if (result.changes > 0) cargosNuevos++;
        } catch (e) {
          // Ya existe
        }
      });

      // Extraer FARMACIAS (columna única)
      const farmacias = new Set();
      datosWorksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Saltar encabezado
        const farmacia = String(row.getCell('B').value || '').trim();
        if (farmacia && farmacia !== '' && farmacia !== 'FARMACIAS') {
          farmacias.add(farmacia);
        }
      });

      // Insertar áreas nuevas
      const stmtArea = db.prepare(`
        INSERT OR IGNORE INTO employee_areas (nombre) VALUES (?)
      `);
      farmacias.forEach(area => {
        try {
          const result = stmtArea.run(area);
          if (result.changes > 0) areasNuevas++;
        } catch (e) {
          // Ya existe
        }
      });

      console.log(`✅ Cargos: ${cargosNuevos} nuevos`);
      console.log(`✅ Áreas: ${areasNuevas} nuevas`);
    }

    // ============================================================================
    // PASO 2: Procesar hoja "Base" (empleados)
    // ============================================================================
    let empleadosInsertados = 0;
    let empleadosSkipped = 0;

    const baseWorksheet = workbook.getWorksheet('Base');
    if (baseWorksheet) {
      // Obtener admin user si existe
      let adminUserId = null;
      try {
        const adminUser = db.prepare(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`).get();
        adminUserId = adminUser ? adminUser.id : null;
      } catch (e) {
        // Tabla users no existe o error
      }

      // Usar user_id 1 si no hay admin
      const createdBy = adminUserId || 1;

      // Preparar statement de inserción
      const stmtInsert = db.prepare(`
        INSERT INTO employees (
          cedula,
          nombre_completo,
          cargo,
          area,
          usuario,
          contraseña,
          fecha_respuesta_soporte,
          created_by,
          created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now','localtime'))
      `);

      // Preparar statement para verificar cédula
      const stmtCheckCedula = db.prepare(`
        SELECT COUNT(*) as cnt FROM employees WHERE cedula = ?
      `);

      baseWorksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Saltar encabezado

        const cedula = String(row.getCell('A').value || '').trim();
        const nombre = String(row.getCell('B').value || '').trim();
        const cargo = String(row.getCell('C').value || '').trim();
        const area = String(row.getCell('D').value || '').trim();
        const usuario = String(row.getCell('E').value || '').trim();
        const contraseña = String(row.getCell('F').value || '').trim();
        const fecha = String(row.getCell('G').value || '').trim();

        // Validar campos no vacíos
        if (!cedula || !nombre || !cargo || !area || !usuario || !contraseña) {
          if (cedula || nombre || cargo || area || usuario || contraseña) {
            console.warn(`⚠️  Fila ${rowNumber}: campos vacíos, omitiendo`);
          }
          empleadosSkipped++;
          return;
        }

        // Verificar que cédula no existe
        const cedulaExists = stmtCheckCedula.get(cedula);
        if (cedulaExists.cnt > 0) {
          console.warn(`⚠️  Cédula ${cedula} ya existe, omitiendo`);
          empleadosSkipped++;
          return;
        }

        // Insertar empleado
        try {
          const result = stmtInsert.run(
            cedula,
            nombre,
            cargo,
            area,
            usuario,
            contraseña,
            fecha || null,
            createdBy
          );
          if (result.changes > 0) empleadosInsertados++;
        } catch (e) {
          console.warn(`⚠️  Error insertando cédula ${cedula}: ${e.message}`);
          empleadosSkipped++;
        }
      });

      console.log(`✅ Empleados: ${empleadosInsertados} nuevos`);
      if (empleadosSkipped > 0) {
        console.log(`⚠️  Empleados: ${empleadosSkipped} omitidos`);
      }
    }

    return {
      cargosNuevos,
      areasNuevas,
      empleadosInsertados,
      empleadosSkipped
    };
  } catch (err) {
    console.error('❌ Error en importEmployeeDataFromExcel:', err.message);
    throw err;
  }
}
